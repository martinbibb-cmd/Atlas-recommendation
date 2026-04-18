/**
 * buildRecommendationsFromEvidence.ts — PR11: Rebuild recommendation logic
 * on the limiter ledger and fit-map evidence.
 *
 * This module replaces the legacy mixed-state heuristic approach with a
 * transparent, evidence-backed ranking engine.
 *
 * Design rules (enforced):
 *   1. No recommendation without an evidence trace.
 *   2. Interventions derive only from removable limiter entries.
 *   3. Hard-stop installability constraints block candidates.
 *   4. Objective scoring is deterministic (no Math.random()).
 *   5. Best-by-objective may differ from bestOverall.
 *   6. No cross-family limiter bleed.
 *
 * Entry point: buildRecommendationsFromEvidence(bundles)
 *
 *   bundles — one CandidateEvidenceBundle per candidate family
 *   returns — RecommendationResult (bestOverall, bestByObjective,
 *             interventions, disqualifiedCandidates, confidenceSummary)
 */

import type {
  RecommendationObjective,
  RecommendationEvidenceTrace,
  RecommendationIntervention,
  RecommendationDecision,
  RecommendationResult,
  RecommendationConfidenceSummary,
  CandidateEvidenceBundle,
  CandidateSuitability,
  RecommendationContextSignals,
  WhyNotExplanation,
} from './RecommendationModel';
import { ALL_OBJECTIVES } from './RecommendationModel';
import type { LimiterLedgerEntry } from '../limiter/LimiterLedger';
import type { ApplianceFamily } from '../topology/SystemTopology';
import type { ProductConstraints, UserPreferencesV1 } from '../schema/EngineInputV2_3';

// ─── Objective weights ────────────────────────────────────────────────────────

/**
 * Default weights for computing the overall score from objective scores.
 * These are the physics-neutral defaults used when no user preferences are expressed.
 * All weights sum to 1.0.
 */
const DEFAULT_OBJECTIVE_WEIGHTS: Readonly<Record<RecommendationObjective, number>> = {
  performance:     0.30,
  reliability:     0.20,
  longevity:       0.15,
  ease_of_control: 0.10,
  eco:             0.10,
  disruption:      0.08,
  space:           0.07,
} as const;

/** Minimum allowed weight for any objective after scenario adjustments. */
const MIN_OBJECTIVE_WEIGHT = 0.01;

/**
 * Additive weight boosts applied per selected PriorityKey.
 * Applied before normalization so weights always sum to 1.0.
 *
 * cost_tendency maps to eco + longevity (running efficiency relates to both).
 * future_compatibility maps to eco + performance (heat-pump pathway).
 */
const PRIORITY_WEIGHT_BOOST: Readonly<Record<string, Partial<Record<RecommendationObjective, number>>>> = {
  performance:          { performance: 0.08 },
  reliability:          { reliability: 0.08 },
  longevity:            { longevity:   0.08 },
  disruption:           { disruption:  0.08 },
  eco:                  { eco:         0.08 },
  cost_tendency:        { eco: 0.04, longevity: 0.04 },
  future_compatibility: { eco: 0.06, performance: 0.02 },
} as const;

/**
 * Derive scenario-specific objective weights from user preferences.
 *
 * Starting from DEFAULT_OBJECTIVE_WEIGHTS, boosts are applied for each
 * expressed preference dimension (spacePriority, disruptionTolerance, and
 * selectedPriorities chip selections). The result is then normalised so that
 * weights always sum to 1.0.
 *
 * Falls back to DEFAULT_OBJECTIVE_WEIGHTS when preferences are absent or
 * entirely empty, preserving backward-compatibility for callers that do not
 * supply preferences.
 *
 * Exported for unit testing.
 */
