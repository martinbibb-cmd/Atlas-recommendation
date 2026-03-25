/**
 * PhysicsVisualGallery.tsx
 *
 * Developer preview surface for the Atlas Physics Visual Library.
 *
 * Shows every registered visual in a card layout with:
 *   - title and purpose from the registry
 *   - the live animation
 *   - the associated script (title, summary, bullets, takeaway)
 *   - simple per-card controls where the visual accepts configurable state
 *
 * This component is intentionally dev-facing. It does not need to be polished
 * for end-user consumption — it exists so the team can review visuals quickly.
 *
 * Access via ?gallery=1 URL param.
 */

import { useState } from 'react';
import { getAllVisualDefinitions } from '../physicsVisualRegistry';
import { getVisualScript } from '../physicsVisualScripts';
import type { PhysicsVisualId, DrivingStyleMode } from '../physicsVisualTypes';
import DrivingStyleVisual from '../visuals/DrivingStyleVisual';
import FlowSplitVisual from '../visuals/FlowSplitVisual';
import SolarMismatchVisual from '../visuals/SolarMismatchVisual';
import CylinderChargeVisual from '../visuals/CylinderChargeVisual';
import './PhysicsVisualGallery.css';

// ─── Per-visual card controls state ───────────────────────────────────────────

interface CardState {
  reducedMotion: boolean;
  // driving_style
  drivingMode: DrivingStyleMode;
  // flow_split
  outletsActive: 1 | 2 | 3;
  pressureLevel: 'low' | 'normal' | 'high';
  // cylinder_charge
  fillLevel: number;
  mixergyMode: boolean;
}

function defaultCardState(): CardState {
  return {
    reducedMotion: false,
    drivingMode: 'combi',
    outletsActive: 1,
    pressureLevel: 'normal',
    fillLevel: 0.6,
    mixergyMode: false,
  };
}

// ─── Script panel ─────────────────────────────────────────────────────────────

