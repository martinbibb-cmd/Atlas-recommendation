/**
 * usageRules.ts
 *
 * Derivation rules for the Home / Demographics step.
 *
 * All demand signals are derived from household composition (age groups +
 * headcounts) and two simple lifestyle answers.  Users do not enter flow
 * rates, concurrency figures, or draw styles directly.
 *
 * The mapping chain:
 *   composition + daytimeOccupancy + bathUse
 *     → deriveProfileFromHouseholdComposition (lib/occupancy)
 *     → occupancyCount + demandPreset + simultaneousUseSeverity
 *     → concurrencyRisk + summaryLine
 */

import type { HomeState, BathUse, DaytimeOccupancy } from './usageTypes';
import {
  deriveProfileFromHouseholdComposition,
} from '../../../lib/occupancy/deriveProfileFromHouseholdComposition';
import type {
  DaytimeOccupancyPattern,
  BathUsePattern,
} from '../../../lib/occupancy/deriveProfileFromHouseholdComposition';

// ─── Output types ─────────────────────────────────────────────────────────────

/** How likely simultaneous draw-off is to stress a combi or small store. */
export type ConcurrencyRisk = 'low' | 'medium' | 'high' | 'unknown';

/** Broad volume demand band — affects cylinder sizing. */
export type VolumeDemandBand = 'low' | 'moderate' | 'high' | 'unknown';

export type DerivedHomeSummary = {
  occupancyCount: number;
  concurrencyRisk: ConcurrencyRisk;
  volumeDemandBand: VolumeDemandBand;
  /** Human-readable one-line summary for dev/debug output. */
  summaryLine: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map DaytimeOccupancy to the library's DaytimeOccupancyPattern. */
function mapDaytimeOccupancy(val: DaytimeOccupancy): DaytimeOccupancyPattern {
  if (val === 'usually_out')  return 'usually_out';
  if (val === 'usually_home') return 'usually_home';
  if (val === 'irregular')    return 'irregular';
  return 'usually_out'; // default for 'unknown'
}

/** Map BathUse to the library's BathUsePattern. */
function mapBathUse(val: BathUse): BathUsePattern {
  if (val === 'rare')      return 'rare';
  if (val === 'sometimes') return 'sometimes';
  if (val === 'frequent')  return 'frequent';
  return 'sometimes'; // default for 'unknown'
}

/** Map simultaneousUseSeverity to a concurrency risk. */
function severityToRisk(
  severity: 'low' | 'medium' | 'high',
): ConcurrencyRisk {
  if (severity === 'high')   return 'high';
  if (severity === 'medium') return 'medium';
  return 'low';
}

/** Derive a broad volume demand band from bath use and occupancy count. */
function deriveVolumeDemandBand(bathUse: BathUse, occupancy: number): VolumeDemandBand {
  const bathScore =
    bathUse === 'frequent' ? 2 :
    bathUse === 'sometimes' ? 1 :
    0;
  const sizeScore =
    occupancy >= 5 ? 2 :
    occupancy >= 3 ? 1 :
    0;
  const total = bathScore + sizeScore;
  if (total >= 3) return 'high';
  if (total >= 1) return 'moderate';
  return 'low';
}

// ─── Top-level deriver ────────────────────────────────────────────────────────

/**
 * Derive a full home demand summary from HomeState.
 *
 * All derivation is from demographics — no manual demand entry required.
 * When daytimeOccupancy or bathUse are 'unknown', sensible defaults are used
 * so that occupancyCount and concurrencyRisk are always available.
 */
export function deriveHomeSummary(state: HomeState): DerivedHomeSummary {
  const daytimePattern = mapDaytimeOccupancy(state.daytimeOccupancy);
  const bathPattern    = mapBathUse(state.bathUse);

  const profile = deriveProfileFromHouseholdComposition(
    state.composition,
    daytimePattern,
    bathPattern,
  );

  const occupancyCount  = profile.occupancyCount;
  const concurrencyRisk = state.daytimeOccupancy === 'unknown' && state.bathUse === 'unknown'
    ? 'unknown' as ConcurrencyRisk
    : severityToRisk(profile.simultaneousUseSeverity);
  const volumeDemandBand = state.bathUse === 'unknown'
    ? 'unknown' as VolumeDemandBand
    : deriveVolumeDemandBand(state.bathUse, occupancyCount);

  const parts: string[] = [];
  parts.push(`${occupancyCount} occupant${occupancyCount !== 1 ? 's' : ''}`);
  if (volumeDemandBand !== 'unknown') parts.push(`${VOLUME_LABELS[volumeDemandBand]} volume demand`);
  if (concurrencyRisk  !== 'unknown') parts.push(`${CONCURRENCY_RISK_LABELS[concurrencyRisk]} concurrency risk`);

  const summaryLine = parts.join(' · ');

  return { occupancyCount, concurrencyRisk, volumeDemandBand, summaryLine };
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export const VOLUME_LABELS: Record<VolumeDemandBand, string> = {
  low:      'Low',
  moderate: 'Moderate',
  high:     'High',
  unknown:  'Unknown',
};

export const CONCURRENCY_RISK_LABELS: Record<ConcurrencyRisk, string> = {
  low:     'Low',
  medium:  'Medium',
  high:    'High',
  unknown: 'Unknown',
};
