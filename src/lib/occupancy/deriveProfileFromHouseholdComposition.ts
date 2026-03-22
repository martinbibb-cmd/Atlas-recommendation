/**
 * deriveProfileFromHouseholdComposition.ts
 *
 * Derives a DemandPresetId and supporting demand parameters from an actual
 * household composition (headcounts by age band) plus two simple lifestyle
 * pattern answers.
 *
 * Design rules:
 *   - The user NEVER selects a broad archetype directly when householdComposition
 *     is provided.  Archetype derivation happens here, invisibly.
 *   - The derivation is deterministic and testable — no randomness.
 *   - Age bands drive demand in meaningfully different ways:
 *       0–4   : frequent short draws, daytime presence, daily bath at bedtime
 *       5–10  : family peaks, bath/shower mix, evening demand
 *       11–17 : long showers, simultaneous demand, chaotic peaks
 *       18–25 at home : later schedules, longer showers, irregular daytime
 *       Adults only   : stable, predictable demand
 *   - The structure intentionally supports future near-lifecycle logic
 *     (e.g. "teenagers soon", "empty nest soon") without schema changes.
 *
 * Usage:
 *   const result = deriveProfileFromHouseholdComposition(
 *     { adultCount: 2, childCount0to4: 0, childCount5to10: 1,
 *       childCount11to17: 0, youngAdultCount18to25AtHome: 0 },
 *     'usually_out',
 *     'sometimes',
 *   );
 *   // result.derivedPresetId        → 'family_young_children'
 *   // result.occupancyCount         → 3
 *   // result.daytimeOccupancyHint   → 'partial'
 */

import type { HouseholdComposition } from '../../engine/schema/EngineInputV2_3';
import type { DemandPresetId, DemandTimingOverrides } from '../../engine/schema/OccupancyPreset';

// ─── Input types ──────────────────────────────────────────────────────────────

/**
 * Weekday daytime occupancy pattern — three-option fast question.
 * 'usually_out'  → most adults away during working hours
 * 'usually_home' → at least one adult home most of the day
 * 'irregular'    → shift work, part-time, variable schedule
 */
export type DaytimeOccupancyPattern = 'usually_out' | 'usually_home' | 'irregular';

/**
 * Bath use frequency band — simple three-option fast question.
 * 'rare'      → baths rarely or never (shower-only household)
 * 'sometimes' → occasional baths (a few times per week)
 * 'frequent'  → baths most days or daily
 */
export type BathUsePattern = 'rare' | 'sometimes' | 'frequent';

// ─── Output type ──────────────────────────────────────────────────────────────

/**
 * Result of deriving a demographic profile from household composition.
 */
export interface HouseholdProfileDerivation {
  /**
   * Derived DemandPresetId — the archetype that best matches this household.
   * Feeds directly into the OccupancyPreset catalogue and buildOccupancyBehaviourFromSurvey.
   */
  derivedPresetId: DemandPresetId;

  /**
   * Human-readable explanation of why this preset was selected.
   * Useful for debugging, "why this profile?" tooltips, and portal/support workflows.
   *
   * Examples:
   *   "Teenagers present → family_teenagers"
   *   "Two adults + usually someone home → retired_couple"
   */
  derivationReason: string;

  /**
   * Total number of regular occupants derived from headcounts.
   * This should be written into EngineInputV2_3.occupancyCount.
   */
  occupancyCount: number;

  /**
   * Mapped daytime occupancy for the DemandTimingOverrides layer.
   * Converted from the three-option pattern into the engine's three-value enum.
   */
  daytimeOccupancyHint: Required<DemandTimingOverrides>['daytimeOccupancy'];

  /**
   * Bath frequency per week derived from the bathUse band and the presence of
   * young children (who typically have a nightly bath).
   */
  bathFrequencyPerWeek: number;

