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
import type { ApplianceFamily } from '../topology/SystemTopology';
import type {
  RecommendationVerdictV1,
  CustomerPresentationV1,
  RejectedSystem,
  FlaggedSystem,
} from './RecommendationVerdictV1';

// ─── Family label map ─────────────────────────────────────────────────────────

const FAMILY_LABELS: Record<ApplianceFamily, string> = {
  combi:       'Gas combi boiler',
  system:      'System boiler with unvented cylinder',
  heat_pump:   'Air source heat pump',
  regular:     'Regular boiler with vented cylinder',
  open_vented: 'Open-vented (regular) boiler system',
};

// ─── Hard-rejection map ───────────────────────────────────────────────────────

/**
 * Derive hard-rejected families from RedFlagModule output and combi DHW flags.
 * Applies Tier 1 precedence — these systems cannot be recommended under any
 * circumstances without the constraint being resolved first.
 */
function deriveRejectedSystems(result: FullEngineResult, _input: EngineInputV2_3): RejectedSystem[] {
  const rejected: RejectedSystem[] = [];
  const { redFlags } = result;

  if (redFlags.rejectCombi) {
    const reason = redFlags.reasons.find(r => r.includes('Combi')) ??
      'Combi on-demand flow cannot serve this home under physics constraints.';
    rejected.push({
      family: 'combi',
      reasonId: 'combi_rejected_physics',
      reason,
    });
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
      const caveat = decision.caveats[0] ?? `${FAMILY_LABELS[decision.family]} is not advised for this home.`;
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
function deriveFlaggedSystems(result: FullEngineResult, _input: EngineInputV2_3): FlaggedSystem[] {
  const flagged: FlaggedSystem[] = [];
  const { redFlags } = result;

  // flagAshp without rejectAshp means: ASHP is possible but requires pipework upgrades.
  if (redFlags.flagAshp && !redFlags.rejectAshp) {
    const workNote = redFlags.reasons.find(r => r.includes('ASHP Flagged') || r.includes('22mm')) ??
      'ASHP requires primary pipework upgrade to ≥28mm to support low-ΔT flow rates.';
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
  result: FullEngineResult,
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
  const primaryReason = winningDecision != null && winningDecision.caveats.length === 0
    ? `${FAMILY_LABELS[winningDecision.family]} scores highest across performance, reliability, and longevity for this home.`
    : winningDecision != null
    ? `${FAMILY_LABELS[winningDecision.family]} is the best-fit option — ${winningDecision.caveats[0] ?? 'see check items below'}.`
    : null;

  // ── What this avoids ──────────────────────────────────────────────────────
  const whatThisAvoids: string[] = [];
  for (const rejected of rejectedSystems) {
    whatThisAvoids.push(`${FAMILY_LABELS[rejected.family]}: ${rejected.reason}`);
  }

  // ── Check items ───────────────────────────────────────────────────────────
  const checkItems: string[] = winningDecision?.caveats.slice() ?? [];

  // ── Alternatives ─────────────────────────────────────────────────────────
  const alternatives = eligibleCandidates
    .filter(d => d.family !== recommendedFamily)
    .slice(0, 2)
    .map(d => ({
      family: d.family,
      label: FAMILY_LABELS[d.family],
      caveat: d.caveats[0] ?? `Suitable with score ${d.overallScore.toFixed(0)}.`,
    }));

  return {
    recommendedFamily,
    recommendedLabel: recommendedFamily != null ? FAMILY_LABELS[recommendedFamily] : null,
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
    label: FAMILY_LABELS[f.family],
    requiredWork: f.requiredWork,
  }));

  const ruledOut = verdict.rejectedSystems.map(r => ({
    label: FAMILY_LABELS[r.family],
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
