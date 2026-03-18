/**
 * DrawOffStatusPanel — draw-off behaviour workbench panel.
 *
 * PR4:  driven by SystemDiagramDisplayState via useDrawOffPlayback.
 * PR15: adds stored hot water reserve indicator for cylinder systems.
 * PR17: replaced slider-based outlet rows with DrawOffCard + CylinderStatusCard
 *       workbench layout.  Controls remain above the cards and drive them
 *       dynamically via the live simulation state.
 *
 * Architecture:
 *   SimulatorDashboard → useDrawOffPlayback(diagramState) → DrawOffDisplayState
 *   DrawOffStatusPanel({ state, systemChoice }) →
 *     controls bar
 *     → DrawOffCard × 3 (shower, bath, kitchen — live sim data)
 *     → CylinderStatusCard (live sim data)
 *     → StoredHotWaterReservePanel (cylinder only)
 *
 * The panel is a display adapter: it never re-derives outlet truth from raw
 * systemType booleans.  useDrawOffPlayback is the single mapping layer.
 */

import DrawOffCard from '../../../../components/lab/DrawOffCard'
import CylinderStatusCard from '../../../../components/lab/CylinderStatusCard'
import type { DrawOffViewModel, DrawOffStatus, CylinderStatusViewModel, StorageRegime, CylinderState } from '../../../../components/lab/drawOffTypes'
import type { DrawOffDisplayState } from '../useDrawOffPlayback'
import type { OutletDisplayState } from '../../state/outletDisplayState'
import type { StoredHotWaterDisplayState } from '../useStoredHotWaterPlayback'
import type { SimulatorSystemChoice } from '../useSystemDiagramPlayback'
import StoredHotWaterReservePanel from './StoredHotWaterReservePanel'
import '../../../../components/lab/lab.css'

// ─── Physics defaults ─────────────────────────────────────────────────────────

const COLD_INLET_TEMP_C              = 10  // Standard cold mains inlet temperature (°C)
const MAINS_FLOW_RATE_LPM            = 12  // Standard pressurised mains cold flow (L/min)
const CWS_FLOW_RATE_LPM              = 8   // Open-vented CWS gravity feed flow (L/min)
const HOT_SUPPLY_COMBI_TEMP_C        = 48  // Typical combi plate-HEX outlet temperature (°C)
const HOT_FLOW_SOLO_LPM              = 10  // Available hot flow with a single outlet open (L/min)
const HOT_FLOW_CONCURRENT_LPM        = 6   // Available hot flow under concurrent demand (L/min)

/** Minimum delivered temperature (°C) considered useful hot water at the outlet. */
const MIN_USABLE_HOT_TEMP_C          = 38

/** Reserve fraction below which the cylinder enters a recovering state. */
const RESERVE_FRACTION_RECOVERING    = 0.3

/** Reserve fraction below which the cylinder is considered depleted. */
const RESERVE_FRACTION_DEPLETED      = 0.1

// ─── Outlet icon map ──────────────────────────────────────────────────────────

const OUTLET_ICONS: Record<string, string> = {
  shower:  '🚿',
  bath:    '🛁',
  kitchen: '🚰',
}

// ─── Outlet adapter ───────────────────────────────────────────────────────────

function outletToViewModel(
  outlet: OutletDisplayState,
  hotSupplyTempC: number,
  concurrent: boolean,
): DrawOffViewModel {
  const icon            = OUTLET_ICONS[outlet.outletId] ?? '🚰'
  const coldSupplyFlow  = outlet.coldSource === 'cws' ? CWS_FLOW_RATE_LPM : MAINS_FLOW_RATE_LPM
  const hotAvailFlow    = outlet.open ? (concurrent ? HOT_FLOW_CONCURRENT_LPM : HOT_FLOW_SOLO_LPM) : 0

  let status: DrawOffStatus
  if (!outlet.open) {
    // Inactive outlets must not masquerade as stable.  Use 'cold' if a pressure
    // collapse or combi ignition failure means the outlet would deliver cold water
    // even if opened; otherwise 'inactive' (simply not in use).
    status = 'inactive'
  } else if (outlet.isConstrained) {
    status = (outlet.deliveredTempC ?? COLD_INLET_TEMP_C) < MIN_USABLE_HOT_TEMP_C ? 'temp_limited' : 'flow_limited'
  } else if (outlet.service === 'mixed_cold_running') {
    status = 'temp_limited'
  } else {
    status = 'stable'
  }

  let note: string
  if (!outlet.open) {
    note = 'Outlet closed — no flow demand.'
  } else if (outlet.isConstrained && outlet.constraintReason) {
    note = outlet.constraintReason
  } else if (outlet.isConstrained) {
    note = 'Concurrent demand has reduced available flow.'
  } else if (outlet.hotSource === 'on_demand') {
    note = 'On-demand hot water stable. Temperature delivered within seconds.'
  } else if (outlet.hotSource === 'stored') {
    note = 'Stored hot water stable. Cylinder temperature holding.'
  } else {
    note = 'Supply stable.'
  }

  return {
    id:                        outlet.outletId,
    label:                     outlet.label,
    icon,
    status,
    coldSupplyTempC:           COLD_INLET_TEMP_C,
    coldSupplyFlowLpm:         coldSupplyFlow,
    hotSupplyTempC:            outlet.open ? hotSupplyTempC : 0,
    hotSupplyAvailableFlowLpm: hotAvailFlow,
    deliveredTempC:            outlet.open ? Math.round(outlet.deliveredTempC ?? COLD_INLET_TEMP_C) : COLD_INLET_TEMP_C,
    deliveredFlowLpm:          Math.round(outlet.flowLpm * 10) / 10,
    note,
  }
}

