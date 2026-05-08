/**
 * buildRecommendationVerdict.ts
 *
 * Produces the single locked RecommendationVerdictV1 and the
 * CustomerPresentationV1 derived from it.
 *
 * Decision precedence — applied in strict order, earlier tiers override later:
 *   Tier 1  Hard rejections   — physically impossible systems (RedFlagModule / limiter hard-stops)
 *   Tier 2  Conditional flags — possible only after enabling works (flagAshp, etc.)
 *   Tier 3  Demand / performance fit — physics evidence from RecommendationResult
 *   Tier 4  Lifestyle preference    — occupancy-signal modifier (fast_reheat, etc.)
 *   Tier 5  Efficiency / eco / cost — secondary scoring dimension
 *
 * Rule: lifestyle preference is a modifier. It may only break ties among
 * equally-ranked candidates that have already passed Tiers 1–3.
 * It must never override a hard rejection or a physics-based ranking decision.
 */

import type { EngineInputV2_3, FullEngineResult } from '../schema/EngineInputV2_3';

type FullEngineResultWithoutVerdict = Omit<FullEngineResult, 'verdictV1'>;
import type { ApplianceFamily } from '../topology/SystemTopology';
import type {
  RecommendationVerdictV1,
  CustomerPresentationV1,
  RejectedSystem,
  FlaggedSystem,
} from './RecommendationVerdictV1';
import { buildCustomerFacingRecommendationLabel, type DhwSubtypeContext } from './buildCustomerFacingRecommendationLabel';

// ─── Family label helper ──────────────────────────────────────────────────────

/**
 * Returns the customer-facing label for a family, using
 * buildCustomerFacingRecommendationLabel as the single source of truth.
 * No local label map is maintained here — all copies go through the resolver.
 */
function familyLabel(family: ApplianceFamily, dhwSubtype?: DhwSubtypeContext): string {
  return buildCustomerFacingRecommendationLabel(family, dhwSubtype);
}

/**
 * Derive the DHW subtype context for a recommended family from the engine input.
 *
 * When the recommended family is 'system' but the current heat source is a
 * regular (heat-only) boiler with an unvented cylinder, the label must say
 * "Regular boiler with unvented cylinder" rather than "System boiler…" —
 * these are physically different appliances at different price points.
 *
 * The 'regular_unvented' subtype signals this like-for-like topology so that
 * buildCustomerFacingRecommendationLabel emits the correct customer label.
 */
function deriveDhwSubtype(
  family: ApplianceFamily,
  input: EngineInputV2_3,
): DhwSubtypeContext | undefined {
  if (
    family === 'system' &&
    input.currentHeatSourceType === 'regular' &&
    (input.dhwStorageType === 'unvented' || input.dhwStorageType === 'mixergy')
  ) {
    return 'regular_unvented';
  }
  return undefined;
}

// ─── Hard-rejection map ───────────────────────────────────────────────────────

/**
 * Derive hard-rejected families from RedFlagModule output and combi DHW flags.
 * Applies Tier 1 precedence — these systems cannot be recommended under any
 * circumstances without the constraint being resolved first.
 */
function deriveRejectedSystems(result: FullEngineResultWithoutVerdict, _input: EngineInputV2_3): RejectedSystem[] {
  const rejected: RejectedSystem[] = [];
  const { redFlags } = result;

  if (redFlags.rejectCombi) {
    // Only hard-reject combi when it is a genuine physics impossibility.
    // `rejectCombi` fires for two distinct conditions in RedFlagModule:
    //   1. dynamicMainsPressure < 0.3 bar — the burner cannot fire at this
    //      pressure; hot-water delivery is physically impossible.  This warrants
    //      a Tier-1 hard rejection at the verdict level.
    //   2. bathroomCount >= 2 && highOccupancy — a demand-side advisory.  This
    //      is already penalised by the limiter ledger (combi_dhw_demand_risk at
    //      'limit' severity), which reduces combi's ranking score so that stored
    //      options win for large/multi-outlet households.  Hard-rejecting combi
    //      here as well would prevent it from being recommended when stored
    //      options face their own hard constraints (e.g. space_for_cylinder_
    //      unavailable), which the limiter ledger correctly handles by scoring
    //      those options lower than combi.  The scoring engine, not a blanket
    //      exclusion, should resolve this trade-off.
    const isPhysicsImpossible = _input.dynamicMainsPressure < 0.3;
    if (isPhysicsImpossible) {
      const reason = redFlags.reasons.find(r => r.includes('Combi')) ??
        'Combi on-demand flow cannot serve this home under physics constraints.';
      rejected.push({
        family: 'combi',
        reasonId: 'combi_rejected_physics',
        reason,
      });
    }
  }

  if (redFlags.rejectAshp) {
    const reason = redFlags.reasons.find(r => r.includes('ASHP Hard Fail') || r.includes('One-pipe')) ??
      'ASHP cannot operate on this pipework topology.';
    rejected.push({
      family: 'heat_pump',
      reasonId: 'ashp_rejected_one_pipe',
      reason,
    });
  }

  if (redFlags.rejectStored || redFlags.rejectVented) {
    const reason = redFlags.reasons.find(r => r.includes('Stored Cylinder') || r.includes('Loft')) ??
      'Vented stored cylinder is not suitable due to building changes.';
    rejected.push({
      family: 'regular',
      reasonId: 'stored_rejected_loft',
      reason,
    });
    rejected.push({
      family: 'open_vented',
      reasonId: 'open_vented_rejected_loft',
      reason,
    });
  }

  // Also reject any family whose bestOverall is disqualified by hard-stop limiters
  for (const decision of result.recommendationResult.disqualifiedCandidates) {
    const alreadyRejected = rejected.some(r => r.family === decision.family);
    if (!alreadyRejected) {
      const primaryLimiter = decision.evidenceTrace.hardStopLimiters[0] ?? 'hard_stop';
      const caveat = decision.caveats[0] ?? `${familyLabel(decision.family)} is not advised for this home.`;
      rejected.push({
        family: decision.family,
        reasonId: primaryLimiter,
        reason: caveat,
      });
    }
  }

  return rejected;
}

