/**
 * Shared boiler efficiency helpers.
 *
 * These are the single source of truth for clamping, fallback, and post-decay
 * efficiency calculations. All call sites (TimelineBuilder, FullSurveyStepper,
 * etc.) must use these helpers so that the logic stays consistent and testable.
 *
 * All values are in percentage points (e.g. 84, not 0.84).
 */

/**
 * Industry-standard nominal boiler efficiency fallback (percentage points).
 *
 * This is the single authoritative definition of the 92 % default.
 * All code that needs this value must import this constant — never write the
 * literal 92 elsewhere in production source.
 */
export const DEFAULT_NOMINAL_EFFICIENCY_PCT = 92;

/**
 * ErP energy-label class for boilers (A–G as printed on the appliance label).
 * A = highest efficiency (≥ 90 % SEDBUK seasonal); G = lowest (pre-condensing, < 70 %).
 */
export type ErpClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

/**
 * Indicative SEDBUK seasonal efficiency midpoints for each ErP class (percentage points).
 *
 * These are representative midpoints within each band, not hard regulatory boundaries.
 * Used when the surveyor knows the label but not the exact SEDBUK figure.
 *
 * Canonical source of truth — import from here; never redefine in other files.
 */
export const ERP_TO_NOMINAL_PCT: Record<ErpClass, number> = {
  A: 92, // condensing A-rated (≥ 90 % SEDBUK)
  B: 88, // high-efficiency condensing
  C: 84, // mid-range condensing
  D: 80, // lower condensing
  E: 76, // marginal condensing
  F: 70, // non-condensing / early condensing
  G: 62, // pre-condensing / old atmospheric
};

/**
 * Clamp `n` to the closed interval [min, max].
 * Defaults reflect the valid SEDBUK / in-use boiler efficiency range (50–99 %).
 */
export function clampPct(n: number, min = 50, max = 99): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Resolve the nominal (as-installed) boiler efficiency percentage.
 *
 * Single fallback point: when `inputSedbuk` is absent the function applies
 * `DEFAULT_NOMINAL_EFFICIENCY_PCT` (92 %) *before* clamping.  No other call
 * site should contain a `?? 92` for nominal efficiency.
 */
export function resolveNominalEfficiencyPct(inputSedbuk?: number): number {
  return clampPct(inputSedbuk ?? DEFAULT_NOMINAL_EFFICIENCY_PCT);
}

/**
 * Compute the current (post-decay) boiler efficiency percentage.
 *
 * `clampPct(nominal - decay)` replaces `Math.max(50, nominal - decay)` everywhere,
 * enforcing both floor (50) and ceiling (99) even when decay is negative (uplift).
 */
export function computeCurrentEfficiencyPct(nominalPct: number, decayPct: number): number {
  return clampPct(nominalPct - decayPct);
}

/**
 * Derive the ErP energy label class (A–G) from a nominal seasonal efficiency (percentage points).
 *
 * Returns the highest class whose midpoint the nominal efficiency meets or exceeds.
 * Returns null when `nominalPct` is negative or otherwise nonsensical.
 */
export function deriveErpClass(nominalPct: number): ErpClass | null {
  if (nominalPct < 0) return null;
  if (nominalPct >= ERP_TO_NOMINAL_PCT.A) return 'A';
  if (nominalPct >= ERP_TO_NOMINAL_PCT.B) return 'B';
  if (nominalPct >= ERP_TO_NOMINAL_PCT.C) return 'C';
  if (nominalPct >= ERP_TO_NOMINAL_PCT.D) return 'D';
  if (nominalPct >= ERP_TO_NOMINAL_PCT.E) return 'E';
  if (nominalPct >= ERP_TO_NOMINAL_PCT.F) return 'F';
  return 'G';
}
