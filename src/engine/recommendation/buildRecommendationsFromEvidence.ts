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
} from './RecommendationModel';
import { ALL_OBJECTIVES } from './RecommendationModel';
import type { LimiterLedgerEntry } from '../limiter/LimiterLedger';
import type { ApplianceFamily } from '../topology/SystemTopology';

// ─── Objective weights ────────────────────────────────────────────────────────

/**
 * Weights for computing the overall score from objective scores.
 * All weights sum to 1.0.
 */
const OBJECTIVE_WEIGHTS: Readonly<Record<RecommendationObjective, number>> = {
  performance:    0.30,
  reliability:    0.20,
  longevity:      0.15,
  ease_of_control: 0.10,
  eco:            0.10,
  disruption:     0.08,
  space:          0.07,
} as const;

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
    label: 'Install mains pressure booster pump',
    description: 'A booster pump raises mains dynamic pressure to support adequate DHW delivery.',
    affectedObjectives: ['performance', 'reliability'],
  },
} as const;

// ─── Hard-stop policy ─────────────────────────────────────────────────────────

/**
 * Limiter IDs that always trigger a hard-stop (not_recommended) verdict
 * regardless of severity.  These represent physical impossibilities or
 * fundamental incompatibilities.
 */
const ALWAYS_HARD_STOP_LIMITER_IDS: ReadonlySet<string> = new Set([
  'space_for_cylinder_unavailable',
]);

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
function computeOverallScore(objectiveScores: Readonly<Record<RecommendationObjective, number>>): number {
  let total = 0;
  for (const obj of ALL_OBJECTIVES) {
    total += objectiveScores[obj] * OBJECTIVE_WEIGHTS[obj];
  }
  return clamp100(total);
}

/** Deterministic family sort key. */
function familySortKey(family: ApplianceFamily): string {
  return family;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score a single candidate from its evidence bundle.
 * Returns a fully-populated RecommendationDecision.
 */
function scoreCandidate(bundle: CandidateEvidenceBundle): RecommendationDecision {
  const family = bundle.runnerResult.topology.appliance.family;
  const baseline = FAMILY_BASELINE_SCORES[family];

  // Accumulate per-objective penalties from limiters
  const limiterPenalties = zeroObjectiveRecord();
  const hardStopLimiters: string[] = [];
  const limitersConsidered: string[] = [];

  for (const entry of bundle.limiterLedger.entries) {
    limitersConsidered.push(entry.id);

    // Detect hard stops
    if (
      entry.severity === 'hard_stop' ||
      ALWAYS_HARD_STOP_LIMITER_IDS.has(entry.id)
    ) {
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

  // Compute final objective scores
  const objectiveScores = {} as Record<RecommendationObjective, number>;
  for (const obj of ALL_OBJECTIVES) {
    const raw =
      (baseline[obj] ?? 50) -
      (limiterPenalties[obj] ?? 0) +
      (fitMapContributions[obj] ?? 0);
    objectiveScores[obj] = clamp100(raw);
  }

  const overallScore = computeOverallScore(objectiveScores);

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
    if (entry.severity === 'hard_stop' || ALWAYS_HARD_STOP_LIMITER_IDS.has(entry.id)) {
      caveats.push(`Hard stop: ${entry.title} — ${entry.description}`);
    } else if (entry.severity === 'limit') {
      caveats.push(`Limit reached: ${entry.title}`);
    } else if (entry.severity === 'warning') {
      caveats.push(`Warning: ${entry.title}`);
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
function buildInterventions(bundles: readonly CandidateEvidenceBundle[]): RecommendationIntervention[] {
  const seen = new Set<string>();
  const interventions: RecommendationIntervention[] = [];

  for (const bundle of bundles) {
    const family = bundle.runnerResult.topology.appliance.family;

    for (const entry of bundle.limiterLedger.entries) {
      if (!entry.removableByUpgrade) continue;

      for (const interventionId of entry.candidateInterventions) {
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

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Build a complete recommendation set from a collection of candidate evidence bundles.
 *
 * This is the primary entry point for PR11 recommendation logic.  It consumes
 * the full evidence stack (FamilyRunnerResult, DerivedSystemEventSummary,
 * LimiterLedger, FitMapModel) and produces an objective-aware ranking with
 * evidence traces, interventions, and a confidence summary.
 *
 * @param bundles  One CandidateEvidenceBundle per candidate family.
 *                 Must be non-empty; order does not affect output.
 * @returns        RecommendationResult with bestOverall, bestByObjective,
 *                 interventions, disqualifiedCandidates, and confidenceSummary.
 */
export function buildRecommendationsFromEvidence(
  bundles: readonly CandidateEvidenceBundle[],
): RecommendationResult {
  // Score every candidate
  const allDecisions: RecommendationDecision[] = bundles
    .map(scoreCandidate)
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

  // Interventions from removable limiters
  const interventions = buildInterventions(bundles);

  // Confidence summary
  const confidenceSummary = buildConfidenceSummary(bundles, allDecisions);

  return {
    bestOverall,
    bestByObjective,
    interventions,
    disqualifiedCandidates,
    confidenceSummary,
  };
}