export function deriveObjectiveWeights(
  preferences?: UserPreferencesV1,
): Readonly<Record<RecommendationObjective, number>> {
  if (!preferences) return DEFAULT_OBJECTIVE_WEIGHTS;

  const hasSpacePriority = preferences.spacePriority != null && preferences.spacePriority !== 'low';
  const hasDisruptionTolerance = preferences.disruptionTolerance != null && preferences.disruptionTolerance !== 'medium';
  const hasSelectedPriorities = (preferences.selectedPriorities?.length ?? 0) > 0;

  if (!hasSpacePriority && !hasDisruptionTolerance && !hasSelectedPriorities) {
    return DEFAULT_OBJECTIVE_WEIGHTS;
  }

  // Mutable copy of defaults
  const weights: Record<RecommendationObjective, number> = { ...DEFAULT_OBJECTIVE_WEIGHTS };

  // spacePriority boosts the space (and disruption) objective weights
  if (preferences.spacePriority === 'high') {
    weights.space      += 0.08;
    weights.disruption += 0.04;
  } else if (preferences.spacePriority === 'medium') {
    weights.space += 0.04;
  }

  // disruptionTolerance: 'low' → disruption matters more (user wants minimal upheaval)
  //                      'high' → disruption matters less (user accepts major works)
  if (preferences.disruptionTolerance === 'low') {
    weights.disruption += 0.08;
  } else if (preferences.disruptionTolerance === 'high') {
    weights.disruption = Math.max(MIN_OBJECTIVE_WEIGHT, weights.disruption - 0.04);
  }

  // selectedPriorities chip selections
  for (const key of preferences.selectedPriorities ?? []) {
    const boosts = PRIORITY_WEIGHT_BOOST[key];
    if (boosts == null) continue;
    for (const obj of ALL_OBJECTIVES) {
      const boost = boosts[obj];
      if (boost != null) {
        weights[obj] += boost;
      }
    }
  }

  // Normalise so weights sum to 1.0
  const total = ALL_OBJECTIVES.reduce((sum, obj) => sum + weights[obj], 0);
  if (total === 0) return DEFAULT_OBJECTIVE_WEIGHTS;

  const normalised = {} as Record<RecommendationObjective, number>;
  for (const obj of ALL_OBJECTIVES) {
    normalised[obj] = weights[obj] / total;
  }
  return normalised;
}

// ─── Baseline scores ──────────────────────────────────────────────────────────

/**
 * Family-specific baseline scores per objective.
 *
 * These reflect the physical starting position of each family before evidence
 * penalties are applied.  They are not hard-coded labels — they seed the
 * evidence-based scoring that follows.
 *
 * Combi: strong on space/disruption (no cylinder), weaker on DHW concurrency.
 * System/Regular stored: strong DHW concurrency, higher space/disruption cost.
 * Heat pump: high eco baseline, but reliability/control require careful installation.
 */
const FAMILY_BASELINE_SCORES: Readonly<Record<ApplianceFamily, Readonly<Record<RecommendationObjective, number>>>> = {
  combi: {
    performance:     75,
    reliability:     70,
    longevity:       70,
    ease_of_control: 80,
    eco:             65,
    disruption:      90,
    space:           95,
  },
  system: {
    performance:     80,
    reliability:     80,
    longevity:       80,
    ease_of_control: 75,
    eco:             65,
    disruption:      60,
    space:           60,
  },
  regular: {
    performance:     75,
    reliability:     75,
    longevity:       80,
    ease_of_control: 70,
    eco:             60,
    disruption:      55,
    space:           55,
  },
  heat_pump: {
    performance:     75,
    reliability:     75,
    longevity:       85,
    ease_of_control: 65,
    eco:             90,
    disruption:      30,
    space:           45,
  },
  open_vented: {
    performance:     70,
    reliability:     70,
    longevity:       65,
    ease_of_control: 65,
    eco:             55,
    disruption:      60,
    space:           55,
  },
};

// ─── Limiter → objective penalty map ─────────────────────────────────────────

/**
 * For each known limiter ID, the objectives it penalises and by how much
 * (scaled by severity, see SEVERITY_SCALE below).
 *
 * The base penalty is applied at 'warning' severity.  The SEVERITY_SCALE
 * multiplier adjusts the magnitude for other severity levels.
 */
interface LimiterObjectivePenalty {
  readonly objectives: readonly RecommendationObjective[];
  /** Base penalty magnitude at 'warning' severity. */
  readonly basePenalty: number;
}

const LIMITER_OBJECTIVE_PENALTIES: Readonly<Record<string, LimiterObjectivePenalty>> = {
  combi_service_switching: {
    objectives: ['performance', 'reliability'],
    basePenalty: 20,
  },
  // combi_dhw_demand_risk: hard simultaneous-demand gate (bathroomCount >= 2 or
  // peakConcurrentOutlets >= 2) or borderline occupancy warning.  This limiter
  // was previously emitted but had no entry here, so it left combi's ranking
  // score unchanged even when a hard demand gate was triggered.  Adding a
  // penalty ensures combi is ranked behind stored options for large/multi-outlet
  // households rather than appearing as the "obvious best fit".
  combi_dhw_demand_risk: {
    objectives: ['performance', 'reliability'],
    basePenalty: 20,
  },
  stored_volume_shortfall: {
    objectives: ['performance', 'reliability'],
    basePenalty: 25,
  },
  reduced_dhw_service: {
    objectives: ['performance'],
    basePenalty: 15,
  },
  hp_reheat_latency: {
    objectives: ['performance', 'ease_of_control'],
    basePenalty: 20,
  },
  simultaneous_demand_constraint: {
    objectives: ['performance', 'reliability'],
    basePenalty: 20,
  },
  mains_flow_constraint: {
    objectives: ['performance', 'reliability'],
    basePenalty: 20,
  },
  pressure_constraint: {
    objectives: ['performance'],
    basePenalty: 15,
  },
  primary_pipe_constraint: {
    objectives: ['performance', 'reliability', 'disruption'],
    basePenalty: 15,
  },
  open_vented_head_limit: {
    objectives: ['performance', 'reliability'],
    basePenalty: 15,
  },
  emitter_temperature_constraint: {
    objectives: ['performance', 'eco', 'disruption'],
    basePenalty: 15,
  },
  cycling_risk: {
    objectives: ['reliability', 'longevity', 'eco'],
    basePenalty: 15,
  },
  high_return_temp_non_condensing: {
    objectives: ['eco', 'longevity'],
    basePenalty: 10,
  },
  hp_high_flow_temp_penalty: {
    objectives: ['eco', 'performance'],
    basePenalty: 20,
  },
  dhw_storage_required: {
    objectives: ['disruption', 'space'],
    basePenalty: 20,
  },
  space_for_cylinder_unavailable: {
    objectives: ['space', 'disruption'],
    basePenalty: 40,
  },
} as const;

