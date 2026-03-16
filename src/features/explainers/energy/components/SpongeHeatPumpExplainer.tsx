/**
 * SpongeHeatPumpExplainer.tsx
 *
 * Visual explainer: outside air as a "bath of low-grade heat", heat pump as
 * a sponge, compressor as the squeeze, emitters as the release.
 *
 * Includes a gentle/hard squeeze toggle that demonstrates the COP tradeoff.
 */

import { useState } from 'react';
import EnergyExplainerCard from './EnergyExplainerCard';
import { ENERGY_COPY } from '../data/energyExplainerCopy';
import './SpongeHeatPumpExplainer.css';

// ─── Component ────────────────────────────────────────────────────────────────

export default function SpongeHeatPumpExplainer() {
  const [isHardSqueeze, setIsHardSqueeze] = useState(false);

  const cop = isHardSqueeze ? 2.1 : 3.8;
  const squeezeLabel = isHardSqueeze
    ? ENERGY_COPY.sponge.hardLabel
    : ENERGY_COPY.sponge.gentleLabel;

  return (
    <EnergyExplainerCard
      title={ENERGY_COPY.sponge.title}
      badge="Phase 1"
      className="sphe"
    >
      <p className="sphe__subtitle">{ENERGY_COPY.sponge.subtitle}</p>

      {/* ── Stage diagram ──────────────────────────────────────────────────── */}
      <div className="sphe__stages">

        {/* Stage 1 — outdoor air bath */}
        <div className="sphe__stage sphe__stage--air">
          <div className="sphe__stage-icon" aria-hidden="true">🌡️</div>
          <div className="sphe__stage-label">{ENERGY_COPY.sponge.bathLabel}</div>
        </div>

        <div className="sphe__arrow" aria-hidden="true">→</div>

        {/* Stage 2 — heat pump / sponge */}
        <div className={`sphe__stage sphe__stage--pump${isHardSqueeze ? ' sphe__stage--hard' : ''}`}>
          <div className="sphe__stage-icon" aria-hidden="true">
            {isHardSqueeze ? '🪣' : '🧽'}
          </div>
          <div className="sphe__stage-label">{ENERGY_COPY.sponge.spongeLabel}</div>
        </div>

        <div className="sphe__arrow" aria-hidden="true">→</div>

        {/* Stage 3 — compressor */}
        <div className="sphe__stage sphe__stage--compressor">
          <div className="sphe__stage-icon" aria-hidden="true">⚙️</div>
          <div className="sphe__stage-label">{ENERGY_COPY.sponge.squeezeLabel}</div>
        </div>

        <div className="sphe__arrow" aria-hidden="true">→</div>

        {/* Stage 4 — emitters */}
        <div className="sphe__stage sphe__stage--emitters">
          <div className="sphe__stage-icon" aria-hidden="true">🏠</div>
          <div className="sphe__stage-label">{ENERGY_COPY.sponge.emittersLabel}</div>
        </div>

      </div>

      {/* ── Squeeze toggle ─────────────────────────────────────────────────── */}
      <div className="sphe__toggle-row">
        <button
          type="button"
          className={`sphe__toggle-btn${!isHardSqueeze ? ' sphe__toggle-btn--active' : ''}`}
          onClick={() => setIsHardSqueeze(false)}
          aria-pressed={!isHardSqueeze}
        >
          Gentle squeeze
        </button>
        <button
          type="button"
          className={`sphe__toggle-btn${isHardSqueeze ? ' sphe__toggle-btn--active sphe__toggle-btn--hard' : ''}`}
          onClick={() => setIsHardSqueeze(true)}
          aria-pressed={isHardSqueeze}
        >
          Hard squeeze
        </button>
      </div>

      {/* ── COP result ─────────────────────────────────────────────────────── */}
      <div className={`sphe__cop-row${isHardSqueeze ? ' sphe__cop-row--hard' : ''}`}>
        <span className="sphe__cop-value" aria-live="polite">COP {cop.toFixed(1)}</span>
        <span className="sphe__cop-label">{squeezeLabel}</span>
      </div>

      {/* ── Explanation note ───────────────────────────────────────────────── */}
      <p className="sphe__note">{ENERGY_COPY.sponge.copNote}</p>

    </EnergyExplainerCard>
  );
}
