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
 * Placement: System Lab header, below the verdict strip.
 */

import './condensing.css';

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface CondensingIndicatorProps {
  /**
   * Estimated return-water temperature in °C.
   * Defaults to 55 °C (boundary of condensing operation).
   */
  returnTempC?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CondensingIndicator
 *
 * A compact horizontal progress bar that communicates how much of the time
 * the boiler is expected to operate in condensing mode.
 */
export default function CondensingIndicator({ returnTempC = 55 }: CondensingIndicatorProps) {
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
    </div>
  );
}