/** Multiplier applied to base penalty per limiter severity level. */
const SEVERITY_SCALE: Readonly<Record<LimiterLedgerEntry['severity'], number>> = {
  info:      0.25,
  warning:   1.0,
  limit:     1.5,
  hard_stop: 2.0,
};

/**
 * Additional flat penalty applied to ALL objectives when a candidate has any
 * 'limit' or 'hard_stop' severity limiter.  This forces clear score separation
 * between candidates with and without hard physical constraints, preventing
 * ASHP/system clustering in clearly unsuitable cases.
 *
 * Calibrated to ensure that a candidate with a single hard constraint sits
 * visibly below a clean candidate (~5 pts on the 0–100 overall scale) without
 * being so large that it double-penalises alongside the per-objective limiter
 * penalties which already scale by severity.
 */
const HARD_CONSTRAINT_SEPARATION_BONUS = 5;

// ─── Fit-map → objective contribution map ────────────────────────────────────

/**
 * Fit-map axis scores are normalised to [0, 100].  We convert them into
 * additive contributions to objectives by computing `(axisScore - 50) * scale`,
 * so that a score of 50 contributes 0 (neutral), higher scores add a bonus,
 * and lower scores produce a penalty.
 */
const FIT_MAP_AXIS_CONTRIBUTION_SCALE = 0.30; // max ±15 contribution from a single axis

// ─── Intervention label map ───────────────────────────────────────────────────

/**
 * Human-readable labels and affected objectives for known intervention IDs.
 * Interventions are derived from `LimiterLedgerEntry.candidateInterventions`.
 */
const INTERVENTION_METADATA: Readonly<Record<string, {
  label: string;
  description: string;
  affectedObjectives: readonly RecommendationObjective[];
}>> = {
  switch_to_stored_system: {
    label: 'Switch to stored hot water system',
    description: 'A stored cylinder would eliminate the service-switching interruption and improve concurrent DHW capacity.',
    affectedObjectives: ['performance', 'reliability'],
  },
  install_cylinder: {
    label: 'Install hot water cylinder',
    description: 'Adding a cylinder would decouple DHW delivery from the appliance and allow simultaneous CH+DHW.',
    affectedObjectives: ['performance', 'reliability', 'ease_of_control'],
  },
  upsize_cylinder: {
    label: 'Upsize hot water cylinder',
    description: 'A larger cylinder provides more usable stored volume, reducing draw-depletion risk.',
    affectedObjectives: ['performance', 'reliability'],
  },
  install_compact_cylinder: {
    label: 'Install compact cylinder',
    description: 'A smaller-footprint cylinder (e.g. slimline or combination unit) can address space constraints.',
    affectedObjectives: ['space', 'disruption'],
  },
  install_mixergy_unit: {
    label: 'Install Mixergy stratified cylinder',
    description: 'A Mixergy unit improves usable volume through stratification, reducing the effective shortfall.',
    affectedObjectives: ['performance', 'eco'],
  },
  improve_recharge_strategy: {
    label: 'Improve cylinder recharge scheduling',
    description: 'Adjusting the control schedule to pre-heat during off-peak periods reduces reheat latency risk.',
    affectedObjectives: ['ease_of_control', 'eco'],
  },
  upsize_primary_pipe: {
    label: 'Upsize primary flow/return pipework',
    description: 'Larger primary pipe bore reduces velocity-related constraints and supports higher-flow operation.',
    affectedObjectives: ['performance', 'reliability', 'disruption'],
  },
  upgrade_radiators: {
    label: 'Upgrade radiators or emitters',
    description: 'Larger or additional radiators lower the required flow temperature, improving efficiency.',
    affectedObjectives: ['eco', 'performance', 'disruption'],
  },
  add_underfloor_heating: {
    label: 'Add underfloor heating',
    description: 'UFH operates at lower flow temperatures, significantly improving heat pump efficiency.',
    affectedObjectives: ['eco', 'performance'],
  },
  increase_emitter_count: {
    label: 'Increase emitter count',
    description: 'More emitters reduce the required flow temperature and improve system efficiency.',
    affectedObjectives: ['eco', 'performance'],
  },
  install_pressure_booster: {
    label: '💧 Install Mixergy or vented cylinder (pressure-independent)',
    description: 'A Mixergy cylinder or tank-fed (vented) cylinder is treated as a stored-water option that remains usable on weaker supplies where combi hot water can become unreliable or cut out — no minimum mains pressure gate in Atlas.',
    affectedObjectives: ['performance', 'reliability'],
  },
} as const;

