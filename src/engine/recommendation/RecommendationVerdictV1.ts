/**
 * RecommendationVerdictV1.ts
 *
 * Single locked recommendation model produced by buildRecommendationVerdict().
 *
 * Design contract:
 *   1. Hard constraints win before lifestyle, eco, or any preference signal.
 *   2. Rejected systems cannot appear as recommendedSystem.
 *   3. Flagged systems can only appear as futurePath (conditional).
 *   4. lifestyleNeeds are a modifier, not a recommender — they may only influence
 *      the rank among eligible, un-rejected candidates.
 *   5. Presentation renders exactly this verdict. It never re-derives a decision.
 *
 * Decision precedence (applied top-to-bottom):
 *   Tier 1  hard rejections   — systems physically impossible for this home
 *   Tier 2  conditional flags — systems possible only with remedial work
 *   Tier 3  demand/performance fit — physics evidence from limiter ledger / fit-map
 *   Tier 4  lifestyle preference  — occupancy-signal modifier (fast_reheat, etc.)
 *   Tier 5  efficiency / eco / cost — secondary scoring dimension
 */

import type { ApplianceFamily } from '../topology/SystemTopology';
import type { LifestyleNeed } from '../schema/EngineInputV2_3';

// ─── Rejection / flag records ─────────────────────────────────────────────────

/**
 * A system that has been hard-rejected for this home.
 * Rejected systems must not appear anywhere in the customer presentation
 * as a recommendation, even as a fallback.
 */
export interface RejectedSystem {
  /** The appliance family that was rejected. */
  readonly family: ApplianceFamily;
  /** Machine-readable reason identifier (maps to a LimiterLedger or RedFlag entry). */
  readonly reasonId: string;
  /** Human-readable explanation of why this system cannot be installed. */
  readonly reason: string;
}

/**
 * A system that is conditionally possible with remedial work.
 * Flagged systems may appear only in the `futurePath` section of
 * CustomerPresentationV1 — never as `recommendedSystem` or `alternatives`.
 */
export interface FlaggedSystem {
  /** The appliance family that was flagged. */
  readonly family: ApplianceFamily;
  /** Machine-readable flag identifier. */
  readonly flagId: string;
  /** Human-readable description of the required enabling work. */
  readonly requiredWork: string;
}

// ─── Verdict ─────────────────────────────────────────────────────────────────

/**
 * The locked recommendation verdict produced by buildRecommendationVerdict().
 *
 * All downstream presentation surfaces must bind to this single object.
 * No presentation layer may re-derive a recommendation from raw module outputs.
 */
export interface RecommendationVerdictV1 {
  /**
   * The single best-overall system after all precedence tiers have been applied.
   *
   * Null only when ALL candidate systems are rejected (extremely unusual; means
   * the survey has uncovered an installation that is not upgradeable without
   * significant enabling works).
   */
  readonly recommendedFamily: ApplianceFamily | null;

  /**
   * Human-readable label for the recommended family.
   * Null when recommendedFamily is null.
   */
  readonly recommendedLabel: string | null;

  /**
   * One-sentence primary reason the recommended system wins for this home.
   * Sourced from the dominant physics evidence, not lifestyle preference.
   */
  readonly primaryReason: string | null;

  /**
   * What this recommendation avoids — the dominant risk of NOT upgrading
   * or of choosing a rejected alternative.
   */
  readonly whatThisAvoids: string[];

  /**
   * Items that the surveyor or customer should check before installation.
   * Derived from conditional / caveated evidence (not hard-stop rejections).
   */
  readonly checkItems: string[];

  /**
   * Systems that are eligible but not the top choice.
   * The presentation may list these as "also suitable" with caveats.
   */
  readonly alternatives: ReadonlyArray<{
    readonly family: ApplianceFamily;
    readonly label: string;
    readonly caveat: string;
  }>;

  /**
   * Systems that were hard-rejected for physics reasons.
   * The presentation must show these with a clear "not suitable" status.
   */
  readonly rejectedSystems: readonly RejectedSystem[];

  /**
   * Systems that are conditionally possible after enabling works.
   * Presented as a future pathway, never as the current recommendation.
   */
  readonly futurePath: readonly FlaggedSystem[];

  /**
   * The lifestyle preference signals that were applied as a modifier.
   * These influenced rank only after physics constraints were applied.
   * Listed here for transparency in the presentation.
   */
  readonly lifestyleSignals: readonly LifestyleNeed[];

  /**
   * Overall evidence confidence level — mirrors RecommendationResult.confidenceSummary.level.
   */
  readonly confidence: 'high' | 'medium' | 'low';
}

// ─── Customer presentation ────────────────────────────────────────────────────

/**
 * Flat presentation data derived from RecommendationVerdictV1.
 *
 * This is the ONLY object that FullSurveyResults (or any other presentation
 * surface) should bind to.  It is produced by buildCustomerPresentation()
 * and contains exactly what the UI needs to render — no more, no less.
 *
 * The presentation renders this receipt. It has no opinions of its own.
 */
export interface CustomerPresentationV1 {
  /**
   * The Atlas verdict headline — exactly one system label.
   * Null when no system is suitable (renders "No suitable system identified").
   */
  readonly verdictHeadline: string | null;

  /**
   * Primary reason in plain English — max two sentences.
   */
  readonly primaryReason: string | null;

  /**
   * What this recommendation avoids — bullet list, max 3 items.
   */
  readonly whatThisAvoids: readonly string[];

  /**
   * What needs checking before proceeding.
   */
  readonly whatNeedsChecking: readonly string[];

  /**
   * Future pathway — conditional upgrades possible after enabling works.
   * Empty when no conditional options exist.
   */
  readonly futurePath: ReadonlyArray<{
    readonly label: string;
    readonly requiredWork: string;
  }>;

  /**
   * Systems that were ruled out and why (for the "Why not?" section).
   */
  readonly ruledOut: ReadonlyArray<{
    readonly label: string;
    readonly reason: string;
  }>;

  /**
   * Alternative options that are also suitable but ranked below the primary.
   */
  readonly alternatives: ReadonlyArray<{
    readonly label: string;
    readonly caveat: string;
  }>;

  /**
   * Lifestyle fit signal — describes what the household occupancy pattern
   * prefers without naming a system. Used by the Twin Visualiser section label.
   */
  readonly lifestyleFitSignal: string;
}
