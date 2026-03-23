/**
 * types.ts
 *
 * Core type definitions for the PR 5 Re-simulation Engine.
 *
 * The engine applies a RecommendedUpgradePackage to an OutcomeSystemSpec,
 * re-runs the exact same TypicalDaySchedule against the upgraded spec, and
 * returns a structured comparison of the two outcomes.
 */

import type { ClassifiedDaySchedule, OutcomeSystemSpec } from '../outcomes/types';

// ─── Resimulation result ──────────────────────────────────────────────────────

/**
 * The full result of a re-simulation run.
 *
 * Contains:
 *   - both specs (simple install and best-fit)
 *   - both classified day schedules
 *   - a structured comparison with deltas and headline improvements
 */
export interface ResimulationResult {
  /** System type shared by both runs. */
  systemType: 'combi' | 'stored_water' | 'heat_pump';

  /** The original, unmodified spec (simple install path). */
  simpleInstallSpec: OutcomeSystemSpec;
  /** The upgraded spec produced by applying the upgrade package. */
  bestFitSpec: OutcomeSystemSpec;

  /** Classified day schedule for the simple install. */
  simpleInstall: ClassifiedDaySchedule;
  /** Classified day schedule for the best-fit install. */
  bestFitInstall: ClassifiedDaySchedule;

  /** Structured comparison between the two runs. */
  comparison: ResimulationComparison;
}

// ─── Comparison summary ───────────────────────────────────────────────────────

/**
 * Structured comparison of outcomes between simple install and best-fit install.
 *
 * Positive delta values represent improvement (fewer problems in best-fit).
 * A negative delta would indicate the upgrade worsened that metric — which
 * is surfaced honestly rather than suppressed.
 */
export interface ResimulationComparison {
  hotWater: HotWaterComparisonSummary;
  heating: HeatingComparisonSummary;
  /**
   * Customer-readable improvement statements generated from the comparison data.
   * Examples: "2 fewer hot-water conflicts", "Bath fills 5 minutes faster".
   * Empty when no meaningful improvement is present.
   */
  headlineImprovements: string[];
}

/** Hot-water specific deltas between simple-install and best-fit-install. */
export interface HotWaterComparisonSummary {
  /**
   * simpleInstall.hotWater.successful − bestFitInstall.hotWater.successful.
   * Negative means best-fit has more successful events (good).
   */
  successfulDelta: number;
  /**
   * simpleInstall.hotWater.reduced − bestFitInstall.hotWater.reduced.
   * Positive means best-fit has fewer reduced events (good).
   */
  reducedDelta: number;
  /**
   * simpleInstall.hotWater.conflict − bestFitInstall.hotWater.conflict.
   * Positive means best-fit has fewer conflict events (good).
   */
  conflictDelta: number;
  /**
   * simpleBathFill − bestFitBathFill, in minutes.
   * Positive means best-fit fills the bath faster (good).
   * null when either run has no bath events.
   */
  averageBathFillTimeDeltaMinutes: number | null;
}

/** Heating specific deltas between simple-install and best-fit-install. */
export interface HeatingComparisonSummary {
  /**
   * simpleInstall.heating.successful − bestFitInstall.heating.successful.
   * Negative means best-fit has more successful events (good).
   */
  successfulDelta: number;
  /**
   * simpleInstall.heating.reduced − bestFitInstall.heating.reduced.
   * Positive means best-fit has fewer reduced events (good).
   */
  reducedDelta: number;
  /**
   * simpleInstall.heating.conflict − bestFitInstall.heating.conflict.
   * Positive means best-fit has fewer conflict events (good).
   */
  conflictDelta: number;
  /**
   * simpleInstall.heating.outsideTargetEventCount −
   * bestFitInstall.heating.outsideTargetEventCount.
   * Positive means best-fit has fewer outside-target events (good).
   */
  outsideTargetEventCountDelta: number;
}