  /**
   * Simultaneous hot-water use severity derived from the number of
   * teenagers and young adults, and total occupancy.
   */
  simultaneousUseSeverity: Required<DemandTimingOverrides>['simultaneousUseSeverity'];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Map the three-option daytime pattern to the engine's daytimeOccupancy enum.
 */
function mapDaytimeOccupancy(
  pattern: DaytimeOccupancyPattern,
): Required<DemandTimingOverrides>['daytimeOccupancy'] {
  switch (pattern) {
    case 'usually_out':  return 'absent';
    case 'usually_home': return 'full';
    case 'irregular':    return 'partial';
  }
}

/**
 * Derive the best-fit DemandPresetId from household composition and pattern.
 *
 * Resolution order (highest priority first):
 *   1. Teenagers (11–17) present → 'family_teenagers'
 *      (strongest simultaneous-demand signal)
 *   2. Young children (0–4 or 5–10) present → 'family_young_children'
 *      (high bath usage, daytime presence)
 *   3. Bath-heavy pattern with no children → 'bath_heavy'
 *   4. 3+ adults / young-adults at home → 'multigenerational'
 *      (continuous high demand from multiple independent schedules)
 *   5. Two adults, usually home → 'retired_couple'
 *      (continuous spread demand, low peaks)
 *   6. Two adults, irregular → 'shift_worker'
 *   7. Two adults → 'working_couple'
 *   8. Single adult, usually home → 'home_worker'
 *   9. Single adult, irregular → 'shift_worker'
 *  10. Default → 'single_working_adult'
 *
 * Returns a `{ presetId, reason }` pair so the derivation rationale is
 * available for debugging, tooltips, and portal/support workflows.
 */
function deriveDemandPresetWithReason(
  composition: HouseholdComposition,
  pattern: DaytimeOccupancyPattern,
  bathUse: BathUsePattern,
): { presetId: DemandPresetId; reason: string } {
  const {
    adultCount,
    childCount0to4,
    childCount5to10,
    childCount11to17,
    youngAdultCount18to25AtHome,
  } = composition;

  const hasTeenagers     = childCount11to17 > 0;
  const hasYoungChildren = childCount0to4 > 0 || childCount5to10 > 0;

  // ── Child-age bands take priority ────────────────────────────────────────
  if (hasTeenagers) {
    return { presetId: 'family_teenagers', reason: 'Teenagers present → family_teenagers' };
  }
  if (hasYoungChildren) {
    return { presetId: 'family_young_children', reason: 'Young children present → family_young_children' };
  }

  // ── Bath-heavy pattern (adults only) ─────────────────────────────────────
  if (bathUse === 'frequent') {
    return { presetId: 'bath_heavy', reason: 'Frequent bath use (adults only) → bath_heavy' };
  }

  // ── Multi-person households ───────────────────────────────────────────────
  const totalAdultLike = adultCount + youngAdultCount18to25AtHome;
  if (totalAdultLike >= 3) {
    return { presetId: 'multigenerational', reason: '3+ adults/young-adults at home → multigenerational' };
  }

  // ── Two-adult households ──────────────────────────────────────────────────
  if (totalAdultLike === 2) {
    if (pattern === 'usually_home') {
      return { presetId: 'retired_couple', reason: 'Two adults + usually someone home → retired_couple' };
    }
    if (pattern === 'irregular') {
      return { presetId: 'shift_worker', reason: 'Two adults + irregular schedule → shift_worker' };
    }
    return { presetId: 'working_couple', reason: 'Two adults + usually out → working_couple' };
  }

  // ── Single-adult household ────────────────────────────────────────────────
  if (pattern === 'usually_home') {
    return { presetId: 'home_worker', reason: 'Single adult + usually home → home_worker' };
  }
  if (pattern === 'irregular') {
    return { presetId: 'shift_worker', reason: 'Single adult + irregular schedule → shift_worker' };
  }
  return { presetId: 'single_working_adult', reason: 'Single adult + usually out → single_working_adult' };
}

/**
 * Derive simultaneous hot-water use severity.
 *
 * Teenagers (11–17) and young adults (18–25) at home are the strongest
 * predictors of concurrent shower use.
 */
function deriveSimultaneousUseSeverity(
  composition: HouseholdComposition,
): Required<DemandTimingOverrides>['simultaneousUseSeverity'] {
  const { adultCount, childCount11to17, youngAdultCount18to25AtHome } = composition;
  const highDemandCount = childCount11to17 + youngAdultCount18to25AtHome;
  const totalOccupants =
    adultCount +
    composition.childCount0to4 +
    composition.childCount5to10 +
    childCount11to17 +
    youngAdultCount18to25AtHome;

  if (highDemandCount >= 2 || totalOccupants >= 4) return 'high';
  if (highDemandCount >= 1 || totalOccupants >= 3) return 'medium';
  return 'low';
}

/**
 * Derive bath frequency per week from the bathUse band and household type.
 *
 * Young children (0–4) typically have a nightly bath, which is incorporated
 * by setting a minimum based on their count.
 */
function deriveBathFrequencyPerWeek(
  composition: HouseholdComposition,
  bathUse: BathUsePattern,
): number {
  const baseFrequency = (() => {
    switch (bathUse) {
      case 'rare':      return 0;
      case 'sometimes': return 3;
      case 'frequent':  return 7;
    }
  })();

  // Young children (0–4) typically have at least one bath per day between them.
  const childBathBoost = Math.min(composition.childCount0to4, 7);

  return Math.min(14, Math.max(baseFrequency, childBathBoost));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Derive a complete demographic demand profile from real household composition
 * counts and two simple lifestyle pattern answers.
 *
 * This is the single entry-point for the household-composition → profile
 * derivation step.  Callers should pass the result fields directly into
 * EngineInputV2_3 and DemandTimingOverrides.
 *
 * @param composition  - Headcounts by age band from the survey lifestyle card.
 * @param daytimeOccupancy - Weekday daytime occupancy pattern (3 options).
 * @param bathUse          - Bath use frequency band (3 options).
 */
export function deriveProfileFromHouseholdComposition(
  composition: HouseholdComposition,
  daytimeOccupancy: DaytimeOccupancyPattern,
  bathUse: BathUsePattern,
): HouseholdProfileDerivation {
  const occupancyCount =
    Math.max(1, composition.adultCount) +
    composition.youngAdultCount18to25AtHome +
    composition.childCount0to4 +
    composition.childCount5to10 +
    composition.childCount11to17;

  const { presetId, reason } = deriveDemandPresetWithReason(composition, daytimeOccupancy, bathUse);

  return {
    derivedPresetId:          presetId,
    derivationReason:         reason,
    occupancyCount,
    daytimeOccupancyHint:     mapDaytimeOccupancy(daytimeOccupancy),
    bathFrequencyPerWeek:     deriveBathFrequencyPerWeek(composition, bathUse),
    simultaneousUseSeverity:  deriveSimultaneousUseSeverity(composition),
  };
}
