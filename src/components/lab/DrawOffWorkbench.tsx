/**
 * DrawOffWorkbench — Visual tab content for System Lab.
 *
 * Left side:  2×2 grid of four draw-off cards (kitchen sink, bathroom basin,
 *             shower, bath fill), each showing cold/hot/delivered values and
 *             a one-line behavioural note.
 * Right side: one tall cylinder / hot-water source status card.
 *
 * Controls:
 *   - Regime selector buttons (Combi / Boiler cylinder / Heat pump cylinder /
 *     Mixergy cylinder) — changes the entire draw-off and cylinder dataset.
 *   - Appliance output slider (combi only) — directly changes the available
 *     hot supply flow, making the outlet cards and water performance gauges
 *     update immediately as the slider moves.
 *
 * Bottom section: WaterPerformanceGauge — instrument-style flow and dynamic
 * pressure readings derived from the current regime and output settings.
 *
 * Focus mode: tapping any tile opens a focused inspection overlay.  Background
 * tiles dim softly.  Close returns directly to the overview map.
 *
 * All regime data values illustrate physics differences between system types.
 * No engine model is re-derived here — values are scaled display models only.
 *
 * Placement: System Lab → Visual tab.
 */

import { useState } from 'react'
import DrawOffCard from './DrawOffCard'
import CylinderStatusCard from './CylinderStatusCard'
import DrawOffFocusPanel from './DrawOffFocusPanel'
import CylinderFocusPanel from './CylinderFocusPanel'
import WaterPerformanceGauge from '../behaviour/WaterPerformanceGauge'
import {
  FLOW_MARKERS,
  PRESSURE_MARKERS,
  flowTone,
  pressureTone,
} from '../behaviour/waterPerformance.model'
import type { DrawOffViewModel, CylinderStatusViewModel, BoilerState } from './drawOffTypes'

// ─── Regime selector ──────────────────────────────────────────────────────────

type Regime = 'combi' | 'boiler_cylinder' | 'heat_pump_cylinder' | 'mixergy_cylinder'

const REGIME_LABELS: Record<Regime, string> = {
  combi:              'Combi',
  boiler_cylinder:    'Boiler cylinder',
  heat_pump_cylinder: 'Heat pump cylinder',
  mixergy_cylinder:   'Mixergy cylinder',
}

// ─── Appliance output defaults / bounds ───────────────────────────────────────

/** Default combi boiler output in kW — the nominal 24 kW standard output. */
const DEFAULT_BOILER_OUTPUT_KW = 24
const MIN_BOILER_OUTPUT_KW     = 18
const MAX_BOILER_OUTPUT_KW     = 42

/**
 * Minimum hot-supply flow (L/min) thresholds for combi boiler firing.
 *
 * These are presentation-layer thresholds used to derive BoilerState.
 * Below IGNITION_FLOW_LPM the burner cannot ignite.
 * Below SUSTAINED_FLOW_LPM operation is marginal / intermittent.
 */
const COMBI_IGNITION_FLOW_LPM  = 2.5
const COMBI_SUSTAINED_FLOW_LPM = 7.0

/**
 * Derive BoilerState from available hot-supply flow for a combi outlet.
 * Thresholds based on typical minimum ignition and sustained operation limits.
 */
function deriveBoilerState(hotSupplyAvailableFlowLpm: number): BoilerState {
  if (hotSupplyAvailableFlowLpm < COMBI_IGNITION_FLOW_LPM)  return 'fails_to_fire'
  if (hotSupplyAvailableFlowLpm < COMBI_SUSTAINED_FLOW_LPM) return 'marginal'
  return 'firing'
}

/**
 * Scale combi hot-supply flow proportionally to the current appliance output
 * relative to the 24 kW baseline.  Caps at the mains flow rate.
 */
function scaleCombiFlow(baseFlowLpm: number, outputKw: number): number {
  const scale = outputKw / DEFAULT_BOILER_OUTPUT_KW
  return Math.round(Math.min(baseFlowLpm * scale, 12) * 10) / 10
}

