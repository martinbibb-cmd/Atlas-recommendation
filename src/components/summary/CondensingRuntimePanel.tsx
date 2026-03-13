/**
 * CondensingRuntimePanel.tsx
 *
 * PR 7 — Condensing Runtime Panel
 *
 * Renders the CondensingRuntimeModule result from FullEngineResultCore in the
 * System Lab summary tab.  Shows:
 *   - Estimated condensing runtime (% + band label)
 *   - Progress bar for visual context
 *   - Current condensing state (from CondensingStateModule — kept separate)
 *   - Main positive and negative drivers (2–5 items)
 *   - Proxy/inferred-input caveat text when applicable
 *
 * When `condensingRuntime` is null or omitted the panel renders a clear
 * "not available" state rather than placeholder data.
 *
 * Placement: System Lab summary tab, below the Performance Enablers panel.
 *
 * Guard: this is a lab-only diagnostic.  The result must never appear in
 * customer-facing recommendation copy or printed reports at this stage.
 */

import type {
  CondensingRuntimeResult,
  CondensingStateResult,
} from '../../engine/schema/EngineInputV2_3';
import './condensing-runtime-panel.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Band derived from estimated condensing runtime percentage. */
function runtimeBand(pct: number): 'green' | 'amber' | 'red' {
  if (pct >= 70) return 'green';
  if (pct >= 40) return 'amber';
  return 'red';
}

/** Human-readable band label. */
function bandLabel(band: 'green' | 'amber' | 'red'): string {
  if (band === 'green') return 'High';
  if (band === 'amber') return 'Moderate';
  return 'Low';
}

/** Badge class name for the current condensing state zone. */
function stateBadgeModifier(zone: CondensingStateResult['zone']): string {
  if (zone === 'condensing')    return 'condensing';
  if (zone === 'borderline')    return 'borderline';
  return 'non-condensing';
}

/** Human-readable label for the current condensing state zone. */
function zoneLabel(zone: CondensingStateResult['zone']): string {
  if (zone === 'condensing')    return '✅ Condensing now';
  if (zone === 'borderline')    return '⚠️ Borderline';
  return '🔴 Not condensing';
}

/**
 * Returns true when any proxy/inferred signal is actively shaping the result.
 *
 * v1 models always carry two proxy dimensions:
 *   - installationPolicy used as a control-quality proxy (driver 4)
 *   - primary pipe capacity inferred without measured lengths (driver 7)
 *
 * Additionally, if systemPlanType was not recorded, driver 5 defaults to a
 * neutral Y-plan baseline ("not recorded" in its detail string).
 */
function hasProxyInputs(result: CondensingRuntimeResult): boolean {
  return result.drivers.some(
    d =>
      d.id === 'primary_suitability_proxy' ||
      d.id === 'control_type' ||
      (d.id === 'system_separation_arrangement' &&
        d.detail.includes('not recorded')),
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /**
   * CondensingRuntimeModule result from FullEngineResultCore.
   * Pass `null` when no engine result is available.  The panel will render a
   * clear "not available" state rather than displaying misleading placeholder
   * data.
   */
  condensingRuntime?: CondensingRuntimeResult | null;
  /**
   * CondensingStateModule result from FullEngineResultCore.
   * Used to display the current condensing state separately from the runtime
   * estimate, keeping the two signals visually distinct.
   * Pass `null` when unavailable.
   */
  condensingState?: CondensingStateResult | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CondensingRuntimePanel
 *
 * Lab-only diagnostic panel showing the engine's condensing runtime estimate.
 * Renders a "not available" state when data is absent so it is always safe to
 * mount in the summary tab regardless of whether an engine run has occurred.
 */
export default function CondensingRuntimePanel({
  condensingRuntime,
  condensingState,
}: Props) {
  // ── Not-available path ────────────────────────────────────────────────────
  if (condensingRuntime == null) {
    return (
      <div
        className="crt-panel crt-panel--unavailable"
        aria-label="Estimated Condensing Runtime: not available"
      >
        <h3 className="crt-panel__title">Estimated Condensing Runtime</h3>
        <p className="crt-panel__na">— not available</p>
      </div>
    );
  }

  // ── Data-driven path ──────────────────────────────────────────────────────
  const { estimatedCondensingRuntimePct, positiveWording, negativeWording } =
    condensingRuntime;

  const band = runtimeBand(estimatedCondensingRuntimePct);

  return (
    <div
      className="crt-panel"
      aria-label={`Estimated Condensing Runtime: ${estimatedCondensingRuntimePct}%`}
    >
      {/* Title */}
      <h3 className="crt-panel__title">Estimated Condensing Runtime</h3>

      {/* Hero: percentage + band chip */}
      <div className="crt-panel__hero">
        <span
          className={`crt-panel__pct crt-panel__pct--${band}`}
          aria-label={`${estimatedCondensingRuntimePct} percent`}
        >
          {estimatedCondensingRuntimePct}%
        </span>
        <span className={`crt-panel__band crt-panel__band--${band}`}>
          {bandLabel(band)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="crt-panel__bar-wrap">
        <div className="crt-panel__track">
          <div
            className={`crt-panel__fill crt-panel__fill--${band}`}
            style={{ width: `${estimatedCondensingRuntimePct}%` }}
            role="progressbar"
            aria-valuenow={estimatedCondensingRuntimePct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Condensing runtime"
          />
        </div>
      </div>

      {/* Current state — kept separate from the runtime estimate */}
      <div>
        <p className="crt-panel__section-heading">Current state</p>
        <div className="crt-panel__state">
          {condensingState != null ? (
            <span
              className={`crt-panel__state-badge crt-panel__state-badge--${stateBadgeModifier(condensingState.zone)}`}
            >
              {zoneLabel(condensingState.zone)}
            </span>
          ) : (
            <span className="crt-panel__state-badge crt-panel__state-badge--unavailable">
              — not available
            </span>
          )}
        </div>
      </div>

      {/* Main drivers */}
      {(positiveWording.length > 0 || negativeWording.length > 0) && (
        <div>
          <p className="crt-panel__section-heading">Main drivers</p>
          <ul className="crt-panel__drivers" role="list">
            {positiveWording.map(text => (
              <li key={text} className="crt-panel__driver crt-panel__driver--positive">
                <span className="crt-panel__driver-icon" aria-hidden="true">+</span>
                <span className="crt-panel__driver-text">{text}</span>
              </li>
            ))}
            {negativeWording.map(text => (
              <li key={text} className="crt-panel__driver crt-panel__driver--negative">
                <span className="crt-panel__driver-icon" aria-hidden="true">−</span>
                <span className="crt-panel__driver-text">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Proxy caveat */}
      {hasProxyInputs(condensingRuntime) && (
        <div className="crt-panel__caveat" role="note">
          <span className="crt-panel__caveat-icon" aria-hidden="true">ⓘ</span>
          <span>
            Some inputs (control type, primary pipe capacity) are inferred from
            survey responses rather than directly measured. This is a proxy
            estimate — use it as a directional guide, not a precise figure.
          </span>
        </div>
      )}
    </div>
  );
}
