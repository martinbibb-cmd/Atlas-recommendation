/**
 * usageNormalizer.ts
 *
 * Maps the UI-level UsageState into a canonical structured object suitable
 * for later binding into engine demand modelling.
 *
 * This is a first-pass normalizer — the output shape is a plain object
 * (not yet wired into EngineInputV2_3) so it can be inspected in dev output
 * before full engine wiring.
 *
 * Layers preserved:
 *   raw UsageState       → UI survey capture
 *   NormalisedUsage      → canonical demand output (this file)
 *   engine wiring        → future: maps to occupancyCount / simulator inputs
 */

import type { UsageState } from './usageTypes';
import { deriveUsageSummary } from './usageRules';

// ─── Canonical output shape ────────────────────────────────────────────────────

export type NormalisedUsage = {
  demand: {
    occupancyPattern: 'usually_out' | 'someone_home' | 'irregular_shifts' | 'unknown';
    bathUse: 'rare' | 'sometimes' | 'frequent' | 'unknown';
    peakHotWaterConcurrency: 1 | 2 | 3 | '4_plus' | 'unknown';
    drawStyle: 'mostly_short' | 'mixed' | 'mostly_long' | 'unknown';
    householdSize: number | null;
    /** Derived concurrency risk classification. */
    concurrencyRisk: 'low' | 'medium' | 'high' | 'unknown';
    /** Derived volume demand band. */
    volumeDemandBand: 'low' | 'moderate' | 'high' | 'unknown';
    /** Derived peak timing hint. */
    peakTimingHint: 'morning_and_evening' | 'spread_through_day' | 'evening_concentrated' | 'unknown';
    /** Human-readable one-line summary. */
    summaryLine: string;
  };
};

// ─── Normalizer ───────────────────────────────────────────────────────────────

/**
 * Produce a canonical demand object from raw UsageState.
 *
 * - All unknown fields are preserved as-is
 * - Derived fields (concurrencyRisk, volumeDemandBand, peakTimingHint) are
 *   computed from the raw inputs via usageRules
 * - householdSize is passed through as-is for downstream sizing use
 */
export function normaliseUsage(state: UsageState): NormalisedUsage {
  const derived = deriveUsageSummary(state);
  return {
    demand: {
      occupancyPattern:        state.occupancyPattern,
      bathUse:                 state.bathUse,
      peakHotWaterConcurrency: state.peakHotWaterConcurrency,
      drawStyle:               state.drawStyle,
      householdSize:           state.householdSize,
      concurrencyRisk:         derived.concurrencyRisk,
      volumeDemandBand:        derived.volumeDemandBand,
      peakTimingHint:          derived.peakTimingHint,
      summaryLine:             derived.summaryLine,
    },
  };
}
