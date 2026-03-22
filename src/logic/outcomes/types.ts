/**
 * types.ts
 *
 * Core type definitions for the PR 3 Event Outcome Engine.
 *
 * The engine runs a TypicalDaySchedule (from PR 2) against an
 * OutcomeSystemSpec and classifies what happens for every event.
 */

// ─── Outcome result ───────────────────────────────────────────────────────────

/**
 * Deterministic classification of a single demand event against a system spec.
 *
 *   successful — system meets the demand without meaningful degradation
 *   reduced    — system partially meets demand; user experiences discomfort
 *   conflict   — system cannot meet demand; clear failure condition
 */
export type EventOutcomeResult = 'successful' | 'reduced' | 'conflict';

// ─── Classified event ─────────────────────────────────────────────────────────

/**
 * A single demand event annotated with the outcome the selected system produces.
 */
export interface ClassifiedDayEvent {
  /** Stable identifier copied from the originating DayEvent. */
  eventId: string;
  /** Event type (shower, bath, heating_recovery, …). */
  type: string;
  /** Minutes from midnight at which this event begins. */
  startMinute: number;
  durationMinutes: number;

  /** Deterministic outcome classification. */
  result: EventOutcomeResult;
  /** Human-readable explanation of why this outcome was chosen. */
  reason: string;

  /** Optional quantitative metrics where calculable. */
  metrics?: {
    /** Effective hot-water delivery rate for this event (litres per minute). */
    estimatedFlowLpm?: number;
    /** Estimated time to fill a standard bath under this system (minutes). */
    bathFillTimeMinutes?: number;
    /** How many degrees outside the comfort target this event sits (°C). */
    outsideTargetDegrees?: number;
  };

  /** Freeform tags carried forward from the originating DayEvent, plus any
   *  outcome-specific tags added by the classifier. */
  tags: string[];
}

// ─── Summary aggregates ───────────────────────────────────────────────────────

/** Aggregated hot-water event counts for a classified day. */
export interface HotWaterOutcomeSummary {
  /** Total number of hot-water draw events (shower, bath, kitchen_draw, tap_draw). */
  totalDraws: number;
  successful: number;
  reduced: number;
  conflict: number;
  /**
   * Average fill time for bath events, in minutes.
   * null when no bath events exist in the schedule.
   */
  averageBathFillTimeMinutes: number | null;
}

/** Aggregated heating event counts for a classified day. */
export interface HeatingOutcomeSummary {
  /** Total number of heating events (recovery + active + setback). */
  totalHeatingEvents: number;
  successful: number;
  reduced: number;
  conflict: number;
  /**
   * Number of heating events where the system is likely to be outside the
   * comfort temperature target.
   */
  outsideTargetEventCount: number;
}

// ─── Full classified schedule ─────────────────────────────────────────────────

/** The complete outcome of running one schedule against one system spec. */
export interface ClassifiedDaySchedule {
  /** Human-readable label identifying the system that was evaluated. */
  systemLabel: string;
  /** All classified events, preserving original sort order. */
  events: ClassifiedDayEvent[];
  hotWater: HotWaterOutcomeSummary;
  heating: HeatingOutcomeSummary;
}

// ─── System spec ─────────────────────────────────────────────────────────────

/**
 * A stripped-down specification of a heating / hot-water system that the
 * outcome classifier can consume.
 *
 * Only the fields needed to produce believable directional outcomes are
 * included.  Full physics are intentionally deferred to later PRs.
 */
export interface OutcomeSystemSpec {
  /** Broad category that drives the primary classification strategy. */
  systemType: 'combi' | 'stored_water' | 'heat_pump';

  // ── Water capability ────────────────────────────────────────────────────────
  /** Maximum sustained hot-water flow rate (litres per minute). */
  peakHotWaterCapacityLpm?: number;
  /** Total usable hot-water storage (litres). Relevant for stored_water / heat_pump. */
  hotWaterStorageLitres?: number;
  /** Rate at which the store recovers after a draw (litres per hour). */
  recoveryRateLitresPerHour?: number;

  // ── Heat capability ─────────────────────────────────────────────────────────
  /** Maximum space-heating / DHW output (kilowatts). */
  heatOutputKw?: number;
  /**
   * How well the system suits low-temperature emitters.
   * heat_pump systems generally require 'high'; combi / stored_water typically
   * deliver 'low' or 'medium'.
   */
  lowTempSuitability?: 'low' | 'medium' | 'high';

  // ── Constraints ─────────────────────────────────────────────────────────────
  /** Dynamic mains pressure available at the property inlet (bar). */
  mainsDynamicPressureBar?: number;
  /** Nominal bore of the primary distribution pipework (mm). */
  primaryPipeSizeMm?: 15 | 22 | 28 | 35;
  /** Overall quality of zone controls / programmer / smart thermostat. */
  controlsQuality?: 'basic' | 'good' | 'excellent';
  /** Assessed condition of the primary system (scale / sludge / wear). */
  systemCondition?: 'clean' | 'average' | 'poor';
}
