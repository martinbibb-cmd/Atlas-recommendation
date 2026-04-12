/**
 * RecommendationModel.ts — PR11: Canonical recommendation types.
 *
 * Defines the machine-readable recommendation contract that ranks appliance-family
 * candidates by evidence-backed objectives, generates interventions from removable
 * limiters, and provides a full evidence trace for every decision.
 *
 * Design rules:
 *   1. No recommendation may exist without an evidence trace.
 *   2. Interventions must derive from removable limiter entries.
 *   3. Hard-stop installability constraints must block or heavily penalise candidates.
 *   4. Objective scoring must be deterministic.
 *   5. Best-by-objective may differ from bestOverall.
 *   6. This model is the logic layer only — no UI, no visual redesign.
 *
 * Sequencing:
 *   PR4  fixed stored-water physical phases.
 *   PR5  fixed combi physical phases.
 *   PR6  introduced the canonical internal state timeline.
 *   PR7  derived readable events and counters from that timeline.
 *   PR8  introduced the limiter ledger — explains why a run struggled.
 *   PR9  derived the service-shape fit map from the above.
 *   PR10 added family-view components binding to the evidence stack.
 *   PR11 (this file) rebuilds recommendation logic on top of the evidence stack.
 */

import type { ApplianceFamily } from '../topology/SystemTopology';

// ─── Objectives ───────────────────────────────────────────────────────────────

/**
 * The scoring dimensions on which candidates are evaluated.
 *
 *   performance     — how well the system serves heating and DHW demand
 *   reliability     — stability, consistency, and absence of cycling / interruptions
 *   longevity       — expected service life and robustness against wear mechanisms
 *   ease_of_control — how straightforward the system is to programme and operate
 *   eco             — thermodynamic efficiency and carbon footprint
 *   disruption      — installation upheaval (enabling works, cylinder changes, etc.)
 *   space           — physical space requirements for the system components
 */
export type RecommendationObjective =
  | 'performance'
  | 'reliability'
  | 'longevity'
  | 'ease_of_control'
  | 'eco'
  | 'disruption'
  | 'space';

/** All defined recommendation objectives, ordered for deterministic output. */
export const ALL_OBJECTIVES: readonly RecommendationObjective[] = [
  'performance',
  'reliability',
  'longevity',
  'ease_of_control',
  'eco',
  'disruption',
  'space',
] as const;

// ─── Evidence trace ───────────────────────────────────────────────────────────

/**
 * Full traceability record for a recommendation decision.
 *
 * Every decision must have a populated evidence trace.  An empty trace
 * is a structural violation (the engine must always cite its working).
 */
export interface RecommendationEvidenceTrace {
  /**
   * IDs of all limiter entries that were considered when scoring this candidate.
   * May be empty only for a perfectly clean run with no constraints.
   */
  readonly limitersConsidered: readonly string[];

  /**
   * Per-objective penalty scores derived from limiter entries.
   * Keys are always present (value is 0 when no penalty was applied).
   */
  readonly limiterPenalties: Readonly<Record<RecommendationObjective, number>>;

  /**
   * Per-objective contributions from fit-map axis scores.
   * Positive values indicate the fit map boosted the objective; negative penalised it.
   */
  readonly fitMapContributions: Readonly<Record<RecommendationObjective, number>>;

  /**
   * Limiter IDs with `hard_stop` severity that mean this candidate is not advised.
   * Empty when no hard-stop limiters were found.
   */
  readonly hardStopLimiters: readonly string[];

  /**
   * Positive evidence IDs (event types, timeline keys, module fields) that
   * supported this candidate.  Traceable to real evidence sources.
   */
  readonly positiveEvidence: readonly string[];
}

// ─── Intervention ─────────────────────────────────────────────────────────────

/**
 * A concrete upgrade suggestion generated from a removable limiter entry.
 *
 * Interventions must derive directly from `LimiterLedgerEntry.candidateInterventions`
 * where `removableByUpgrade === true`.  They must never be invented without a
 * matching limiter source.
 */
export interface RecommendationIntervention {
  /**
   * Machine-readable identifier for this intervention.
   * E.g. 'switch_to_stored_system', 'upsize_cylinder', 'upgrade_radiators'.
   */
  readonly id: string;

  /** Human-readable label suitable for display. */
  readonly label: string;

  /**
   * The limiter entry ID that triggered this intervention.
   * Must correspond to a real `LimiterLedgerEntry.id` with `removableByUpgrade === true`.
   */
  readonly sourceLimiterId: string;