// ─── Regime-aware data ────────────────────────────────────────────────────────

function getDrawOffData(regime: Regime, outputKw: number): DrawOffViewModel[] {
  if (regime === 'combi') {
    const hotFlow = scaleCombiFlow(10, outputKw)
    // Concurrent demand (two outlets sharing the boiler) scales at a lower base
    // flow (3 L/min).  At minimum boiler output (18 kW) this evaluates to
    // 3 × (18/24) = 2.25 L/min — below the 2.5 L/min ignition threshold —
    // demonstrating the combi non-fire scenario in the UI.
    const concurrentHotFlow = scaleCombiFlow(3, outputKw)
    const hotTemp = 45 + Math.round((outputKw - DEFAULT_BOILER_OUTPUT_KW) * 0.15)
    const bathBoilerState = deriveBoilerState(concurrentHotFlow)
    return [
      {
        id: 'kitchen',
        label: 'Kitchen sink',
        icon: '🚰',
        status: 'stable',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 12,
        hotSupplyTempC: hotTemp + 3,
        hotSupplyAvailableFlowLpm: hotFlow,
        deliveredTempC: 42,
        deliveredFlowLpm: Math.min(8, hotFlow * 0.8),
        note: 'On-demand supply stable at low draw rate. Temperature delivered within seconds.',
        limitingFactor: 'None — demand within appliance capacity',
        boilerState: deriveBoilerState(hotFlow),
      },
      {
        id: 'basin',
        label: 'Bathroom basin',
        icon: '🪥',
        status: 'stable',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 12,
        hotSupplyTempC: hotTemp + 2,
        hotSupplyAvailableFlowLpm: hotFlow,
        deliveredTempC: 40,
        deliveredFlowLpm: Math.min(6, hotFlow * 0.6),
        note: 'Low-flow draw; appliance not yet approaching throughput limit.',
        limitingFactor: 'None — low-flow draw well within capacity',
        boilerState: deriveBoilerState(hotFlow),
      },
      {
        id: 'shower',
        label: 'Shower',
        icon: '🚿',
        status: hotFlow >= 10 ? 'stable' : 'flow_limited',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 12,
        hotSupplyTempC: hotTemp,
        hotSupplyAvailableFlowLpm: hotFlow,
        deliveredTempC: 38,
        deliveredFlowLpm: Math.min(10, hotFlow),
        note: hotFlow >= 10
          ? 'Stable draw. Temperature held by adjusting blend ratio.'
          : 'Flow capped at appliance throughput limit. Temperature held by adjusting blend ratio.',
        limitingFactor: hotFlow >= 10 ? 'None' : 'Hot-side output constrained — appliance throughput limit reached',
        boilerState: deriveBoilerState(hotFlow),
      },
      {
        id: 'bath',
        label: 'Bath fill',
        icon: '🛁',
        status: bathBoilerState === 'fails_to_fire' ? 'below_ignition_threshold' : 'starved',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 12,
        hotSupplyTempC: hotTemp - 7,
        hotSupplyAvailableFlowLpm: concurrentHotFlow,
        deliveredTempC: 32,
        deliveredFlowLpm: Math.min(6, concurrentHotFlow + 2),
        note: bathBoilerState === 'fails_to_fire'
          ? 'Flow too low to fire combi — simultaneous demand has dropped per-outlet flow below ignition threshold. Only cold water delivered.'
          : 'Concurrent demand has exhausted appliance capacity. Delivered temperature and flow both degraded.',
        limitingFactor: bathBoilerState === 'fails_to_fire'
          ? 'Below combi ignition threshold — burner cannot fire under simultaneous demand'
          : 'Concurrent demand exceeds appliance capacity — insufficient DHW flow to sustain burner',
        boilerState: bathBoilerState,
      },
    ]
  }

  if (regime === 'boiler_cylinder') {
    return [
      {
        id: 'kitchen',
        label: 'Kitchen sink',
        icon: '🚰',
        status: 'stable',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 15,
        hotSupplyTempC: 60,
        hotSupplyAvailableFlowLpm: 15,
        deliveredTempC: 42,
        deliveredFlowLpm: 9,
        note: 'Mains-pressure supply from stored cylinder. Ample hot fraction available.',
        limitingFactor: 'None — stored supply ample',
      },
      {
        id: 'basin',
        label: 'Bathroom basin',
        icon: '🪥',
        status: 'stable',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 15,
        hotSupplyTempC: 60,
        hotSupplyAvailableFlowLpm: 15,
        deliveredTempC: 40,
        deliveredFlowLpm: 7,
        note: 'Stored supply stable. Cylinder temperature holding at set point.',
        limitingFactor: 'None — stored supply ample',
      },
      {
        id: 'shower',
        label: 'Shower',
        icon: '🚿',
        status: 'stable',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 15,
        hotSupplyTempC: 58,
        hotSupplyAvailableFlowLpm: 14,
        deliveredTempC: 38,
        deliveredFlowLpm: 11,
        note: 'High-temperature store allows small hot fraction. Concurrent draw well within cylinder capacity.',
        limitingFactor: 'None — concurrent draw within cylinder capacity',
      },
      {
        id: 'bath',
        label: 'Bath fill',
        icon: '🛁',
        status: 'temp_limited',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 15,
        hotSupplyTempC: 52,
        hotSupplyAvailableFlowLpm: 12,
        deliveredTempC: 40,
        deliveredFlowLpm: 14,
        note: 'Store temperature dropping under sustained large-volume draw. Recovery active; thermocline falling.',
        limitingFactor: 'Store temperature declining — thermocline falling under large-volume draw',
      },
    ]
  }

  // heat_pump_cylinder
  if (regime === 'heat_pump_cylinder') {
    return [
      {
        id: 'kitchen',
        label: 'Kitchen sink',
        icon: '🚰',
        status: 'stable',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 15,
        hotSupplyTempC: 52,
        hotSupplyAvailableFlowLpm: 14,
        deliveredTempC: 42,
        deliveredFlowLpm: 9,
        note: 'Stored supply from heat pump cylinder. Higher hot fraction needed due to lower storage temperature.',
        limitingFactor: 'Lower store temperature — higher hot fraction required',
      },
      {
        id: 'basin',
        label: 'Bathroom basin',
        icon: '🪥',
        status: 'stable',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 15,
        hotSupplyTempC: 51,
        hotSupplyAvailableFlowLpm: 13,
        deliveredTempC: 40,
        deliveredFlowLpm: 7,
        note: 'Stored supply stable at moderate draw. Usable volume depleting more quickly than a boiler cylinder.',
        limitingFactor: 'Usable volume depleting faster than recovery rate',
      },
      {
        id: 'shower',
        label: 'Shower',
        icon: '🚿',
        status: 'temp_limited',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 15,
        hotSupplyTempC: 48,
        hotSupplyAvailableFlowLpm: 11,
        deliveredTempC: 37,
        deliveredFlowLpm: 10,
        note: 'Store temperature lower than optimal. Delivered temperature held by increased hot fraction, reducing available flow.',
        limitingFactor: 'Store temperature below target — increased hot fraction reduces available flow',
      },
      {
        id: 'bath',
        label: 'Bath fill',
        icon: '🛁',
        status: 'starved',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 15,
        hotSupplyTempC: 42,
        hotSupplyAvailableFlowLpm: 7,
        deliveredTempC: 34,
        deliveredFlowLpm: 9,
        note: 'Usable volume depleted. Recovery lagging — heat pump cannot match boiler reheat rate under simultaneous demand.',
        limitingFactor: 'Usable volume depleted — recovery rate insufficient for simultaneous demand',
      },
    ]
  }

  // mixergy_cylinder — top-down stratification keeps hot layer intact
  return [
    {
      id: 'kitchen',
      label: 'Kitchen sink',
      icon: '🚰',
      status: 'stable',
      coldSupplyTempC: 10,
      coldSupplyFlowLpm: 15,
      hotSupplyTempC: 60,
      hotSupplyAvailableFlowLpm: 15,
      deliveredTempC: 42,
      deliveredFlowLpm: 9,
      note: 'Mains-pressure supply from Mixergy cylinder. Stratification maintains hot layer; minimal draw on lower zone.',
      limitingFactor: 'None — stratified store maintaining hot layer',
    },
    {
      id: 'basin',
      label: 'Bathroom basin',
      icon: '🪥',
      status: 'stable',
      coldSupplyTempC: 10,
      coldSupplyFlowLpm: 15,
      hotSupplyTempC: 60,
      hotSupplyAvailableFlowLpm: 15,
      deliveredTempC: 40,
      deliveredFlowLpm: 7,
      note: 'Stored supply stable. Top-down heating keeps upper zone at set point even at partial fill.',
      limitingFactor: 'None — top-down stratification holding set point',
    },
    {
      id: 'shower',
      label: 'Shower',
      icon: '🚿',
      status: 'stable',
      coldSupplyTempC: 10,
      coldSupplyFlowLpm: 15,
      hotSupplyTempC: 59,
      hotSupplyAvailableFlowLpm: 14,
      deliveredTempC: 38,
      deliveredFlowLpm: 11,
      note: 'High-temperature stratified store; small hot fraction sufficient. Demand mirroring reduces reheat cycling.',
      limitingFactor: 'None — stratified store and demand mirroring active',
    },
    {
      id: 'bath',
      label: 'Bath fill',
      icon: '🛁',
      status: 'stable',
      coldSupplyTempC: 10,
      coldSupplyFlowLpm: 15,
      hotSupplyTempC: 57,
      hotSupplyAvailableFlowLpm: 13,
      deliveredTempC: 41,
      deliveredFlowLpm: 13,
      note: 'Sustained draw drawing from stratified upper zone. Thermocline lower than standard cylinder under same load — Mixergy advantage visible.',
      limitingFactor: 'None — Mixergy stratification preserving upper zone under concurrent load',
    },
  ]
}

