/**
 * usageTypes.ts
 *
 * UI state model for the Home / Demographics step.
 *
 * Demographics are the primary source of demand physics: age group headcounts
 * determine demand shape, concurrency likelihood, and draw type.  Manual usage
 * inputs (occupancyPattern, peakHotWaterConcurrency, drawStyle) have been
 * removed — demand is derived from household composition + two simple lifestyle
 * questions (daytimeOccupancy, bathUse).
 *
 * This is the home layer of the system → home → services triad.
 * Normalised into a canonical shape by usageNormalizer before downstream use.
 */

import type { HouseholdComposition } from '../../../engine/schema/EngineInputV2_3';

export type { HouseholdComposition };

// ─── Daytime occupancy ────────────────────────────────────────────────────────

/**
 * Weekday daytime occupancy pattern.
 * Drives morning / evening peak timing and the likelihood of mid-day demand.
 * Three options only — avoids false precision.
 */
export type DaytimeOccupancy =
  | 'usually_out'    // most adults out during working hours
  | 'usually_home'   // at least one adult home most of the day
  | 'irregular'      // shift workers / mixed / variable schedule
  | 'unknown';

// ─── Bath use ─────────────────────────────────────────────────────────────────

/** How often baths (rather than showers) are taken. */
export type BathUse = 'rare' | 'sometimes' | 'frequent' | 'unknown';

// ─── Complete UI state ────────────────────────────────────────────────────────

/**
 * HomeState
 *
 * Demographics-driven UI model for the Home step.  Household composition
 * (age groups + headcounts) is the primary demand signal.  Two simple
 * lifestyle answers (daytimeOccupancy, bathUse) allow demand timing and
 * volume to be derived without requiring manual entry of flow rates or
 * concurrency figures that users cannot accurately provide.
 *
 * bathroomCount is captured here because it is a household property that
 * informs concurrent draw risk — not a hot water system property.
 *
 * Downstream:
 *   composition → deriveProfileFromHouseholdComposition → demandPreset + occupancyCount
 *   daytimeOccupancy + bathUse → DemandTimingOverrides
 *   bathroomCount → engine input directly (DHW sizing and concurrent-draw gate)
 *
 * Fields
 * ──────
 * composition        — headcounts by age band (the primary demand signal)
 * daytimeOccupancy   — weekday daytime presence (usually_out / usually_home / irregular)
 * bathUse            — bath frequency (rare / sometimes / frequent)
 * bathroomCount      — number of bathrooms (concurrent draw risk gate)
 */
export type HomeState = {
  composition: HouseholdComposition;
  daytimeOccupancy: DaytimeOccupancy;
  bathUse: BathUse;
  bathroomCount: number | null;
};

/** Blank initial composition — one adult, no children. */
export const INITIAL_HOUSEHOLD_COMPOSITION: HouseholdComposition = {
  adultCount: 1,
  childCount0to4: 0,
  childCount5to10: 0,
  childCount11to17: 0,
  youngAdultCount18to25AtHome: 0,
};

export const INITIAL_HOME_STATE: HomeState = {
  composition: INITIAL_HOUSEHOLD_COMPOSITION,
  daytimeOccupancy: 'unknown',
  bathUse: 'unknown',
  bathroomCount: null,
};

/**
 * @deprecated Use HomeState and INITIAL_HOME_STATE instead.
 * Kept as a re-export so legacy imports don't break during migration.
 */
export type UsageState = HomeState;
/** @deprecated Use INITIAL_HOME_STATE. */
export const INITIAL_USAGE_STATE: HomeState = INITIAL_HOME_STATE;
