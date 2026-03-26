/**
 * usageRules.ts
 *
 * Derivation rules that map a UsageState to demand characterisation outputs.
 *
 * These rules are auditable: each mapping step is explicit and one-directional.
 * The mapping chain is:
 *   peakHotWaterConcurrency → concurrencyRisk
 *   bathUse + drawStyle     → volumeDemandBand
 *   occupancyPattern        → peakTimingHint
 *   householdSize           → sizingHint
 *
 * These outputs are informational — they inform the normaliser and eventually
 * the engine, but do not yet alter recommendation ranking directly.
 */

import type {
  UsageState,
  OccupancyPattern,
  BathUse,
  ConcurrencyLevel,
  DrawStyle,
} from './usageTypes';

// ─── Output types ─────────────────────────────────────────────────────────────

/** How likely simultaneous draw-off is to stress a combi or small store. */
export type ConcurrencyRisk = 'low' | 'medium' | 'high' | 'unknown';

/** Broad volume demand band — affects cylinder sizing. */
export type VolumeDemandBand = 'low' | 'moderate' | 'high' | 'unknown';

/** Hint about when peak demand occurs during the day. */
export type PeakTimingHint = 'morning_and_evening' | 'spread_through_day' | 'evening_concentrated' | 'unknown';

/** Sizing band derived from household size. */
export type SizingHint = 'single_or_couple' | 'small_family' | 'large_household' | 'unknown';

export type DerivedUsageSummary = {
  concurrencyRisk: ConcurrencyRisk;
  volumeDemandBand: VolumeDemandBand;
  peakTimingHint: PeakTimingHint;
  sizingHint: SizingHint;
  /** Human-readable one-line summary for dev/debug output. */
  summaryLine: string;
};

// ─── Rules ────────────────────────────────────────────────────────────────────

/** Map peak concurrency level to a risk classification. */
export function deriveConcurrencyRisk(level: ConcurrencyLevel): ConcurrencyRisk {
  if (level === 'unknown') return 'unknown';
  if (level === 1) return 'low';
  if (level === 2) return 'medium';
  if (level === 3 || level === '4_plus') return 'high';
  return 'unknown';
}

/** Map bath use + draw style to a volume demand band. */
export function deriveVolumeDemandBand(bathUse: BathUse, drawStyle: DrawStyle): VolumeDemandBand {
  if (bathUse === 'unknown' && drawStyle === 'unknown') return 'unknown';
  const bathScore =
    bathUse === 'frequent' ? 2 :
    bathUse === 'sometimes' ? 1 :
    bathUse === 'rare' ? 0 : 0;
  const drawScore =
    drawStyle === 'mostly_long' ? 2 :
    drawStyle === 'mixed' ? 1 :
    drawStyle === 'mostly_short' ? 0 : 0;
  const total = bathScore + drawScore;
  if (total >= 3) return 'high';
  if (total >= 1) return 'moderate';
  return 'low';
}

/** Map occupancy pattern to a peak timing hint. */
export function derivePeakTimingHint(pattern: OccupancyPattern): PeakTimingHint {
  switch (pattern) {
    case 'usually_out':      return 'morning_and_evening';
    case 'someone_home':     return 'spread_through_day';
    case 'irregular_shifts': return 'evening_concentrated';
    default:                 return 'unknown';
  }
}

/** Map household size to a sizing hint. */
export function deriveSizingHint(householdSize: number | null): SizingHint {
  if (householdSize === null) return 'unknown';
  if (householdSize <= 2)  return 'single_or_couple';
  if (householdSize <= 4)  return 'small_family';
  return 'large_household';
}

// ─── Top-level deriver ────────────────────────────────────────────────────────

/**
 * Derive a full demand summary from a UsageState.
 *
 * All mapping steps are explicit and auditable.
 * Returns 'unknown' for any dimension where input is unknown.
 */
export function deriveUsageSummary(state: UsageState): DerivedUsageSummary {
  const concurrencyRisk   = deriveConcurrencyRisk(state.peakHotWaterConcurrency);
  const volumeDemandBand  = deriveVolumeDemandBand(state.bathUse, state.drawStyle);
  const peakTimingHint    = derivePeakTimingHint(state.occupancyPattern);
  const sizingHint        = deriveSizingHint(state.householdSize);

  const parts: string[] = [];
  if (sizingHint !== 'unknown')        parts.push(SIZING_LABELS[sizingHint]);
  if (volumeDemandBand !== 'unknown')  parts.push(`${VOLUME_LABELS[volumeDemandBand]} volume demand`);
  if (concurrencyRisk !== 'unknown')   parts.push(`${CONCURRENCY_RISK_LABELS[concurrencyRisk]} concurrency risk`);

  const summaryLine = parts.length > 0 ? parts.join(' · ') : 'Usage not yet specified';

  return { concurrencyRisk, volumeDemandBand, peakTimingHint, sizingHint, summaryLine };
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export const SIZING_LABELS: Record<SizingHint, string> = {
  single_or_couple: '1–2 occupants',
  small_family:     '3–4 occupants',
  large_household:  '5+ occupants',
  unknown:          'Unknown household size',
};

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