// ─── Conditional / flagged systems ───────────────────────────────────────────

/**
 * Derive conditionally possible (flagged) systems from RedFlagModule.
 * Applies Tier 2 precedence — these may only appear in `futurePath`.
 */
function deriveFlaggedSystems(result: FullEngineResultWithoutVerdict, _input: EngineInputV2_3): FlaggedSystem[] {
  const flagged: FlaggedSystem[] = [];
  const { redFlags } = result;

  // flagAshp without rejectAshp means: ASHP is possible but requires pipework upgrades.
  if (redFlags.flagAshp && !redFlags.rejectAshp) {
    // Rewrite any technical reason text into customer-safe behavioural language.
    // Technical details (pipe sizes, ΔT, L/min) belong in the engineer report only.
    const rawReason = redFlags.reasons.find(r => r.includes('ASHP Flagged') || r.includes('22mm'));
    const workNote = rawReason != null
      ? 'A heat pump would require major pipework upgrades to perform properly here.'
      : 'A heat pump would require major pipework upgrades to perform properly here.';
    flagged.push({
      family: 'heat_pump',
      flagId: 'ashp_pipework_flag',
      requiredWork: workNote,
    });
  }

  return flagged;
}

// ─── Main verdict builder ─────────────────────────────────────────────────────

/**
 * Build the single locked RecommendationVerdictV1 from a FullEngineResult.
 *
 * Precedence tiers are applied in strict order.  The recommended family is
 * resolved as follows:
 *
 *   1. Start with `recommendationResult.bestOverall.family` (Tier 3 winner).
 *   2. If that family is hard-rejected (Tier 1), promote the next suitable
 *      candidate that is not hard-rejected.
 *   3. If no un-rejected candidate is suitable, return null.
 *
 * Lifestyle needs (Tier 4) only break ties when two candidates have equal
 * overall scores and neither is rejected or flagged.
 */