// ─── Hard-stop policy ─────────────────────────────────────────────────────────
//
// Policy: hard stops are not permitted — the engine produces advice only.
// No limiter may use 'hard_stop' severity.  All constraints are advisory.
//
// The `hardStopLimiters` evidence-trace field (below) is preserved for
// structural compatibility but will always be empty under this policy.

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp a number to [0, 100]. */
function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Zero-initialised objective record. */
function zeroObjectiveRecord(): Record<RecommendationObjective, number> {
  const rec = {} as Record<RecommendationObjective, number>;
  for (const obj of ALL_OBJECTIVES) rec[obj] = 0;
  return rec;
}

/** Compute weighted overall score from per-objective scores. */
function computeOverallScore(
  objectiveScores: Readonly<Record<RecommendationObjective, number>>,
  weights: Readonly<Record<RecommendationObjective, number>>,
): number {
  let total = 0;
  for (const obj of ALL_OBJECTIVES) {
    total += objectiveScores[obj] * weights[obj];
  }
  return clamp100(total);
}

/** Deterministic family sort key. */
function familySortKey(family: ApplianceFamily): string {
  return family;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Families that benefit from stored hot water (non-combi).
 * Used when applying storageBenefitSignal bonuses/penalties.
 */
const STORED_HOT_WATER_FAMILIES: ReadonlySet<ApplianceFamily> = new Set([
  'system', 'regular', 'heat_pump', 'open_vented',
]);

/**
 * Context-signal objective adjustments.
 *
 * storageBenefitSignal:
 *   high   → stored families +10 performance, +5 reliability
 *            combi −8 performance
 *   medium → stored families +5 performance
 *            (no combi penalty — borderline households may still suit a combi)
 *
 * solarStorageOpportunity:
 *   high   → stored families +10 eco
 *            combi −5 eco  (cannot self-consume PV surplus without a cylinder)
 *   medium → stored families +5 eco
 */
const STORAGE_BENEFIT_BONUS: Record<string, Partial<Record<RecommendationObjective, number>>> = {
  high:   { performance: 10, reliability: 5 },
  medium: { performance: 5 },
  low:    {},
};
const STORAGE_BENEFIT_COMBI_PENALTY: Record<string, Partial<Record<RecommendationObjective, number>>> = {
  high:   { performance: 8 },
  medium: {},
  low:    {},
};
const SOLAR_STORAGE_BONUS: Record<string, Partial<Record<RecommendationObjective, number>>> = {
  high:   { eco: 10 },
  medium: { eco: 5 },
  low:    {},
};
const SOLAR_STORAGE_COMBI_PENALTY: Record<string, Partial<Record<RecommendationObjective, number>>> = {
  high:   { eco: 5 },
  medium: {},
  low:    {},
};

/**
 * Score a single candidate from its evidence bundle and optional context signals.
 * Returns a fully-populated RecommendationDecision.
 *
 * @param bundle   Evidence bundle for this candidate family.
 * @param context  Optional context signals (demographics, PV, preferences).
 * @param weights  Scenario-derived objective weights (from deriveObjectiveWeights).
 *                 Defaults to DEFAULT_OBJECTIVE_WEIGHTS when absent.
 */
function scoreCandidate(
  bundle: CandidateEvidenceBundle,
  context?: RecommendationContextSignals,
  weights: Readonly<Record<RecommendationObjective, number>> = DEFAULT_OBJECTIVE_WEIGHTS,
): RecommendationDecision {
  const family = bundle.runnerResult.topology.appliance.family;
  const baseline = FAMILY_BASELINE_SCORES[family];

  // Accumulate per-objective penalties from limiters
  const limiterPenalties = zeroObjectiveRecord();
  const hardStopLimiters: string[] = [];
  const limitersConsidered: string[] = [];

  for (const entry of bundle.limiterLedger.entries) {
    limitersConsidered.push(entry.id);

    // Detect hard stops (none expected under the advice-only policy, but tracked for transparency)
    if (entry.severity === 'hard_stop') {
      hardStopLimiters.push(entry.id);
    }

    const penaltySpec = LIMITER_OBJECTIVE_PENALTIES[entry.id];
    if (penaltySpec === undefined) continue;

    const scale = SEVERITY_SCALE[entry.severity];
    const magnitude = Math.round(penaltySpec.basePenalty * scale);

    for (const obj of penaltySpec.objectives) {
      limiterPenalties[obj] = (limiterPenalties[obj] ?? 0) + magnitude;
    }
  }

  // Hard-constraint separation: when a candidate has 'limit' or 'hard_stop'
  // severity limiters, apply an additional separation bonus to ensure the
  // candidate is clearly ranked behind alternatives.  This prevents ASHP and
  // system clustering when a hard physical constraint should clearly split them.
  const hasHardConstraint = bundle.limiterLedger.entries.some(
    e => e.severity === 'hard_stop' || e.severity === 'limit'
  );
  if (hasHardConstraint) {
    for (const obj of ALL_OBJECTIVES) {
      limiterPenalties[obj] = (limiterPenalties[obj] ?? 0) + HARD_CONSTRAINT_SEPARATION_BONUS;
    }
  }

  // Fit-map axis contributions
  //
  // Only 'performance', 'reliability', and 'eco' receive fit-map contributions.
  // 'longevity', 'ease_of_control', 'disruption', and 'space' are determined by
  // limiter penalties and family baselines alone — the fit-map heating/DHW axes
  // do not carry meaningful signal for those dimensions.
  const fitMapContributions = zeroObjectiveRecord();
  const heatingContrib = Math.round(
    (bundle.fitMap.heatingAxis.score - 50) * FIT_MAP_AXIS_CONTRIBUTION_SCALE,
  );
  const dhwContrib = Math.round(
    (bundle.fitMap.dhwAxis.score - 50) * FIT_MAP_AXIS_CONTRIBUTION_SCALE,
  );

  fitMapContributions['performance'] += Math.round((heatingContrib + dhwContrib) / 2);
  fitMapContributions['reliability'] += heatingContrib;
  fitMapContributions['eco'] += bundle.fitMap.efficiencyScore !== undefined
    ? Math.round((bundle.fitMap.efficiencyScore - 50) * FIT_MAP_AXIS_CONTRIBUTION_SCALE)
    : 0;

  // Build positive evidence from event counters
  const positiveEvidence: string[] = [];
  const counters = bundle.events.counters;
  if (counters.rechargeCycles > 0 && family !== 'combi') {
    positiveEvidence.push('recharge_completed');
  }
  if (counters.heatingInterruptions === 0 && family !== 'combi') {
    positiveEvidence.push('no_heating_interruptions');
  }
  if (counters.simultaneousDemandConstraints === 0) {
    positiveEvidence.push('no_simultaneous_demand_constraint');
  }

  // Compute final objective scores (with optional context-signal adjustments)
  const objectiveScores = {} as Record<RecommendationObjective, number>;
  for (const obj of ALL_OBJECTIVES) {
    let raw =
      (baseline[obj] ?? 50) -
      (limiterPenalties[obj] ?? 0) +
      (fitMapContributions[obj] ?? 0);

    // Apply context-signal adjustments (storageBenefitSignal, solarStorageOpportunity)
    if (context) {
      const isStoredFamily = STORED_HOT_WATER_FAMILIES.has(family);
      const isCombi = family === 'combi';

      const storageBonus = STORAGE_BENEFIT_BONUS[context.storageBenefitSignal] ?? {};
      const storagePenalty = STORAGE_BENEFIT_COMBI_PENALTY[context.storageBenefitSignal] ?? {};
      const solarBonus = SOLAR_STORAGE_BONUS[context.solarStorageOpportunity] ?? {};
      const solarPenalty = SOLAR_STORAGE_COMBI_PENALTY[context.solarStorageOpportunity] ?? {};

      if (isStoredFamily) {
        raw += storageBonus[obj] ?? 0;
        raw += solarBonus[obj] ?? 0;
      }
      if (isCombi) {
        raw -= storagePenalty[obj] ?? 0;
        raw -= solarPenalty[obj] ?? 0;
      }
    }

    objectiveScores[obj] = clamp100(raw);
  }

  const overallScore = computeOverallScore(objectiveScores, weights);

  // Determine suitability
  let suitability: CandidateSuitability;
  if (hardStopLimiters.length > 0) {
    suitability = 'not_recommended';
  } else if (limitersConsidered.length > 0) {
    suitability = 'suitable_with_caveats';
  } else {
    suitability = 'suitable';
  }

  // Build human-readable caveats
  const caveats: string[] = [];
  for (const entry of bundle.limiterLedger.entries) {
    if (entry.severity === 'hard_stop') {
      // Hard stops are not permitted — surface as an advisory note instead.
      caveats.push(`Note: ${entry.title} — ${entry.description}`);
    } else if (entry.severity === 'limit') {
      caveats.push(`Limit reached: ${entry.title}`);
    } else if (entry.severity === 'warning') {
      caveats.push(`Advisory: ${entry.title}`);
    }
  }

  const evidenceTrace: RecommendationEvidenceTrace = {
    limitersConsidered,
    limiterPenalties,
    fitMapContributions,
    hardStopLimiters,
    positiveEvidence,
  };

  return {
    family,
    suitability,
    objectiveScores,
    overallScore,
    evidenceTrace,
    caveats,
  };
}

// ─── Intervention generation ──────────────────────────────────────────────────

/**
 * Derive interventions from removable limiters across all candidate bundles.
 *
 * Each `LimiterLedgerEntry` with `removableByUpgrade === true` yields one
 * intervention per `candidateInterventions` entry.  Duplicate
 * (intervention id + family) pairs are de-duplicated.
 */
function buildInterventions(
  bundles: readonly CandidateEvidenceBundle[],
  constraints?: ProductConstraints,
): RecommendationIntervention[] {
  // Build the set of blocked intervention IDs from product constraints.
  // UFH is excluded by default (allowUFH defaults to false).
  const blockedInterventions = new Set<string>();
  if (!(constraints?.allowUFH === true)) {
    blockedInterventions.add('add_underfloor_heating');
  }

  const seen = new Set<string>();
  const interventions: RecommendationIntervention[] = [];

  for (const bundle of bundles) {
    const family = bundle.runnerResult.topology.appliance.family;

    for (const entry of bundle.limiterLedger.entries) {
      if (!entry.removableByUpgrade) continue;

      for (const interventionId of entry.candidateInterventions) {
        // Skip interventions blocked by product constraints
        if (blockedInterventions.has(interventionId)) continue;

        const key = `${interventionId}::${family}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const meta = INTERVENTION_METADATA[interventionId];
        if (meta === undefined) continue;

        // Map limiter objectives to affected intervention objectives
        const limiterPenaltySpec = LIMITER_OBJECTIVE_PENALTIES[entry.id];
        const affectedObjectives: RecommendationObjective[] =
          limiterPenaltySpec !== undefined
            ? [...limiterPenaltySpec.objectives]
            : [...meta.affectedObjectives];

        interventions.push({
          id: interventionId,
          label: meta.label,
          sourceLimiterId: entry.id,
          sourceFamily: family,
          affectedObjectives,
          description: meta.description,
        });
      }
    }
  }

  // Deterministic order: by intervention id, then by family
  interventions.sort((a, b) => {
    const idCmp = a.id.localeCompare(b.id);
    if (idCmp !== 0) return idCmp;
    return familySortKey(a.sourceFamily).localeCompare(familySortKey(b.sourceFamily));
  });

  return interventions;
}

// ─── Best-by-objective ────────────────────────────────────────────────────────

/**
 * Pick the best decision per objective from eligible (non-disqualified) decisions.
 *
 * Ties are broken by overall score, then family name ascending.
 */
function buildBestByObjective(
  eligible: readonly RecommendationDecision[],
): Record<RecommendationObjective, RecommendationDecision | null> {
  const bestByObjective = {} as Record<RecommendationObjective, RecommendationDecision | null>;

  for (const obj of ALL_OBJECTIVES) {
    if (eligible.length === 0) {
      bestByObjective[obj] = null;
      continue;
    }

    const sorted = [...eligible].sort((a, b) => {
      const scoreDiff = (b.objectiveScores[obj] ?? 0) - (a.objectiveScores[obj] ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      const overallDiff = b.overallScore - a.overallScore;
      if (overallDiff !== 0) return overallDiff;
      return familySortKey(a.family).localeCompare(familySortKey(b.family));
    });

    bestByObjective[obj] = sorted[0] ?? null;
  }

  return bestByObjective;
}

// ─── Confidence summary ───────────────────────────────────────────────────────

function buildConfidenceSummary(
  bundles: readonly CandidateEvidenceBundle[],
  decisions: readonly RecommendationDecision[],
): RecommendationConfidenceSummary {
  const totalLimiters = bundles.reduce(
    (sum, b) => sum + b.limiterLedger.entries.length,
    0,
  );
  const totalEventItems = bundles.reduce(
    (sum, b) => sum + b.events.events.length,
    0,
  );
  const evidenceCount = totalLimiters + totalEventItems;
  const candidateCount = decisions.length;

  const notes: string[] = [];

  let level: RecommendationConfidenceSummary['level'];

  if (candidateCount >= 2 && evidenceCount >= 4) {
    level = 'high';
  } else if (candidateCount >= 1 && evidenceCount >= 1) {
    level = 'medium';
    notes.push('Limited evidence — additional survey data would improve confidence.');
  } else {
    level = 'low';
    notes.push('Very limited evidence base — recommendation should be treated as provisional.');
  }

  if (candidateCount === 1) {
    notes.push('Only one candidate was provided — cross-family comparison not available.');
  }

  const hardStopCount = decisions.filter(d => d.suitability === 'not_recommended').length;
  if (hardStopCount > 0) {
    notes.push(`${hardStopCount} candidate(s) disqualified by hard-stop limiters.`);
  }

  return { level, evidenceCount, limitersConsidered: totalLimiters, notes };
}

// ─── "Why not this option?" builder ───────────────────────────────────────────

/** Human-readable family labels for explanation text (engine-internal only). */
const FAMILY_DISPLAY_NAMES: Readonly<Record<ApplianceFamily, string>> = {
  combi: 'Combi boiler',
  system: 'System boiler with cylinder',
  regular: 'Regular boiler with cylinder',
  heat_pump: 'Heat pump',
  open_vented: 'Open vented system',
};

/**
 * Build "why not this option?" explanations for every non-winning candidate.
 *
 * Each explanation cites the dominant limiting and supporting signals from
 * the candidate's evidence trace, the score gap to the winner, and whether
 * the candidate was disqualified outright.
 */
function buildWhyNotExplanations(
  allDecisions: readonly RecommendationDecision[],
  bestOverall: RecommendationDecision | null,
): WhyNotExplanation[] {
  if (!bestOverall) return [];

  const explanations: WhyNotExplanation[] = [];

  for (const decision of allDecisions) {
    if (decision.family === bestOverall.family) continue;

    const isDisqualified = decision.suitability === 'not_recommended';
    const scoreGap = bestOverall.overallScore - decision.overallScore;

    // Find dominant limiting signals (limiters with highest penalty impact)
    const dominantLimiters = decision.evidenceTrace.hardStopLimiters.length > 0
      ? [...decision.evidenceTrace.hardStopLimiters]
      : decision.evidenceTrace.limitersConsidered.slice(0, 3);

    const dominantSupports = [...decision.evidenceTrace.positiveEvidence].slice(0, 3);

    // Build summary
    const familyName = FAMILY_DISPLAY_NAMES[decision.family] ?? decision.family;
    let summary: string;

    if (isDisqualified) {
      const hardStopNames = decision.evidenceTrace.hardStopLimiters.join(', ');
      summary = `${familyName} is not advised for this home due to physical constraint(s): ${hardStopNames}.`;
    } else if (dominantLimiters.length > 0) {
      const limiterList = dominantLimiters.join(', ');
      summary = `${familyName} scored ${scoreGap.toFixed(0)} points below the recommended option. ` +
        `Key limiting signal(s): ${limiterList}.`;
    } else {
      summary = `${familyName} scored ${scoreGap.toFixed(0)} points below the recommended option ` +
        `without specific physical constraints — the winner simply fits better overall.`;
    }

    // Append caveats if present
    if (decision.caveats.length > 0) {
      summary += ' ' + decision.caveats[0];
    }

    explanations.push({
      family: decision.family,
      dominantLimiters,
      dominantSupports,
      scoreGap,
      summary,
      isDisqualified,
    });
  }

  // Deterministic order: disqualified first, then by score gap descending
  explanations.sort((a, b) => {
    if (a.isDisqualified !== b.isDisqualified) return a.isDisqualified ? -1 : 1;
    return b.scoreGap - a.scoreGap;
  });

  return explanations;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Build a complete recommendation set from a collection of candidate evidence bundles.
 *
 * This is the primary entry point for PR11 recommendation logic.  It consumes
 * the full evidence stack (FamilyRunnerResult, DerivedSystemEventSummary,
 * LimiterLedger, FitMapModel) and produces an objective-aware ranking with
 * evidence traces, interventions, and a confidence summary.
 *
 * @param bundles      One CandidateEvidenceBundle per candidate family.
 *                     Must be non-empty; order does not affect output.
 * @param constraints  Optional product constraints — controls which intervention
 *                     types (e.g. UFH, heat pump) are eligible for inclusion.
 *                     When absent, UFH is excluded by default.
 * @param context      Optional context signals — demographics, PV opportunity, and
 *                     user preferences.  When `context.userPreferences` is present,
 *                     objective weights are derived from the household's stated
 *                     priorities so bestOverall reflects their scenario rather than
 *                     a single fixed weighting.  When absent, no context-signal
 *                     adjustments are applied (backward-compatible).
 * @returns            RecommendationResult with bestOverall, bestByObjective,
 *                     interventions, disqualifiedCandidates, and confidenceSummary.
 */
export function buildRecommendationsFromEvidence(
  bundles: readonly CandidateEvidenceBundle[],
  constraints?: ProductConstraints,
  context?: RecommendationContextSignals,
): RecommendationResult {
  // Derive scenario-specific objective weights from user preferences (if any).
  // Falls back to DEFAULT_OBJECTIVE_WEIGHTS when no preferences are expressed.
  const weights = deriveObjectiveWeights(context?.userPreferences);

  // Score every candidate using the scenario weights
  const allDecisions: RecommendationDecision[] = bundles
    .map(bundle => scoreCandidate(bundle, context, weights))
    .sort((a, b) => {
      // Primary: overall score descending
      const scoreDiff = b.overallScore - a.overallScore;
      if (scoreDiff !== 0) return scoreDiff;
      // Tie-break: family name ascending (deterministic)
      return familySortKey(a.family).localeCompare(familySortKey(b.family));
    });

  // Separate eligible from disqualified
  const eligible = allDecisions.filter(d => d.suitability !== 'not_recommended');
  const disqualifiedCandidates = allDecisions.filter(
    d => d.suitability === 'not_recommended',
  );

  // Best overall: highest-scoring eligible candidate
  const bestOverall = eligible.length > 0 ? eligible[0] ?? null : null;

  // Best by objective
  const bestByObjective = buildBestByObjective(eligible);

  // Interventions from removable limiters — filtered by product constraints
  const interventions = buildInterventions(bundles, constraints);

  // Confidence summary
  const confidenceSummary = buildConfidenceSummary(bundles, allDecisions);

  // "Why not this option?" explanations for non-winning candidates
  const whyNotExplanations = buildWhyNotExplanations(allDecisions, bestOverall);

  // Physics anchor fields: primaryConstraint, supportingEvents, fitMapPosition
  const primaryConstraint = derivePrimaryConstraint(bestOverall, bundles);
  const supportingEvents   = bestOverall?.evidenceTrace.positiveEvidence ?? [];
  const fitMapPosition     = deriveFitMapPosition(bestOverall, bundles);

  return {
    bestOverall,
    bestByObjective,
    interventions,
    disqualifiedCandidates,
    confidenceSummary,
    whyNotExplanations,
    primaryConstraint,
    supportingEvents,
    fitMapPosition,
    allDecisions,
  };
}

// ─── Physics anchor helpers ───────────────────────────────────────────────────

/**
 * Derives the dominant limiter ID from the best-overall candidate's evidence.
 *
 * Priority order:
 *   1. hard_stop limiter in the winning candidate's bundle (blocks other families)
 *   2. First `limit`-severity limiter entry in the bundle for the winning family
 *   3. First limiter ID in the evidence trace (highest-penalty by ordering)
 *   4. null — genuinely clean run with no constraints
 */
function derivePrimaryConstraint(
  bestOverall: RecommendationDecision | null,
  bundles: readonly CandidateEvidenceBundle[],
): string | null {
  if (!bestOverall) return null;

  const bundle = bundles.find(b => b.runnerResult.topology.appliance.family === bestOverall.family);
  if (!bundle) return null;

  const entries = bundle.limiterLedger.entries;

  // 1. hard_stop first
  const hardStop = entries.find(e => e.severity === 'hard_stop');
  if (hardStop) return hardStop.id;

  // 2. limit severity next
  const limitEntry = entries.find(e => e.severity === 'limit');
  if (limitEntry) return limitEntry.id;

  // 3. first entry from the evidence trace
  const firstConsidered = bestOverall.evidenceTrace.limitersConsidered[0];
  if (firstConsidered) return firstConsidered;

  return null;
}

/**
 * Returns the fit-map axis scores for the best-overall candidate.
 */
function deriveFitMapPosition(
  bestOverall: RecommendationDecision | null,
  bundles: readonly CandidateEvidenceBundle[],
): { readonly heatingScore: number; readonly dhwScore: number } | null {
  if (!bestOverall) return null;

  const bundle = bundles.find(b => b.runnerResult.topology.appliance.family === bestOverall.family);
  if (!bundle) return null;

  return {
    heatingScore: bundle.fitMap.heatingAxis.score,
    dhwScore:     bundle.fitMap.dhwAxis.score,
  };
}