function getCylinderData(regime: Regime): CylinderStatusViewModel {
  if (regime === 'combi') {
    return {
      storageRegime: 'on_demand_combi',
      recoverySource: 'None (on-demand hot water)',
      recoveryPowerTendency: 'N/A — no stored volume to recover',
      state: 'idle',
      recoveryNote: 'On-demand supply produced within seconds of opening a tap. No recharge cycle required.',
      storeNote: 'No cylinder storage. Concurrent demand degrades both flow and temperature simultaneously.',
    }
  }

  if (regime === 'boiler_cylinder') {
    return {
      storageRegime: 'boiler_cylinder',
      topTempC: 60,
      bulkTempC: 55,
      nominalVolumeL: 150,
      usableVolumeFactor: 0.78,
      recoverySource: 'Boiler',
      recoveryPowerTendency: 'High — rapid recovery via dedicated DHW zone',
      state: 'recovering',
      recoveryNote: 'Boiler firing on DHW zone. Cylinder top-up in progress; stratification holding upper zone temperature.',
      storeNote: 'Thermocline falling slowly under simultaneous shower and bath draw. Recovery rate exceeds draw rate.',
    }
  }

  // heat_pump_cylinder
  if (regime === 'heat_pump_cylinder') {
    return {
      storageRegime: 'heat_pump_cylinder',
      topTempC: 52,
      bulkTempC: 46,
      nominalVolumeL: 200,
      usableVolumeFactor: 0.45,
      recoverySource: 'Heat pump',
      recoveryPowerTendency: 'Moderate — slower reheat than boiler under peak demand',
      state: 'recovering',
      recoveryNote: 'Heat pump recovering cylinder. Recharge at 55–60°C pushes COP down sharply — reheat rate lower than peak simultaneous demand.',
      storeNote: 'Usable volume depleting faster than recovery rate. Thermocline falling — draw-off impact visible on bulk temperature.',
    }
  }

  // mixergy_cylinder
  return {
    storageRegime: 'mixergy_cylinder',
    topTempC: 60,
    heatedVolumeL: 128,
    heatedFractionPct: 85,
    nominalVolumeL: 150,
    usableVolumeFactor: 0.88,
    recoverySource: 'Boiler (Mixergy)',
    recoveryPowerTendency: 'Demand-mirrored heating — hot layer maintained; reduced reheat cycling',
    state: 'recovering',
    recoveryNote: 'Boiler firing via Mixergy controller. Top-down stratification actively grows the heated layer.',
    storeNote: 'Hot water delivered from a defined heated layer. 128 L (85%) heated at 60°C. Once the thermocline reaches the outlet level, hot delivery falls rapidly rather than cooling gradually.',
  }
}