export function buildRecommendationVerdict(
  result: FullEngineResultWithoutVerdict,
  input: EngineInputV2_3,
): RecommendationVerdictV1 {
  const rejectedSystems = deriveRejectedSystems(result, input);
  const flaggedSystems = deriveFlaggedSystems(result, input);
  const rejectedFamilies = new Set(rejectedSystems.map(r => r.family));
  const flaggedFamilies = new Set(flaggedSystems.map(f => f.family));

  // ── Tier 3: demand/performance winner from evidence-backed ranking ──────────
  const { allDecisions, bestOverall, confidenceSummary } = result.recommendationResult;

  // Build ordered list of candidates, excluding hard-rejected and flagged.
  // allDecisions is already sorted by overallScore descending.
  const eligibleCandidates = allDecisions.filter(
    d => !rejectedFamilies.has(d.family) && !flaggedFamilies.has(d.family) &&
         d.suitability !== 'not_recommended',
  );

  // ── Tier 4: lifestyle modifier — only breaks score ties ────────────────────
  const lifestyleNeeds = result.lifestyle.lifestyleNeeds;
  const lifestylePreferredFamily: ApplianceFamily | null =
    lifestyleNeeds.includes('fast_reheat') ? 'combi' :
    lifestyleNeeds.includes('steady_low_temp') ? 'heat_pump' :
    lifestyleNeeds.includes('stored_resilience') ? 'system' :
    null;

  // Apply lifestyle as a tiebreaker only — if two candidates share the same
  // integer-rounded overall score, prefer the lifestyle-preferred family.
  let recommendedFamily: ApplianceFamily | null = null;
  if (eligibleCandidates.length > 0) {
    const top = eligibleCandidates[0];
    const second = eligibleCandidates[1];
    if (
      second != null &&
      lifestylePreferredFamily != null &&
      Math.round(top.overallScore) === Math.round(second.overallScore) &&
      second.family === lifestylePreferredFamily &&
      !rejectedFamilies.has(lifestylePreferredFamily) &&
      !flaggedFamilies.has(lifestylePreferredFamily)
    ) {
      // Tiebreak: lifestyle preferred family wins
      recommendedFamily = second.family;
    } else {
      recommendedFamily = top.family;
    }
  } else if (
    bestOverall != null &&
    !rejectedFamilies.has(bestOverall.family) &&
    !flaggedFamilies.has(bestOverall.family)
  ) {
    // Fallback: use bestOverall if it is not rejected/flagged
    recommendedFamily = bestOverall.family;
  }

  // ── Primary reason (from evidence, not lifestyle) ─────────────────────────
  const winningDecision = allDecisions.find(d => d.family === recommendedFamily);
  const recommendedSubtype = recommendedFamily != null ? deriveDhwSubtype(recommendedFamily, input) : undefined;
  const primaryReason = winningDecision != null && winningDecision.caveats.length === 0
    ? `${familyLabel(winningDecision.family, recommendedSubtype)} scores highest across performance, reliability, and longevity for this home.`
    : winningDecision != null
    ? `${familyLabel(winningDecision.family, recommendedSubtype)} is the best-fit option — ${winningDecision.caveats[0] ?? 'see check items below'}.`
    : null;

  // ── What this avoids ──────────────────────────────────────────────────────
  const whatThisAvoids: string[] = [];
  for (const rejected of rejectedSystems) {
    // Do not include the selected topology in the avoids list — if the recommended
    // family and a rejected family share the same customer-facing label, skip it.
    const rejectedLabel = familyLabel(rejected.family);
    const recommendedLabelStr = recommendedFamily != null
      ? familyLabel(recommendedFamily, recommendedSubtype)
      : null;
    if (rejectedLabel === recommendedLabelStr) continue;
    whatThisAvoids.push(`${rejectedLabel}: ${rejected.reason}`);
  }

  // ── Check items ───────────────────────────────────────────────────────────
  const checkItems: string[] = winningDecision?.caveats.slice() ?? [];

  // ── Alternatives ─────────────────────────────────────────────────────────
  const alternatives = eligibleCandidates
    .filter(d => d.family !== recommendedFamily)
    .slice(0, 2)
    .map(d => ({
      family: d.family,
      label: familyLabel(d.family),
      caveat: d.caveats[0] ?? `Suitable with score ${d.overallScore.toFixed(0)}.`,
    }));

  return {
    recommendedFamily,
    recommendedLabel: recommendedFamily != null ? familyLabel(recommendedFamily, recommendedSubtype) : null,
    primaryReason,
    whatThisAvoids,
    checkItems,
    alternatives,
    rejectedSystems,
    futurePath: flaggedSystems,
    lifestyleSignals: lifestyleNeeds,
    confidence: confidenceSummary.level,
  };
}

// ─── Customer presentation builder ───────────────────────────────────────────

/**
 * Build the flat CustomerPresentationV1 from a RecommendationVerdictV1.
 *
 * This is the ONLY object that presentation surfaces should receive.
 * It is a simple data projection — no decisions are made here.
 */
export function buildCustomerPresentation(
  verdict: RecommendationVerdictV1,
): CustomerPresentationV1 {
  const verdictHeadline = verdict.recommendedLabel ?? 'No suitable system identified';

  const futurePath = verdict.futurePath.map(f => ({
    label: familyLabel(f.family),
    requiredWork: f.requiredWork,
  }));

  const ruledOut = verdict.rejectedSystems.map(r => ({
    label: familyLabel(r.family),
    reason: r.reason,
  }));

  const alternatives = verdict.alternatives.map(a => ({
    label: a.label,
    caveat: a.caveat,
  }));

  const lifestyleFitSignal =
    verdict.lifestyleSignals.includes('fast_reheat')       ? 'Fast reheat preference' :
    verdict.lifestyleSignals.includes('steady_low_temp')   ? 'Steady low-temperature preference' :
    verdict.lifestyleSignals.includes('stored_resilience') ? 'Stored-water resilience preference' :
    'Standard occupancy';

  return {
    verdictHeadline,
    primaryReason: verdict.primaryReason,
    whatThisAvoids: verdict.whatThisAvoids.slice(0, 3),
    whatNeedsChecking: verdict.checkItems,
    futurePath,
    ruledOut,
    alternatives,
    lifestyleFitSignal,
  };
}
