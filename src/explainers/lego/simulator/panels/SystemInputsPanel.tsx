/**
 * SystemInputsPanel — physics-relevant simulator inputs.
 *
 * Exposes controls for mains pressure, mains flow, cold inlet temperature,
 * cylinder size, combi power, time speed, and heating system configuration.
 * All values are controlled by the parent (SimulatorDashboard) so the panel
 * is purely presentational.
 *
 * Architecture:
 *   SimulatorDashboard (state) → SystemInputsPanel (props)
 *
 * Note: Some inputs (e.g. cylinder size, cold inlet temp) are collected here
 * for future physics wiring; currently only combiPowerKw feeds directly into
 * the limiter explanations, and timeSpeed feeds into the phase cycling rate.
 *
 * Types and constants are in systemInputsTypes.ts to comply with the
 * react-refresh rule (only export components from .tsx files).
 */

import type { SimulatorSystemChoice } from '../useSystemDiagramPlayback'
import type { SystemInputs, PrimaryPipeSize, EmitterType, CylinderType, SystemCondition, ControlStrategy, OccupancyProfile } from '../systemInputsTypes'
import { CYLINDER_SIZES_BY_TYPE } from '../systemInputsTypes'

// ─── Time speed constants ─────────────────────────────────────────────────────
// Min 0.5× keeps demo phases visually legible; max 8× allows rapid cycling
// for quick inspection without the 500 ms hard floor in useSystemDiagramPlayback.
const TIME_SPEED_MIN  = 0.5
const TIME_SPEED_MAX  = 8
const TIME_SPEED_STEP = 0.5

// ─── Emitter capacity factor constants ────────────────────────────────────────
// 0.5× = severely undersized; 2.0× = very oversized / UFH-like
const EMITTER_FACTOR_MIN  = 0.5
const EMITTER_FACTOR_MAX  = 2.0
const EMITTER_FACTOR_STEP = 0.1

// ─── Pipe size options ────────────────────────────────────────────────────────

const PIPE_SIZE_OPTIONS: { value: PrimaryPipeSize; label: string }[] = [
  { value: '15mm', label: '15 mm' },
  { value: '22mm', label: '22 mm' },
  { value: '28mm', label: '28 mm' },
]

// ─── Emitter type options ─────────────────────────────────────────────────────

const EMITTER_TYPE_OPTIONS: { value: EmitterType; label: string }[] = [
  { value: 'radiators',           label: 'Radiators'           },
  { value: 'oversized_radiators', label: 'Oversized radiators' },
  { value: 'ufh',                 label: 'Underfloor heating'  },
]

// ─── Cylinder type options ────────────────────────────────────────────────────
// open_vented is only relevant when the system choice is open_vented.
// unvented and mixergy are relevant for unvented / heat_pump system choices.

const CYLINDER_TYPE_OPTIONS: { value: CylinderType; label: string }[] = [
  { value: 'open_vented', label: 'Open vented' },
  { value: 'unvented',    label: 'Unvented'    },
  { value: 'mixergy',     label: 'Mixergy'     },
]

/**
 * Returns the cylinder type options that are valid for the given system choice.
 *
 * open_vented system  → only open_vented cylinder
 * unvented / heat_pump → unvented or mixergy
 * combi               → none (cylinder not applicable)
 */
function cylinderTypeOptionsFor(systemChoice: SimulatorSystemChoice) {
  if (systemChoice === 'open_vented') {
    return CYLINDER_TYPE_OPTIONS.filter(o => o.value === 'open_vented')
  }
  return CYLINDER_TYPE_OPTIONS.filter(o => o.value !== 'open_vented')
}

// ─── Control strategy options ─────────────────────────────────────────────────

