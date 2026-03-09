// src/explainers/lego/animation/render/ConditionPanel.tsx
//
// Current condition control panel for the lab.
//
// Lets the user set two condition axes:
//   - Heating circuit: Clean / Some sludge / Heavy sludge
//   - Hot water side:  Clean / Some scale  / Heavy scale
//
// These drive simple scenario modifiers applied in stepSimulation():
//   - Sludge reduces heating-circuit responsiveness and CH output.
//   - Scale reduces DHW heat-exchanger efficiency and output.
//
// No second degradation engine is built here — modifiers are forwarded
// directly to stepSimulation() as a plain LabConditionState object.

import type { LabConditionState, SludgeLevel, ScaleLevel } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConditionPanelProps {
  condition: LabConditionState
  onChange: (next: LabConditionState) => void
}

// ─── Option definitions ───────────────────────────────────────────────────────

const SLUDGE_OPTIONS: Array<{ value: SludgeLevel; label: string; note: string }> = [
  { value: 'clean',        label: 'Clean',       note: 'Full heating responsiveness' },
  { value: 'some_sludge',  label: 'Some sludge', note: 'Moderate circuit resistance' },
  { value: 'heavy_sludge', label: 'Heavy sludge', note: 'Heating circuit impaired' },
]

const SCALE_OPTIONS: Array<{ value: ScaleLevel; label: string; note: string }> = [
  { value: 'clean',       label: 'Clean',      note: 'Full DHW output' },
  { value: 'some_scale',  label: 'Some scale', note: 'Reduced HEX efficiency' },
  { value: 'heavy_scale', label: 'Heavy scale', note: 'Significant DHW loss' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export function ConditionPanel({ condition, onChange }: ConditionPanelProps) {
  return (
    <div className="lab-controls-panel">
      <div className="lab-controls-panel__header">
        Current condition
      </div>

      {/* ── Heating circuit ───────────────────────────────────────── */}
      <div className="lab-controls-panel__row">
        <span className="lab-controls-panel__label">Heating circuit</span>
        <div className="lab-controls-panel__options">
          {SLUDGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`lab-controls-panel__option${condition.heatingCircuit === opt.value ? ' lab-controls-panel__option--active' : ''}`}
              onClick={() => onChange({ ...condition, heatingCircuit: opt.value })}
              title={opt.note}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {condition.heatingCircuit !== 'clean' && (
          <div className="lab-controls-panel__sub lab-controls-panel__sub--warn">
            {SLUDGE_OPTIONS.find(o => o.value === condition.heatingCircuit)?.note}
          </div>
        )}
      </div>

      {/* ── Hot water side ────────────────────────────────────────── */}
      <div className="lab-controls-panel__row">
        <span className="lab-controls-panel__label">Hot water side</span>
        <div className="lab-controls-panel__options">
          {SCALE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`lab-controls-panel__option${condition.hotWaterSide === opt.value ? ' lab-controls-panel__option--active' : ''}`}
              onClick={() => onChange({ ...condition, hotWaterSide: opt.value })}
              title={opt.note}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {condition.hotWaterSide !== 'clean' && (
          <div className="lab-controls-panel__sub lab-controls-panel__sub--warn">
            {SCALE_OPTIONS.find(o => o.value === condition.hotWaterSide)?.note}
          </div>
        )}
      </div>
    </div>
  )
}
