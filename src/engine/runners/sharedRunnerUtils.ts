/**
 * sharedRunnerUtils.ts — Shared utility functions used across all family runners.
 *
 * These helpers encapsulate the repeated computation patterns that appear in
 * every runner.  Extracting them here avoids duplication and ensures any future
 * change to the calculation applies uniformly across all runner families.
 */

import type { LifestyleResult } from '../schema/EngineInputV2_3';

/**
 * Interpolates 15-minute demand heat output (kW) from an hourly lifestyle profile.
 *
 * Returns an array of 96 values (24 h × 4 quarters), each the linear interpolation
 * between adjacent hourly demand values.  The array is suitable for passing to
 * `buildBoilerEfficiencyModelV1` as `demandHeatKw96`.
 *
 * Returns `undefined` when the lifestyle result contains no hourly data.
 *
 * @param lifestyle  Result from `runLifestyleSimulationModule`.
 */
export function buildDemandHeatKw96(
  lifestyle: LifestyleResult,
): number[] | undefined {
  if (lifestyle.hourlyData.length === 0) return undefined;

  return Array.from({ length: 96 }, (_, i) => {
    const minute = i * 15;
    const hour = Math.floor(minute / 60);
    const frac = (minute % 60) / 60;
    const h0 = hour % 24;
    const h1 = (hour + 1) % 24;
    const d0 = lifestyle.hourlyData[h0]?.demandKw ?? 0;
    const d1 = lifestyle.hourlyData[h1]?.demandKw ?? 0;
    return parseFloat(Math.max(0, d0 + (d1 - d0) * frac).toFixed(3));
  });
}

/**
 * Computes the average load fraction from a lifestyle hourly demand profile.
 *
 * Used by `runCondensingStateModule` to derive the average fraction of peak demand
 * being met over the 24-hour period.  Returns `undefined` when the peak demand is
 * zero (no data or all-zero profile), which signals the condensing-state module to
 * fall back to its default behaviour.
 *
 * @param lifestyle  Result from `runLifestyleSimulationModule`.
 */
export function computeAverageLoadFraction(
  lifestyle: LifestyleResult,
): number | undefined {
  let peak = 0;
  let sum = 0;
  for (const h of lifestyle.hourlyData) {
    if (h.demandKw > peak) peak = h.demandKw;
    sum += h.demandKw;
  }
  if (peak <= 0) return undefined;
  return (sum / lifestyle.hourlyData.length) / peak;
}
