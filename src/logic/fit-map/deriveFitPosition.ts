/**
 * deriveFitPosition.ts
 *
 * Derives a FitPosition from a completed EngineInputV2_3.
 *
 * Extracted from App.tsx so this logic can be unit-tested independently of
 * the React component tree.
 *
 * Key fix (PR1b): Occupancy for the fit map is now derived from
 * `occupancyCount` (set by sanitiseModelForEngine from householdComposition),
 * NOT from the legacy `occupancySignature` field.  `occupancySignature`
 * defaults to 'professional' and is never updated from survey data, so it
 * would systematically undercount demand and give combis an unfair boost.
 */

import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import { computeFitPosition } from './computeFitPosition';
import type { FitPosition } from './computeFitPosition';

/** Minimum occupancy count that triggers 'steady' demand profile on the fit map.
 *  At 3+ occupants concurrent hot-water draw is likely — treat as steady demand. */
export const FIT_MAP_STEADY_OCCUPANCY_MIN = 3;

/**
 * Derive a FitPosition from a completed engine input.
 *
 * @param engineInput - A sanitised EngineInputV2_3 (post sanitiseModelForEngine).
 */
export function deriveFitPosition(engineInput: EngineInputV2_3): FitPosition {
  const pipe = engineInput.primaryPipeDiameter;
  const pipeMm: 15 | 22 | 28 | 35 =
    pipe === 15 || pipe === 22 || pipe === 28 || pipe === 35 ? pipe : 22;

  // Prefer the explicitly measured or derived peakConcurrentOutlets when available
  // (set by sanitiseModelForEngine from demandPreset); fall back to bathroomCount.
  const peakOutlets = engineInput.peakConcurrentOutlets ?? (engineInput.bathroomCount ?? 1);

  // Prefer the newer dynamicMainsPressureBar field over the legacy dynamicMainsPressure.
  const pressureBar = engineInput.dynamicMainsPressureBar ?? engineInput.dynamicMainsPressure ?? 1.5;

  // Derive occupancy type from canonical occupancyCount when available.
  // occupancySignature is a legacy field that defaults to 'professional' and is
  // never updated from survey data, so it would produce a systematically low
  // demand signal.  Using occupancyCount (set by sanitiseModelForEngine from
  // householdComposition) gives an accurate demand signal.
  const occupancyCount = engineInput.occupancyCount ?? 0;
  const occupancyForFitMap: 'professional' | 'steady' | 'shift' =
    occupancyCount >= FIT_MAP_STEADY_OCCUPANCY_MIN ? 'steady'
    : engineInput.occupancySignature === 'shift' ? 'shift'
    : 'professional';

  return computeFitPosition({
    peakConcurrentOutlets: Math.max(1, peakOutlets),
    mainsDynamicPressureBar: pressureBar,
    primaryPipeSizeMm: pipeMm,
    thermalInertia: engineInput.buildingMass === 'heavy' ? 'high'
      : engineInput.buildingMass === 'light' ? 'low' : 'medium',
    occupancy: occupancyForFitMap,
  });
}
