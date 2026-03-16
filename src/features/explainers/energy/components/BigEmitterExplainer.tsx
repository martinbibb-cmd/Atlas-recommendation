/**
 * BigEmitterExplainer.tsx
 *
 * Visual: same room heat target delivered via three emitter configurations:
 *   1. Small emitter → requires high flow temperature
 *   2. Large emitter → same heat at low flow temperature
 *   3. Multiple low emitters → equivalent large release area
 *
 * Connects emitter size → flow temp → COP → running cost.
 */

import { useState } from 'react';
import EnergyExplainerCard from './EnergyExplainerCard';
import { ENERGY_COPY } from '../data/energyExplainerCopy';
import { explainEmitterEffect } from '../lib/energyMath';
import './BigEmitterExplainer.css';

// ─── Emitter configurations ───────────────────────────────────────────────────

const EMITTER_CONFIGS = [
  {
    id: 'small',
    label: ENERGY_COPY.bigEmitter.smallLabel,
    detail: ENERGY_COPY.bigEmitter.smallDetail,
    flowTempC: 72,
    icon: '🔴',
    barWidth: 15,
  },
  {
    id: 'large',
    label: ENERGY_COPY.bigEmitter.largeLabel,
    detail: ENERGY_COPY.bigEmitter.largeDetail,
    flowTempC: 45,
    icon: '🟢',
    barWidth: 55,
  },
  {
    id: 'multiple',
    label: ENERGY_COPY.bigEmitter.multipleLabel,
    detail: ENERGY_COPY.bigEmitter.multipleDetail,
    flowTempC: 40,
    icon: '🟢',
    barWidth: 70,
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function BigEmitterExplainer() {
  const [activeId, setActiveId] = useState<string>('small');

  const active = EMITTER_CONFIGS.find((c) => c.id === activeId) ?? EMITTER_CONFIGS[0];
  const effectLabel = explainEmitterEffect(active.flowTempC);

  return (
    <EnergyExplainerCard
      title={ENERGY_COPY.bigEmitter.title}
      badge="Phase 1"
      className="bee"
    >
      <p className="bee__subtitle">{ENERGY_COPY.bigEmitter.subtitle}</p>

      {/* ── Config selector ─────────────────────────────────────────────────── */}
      <div className="bee__selector" role="group" aria-label="Select emitter configuration">
        {EMITTER_CONFIGS.map((config) => (
          <button
            key={config.id}
            type="button"
            className={`bee__config-btn${activeId === config.id ? ' bee__config-btn--active' : ''}`}
            onClick={() => setActiveId(config.id)}
            aria-pressed={activeId === config.id}
          >
            <span className="bee__config-icon" aria-hidden="true">{config.icon}</span>
            <span className="bee__config-label">{config.label}</span>
          </button>
        ))}
      </div>

      {/* ── Visual outlet representation ────────────────────────────────────── */}
      <div className="bee__visual" aria-label="Emitter area visualisation">
        <div className="bee__room-label">Room heat demand (same in all cases)</div>
        <div className="bee__outlet-row">
          <div
            className="bee__outlet"
            style={{ width: `${active.barWidth}%` }}
            aria-label={`Emitter area: ${active.barWidth}% of maximum`}
          />
          <div className="bee__outlet-spacer" style={{ width: `${100 - active.barWidth}%` }} />
        </div>
        <div className="bee__flow-temp-row">
          <span className="bee__flow-temp-label">Required flow temperature</span>
          <span
            className={`bee__flow-temp-value${active.flowTempC > 55 ? ' bee__flow-temp-value--high' : ' bee__flow-temp-value--low'}`}
            aria-live="polite"
          >
            {active.flowTempC} °C
          </span>
        </div>
      </div>

      {/* ── Detail text ─────────────────────────────────────────────────────── */}
      <div className="bee__detail">
        <p className="bee__detail-text">{active.detail}</p>
        <p className="bee__effect-text" aria-live="polite">{effectLabel}</p>
      </div>

      {/* ── Consequence chain ────────────────────────────────────────────────── */}
      <p className="bee__consequence">{ENERGY_COPY.bigEmitter.consequence}</p>

    </EnergyExplainerCard>
  );
}