const CONTROL_STRATEGY_OPTIONS: { value: ControlStrategy; label: string; description: string }[] = [
  { value: 'combi',      label: 'Combi',     description: 'on-demand hot water via plate HEX. No zone valves.' },
  { value: 's_plan',     label: 'S-plan',    description: 'Independent CH and DHW zones via motorised valves.' },
  { value: 'y_plan',     label: 'Y-plan',    description: 'Mid-position valve; cannot run CH and DHW fully simultaneously.' },
  { value: 'heat_pump',  label: 'HP layout', description: 'Heat pump primary loop with thermal store cylinder.' },
]

/**
 * Returns the control strategy options that are valid for the given system choice.
 *
 * combi     → combi only
 * heat_pump → heat_pump only
 * unvented  → s_plan or y_plan
 * open_vented → s_plan or y_plan
 */
function controlStrategyOptionsFor(systemChoice: SimulatorSystemChoice): typeof CONTROL_STRATEGY_OPTIONS {
  if (systemChoice === 'combi') return CONTROL_STRATEGY_OPTIONS.filter(o => o.value === 'combi')
  if (systemChoice === 'heat_pump') return CONTROL_STRATEGY_OPTIONS.filter(o => o.value === 'heat_pump')
  return CONTROL_STRATEGY_OPTIONS.filter(o => o.value === 's_plan' || o.value === 'y_plan')
}

// ─── System condition options ─────────────────────────────────────────────────

const SYSTEM_CONDITION_OPTIONS: { value: SystemCondition; label: string }[] = [
  { value: 'clean',   label: 'Clean'   },
  { value: 'sludged', label: 'Sludged' },
  { value: 'scaled',  label: 'Scaled'  },
]

// ─── Occupancy profile options ────────────────────────────────────────────────

const OCCUPANCY_PROFILE_OPTIONS: { value: OccupancyProfile; label: string; description: string }[] = [
  { value: 'professional', label: 'Professional', description: 'Works office hours; peak demand morning and evening only.' },
  { value: 'steady_home',  label: 'Steady home',  description: 'Home throughout the day; moderate, spread demand.'         },
  { value: 'family',       label: 'Family',       description: 'School-age household; morning rush, pick-up, evening peak.' },
  { value: 'shift',        label: 'Shift',        description: 'Irregular hours; demand offset from typical patterns.'      },
]

interface SystemInputsPanelProps {
  /** Demo phase cycling speed multiplier (0.5–8×). */
  timeSpeed: number
  onTimeSpeedChange: (v: number) => void
  inputs: SystemInputs
  onInputChange: (partial: Partial<SystemInputs>) => void
  /** Current system choice — used to disable irrelevant inputs. */
  systemChoice: SimulatorSystemChoice
}

interface InputRowProps {
  label: string
  icon: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  disabled?: boolean
  onChange: (v: number) => void
  formatValue?: (v: number) => string
}

function InputRow({
  label, icon, value, min, max, step, unit, disabled = false, onChange, formatValue,
}: InputRowProps) {
  const display = formatValue ? formatValue(value) : `${value} ${unit}`
  return (
    <div className={`sys-input-row${disabled ? ' sys-input-row--disabled' : ''}`}>
      <span className="sys-input-row__icon" aria-hidden="true">{icon}</span>
      <span className="sys-input-row__label">{label}</span>
      <input
        type="range"
        className="sys-input-row__slider"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <span className="sys-input-row__value">{disabled ? '—' : display}</span>
    </div>
  )
}

