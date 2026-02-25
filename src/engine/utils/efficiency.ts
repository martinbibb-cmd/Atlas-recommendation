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
 * Clamp `n` to the closed interval [min, max].
 * Defaults reflect the valid SEDBUK / in-use boiler efficiency range (50–99 %).
 */
export function clampPct(n: number, min = 50, max = 99): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Resolve the nominal (as-installed) boiler efficiency percentage.
 *
 * Single fallback point: when `inputSedbuk` is absent the function applies the
 * 92 % industry default *before* clamping.  No other call site should contain
 * a `?? 92` for nominal efficiency.
 */
export function resolveNominalEfficiencyPct(inputSedbuk?: number): number {
  return clampPct(inputSedbuk ?? 92);
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