// ─── Water performance derivation ─────────────────────────────────────────────

interface WaterPerformance {
  peakFlowLpm: number
  dynamicPressureBar: number
}

/**
 * Derives water performance values (peak flow + dynamic pressure) from the
 * current regime and outlets.  Combi flow scales directly with appliance
 * output; stored systems use mains-pressure values.
 */
function getWaterPerformance(
  regime: Regime,
  outlets: DrawOffViewModel[],
): WaterPerformance {
  // Peak delivered flow across all active outlets
  const peakFlowLpm = outlets.reduce((max, o) => Math.max(max, o.deliveredFlowLpm), 0)

  if (regime === 'combi') {
    // Dynamic pressure for combi: mains-fed with modest friction loss
    return { peakFlowLpm, dynamicPressureBar: 1.1 }
  }
  if (regime === 'heat_pump_cylinder') {
    // HP cylinder: mains-fed but larger volume demand
    return { peakFlowLpm, dynamicPressureBar: 2.3 }
  }
  // boiler_cylinder and mixergy_cylinder: high-pressure mains-fed store
  return { peakFlowLpm, dynamicPressureBar: 2.5 }
}

// ─── Focus state types ────────────────────────────────────────────────────────

type FocusTarget =
  | { kind: 'outlet'; outletId: string }
  | { kind: 'cylinder' }

