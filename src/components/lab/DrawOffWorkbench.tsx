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
 * All regime data values illustrate physics differences between system types.
 * No engine model is re-derived here — values are scaled display models only.
 *
 * Placement: System Lab → Visual tab.
 */

import { useState } from 'react'
import DrawOffCard from './DrawOffCard'
import CylinderStatusCard from './CylinderStatusCard'
import WaterPerformanceGauge from '../behaviour/WaterPerformanceGauge'
import {
  FLOW_MARKERS,
  PRESSURE_MARKERS,
  flowTone,
  pressureTone,
} from '../behaviour/waterPerformance.model'
import type { DrawOffViewModel, CylinderStatusViewModel } from './drawOffTypes'

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
    const concurrentHotFlow = scaleCombiFlow(4, outputKw)
    const hotTemp = 45 + Math.round((outputKw - DEFAULT_BOILER_OUTPUT_KW) * 0.15)
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
          ? 'Flow within appliance throughput. Temperature held by adjusting blend ratio.'
          : 'Flow capped at appliance throughput limit. Temperature held by adjusting blend ratio.',
      },
      {
        id: 'bath',
        label: 'Bath fill',
        icon: '🛁',
        status: 'starved',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 12,
        hotSupplyTempC: hotTemp - 7,
        hotSupplyAvailableFlowLpm: concurrentHotFlow,
        deliveredTempC: 32,
        deliveredFlowLpm: Math.min(6, concurrentHotFlow + 2),
        note: 'Concurrent demand has exhausted appliance capacity. Delivered temperature and flow both degraded.',
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
      recoveryNote: 'Heat pump operating at rated COP to recover cylinder. Reheat rate lower than peak simultaneous demand.',
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function DrawOffWorkbench() {
  const [regime, setRegime] = useState<Regime>('boiler_cylinder')
  const [boilerOutputKw, setBoilerOutputKw] = useState<number>(DEFAULT_BOILER_OUTPUT_KW)

  const isCombi  = regime === 'combi'
  const outlets  = getDrawOffData(regime, boilerOutputKw)
  const cylinder = getCylinderData(regime)
  const water    = getWaterPerformance(regime, outlets)

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
      <div className="draw-off-workbench__panel">

        {/* Left: 2×2 outlet grid */}
        <div className="draw-off-workbench__outlets" aria-label="Draw-off outlets">
          {outlets.map(outlet => (
            <DrawOffCard key={outlet.id} data={outlet} />
          ))}
        </div>

        {/* Right: cylinder / source status */}
        <div className="draw-off-workbench__source">
          <CylinderStatusCard data={cylinder} />
        </div>

      </div>

      {/* ── Water performance ───────────────────────────────────────────────── */}
      <div className="water-performance-card" aria-label="Water performance">
        <div className="panel-title">Water performance</div>
        <div className="water-performance-card__grid">
          <WaterPerformanceGauge
            label="Flow"
            value={water.peakFlowLpm}
            min={0}
            max={25}
            unit="L/min"
            markers={FLOW_MARKERS}
            tone={flowTone(water.peakFlowLpm)}
          />
          <WaterPerformanceGauge
            label="Dynamic pressure"
            value={water.dynamicPressureBar}
            min={0}
            max={3}
            unit="bar"
            markers={PRESSURE_MARKERS}
            tone={pressureTone(water.dynamicPressureBar)}
          />
        </div>
      </div>

    </div>
  )
}