  /** The appliance family whose ledger contained the source limiter. */
  readonly sourceFamily: ApplianceFamily;

  /**
   * Which objectives this intervention would improve if acted upon.
   * At least one objective must be listed.
   */
  readonly affectedObjectives: readonly RecommendationObjective[];

  /** Plain-English description of why this intervention is suggested. */
  readonly description: string;
}

// ─── Decision ─────────────────────────────────────────────────────────────────

/**
 * Suitability verdict for a single candidate.
 *
 *   suitable              — no significant limiters; recommended
 *   suitable_with_caveats — some limiting evidence but no hard stops; usable with notes
 *   not_recommended       — hard-stop limiters mean this option is not advised
 */
export type CandidateSuitability =
  | 'suitable'
  | 'suitable_with_caveats'
  | 'not_recommended';

/**
 * Scored ranking decision for a single appliance-family candidate.
 *
 * `objectiveScores` and `overallScore` are computed deterministically from
 * limiter penalties and fit-map contributions.  No random adjustments.
 *
 * `evidenceTrace` must always be populated — a decision without evidence is
 * a structural violation.
 */
export interface RecommendationDecision {
  /** The appliance family this decision was produced for. */
  readonly family: ApplianceFamily;

  /** Whether this candidate is suitable, suitable with caveats, or not recommended. */
  readonly suitability: CandidateSuitability;

  /**
   * Per-objective scores in the range [0, 100].
   * Higher is better.  All objectives are always present.
   */
  readonly objectiveScores: Readonly<Record<RecommendationObjective, number>>;

  /**
   * Weighted overall score in the range [0, 100].
   * Computed as a weighted mean of all objective scores.
   * Ties are broken deterministically (by family name, ascending).
   */
  readonly overallScore: number;

  /**
   * Full evidence trace for this decision.
   * Must always be populated.
   */
  readonly evidenceTrace: RecommendationEvidenceTrace;

  /**
   * Human-readable caveats explaining why this candidate is not fully suitable.
   * Empty when suitability is 'suitable'.
   */
  readonly caveats: readonly string[];
}

// ─── Result ───────────────────────────────────────────────────────────────────

/**
 * Complete recommendation output produced by `buildRecommendationsFromEvidence`.
 *
 * `bestOverall`          — single highest-scoring suitable candidate, or null.
 * `bestByObjective`      — best candidate per objective (may differ from bestOverall).
 * `interventions`        — all upgrade suggestions derived from removable limiters.
 * `disqualifiedCandidates` — candidates blocked by hard-stop limiters.
 * `confidenceSummary`    — summary of how much evidence was available.
 *
 * All objectives in `ALL_OBJECTIVES` are always present as keys in `bestByObjective`.
 */
export interface RecommendationResult {
  /**
   * The single best-overall candidate, or null when no candidate is suitable.
   * Overall ranking excludes candidates with `suitability === 'not_recommended'`.
   * Ties are broken deterministically.
   */
  readonly bestOverall: RecommendationDecision | null;

  /**
   * Best candidate for each objective.
   * A candidate with suitability 'not_recommended' cannot win an objective.
   * Null when no suitable candidate exists for that objective.
   */
  readonly bestByObjective: Readonly<Record<RecommendationObjective, RecommendationDecision | null>>;

  /**
   * All upgrade interventions derived from removable limiters, across all candidates.
   * Deduplicated by `id + sourceFamily` pair.
   */
  readonly interventions: readonly RecommendationIntervention[];

  /**
   * Candidates that were excluded from recommendation because of hard-stop limiters
   * (not advised for this home). Sorted by family name ascending for determinism.
   */
  readonly disqualifiedCandidates: readonly RecommendationDecision[];

  /**
   * Summary of the evidence base used to produce this recommendation set.
   */
  readonly confidenceSummary: RecommendationConfidenceSummary;

  /**
   * "Why not this option?" explanations for non-winning candidates.
   * One entry per candidate that was not bestOverall.
   * Explains the dominant limiting signal(s) and score gap.
   */
  readonly whyNotExplanations: readonly WhyNotExplanation[];

  /**
   * The dominant limiter ID (from LimiterLedger) that most influenced this
   * recommendation.  This is the `hard_stop` limiter if one exists for the winning
   * family; otherwise the first `limit`-severity entry; otherwise the highest-penalty
   * limiter from the evidence trace of `bestOverall`.
   *
   * Null when the run was entirely clean (no limiters at all across all candidates).
   *
   * This is the causal chain anchor: every recommendation must be traceable to a
   * real constraint or to an absence of constraints (clean run).
   */
  readonly primaryConstraint: string | null;

