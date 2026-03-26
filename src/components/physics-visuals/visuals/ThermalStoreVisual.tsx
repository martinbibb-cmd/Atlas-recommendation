/**
 * ThermalStoreVisual.tsx
 *
 * Legacy-system explainer visual for the thermal store architecture.
 *
 * Shows:
 *   - A boiler pushing high-temperature primary water (75–85 °C) into a
 *     thermal store vessel (glowing amber/orange to signal high temperature).
 *   - An internal heat exchanger coil inside the store, producing domestic
 *     hot water from the stored heat.
 *   - A flow-temperature badge indicating the high primary requirement.
 *   - An efficiency note showing why high-temperature dependence is a drawback.
 *
 * This visual is intentionally constrained to current-system / explainer
 * contexts. It must NOT appear on shortlist or recommendation pages.
 */

import type { ThermalStoreVisualProps } from '../physicsVisualTypes';
import './ThermalStoreVisual.css';

// ─── Component ──────────────────────────────────────────────────────────────────

export default function ThermalStoreVisual({
  flowTempBand = 'high',
  reducedMotion = false,
  emphasis = 'medium',
  displayMode = 'preview',
  caption,
}: ThermalStoreVisualProps) {
  const tempLabel = flowTempBand === 'very_high' ? '80–85 °C primary' : '75–85 °C primary';

  return (
    <div
      className={[
        'tsv',
        `tsv--flow-${flowTempBand}`,
        `tsv--emphasis-${emphasis}`,
        `tsv--mode-${displayMode}`,
        reducedMotion ? 'tsv--reduced-motion' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="img"
      aria-label={`Thermal store: stores heat at ${tempLabel}, produces hot water through heat exchanger`}
    >
      {/* ── Boiler ────────────────────────────────────────────────────────── */}
      <div className="tsv__boiler" aria-hidden="true">
        <div className="tsv__boiler-body">
          <span className="tsv__boiler-label">Boiler</span>
        </div>
        <div className="tsv__temp-badge">
          <span className="tsv__temp-text">{tempLabel}</span>
        </div>
      </div>

      {/* ── Primary flow arrow ────────────────────────────────────────────── */}
      <div
        className={`tsv__flow-arrow${reducedMotion ? '' : ' tsv__flow-arrow--animated'}`}
        aria-hidden="true"
      />

      {/* ── Thermal store vessel ──────────────────────────────────────────── */}
      <div className="tsv__store" aria-hidden="true">
        <span className="tsv__store-label">Thermal store</span>

        {/* Heat exchanger coil inside the store */}
        <div className="tsv__coil">
          <div
            className={`tsv__coil-element${reducedMotion ? '' : ' tsv__coil-element--animated'}`}
          />
          <span className="tsv__coil-label">Heat exchanger</span>
        </div>

        {/* Glow layer — signals stored heat / high temperature */}
        <div
          className={`tsv__glow${reducedMotion ? '' : ' tsv__glow--animated'}`}
          aria-hidden="true"
        />
      </div>

      {/* ── DHW output arrow ─────────────────────────────────────────────── */}
      <div className="tsv__dhw-arrow" aria-hidden="true" />

      {/* ── DHW tap output ────────────────────────────────────────────────── */}
      <div className="tsv__tap" aria-hidden="true">
        <span className="tsv__tap-label">Domestic hot water</span>
        <span className="tsv__tap-note">via heat exchanger</span>
      </div>

      {/* ── Drawback note ─────────────────────────────────────────────────── */}
      {displayMode !== 'preview' && (
        <div className="tsv__drawback" role="note">
          High primary temperature required — prevents efficient condensing operation and heat pump compatibility.
        </div>
      )}

      {caption && <p className="tsv__caption">{caption}</p>}
    </div>
  );
}