export default function SystemInputsPanel({
  timeSpeed,
  onTimeSpeedChange,
  inputs,
  onInputChange,
  systemChoice,
}: SystemInputsPanelProps) {
  const isCombi = systemChoice === 'combi'

  return (
    <div className="sys-inputs-panel">
      <InputRow
        label="Time speed"
        icon="⏱"
        value={timeSpeed}
        min={TIME_SPEED_MIN}
        max={TIME_SPEED_MAX}
        step={TIME_SPEED_STEP}
        unit="×"
        onChange={onTimeSpeedChange}
        formatValue={v => `${v}×`}
      />
      <InputRow
        label="Mains pressure"
        icon="💧"
        value={inputs.mainsPressureBar}
        min={1.5}
        max={6}
        step={0.5}
        unit="bar"
        onChange={v => onInputChange({ mainsPressureBar: v })}
      />
      <InputRow
        label="Mains flow"
        icon="🚿"
        value={inputs.mainsFlowLpm}
        min={10}
        max={50}
        step={1}
        unit="L/min"
        onChange={v => onInputChange({ mainsFlowLpm: v })}
      />
      <InputRow
        label="Cold inlet temp"
        icon="🌡"
        value={inputs.coldInletTempC}
        min={5}
        max={20}
        step={1}
        unit="°C"
        onChange={v => onInputChange({ coldInletTempC: v })}
      />

      {/* ── Cylinder type ────────────────────────────────────────────────── */}
      <div className={`sys-input-row${isCombi ? ' sys-input-row--disabled' : ''}`}>
        <span className="sys-input-row__icon" aria-hidden="true">🛢</span>
        <span className="sys-input-row__label">Cylinder type</span>
        <div className="sys-input-row__segmented" role="group" aria-label="Cylinder type">
          {cylinderTypeOptionsFor(systemChoice).map(opt => (
            <button
              key={opt.value}
              className={`sys-input-row__seg-btn${inputs.cylinderType === opt.value ? ' sys-input-row__seg-btn--active' : ''}`}
              onClick={() => {
                const sizes = CYLINDER_SIZES_BY_TYPE[opt.value]
                // Keep current size if valid for the new type, else use the first valid size.
                const newSize = sizes.includes(inputs.cylinderSizeLitres)
                  ? inputs.cylinderSizeLitres
                  : sizes[0]
                onInputChange({ cylinderType: opt.value, cylinderSizeLitres: newSize })
              }}
              disabled={isCombi}
              aria-pressed={inputs.cylinderType === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Cylinder size ─────────────────────────────────────────────────── */}
      <div className={`sys-input-row${isCombi ? ' sys-input-row--disabled' : ''}`}>
        <span className="sys-input-row__icon" aria-hidden="true">📏</span>
        <span className="sys-input-row__label">Cylinder size</span>
        {isCombi ? (
          <span className="sys-input-row__value">—</span>
        ) : (
          <select
            className="sys-input-row__select"
            value={inputs.cylinderSizeLitres}
            onChange={e => onInputChange({ cylinderSizeLitres: Number(e.target.value) })}
            aria-label="Cylinder size"
          >
            {CYLINDER_SIZES_BY_TYPE[inputs.cylinderType].map(size => (
              <option key={size} value={size}>{size} L</option>
            ))}
          </select>
        )}
      </div>
      <InputRow
        label="Combi power"
        icon="🔥"
        value={inputs.combiPowerKw}
        min={18}
        max={42}
        step={2}
        unit="kW"
        disabled={!isCombi}
        onChange={v => onInputChange({ combiPowerKw: v })}
      />

      {/* ── Heating System ────────────────────────────────────────────────── */}
      <div className="sys-inputs-section-heading">Heating System</div>

      <InputRow
        label="Emitter size"
        icon="🌡"
        value={inputs.emitterCapacityFactor}
        min={EMITTER_FACTOR_MIN}
        max={EMITTER_FACTOR_MAX}
        step={EMITTER_FACTOR_STEP}
        unit=""
        onChange={v => onInputChange({ emitterCapacityFactor: v })}
        formatValue={v => `${v.toFixed(1)}×`}
      />

      <div className="sys-input-row">
        <span className="sys-input-row__icon" aria-hidden="true">🔧</span>
        <span className="sys-input-row__label">Primary pipe size</span>
        <div className="sys-input-row__segmented" role="group" aria-label="Primary pipe size">
          {PIPE_SIZE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`sys-input-row__seg-btn${inputs.primaryPipeSize === opt.value ? ' sys-input-row__seg-btn--active' : ''}`}
              onClick={() => onInputChange({ primaryPipeSize: opt.value })}
              aria-pressed={inputs.primaryPipeSize === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sys-input-row">
        <span className="sys-input-row__icon" aria-hidden="true">♨</span>
        <span className="sys-input-row__label">Emitter type</span>
        <div className="sys-input-row__segmented" role="group" aria-label="Emitter type">
          {EMITTER_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`sys-input-row__seg-btn${inputs.emitterType === opt.value ? ' sys-input-row__seg-btn--active' : ''}`}
              onClick={() => onInputChange({ emitterType: opt.value })}
              aria-pressed={inputs.emitterType === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sys-input-row">
        <span className="sys-input-row__icon" aria-hidden="true">🌤</span>
        <span className="sys-input-row__label">Weather compensation</span>
        <button
          className={`sys-input-row__toggle${inputs.weatherCompensation ? ' sys-input-row__toggle--on' : ''}`}
          onClick={() => onInputChange({ weatherCompensation: !inputs.weatherCompensation })}
          aria-pressed={inputs.weatherCompensation}
          aria-label="Weather compensation"
        >
          {inputs.weatherCompensation ? 'On' : 'Off'}
        </button>
      </div>

      {/* ── Load compensation ─────────────────────────────────────────────── */}
      <div className="sys-input-row">
        <span className="sys-input-row__icon" aria-hidden="true">📉</span>
        <span className="sys-input-row__label">Load compensation</span>
        <button
          className={`sys-input-row__toggle${inputs.loadCompensation ? ' sys-input-row__toggle--on' : ''}`}
          onClick={() => onInputChange({ loadCompensation: !inputs.loadCompensation })}
          aria-pressed={inputs.loadCompensation}
          aria-label="Load compensation"
        >
          {inputs.loadCompensation ? 'On' : 'Off'}
        </button>
      </div>

      {/* ── Control strategy / layout ─────────────────────────────────────── */}
      <div className="sys-input-row">
        <span className="sys-input-row__icon" aria-hidden="true">🗺</span>
        <span className="sys-input-row__label">Control layout</span>
        <div className="sys-input-row__segmented" role="group" aria-label="Control layout">
          {controlStrategyOptionsFor(systemChoice).map(opt => (
            <button
              key={opt.value}
              className={`sys-input-row__seg-btn${inputs.controlStrategy === opt.value ? ' sys-input-row__seg-btn--active' : ''}`}
              onClick={() => onInputChange({ controlStrategy: opt.value })}
              aria-pressed={inputs.controlStrategy === opt.value}
              title={opt.description}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sys-input-row">
        <span className="sys-input-row__icon" aria-hidden="true">🧹</span>
        <span className="sys-input-row__label">System condition</span>
        <div className="sys-input-row__segmented" role="group" aria-label="System condition">
          {SYSTEM_CONDITION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`sys-input-row__seg-btn${inputs.systemCondition === opt.value ? ' sys-input-row__seg-btn--active' : ''}`}
              onClick={() => onInputChange({ systemCondition: opt.value })}
              aria-pressed={inputs.systemCondition === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Occupancy profile ─────────────────────────────────────────────── */}
      <div className="sys-inputs-section-heading">Occupancy</div>

      <div className="sys-input-row">
        <span className="sys-input-row__icon" aria-hidden="true">🏡</span>
        <span className="sys-input-row__label">Household pattern</span>
        <div className="sys-input-row__segmented" role="group" aria-label="Occupancy profile">
          {OCCUPANCY_PROFILE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`sys-input-row__seg-btn${inputs.occupancyProfile === opt.value ? ' sys-input-row__seg-btn--active' : ''}`}
              onClick={() => onInputChange({ occupancyProfile: opt.value })}
              aria-pressed={inputs.occupancyProfile === opt.value}
              title={opt.description}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