  /**
   * Positive evidence IDs (event types, timeline keys, module fields) from the
   * `bestOverall` candidate's evidence trace that supported this recommendation.
   * Empty array when no positive evidence was recorded or when `bestOverall` is null.
   */
  readonly supportingEvents: readonly string[];

  /**
   * Fit-map axis position of the `bestOverall` candidate.
   * Derived from the candidate's FitMapModel (heatingAxis.score, dhwAxis.score).
   * Null when `bestOverall` is null or the bundle contained no fit-map data.
   */
  readonly fitMapPosition: { readonly heatingScore: number; readonly dhwScore: number } | null;
}

/**
 * Summary of how confident the recommendation engine is in its output.
 */
export interface RecommendationConfidenceSummary {
  /**
   * Overall confidence level.
   *
   *   high   — multiple candidates, strong evidence, no ambiguous limiters
   *   medium — some ambiguity or limited evidence
   *   low    — very little evidence or only one candidate
   */
  readonly level: 'high' | 'medium' | 'low';

  /**
   * Total number of evidence items (limiters + events) considered across all candidates.
   */
  readonly evidenceCount: number;

  /**
   * Total number of limiter entries considered across all candidates.
   */
  readonly limitersConsidered: number;

  /**
   * Human-readable notes explaining the confidence level and any ambiguities.
   */
  readonly notes: readonly string[];
}

// ─── Input bundle ─────────────────────────────────────────────────────────────

/**
 * All evidence for a single candidate, bundled for passing into
 * `buildRecommendationsFromEvidence`.
 *
 * Every field must be pre-populated from the engine's evidence stack (PR6–PR9).
 * The bundle is the single unit of input per candidate.
 */
export interface CandidateEvidenceBundle {
  /** Runner result for this family (PR3). */
  readonly runnerResult: import('../runners/types').FamilyRunnerResult;
  /** Derived events and counters (PR7). */
  readonly events: import('../timeline/DerivedSystemEvent').DerivedSystemEventSummary;
  /** Limiter ledger (PR8). */
  readonly limiterLedger: import('../limiter/LimiterLedger').LimiterLedger;
  /** Fit-map model (PR9). */
  readonly fitMap: import('../fitmap/FitMapModel').FitMapModel;
}

// ─── Context signals ──────────────────────────────────────────────────────────

/**
 * Optional demographic and PV signals that influence recommendation scoring.
 *
 * Passed by `runEngine()` so the recommendation engine can apply bonus/penalty
 * adjustments based on household demand characteristics and solar opportunity.
 *
 * These are intentionally separate from the per-candidate limiter/fit-map
 * evidence — they represent whole-home context rather than family-specific
 * physics results.
 */
export interface RecommendationContextSignals {
  /**
   * Composite stored-hot-water benefit signal derived from household composition.
   *   high   → stored families receive a performance/reliability bonus;
   *            combi receives a performance penalty.
   *   medium → stored families receive a smaller bonus; combi unchanged.
   *   low    → no adjustment (combi-neutral).
   */
  storageBenefitSignal: import('../modules/DemographicsAssessmentModule').StorageBenefitSignal;

  /**
   * Opportunity to capture PV surplus as stored hot water.
   *   high   → stored families receive an eco bonus; combi receives eco penalty.
   *   medium → stored families receive a smaller eco bonus.
   *   low    → no adjustment.
   */
  solarStorageOpportunity: import('../modules/PvAssessmentModule').SolarStorageOpportunity;
}

// ─── "Why not this option?" explanation ───────────────────────────────────────

/**
 * Explains why a particular candidate was not the top recommendation.
 *
 * Each non-winning candidate gets one WhyNotExplanation that cites the
 * dominant limiting signal(s) and the score gap to the winner.
 *
 * These are consequences of physics, not soft preference weighting.
 */
export interface WhyNotExplanation {
  /** The appliance family this explanation is for. */
  readonly family: ApplianceFamily;

  /** The dominant limiting signals that reduced this candidate's score. */
  readonly dominantLimiters: readonly string[];

  /** The dominant supporting signals that helped this candidate. */
  readonly dominantSupports: readonly string[];

  /** Score gap between this candidate and the winner (positive = winner scored higher). */
  readonly scoreGap: number;

  /** Human-readable summary explaining why this option was not selected. */
  readonly summary: string;

  /** Whether this candidate was disqualified entirely (hard-stop). */
  readonly isDisqualified: boolean;
}

