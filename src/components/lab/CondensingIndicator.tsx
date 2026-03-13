/**
 * CondensingIndicator.tsx
 *
 * Displays a visual bar showing the estimated percentage of operating hours
 * a gas condensing boiler spends in condensing mode.
 *
 * Physics:
 *   A boiler condenses when the return water temperature stays below the
 *   flue-gas dewpoint (~55 °C for natural gas).  Condensing operation
 *   recovers latent heat from the exhaust, improving seasonal efficiency
 *   by up to 15 %.
 *
 * Calculation (display model — no engine re-run):
 *   condensingPct = clamp(100 × (1 - (returnTemp − 35) / 30), 0, 100)
 *   where 35 °C → ~100 % condensing, 65 °C → ~0 % condensing.
 *
 * Colour bands:
 *   ≥ 70 %  → green  (full condensing)
 *   40–69 % → amber  (partial condensing)
 *   < 40 %  → red    (non-condensing)
 *
 * Signal source hierarchy (preferred → fallback):
 *   1. onePipeCascade  — measured average return from a one-pipe cascade model
 *   2. derived         — estimated as flowTempC − ΔT (design assumption)
 *   3. null            — no data; indicator shows "not available"
 *
 * Placement: System Lab header, below the verdict strip.
 */

import './condensing.css';
import type { CondensingStateResult } from '../../engine/schema/EngineInputV2_3';

// ─── Physics thresholds ───────────────────────────────────────────────────────

/** Return temp (°C) at which condensing is fully optimal — 100 % estimate. */
const CONDENSING_LOWER_BOUND_C = 35;

/**
 * Temperature range (°C) over which condensing fraction transitions from
 * ~100 % (at CONDENSING_LOWER_BOUND_C) to 0 % (at 65 °C = non-condensing).
 */
const CONDENSING_TEMP_RANGE_C = 30; // 65 °C − 35 °C

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Estimate the proportion of operating hours the boiler spends condensing.
 * Based on a linear interpolation between the lower (35 °C) and upper (65 °C)
 * return-temperature bounds.
 */
export function computeCondensingPct(returnTempC: number): number {
  return clamp(
    Math.round(100 * (1 - (returnTempC - CONDENSING_LOWER_BOUND_C) / CONDENSING_TEMP_RANGE_C)),
    0,
    100,
  );
}

/** Colour band derived from condensing percentage. */
function condensingBand(pct: number): 'green' | 'amber' | 'red' {
  if (pct >= 70) return 'green';
  if (pct >= 40) return 'amber';
  return 'red';
}

/** Human-readable label for a return-temperature source value. */
function sourceLabel(source: CondensingStateResult['returnTempSource']): string {
  switch (source) {
    case 'onePipeCascade': return 'onePipeCascade (measured)';
    case 'derived':        return 'derived (flowTempC − ΔT)';
    case 'unavailable':    return 'unavailable';
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CondensingIndicatorProps {
  /**
   * Full engine condensing-state result.  When provided the indicator derives
   * all display values (flow temp, return temp, zone) from this authoritative
   * source rather than relying on a caller-supplied scalar.
   *
   * Pass `null` when no engine result is available (e.g. standalone lab demo
   * without a completed survey).  The indicator will show a "not available"
   * state rather than displaying misleading placeholder data.
   *
   * Source hierarchy used inside the module:
   *   1. onePipeCascade — measured average return from one-pipe cascade model
   *   2. derived        — flowTempC − ΔT (design assumption, no measurement)
   */
  condensingState?: CondensingStateResult | null;
}

// ─── Expert debug panel ───────────────────────────────────────────────────────

/**
 * CondensingSignalDebug
 *
 * Compact debug readout shown in engineer mode.  Answers the question
 * "where did this condensing signal come from?" without requiring the user
 * to open the Glass Box panel.
 *
 * Hidden from customer-facing views; only visible when this component is
 * rendered inside an expert/engineer context.
 */
function CondensingSignalDebug({ cs }: { cs: CondensingStateResult }) {
  const zoneLabel = cs.zone === 'condensing'
    ? '✅ Condensing'
    : cs.zone === 'borderline'
      ? '⚠️ Borderline'
      : '🔴 Not condensing';

  return (
    <dl className="condensing-indicator__debug" aria-label="Condensing signal debug">
      <div className="condensing-indicator__debug-row">
        <dt>Flow temp</dt>
        <dd>{cs.flowTempC} °C</dd>
      </div>
      <div className="condensing-indicator__debug-row">
        <dt>Return temp</dt>
        <dd>{cs.fullLoadReturnC.toFixed(1)} °C</dd>
      </div>
      <div className="condensing-indicator__debug-row">
        <dt>Threshold</dt>
        <dd>{cs.condensingThresholdC} °C</dd>
      </div>
      <div className="condensing-indicator__debug-row">
        <dt>State</dt>
        <dd>{zoneLabel}</dd>
      </div>
      <div className="condensing-indicator__debug-row">
        <dt>Source</dt>
        <dd>{sourceLabel(cs.returnTempSource)}</dd>
      </div>
    </dl>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CondensingIndicator
 *
 * A compact horizontal progress bar that communicates how much of the time
 * the boiler is expected to operate in condensing mode.
 *
 * When `condensingState` is `null` or omitted the indicator renders a
 * "not available" state rather than showing a misleading placeholder value.
 * This makes it safe to render before any engine result is available.
 */
export default function CondensingIndicator({ condensingState }: CondensingIndicatorProps) {
  // ── Not-available path ────────────────────────────────────────────────────
  if (condensingState == null) {
    return (
      <div className="condensing-indicator condensing-indicator--unavailable" aria-label="Condensing operation: not available">
        <span className="condensing-indicator__heading">Condensing Operation</span>
        <span className="condensing-indicator__na">— not available</span>
      </div>
    );
  }

  // ── Data-driven path ──────────────────────────────────────────────────────
  const returnTempC = condensingState.fullLoadReturnC;
  const pct  = computeCondensingPct(returnTempC);
  const band = condensingBand(pct);

  const label =
    band === 'green' ? 'Full condensing operation'
    : band === 'amber' ? 'Partial condensing operation'
    : 'Non-condensing — return temp too high';

  return (
    <div
      className="condensing-indicator"
      aria-label={`Condensing operation: ${pct}%`}
      title={`Return temp: ${returnTempC} °C — ${label}`}
    >
      <span className="condensing-indicator__heading">Condensing Operation</span>
      <div className="condensing-indicator__bar-wrap">
        <div className="condensing-indicator__track">
          <div
            className={`condensing-indicator__fill condensing-indicator__fill--${band}`}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <span className={`condensing-indicator__pct condensing-indicator__pct--${band}`}>
          {pct}%
        </span>
      </div>
      <span className={`condensing-indicator__label condensing-indicator__label--${band}`}>
        {label}
      </span>
      <CondensingSignalDebug cs={condensingState} />
    </div>
  );
}
