// src/explainers/lego/animation/render/WaterSupplyPanel.tsx
//
// Compact water-supply controls panel for the lab.
//
// Exposes three user-adjustable parameters that directly affect playback:
//   - Dynamic flow (L/min)        — controls effective mains flow rate
//   - Dynamic pressure (bar)      — controls token-size pressure proxy
//   - Cold inlet temperature (°C) — controls heat-rise ΔT for DHW
//
// When survey-backed mode is active, the panel shows which values come from
// the survey and highlights any manual overrides with a small indicator.
// A "Reset" button restores all overrides to survey / default values.
//
// Architecture:
//   WaterSupplyPanel is a controlled component — it owns no state.
//   All values and callbacks come from LabCanvas.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WaterSupplyPanelProps {
  // ── Current effective values ─────────────────────────────────────────────
  /** Effective flow rate (L/min) — either manual override or base value. */
  flowLpm: number
  /** Effective dynamic pressure (bar) — manual override when set, otherwise undefined. */
  pressureBar: number | undefined
  /** Effective cold inlet temperature (°C). */
  coldInletC: 5 | 10 | 15

  // ── Base / survey values (for override indicators) ────────────────────────
  /** Survey-measured flow (L/min), if present in playbackInputs. */
  surveyFlowLpm: number | undefined
  /** Survey-measured dynamic pressure (bar), if present in playbackInputs. */
  surveyPressureBar: number | undefined
  /** Default cold inlet temp from base controls (before any override). */
  baseFlowLpm: number
  /** Default cold inlet temp from base controls (before any override). */
  baseColdInletC: 5 | 10 | 15

  // ── Override state flags ─────────────────────────────────────────────────
  manualFlowLpm: number | undefined
  manualPressureBar: number | undefined
  manualColdInletC: 5 | 10 | 15 | undefined

  // ── Callbacks ─────────────────────────────────────────────────────────────
  onFlowChange: (lpm: number) => void
  onPressureChange: (bar: number | undefined) => void
  onColdInletChange: (c: 5 | 10 | 15) => void
  onReset: () => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FLOW_MIN = 6
const FLOW_MAX = 25
const PRESSURE_STEPS: number[] = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5]
const COLD_INLET_OPTIONS: Array<5 | 10 | 15> = [5, 10, 15]

// ─── Component ───────────────────────────────────────────────────────────────

export function WaterSupplyPanel(props: WaterSupplyPanelProps) {
  const {
    flowLpm, pressureBar, coldInletC,
    surveyFlowLpm, surveyPressureBar, baseFlowLpm, baseColdInletC,
    manualFlowLpm, manualPressureBar, manualColdInletC,
    onFlowChange, onPressureChange, onColdInletChange, onReset,
  } = props

  const hasAnyOverride = manualFlowLpm !== undefined || manualPressureBar !== undefined || manualColdInletC !== undefined

  return (
    <div className="lab-controls-panel">
      <div className="lab-controls-panel__header">
        Water supply
        {hasAnyOverride && (
          <button
            className="lab-controls-panel__reset-btn"
            onClick={onReset}
            title="Reset all water supply controls to survey / default values"
          >
            Reset
          </button>
        )}
      </div>

      {/* ── Flow ─────────────────────────────────────────────────────── */}
      <div className="lab-controls-panel__row">
        <span className="lab-controls-panel__label">
          Flow
          {manualFlowLpm !== undefined && (
            <span className="lab-controls-panel__override-badge">override</span>
          )}
          {manualFlowLpm === undefined && surveyFlowLpm !== undefined && (
            <span className="lab-controls-panel__survey-badge">survey</span>
          )}
        </span>
        <div className="lab-controls-panel__slider-row">
          <input
            type="range"
            className="lab-controls-panel__slider"
            min={FLOW_MIN}
            max={FLOW_MAX}
            step={1}
            value={Math.round(flowLpm)}
            onChange={e => onFlowChange(Number(e.target.value))}
            aria-label="Dynamic flow rate (L/min)"
          />
          <span className="lab-controls-panel__value">
            {Math.round(flowLpm)} L/min
          </span>
        </div>
        {manualFlowLpm !== undefined && (
          <div className="lab-controls-panel__sub">
            Survey / default: {surveyFlowLpm ?? baseFlowLpm} L/min
          </div>
        )}
      </div>

      {/* ── Pressure ─────────────────────────────────────────────────── */}
      <div className="lab-controls-panel__row">
        <span className="lab-controls-panel__label">
          Pressure
          {manualPressureBar !== undefined && (
            <span className="lab-controls-panel__override-badge">override</span>
          )}
          {manualPressureBar === undefined && surveyPressureBar !== undefined && (
            <span className="lab-controls-panel__survey-badge">survey</span>
          )}
        </span>
        <div className="lab-controls-panel__options">
          {PRESSURE_STEPS.map(bar => (
            <button
              key={bar}
              className={`lab-controls-panel__option${pressureBar === bar ? ' lab-controls-panel__option--active' : ''}`}
              onClick={() => onPressureChange(bar === pressureBar && manualPressureBar === bar ? undefined : bar)}
              title={`Set mains pressure to ${bar} bar`}
            >
              {bar}
            </button>
          ))}
        </div>
        {pressureBar !== undefined && (
          <div className="lab-controls-panel__sub">
            {pressureBar} bar
            {surveyPressureBar !== undefined && manualPressureBar !== undefined && (
              <> · survey: {surveyPressureBar} bar</>
            )}
          </div>
        )}
        {pressureBar === undefined && surveyPressureBar === undefined && (
          <div className="lab-controls-panel__sub lab-controls-panel__sub--muted">
            Not set — token size follows flow
          </div>
        )}
      </div>

      {/* ── Cold inlet temperature ───────────────────────────────────── */}
      <div className="lab-controls-panel__row">
        <span className="lab-controls-panel__label">
          Cold inlet
          {manualColdInletC !== undefined && (
            <span className="lab-controls-panel__override-badge">override</span>
          )}
        </span>
        <div className="lab-controls-panel__options">
          {COLD_INLET_OPTIONS.map(c => (
            <button
              key={c}
              className={`lab-controls-panel__option${coldInletC === c ? ' lab-controls-panel__option--active' : ''}`}
              onClick={() => onColdInletChange(c)}
              title={`Set cold inlet temperature to ${c} °C`}
            >
              {c} °C
            </button>
          ))}
        </div>
        {manualColdInletC !== undefined && (
          <div className="lab-controls-panel__sub">
            Default: {baseColdInletC} °C
          </div>
        )}
      </div>
    </div>
  )
}