function ScriptPanel({ id }: { id: PhysicsVisualId }) {
  const script = getVisualScript(id);
  return (
    <div className="pvg__script">
      <p className="pvg__script-summary">{script.summary}</p>
      {script.bullets && script.bullets.length > 0 && (
        <ul className="pvg__script-bullets">
          {script.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {script.takeaway && (
        <p className="pvg__script-takeaway">
          <strong>Key point:</strong> {script.takeaway}
        </p>
      )}
    </div>
  );
}

// ─── Visual renderer with controls ────────────────────────────────────────────

function VisualWithControls({
  id,
  state,
  onStateChange,
}: {
  id: PhysicsVisualId;
  state: CardState;
  onStateChange: (patch: Partial<CardState>) => void;
}) {
  const shared = { reducedMotion: state.reducedMotion };

  switch (id) {
    case 'driving_style':
      return (
        <div className="pvg__visual-section">
          <div className="pvg__visual-frame">
            <DrivingStyleVisual {...shared} mode={state.drivingMode} />
          </div>
          <div className="pvg__controls">
            <label className="pvg__control-label">Mode</label>
            <div className="pvg__btn-row">
              {(['combi', 'stored', 'heat_pump'] as DrivingStyleMode[]).map((m) => (
                <button
                  key={m}
                  className={`pvg__btn${state.drivingMode === m ? ' pvg__btn--active' : ''}`}
                  onClick={() => onStateChange({ drivingMode: m })}
                >
                  {m === 'heat_pump' ? 'Heat pump' : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      );

    case 'flow_split':
      return (
        <div className="pvg__visual-section">
          <div className="pvg__visual-frame">
            <FlowSplitVisual
              {...shared}
              outletsActive={state.outletsActive}
              pressureLevel={state.pressureLevel}
            />
          </div>
          <div className="pvg__controls">
            <label className="pvg__control-label">Outlets active</label>
            <div className="pvg__btn-row">
              {([1, 2, 3] as (1 | 2 | 3)[]).map((n) => (
                <button
                  key={n}
                  className={`pvg__btn${state.outletsActive === n ? ' pvg__btn--active' : ''}`}
                  onClick={() => onStateChange({ outletsActive: n })}
                >
                  {n}
                </button>
              ))}
            </div>
            <label className="pvg__control-label">Pressure</label>
            <div className="pvg__btn-row">
              {(['low', 'normal', 'high'] as ('low' | 'normal' | 'high')[]).map((p) => (
                <button
                  key={p}
                  className={`pvg__btn${state.pressureLevel === p ? ' pvg__btn--active' : ''}`}
                  onClick={() => onStateChange({ pressureLevel: p })}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      );

    case 'solar_mismatch':
      return (
        <div className="pvg__visual-section">
          <div className="pvg__visual-frame">
            <SolarMismatchVisual {...shared} />
          </div>
        </div>
      );

    case 'cylinder_charge':
      return (
        <div className="pvg__visual-section">
          <div className="pvg__visual-frame">
            <CylinderChargeVisual
              {...shared}
              fillLevel={state.fillLevel}
              mixergyMode={state.mixergyMode}
            />
          </div>
          <div className="pvg__controls">
            <label className="pvg__control-label">
              Fill level: {Math.round(state.fillLevel * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(state.fillLevel * 100)}
              onChange={(e) => onStateChange({ fillLevel: Number(e.target.value) / 100 })}
              className="pvg__slider"
            />
            <label className="pvg__control-label">
              <input
                type="checkbox"
                checked={state.mixergyMode}
                onChange={(e) => onStateChange({ mixergyMode: e.target.checked })}
              />
              {' '}Mixergy mode
            </label>
          </div>
        </div>
      );

    default:
      return (
        <div className="pvg__visual-frame pvg__visual-frame--placeholder">
          <span className="pvg__coming-soon">Coming in a future PR</span>
        </div>
      );
  }
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function VisualCard({ id }: { id: PhysicsVisualId }) {
  const def = getAllVisualDefinitions().find((d) => d.id === id);
  const script = getVisualScript(id);
  const [state, setState] = useState<CardState>(defaultCardState);
  const [showScript, setShowScript] = useState(false);

  if (!def) return null;

  return (
    <div className="pvg__card">
      {/* Header */}
      <div className="pvg__card-header">
        <div className="pvg__card-meta">
          <span className={`pvg__category pvg__category--${def.category}`}>{def.category.replace('_', ' ')}</span>
          <h3 className="pvg__card-title">{def.title}</h3>
          <p className="pvg__card-purpose">{def.purpose}</p>
        </div>
        <div className="pvg__card-flags">
          {def.supportsReducedMotion && (
            <span className="pvg__flag">♿ reduced motion</span>
          )}
        </div>
      </div>

      {/* Visual + controls */}
      <VisualWithControls
        id={id}
        state={state}
        onStateChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
      />

      {/* Reduced motion toggle */}
      <div className="pvg__motion-row">
        <label className="pvg__motion-label">
          <input
            type="checkbox"
            checked={state.reducedMotion}
            onChange={(e) => setState((prev) => ({ ...prev, reducedMotion: e.target.checked }))}
          />
          {' '}Simulate reduced motion
        </label>
      </div>

      {/* Script toggle */}
      <button
        className="pvg__script-toggle"
        onClick={() => setShowScript((v) => !v)}
      >
        {showScript ? '▲ Hide script' : '▼ Show script'}
      </button>

      {showScript && (
        <div className="pvg__script-section">
          <p className="pvg__script-title">{script.title}</p>
          <ScriptPanel id={id} />
        </div>
      )}
    </div>
  );
}

// ─── Gallery ──────────────────────────────────────────────────────────────────

interface PhysicsVisualGalleryProps {
  onBack?: () => void;
}

export default function PhysicsVisualGallery({ onBack }: PhysicsVisualGalleryProps) {
  const all = getAllVisualDefinitions();
  const [filter, setFilter] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(all.map((d) => d.category)))];
  const visible = filter === 'all' ? all : all.filter((d) => d.category === filter);

  return (
    <div className="pvg">
      {/* Page header */}
      <div className="pvg__header">
        {onBack && (
          <button className="pvg__back-btn" onClick={onBack}>
            ← Back
          </button>
        )}
        <div className="pvg__title-block">
          <h1 className="pvg__page-title">Physics Visual Library</h1>
          <p className="pvg__page-subtitle">
            Atlas explainer animations — preview and review surface.
            First 4 visuals available; others shown as placeholders.
          </p>
        </div>
      </div>

      {/* Category filter */}
      <div className="pvg__filter-row">
        {categories.map((c) => (
          <button
            key={c}
            className={`pvg__filter-btn${filter === c ? ' pvg__filter-btn--active' : ''}`}
            onClick={() => setFilter(c)}
          >
            {c === 'all' ? 'All' : c.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Card grid */}
      <div className="pvg__grid">
        {visible.map((def) => (
          <VisualCard key={def.id} id={def.id} />
        ))}
      </div>
    </div>
  );
}