// ─── Cylinder adapter ─────────────────────────────────────────────────────────

function buildCylinderViewModel(
  state: DrawOffDisplayState,
  systemChoice: SimulatorSystemChoice,
): CylinderStatusViewModel {
  if (!state.isCylinder || !state.storedHotWaterState) {
    return {
      storageRegime:         'on_demand_combi',
      recoverySource:        'None (on-demand hot water)',
      recoveryPowerTendency: 'N/A — no stored volume to recover',
      state:                 'idle',
      recoveryNote:          'On-demand supply produced within seconds of opening a tap. No recharge cycle required.',
      storeNote:             'No cylinder storage — on-demand hot water only. Concurrent demand degrades both flow and temperature simultaneously.',
    }
  }

  const stored: StoredHotWaterDisplayState = state.storedHotWaterState
  const isHeatPump    = systemChoice === 'heat_pump'
  const isMixergy     = systemChoice === 'mixergy'
  const storageRegime: StorageRegime = isMixergy
    ? 'mixergy_cylinder'
    : isHeatPump ? 'heat_pump_cylinder' : 'boiler_cylinder'

  let cylinderState: CylinderState = 'idle'
  if (stored.isReheatActive) {
    cylinderState = stored.usableReserveFraction < RESERVE_FRACTION_RECOVERING ? 'recovering' : 'charging'
  } else if (stored.usableReserveFraction < RESERVE_FRACTION_DEPLETED) {
    cylinderState = 'depleted'
  }

  const sourceLabel    = isMixergy ? 'Boiler (Mixergy)' : isHeatPump ? 'Heat pump' : 'Boiler'
  const thermocline    = cylinderState === 'recovering' || cylinderState === 'depleted' ? 'dropping' : 'stable'
  const heatedVolumeL  = Math.round(stored.usableReserveFraction * stored.cylinderSizeLitres)

  return {
    storageRegime,
    topTempC:              Math.round(stored.topTempC),
    ...(isMixergy
      ? {
          heatedVolumeL,
          heatedFractionPct:  Math.round(stored.usableReserveFraction * 100),
        }
      : {
          bulkTempC: Math.round(stored.deliveryTempC),
        }),
    nominalVolumeL:        stored.cylinderSizeLitres,
    usableVolumeFactor:    Math.round(stored.usableReserveFraction * 100) / 100,
    recoverySource:        sourceLabel,
    recoveryPowerTendency: isHeatPump
      ? 'Moderate — slower reheat than boiler under peak demand'
      : isMixergy
        ? 'Demand-mirrored heating — hot layer maintained; reduced reheat cycling'
        : 'High — rapid recovery via dedicated DHW zone',
    state:                 cylinderState,
    recoveryNote:          stored.isReheatActive
      ? `${sourceLabel} firing — cylinder recovering. Store temperature stabilising.`
      : 'System monitoring cylinder temperature. No active reheat required.',
    storeNote:             isMixergy
      ? `Hot water delivered from a defined heated layer. ${heatedVolumeL} L (${Math.round(stored.usableReserveFraction * 100)}%) heated at ${Math.round(stored.topTempC)}°C. Once the thermocline reaches the outlet level, hot delivery falls rapidly rather than cooling gradually.`
      : `${Math.round(stored.availableHotWaterL)} L available at ${Math.round(stored.deliveryTempC)}°C. Thermocline ${thermocline}.`,
  }
}

// ─── System banners ───────────────────────────────────────────────────────────

