/**
 * usageTypes.ts
 *
 * UI state model for the Usage / Demand step.
 * Captures behavioural demand inputs that describe how heat and hot water are
 * actually used in the home — not demographic descriptors.
 *
 * This is the demand layer of the supply → architecture → demand triad.
 * Normalised into a canonical shape by usageNormalizer before downstream use.
 */

// ─── Occupancy pattern ────────────────────────────────────────────────────────

/**
 * Describes how the home is occupied during weekday daytime hours.
 * Drives morning / evening peak timing and the likelihood of mid-day demand.
 */
export type OccupancyPattern =
  | 'usually_out'       // most occupants out during weekday days
  | 'someone_home'      // at least one person home most of the day
  | 'irregular_shifts'  // shift workers / mixed / unpredictable
  | 'unknown';

// ─── Bath use ─────────────────────────────────────────────────────────────────

/** How often baths (rather than showers) are taken. */
export type BathUse = 'rare' | 'sometimes' | 'frequent' | 'unknown';

// ─── Peak concurrency ─────────────────────────────────────────────────────────

/**
 * Peak number of simultaneous hot-water outlets or draw-off points.
 * Used to assess combi boiler adequacy and cylinder sizing.
 */
export type ConcurrencyLevel = 1 | 2 | 3 | '4_plus' | 'unknown';

// ─── Draw style ───────────────────────────────────────────────────────────────

/**
 * Predominant draw style — short-draw (brief taps, dishwasher) vs long-draw
 * (long showers, deep baths).  Informs cylinder volume and recovery estimates.
 */
export type DrawStyle = 'mostly_short' | 'mixed' | 'mostly_long' | 'unknown';

// ─── Complete UI state ────────────────────────────────────────────────────────

/**
 * UsageState
 *
 * Lean UI model capturing behavioural hot water and heating demand inputs.
 * Deliberately minimal — normalised into a canonical demand object by
 * usageNormalizer before being passed downstream.
 *
 * Fields
 * ──────
 * occupancyPattern       — daytime occupancy behaviour
 * bathUse                — frequency of bath vs shower usage
 * peakHotWaterConcurrency — simultaneous draw-off points at peak
 * drawStyle              — short vs long draw preference
 * householdSize          — number of occupants (sizing context only)
 * confidenceNote         — human-readable note about data confidence
 */
export type UsageState = {
  occupancyPattern: OccupancyPattern;
  bathUse: BathUse;
  peakHotWaterConcurrency: ConcurrencyLevel;
  drawStyle: DrawStyle;
  householdSize: number | null;
  confidenceNote: string | null;
};

export const INITIAL_USAGE_STATE: UsageState = {
  occupancyPattern: 'unknown',
  bathUse: 'unknown',
  peakHotWaterConcurrency: 'unknown',
  drawStyle: 'unknown',
  householdSize: null,
  confidenceNote: null,
};
