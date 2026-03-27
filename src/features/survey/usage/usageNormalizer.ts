/**
 * usageNormalizer.ts
 *
 * Maps the UI-level HomeState into a canonical structured object suitable
 * for downstream binding into EngineInputV2_3.
 *
 * The normalised output is intentionally a plain object so it can be
 * inspected in dev output before full engine wiring.
 *
 * Derivation layers:
 *   HomeState (UI survey capture)
 *     → deriveProfileFromHouseholdComposition (lib/occupancy)
 *     → NormalisedHome (this file)
 *     → engine wiring (householdComposition, bathroomCount, occupancyCount)
 */

import type { HomeState, HouseholdComposition } from './usageTypes';
import { deriveHomeSummary } from './usageRules';
import {
  deriveProfileFromHouseholdComposition,
} from '../../../lib/occupancy/deriveProfileFromHouseholdComposition';
import type {
  DaytimeOccupancyPattern,
  BathUsePattern,
} from '../../../lib/occupancy/deriveProfileFromHouseholdComposition';

// ─── Canonical output shape ────────────────────────────────────────────────────

export type NormalisedHome = {
  home: {
    /** Raw composition — written directly to EngineInputV2_3.householdComposition. */
    composition: HouseholdComposition;
    /** Weekday daytime occupancy pattern — for DemandTimingOverrides. */
    daytimeOccupancy: 'usually_out' | 'usually_home' | 'irregular' | 'unknown';
    /** Bath use frequency — for DemandTimingOverrides. */
    bathUse: 'rare' | 'sometimes' | 'frequent' | 'unknown';
    /** Number of bathrooms — for DHW concurrent draw risk gate. */
    bathroomCount: number | null;
    /** Derived total occupant count from composition. */
    occupancyCount: number;
    /** Derived demand preset ID. */
    derivedPresetId: string;
    /** Human-readable derivation reason (debugging / portal support). */
    derivationReason: string;
    /** Concurrency risk classification derived from composition. */
    concurrencyRisk: 'low' | 'medium' | 'high' | 'unknown';
    /** Volume demand band derived from bathUse + occupancy. */
    volumeDemandBand: 'low' | 'moderate' | 'high' | 'unknown';
    /** One-line demand summary. */
    summaryLine: string;
  };
};

// ─── Normalizer ───────────────────────────────────────────────────────────────

function toDaytimePattern(val: HomeState['daytimeOccupancy']): DaytimeOccupancyPattern {
  if (val === 'usually_out')  return 'usually_out';
  if (val === 'usually_home') return 'usually_home';
  if (val === 'irregular')    return 'irregular';
  return 'usually_out';
}

function toBathPattern(val: HomeState['bathUse']): BathUsePattern {
  if (val === 'rare')      return 'rare';
  if (val === 'sometimes') return 'sometimes';
  if (val === 'frequent')  return 'frequent';
  return 'sometimes';
}

/**
 * Produce a canonical home object from raw HomeState.
 *
 * Null values indicate fields that were left blank (not the same as
 * the surveyor selecting 'unknown').
 */
export function normaliseUsage(state: HomeState): NormalisedHome {
  const profile = deriveProfileFromHouseholdComposition(
    state.composition,
    toDaytimePattern(state.daytimeOccupancy),
    toBathPattern(state.bathUse),
  );

  const summary = deriveHomeSummary(state);

  return {
    home: {
      composition:       state.composition,
      daytimeOccupancy:  state.daytimeOccupancy,
      bathUse:           state.bathUse,
      bathroomCount:     state.bathroomCount,
      occupancyCount:    profile.occupancyCount,
      derivedPresetId:   profile.derivedPresetId,
      derivationReason:  profile.derivationReason,
      concurrencyRisk:   summary.concurrencyRisk,
      volumeDemandBand:  summary.volumeDemandBand,
      summaryLine:       summary.summaryLine,
    },
  };
}
