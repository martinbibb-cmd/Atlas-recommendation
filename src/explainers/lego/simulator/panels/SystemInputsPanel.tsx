/**
 * SystemInputsPanel — physics-relevant simulator inputs.
 *
 * Exposes controls for mains pressure, mains flow, cold inlet temperature,
 * cylinder size, combi power, and time speed. All values are controlled by
 * the parent (SimulatorDashboard) so the panel is purely presentational.
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
import type { SystemInputs } from '../systemInputsTypes'

// ─── Time speed constants ─────────────────────────────────────────────────────
// Min 0.5× keeps demo phases visually legible; max 8× allows rapid cycling
// for quick inspection without the 500 ms hard floor in useSystemDiagramPlayback.
const TIME_SPEED_MIN  = 0.5
const TIME_SPEED_MAX  = 8
const TIME_SPEED_STEP = 0.5

// ─── Component ────────────────────────────────────────────────────────────────

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
      <InputRow
        label="Cylinder size"
        icon="🛢"
        value={inputs.cylinderSizeLitres}
        min={100}
        max={400}
        step={25}
        unit="L"
        disabled={isCombi}
        onChange={v => onInputChange({ cylinderSizeLitres: v })}
      />
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
    </div>
  )
}