function SystemBanners({ state }: { state: DrawOffDisplayState }) {
  const banners: string[] = []
  if (state.serviceSwitchingActive) banners.push('On-demand hot water active · CH temporarily suspended')
  if (state.isCylinder && (state.systemMode === 'dhw_reheat' || state.systemMode === 'heating_and_reheat')) {
    banners.push('Stored hot water buffering peak demand')
  }
  if (state.combiAtCapacity) banners.push('On-demand hot water at capacity')
  if (!banners.length) return null
  return (
    <div className="draw-off-panel__banners">
      {banners.map((msg, i) => (
        <div key={i} className="draw-off-banner" role="status">ℹ {msg}</div>
      ))}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DrawOffStatusPanelProps {
  state: DrawOffDisplayState
  systemChoice: SimulatorSystemChoice
  mode: 'auto' | 'manual'
  heatingEnabled: boolean
  shower: boolean
  bath: boolean
  kitchen: boolean
  onSetMode: (mode: 'auto' | 'manual') => void
  onToggleHeating: () => void
  onToggleShower: () => void
  onToggleBath: () => void
  onToggleKitchen: () => void
  onPresetOne: () => void
  onPresetTwo: () => void
  onPresetBathFill: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DrawOffStatusPanel({ state, systemChoice, ...controls }: DrawOffStatusPanelProps) {
  const openCount    = state.outletStates.filter(o => o.open).length
  const concurrent   = openCount >= 2
  const hotSupplyTempC = state.storedHotWaterState
    ? Math.round(state.storedHotWaterState.topTempC)
    : HOT_SUPPLY_COMBI_TEMP_C

  const outletCards   = state.outletStates.map(o => outletToViewModel(o, hotSupplyTempC, concurrent))
  const cylinderData  = buildCylinderViewModel(state, systemChoice)

  return (
    <div className="draw-off-panel" data-testid="draw-off-behaviour">

      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className="draw-off-panel__header">Draw-off Behaviour</div>

      {/* ── Demo controls ───────────────────────────────────────────────── */}
      <div className="draw-off-controls">
        <button
          className={`sim-demand-btn${controls.mode === 'auto' ? ' sim-demand-btn--active' : ''}`}
          onClick={() => controls.onSetMode('auto')}
        >Auto demo</button>
        <button
          className={`sim-demand-btn${controls.mode === 'manual' ? ' sim-demand-btn--active' : ''}`}
          onClick={() => controls.onSetMode('manual')}
        >Manual</button>
        <button
          className={`sim-demand-btn${controls.heatingEnabled ? ' sim-demand-btn--active' : ''}`}
          onClick={controls.onToggleHeating}
        >Heating</button>
        <button
          className={`sim-demand-btn sim-demand-btn--outlet${controls.shower ? ' sim-demand-btn--active' : ''}`}
          onClick={controls.onToggleShower}
        >Shower</button>
        <button
          className={`sim-demand-btn sim-demand-btn--outlet${controls.bath ? ' sim-demand-btn--active' : ''}`}
          onClick={controls.onToggleBath}
        >Bath</button>
        <button
          className={`sim-demand-btn sim-demand-btn--outlet${controls.kitchen ? ' sim-demand-btn--active' : ''}`}
          onClick={controls.onToggleKitchen}
        >Kitchen tap</button>
        <button className="sim-demand-btn sim-demand-btn--preset" onClick={controls.onPresetOne}>One outlet</button>
        <button className="sim-demand-btn sim-demand-btn--preset" onClick={controls.onPresetTwo}>Two outlets</button>
        <button className="sim-demand-btn sim-demand-btn--preset" onClick={controls.onPresetBathFill}>Bath fill</button>
      </div>

      {/* ── System banners ──────────────────────────────────────────────── */}
      <SystemBanners state={state} />

      {/* ── Workbench: outlet cards + cylinder status ────────────────────── */}
      <div className="draw-off-workbench__panel">

        {/* Left: outlet cards grid */}
        <div className="draw-off-workbench__outlets" aria-label="Draw-off outlets">
          {outletCards.map(card => (
            <DrawOffCard key={card.id} data={card} />
          ))}
        </div>

        {/* Right: cylinder / source status */}
        <div className="draw-off-workbench__source">
          <CylinderStatusCard data={cylinderData} />
        </div>

      </div>

      {/* ── Stored hot water reserve (cylinder systems only) ─────────────── */}
      {state.storedHotWaterState !== null && (
        <StoredHotWaterReservePanel state={state.storedHotWaterState} />
      )}

    </div>
  )
}