// ─── Component ────────────────────────────────────────────────────────────────

export default function DrawOffWorkbench({ onOpenReport }: { onOpenReport?: () => void }) {
  const [regime, setRegime] = useState<Regime>('boiler_cylinder')
  const [boilerOutputKw, setBoilerOutputKw] = useState<number>(DEFAULT_BOILER_OUTPUT_KW)
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null)

  const isCombi  = regime === 'combi'
  const outlets  = getDrawOffData(regime, boilerOutputKw)
  const cylinder = getCylinderData(regime)
  const water    = getWaterPerformance(regime, outlets)

  const focusedOutlet =
    focusTarget?.kind === 'outlet'
      ? outlets.find(o => o.id === focusTarget.outletId) ?? null
      : null
  const focusCylinder = focusTarget?.kind === 'cylinder'

  const closeFocus = () => setFocusTarget(null)

  const focusTitle = focusedOutlet
    ? `${focusedOutlet.label} — Focus`
    : focusCylinder
      ? 'Cylinder — Focus'
      : ''

  return (
    <div className="draw-off-workbench" data-testid="draw-off-workbench">

      {/* ── Regime selector ────────────────────────────────────────────────── */}
      <div className="draw-off-workbench__regime-bar" role="group" aria-label="System regime">
        <span className="draw-off-workbench__regime-label">System:</span>
        {(Object.keys(REGIME_LABELS) as Regime[]).map(r => (
          <button
            key={r}
            className={`draw-off-workbench__regime-btn${regime === r ? ' draw-off-workbench__regime-btn--active' : ''}`}
            onClick={() => setRegime(r)}
            aria-pressed={regime === r}
          >
            {REGIME_LABELS[r]}
          </button>
        ))}
        {onOpenReport && (
          <button
            className="draw-off-workbench__report-btn"
            onClick={onOpenReport}
            aria-label="View report"
          >
            View report
          </button>
        )}
      </div>

      {/* ── Appliance output slider (combi only) ────────────────────────────── */}
      {isCombi && (
        <div className="workbench-output-row" aria-label="Appliance output controls">
          <span className="workbench-output-row__label">Appliance output</span>
          <input
            type="range"
            className="workbench-output-row__slider"
            min={MIN_BOILER_OUTPUT_KW}
            max={MAX_BOILER_OUTPUT_KW}
            step={1}
            value={boilerOutputKw}
            onChange={e => setBoilerOutputKw(Number(e.target.value))}
            aria-label="Appliance output (kW)"
            aria-valuenow={boilerOutputKw}
            aria-valuemin={MIN_BOILER_OUTPUT_KW}
            aria-valuemax={MAX_BOILER_OUTPUT_KW}
          />
          <span className="workbench-output-row__value">{boilerOutputKw} kW</span>
        </div>
      )}

      {/* ── Main panel: outlets + cylinder ─────────────────────────────────── */}
      <div className={`draw-off-workbench__panel${focusTarget ? ' draw-off-workbench__panel--dimmed' : ''}`}>

        {/* Left: 2×2 outlet grid */}
        <div className="draw-off-workbench__outlets" aria-label="Draw-off outlets">
          {outlets.map(outlet => (
            <DrawOffCard
              key={outlet.id}
              data={outlet}
              onFocus={() => setFocusTarget({ kind: 'outlet', outletId: outlet.id })}
            />
          ))}
        </div>

        {/* Right: cylinder / source status */}
        <div className="draw-off-workbench__source">
          <CylinderStatusCard
            data={cylinder}
            onFocus={() => setFocusTarget({ kind: 'cylinder' })}
          />
        </div>

      </div>

      {/* ── Water performance ───────────────────────────────────────────────── */}
      <div
        className={`water-performance-card${focusTarget ? ' water-performance-card--dimmed' : ''}`}
        aria-label="Water performance"
      >
        <div className="panel-title">Water performance</div>
        <div className="water-performance-card__grid">
          <WaterPerformanceGauge
            label="Estimated flow"
            value={water.peakFlowLpm}
            min={0}
            max={25}
            unit="L/min"
            markers={FLOW_MARKERS}
            tone={flowTone(water.peakFlowLpm)}
          />
          <WaterPerformanceGauge
            label="Assumed pressure"
            value={water.dynamicPressureBar}
            min={0}
            max={3}
            unit="bar"
            markers={PRESSURE_MARKERS}
            tone={pressureTone(water.dynamicPressureBar)}
          />
        </div>
      </div>

      {/* ── Focus overlay ───────────────────────────────────────────────────── */}
      {focusTarget && (
        <div
          className="draw-off-focus-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Focus view"
          data-testid="focus-overlay"
        >
          <div className="draw-off-focus-overlay__backdrop" onClick={closeFocus} aria-hidden="true" />
          <div className="draw-off-focus-overlay__panel">
            <div className="draw-off-focus-overlay__header">
              <span className="draw-off-focus-overlay__title" data-testid="focus-overlay-title">
                {focusTitle}
              </span>
              <button
                className="draw-off-focus-overlay__close"
                onClick={closeFocus}
                aria-label="Close Focus view"
              >
                ✕
              </button>
            </div>
            {focusedOutlet && (
              <DrawOffFocusPanel data={focusedOutlet} />
            )}
            {focusCylinder && (
              <CylinderFocusPanel data={cylinder} />
            )}
          </div>
        </div>
      )}

    </div>
  )
}
