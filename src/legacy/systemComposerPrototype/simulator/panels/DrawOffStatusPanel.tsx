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
import type { CylinderType } from '../systemInputsTypes'
import type { DrawOffFlowStability } from '../../../../engine/modules/StoredDhwModule'
import { computeCombiThermalLimit } from '../../model/dhwModel'
import StoredHotWaterReservePanel from './StoredHotWaterReservePanel'
import '../../../../components/lab/lab.css'

// ─── Physics defaults ─────────────────────────────────────────────────────────

const COLD_INLET_TEMP_C              = 10   // Standard cold mains inlet temperature (°C)
const DEFAULT_MAINS_FLOW_RATE_LPM    = 12   // Standard pressurised mains cold flow (L/min)
const CWS_FLOW_RATE_LPM              = 8    // Open-vented CWS gravity feed flow (L/min)
const HOT_SUPPLY_COMBI_TEMP_C        = 48   // Typical combi plate-HEX outlet temperature (°C)
/**
 * HEX setpoint temperature (°C) used to compute the combi thermal flow limit.
 * Represents the target DHW outlet temperature at the heat exchanger before
 * mixing with the cold-bypass at the TMV.
 */
const HOT_SUPPLY_COMBI_SETPOINT_C    = 55
/** Default combi DHW boiler output (kW) used when no survey value is available. */
const DEFAULT_COMBI_DHW_OUTPUT_KW    = 30
/**
 * Fraction of solo hot-supply flow each outlet receives under concurrent demand.
 * Under simultaneous draw, the boiler splits its output between two outlets;
 * each receives approximately 60% of the unconstrained solo rate.
 */
const CONCURRENT_HOT_SPLIT_FACTOR    = 0.6
/**
 * Minimum mains flow (L/min) below which a combi boiler cannot sustain
 * ignition.  Mirrors the ignition threshold in DrawOffWorkbench.tsx.
 */
const COMBI_IGNITION_THRESHOLD_LPM   = 2.5

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
  cold_tap: '🚰',
}

// ─── Derived flow physics ─────────────────────────────────────────────────────

/**
 * Derive outlet hot-supply flow (L/min) for a combi system.
 *
 * The combi plate HEX can supply at most `thermalLimitLpm` of hot water, derived
 * from the boiler's rated DHW output and the temperature rise across the HEX:
 *   thermalLimit = boilerKw / (0.06977 × (setpointC − coldTempC))
 *
 * This thermal limit is additionally capped by the cold-mains supply capacity,
 * since all water — both the HEX portion and the cold bypass — must be drawn from
 * the same mains connection.
 *
 * Under concurrent demand, two outlets share the boiler output; each therefore
 * receives approximately 60% of the solo rate.
 *
 * Returns 0 when mains flow is below the combi ignition threshold.
 */
function deriveCombiHotFlow(
  mainsFlowLpm: number,
  concurrent: boolean,
  boilerDhwOutputKw: number,
  coldInletTempC: number,
): number {
  if (mainsFlowLpm < COMBI_IGNITION_THRESHOLD_LPM) return 0
  // Thermal limit: max hot flow the HEX can sustain at rated boiler output
  const thermalLimitLpm = computeCombiThermalLimit({
    dhwOutputKw: boilerDhwOutputKw,
    coldTempC:   coldInletTempC,
    setpointC:   HOT_SUPPLY_COMBI_SETPOINT_C,
  })
  // Cap by both the thermal limit and the cold-mains capacity
  const maxHotLpm = Math.min(thermalLimitLpm, mainsFlowLpm)
  return concurrent ? Math.round(maxHotLpm * CONCURRENT_HOT_SPLIT_FACTOR * 10) / 10 : maxHotLpm
}

// ─── Outlet adapter ───────────────────────────────────────────────────────────

function outletToViewModel(
  outlet: OutletDisplayState,
  hotSupplyTempC: number,
  concurrent: boolean,
  mainsFlowLpm: number,
  isCombi: boolean,
  openMainsFedCount: number,
  boilerDhwOutputKw: number,
  coldInletTempC: number,
): DrawOffViewModel {
  const icon           = OUTLET_ICONS[outlet.outletId] ?? '🚰'
  // Cold supply available to this outlet from the shared mains.
  // When multiple mains-fed outlets are open concurrently they divide the
  // property-level mains budget equally — each sees only its proportional
  // share, not the full incoming flow.  CWS-fed outlets use the gravity-tank
  // rate regardless of concurrency.
  const coldSupplyFlow = outlet.coldSource === 'cws'
    ? CWS_FLOW_RATE_LPM
    : (openMainsFedCount >= 2
        ? Math.round(mainsFlowLpm / openMainsFedCount * 10) / 10
        : mainsFlowLpm)
  const hotAvailFlow   = outlet.open
    ? (isCombi
        ? deriveCombiHotFlow(mainsFlowLpm, concurrent, boilerDhwOutputKw, coldInletTempC)
        : (concurrent ? Math.round(mainsFlowLpm * CONCURRENT_HOT_SPLIT_FACTOR * 10) / 10 : mainsFlowLpm))
    : 0

  let status: DrawOffStatus
  if (!outlet.open) {
    // Inactive outlets must not masquerade as stable.  Use 'cold' if a pressure
    // collapse or combi ignition failure means the outlet would deliver cold water
    // even if opened; otherwise 'inactive' (simply not in use).
    status = 'inactive'
  } else if (isCombi && mainsFlowLpm < COMBI_IGNITION_THRESHOLD_LPM) {
    // Combi-specific: mains flow below ignition threshold — burner cannot fire.
    // Outlet is open but will only deliver cold water.
    status = 'below_ignition_threshold'
  } else if (outlet.isConstrained) {
    status = (outlet.deliveredTempC ?? COLD_INLET_TEMP_C) < MIN_USABLE_HOT_TEMP_C ? 'temp_limited' : 'flow_limited'
  } else if (outlet.service === 'cold_only') {
    status = 'cold'
  } else if (outlet.service === 'mixed_cold_running') {
    status = 'temp_limited'
  } else {
    status = 'stable'
  }

  let note: string
  if (!outlet.open) {
    note = 'Outlet closed — no flow demand.'
  } else if (status === 'below_ignition_threshold') {
    note = 'Flow too low to fire combi — simultaneous demand has dropped per-outlet flow below ignition threshold. Only cold water delivered.'
  } else if (outlet.service === 'cold_only') {
    note = 'Cold tap outlet — direct cold-water draw with no hot-water demand.'
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
    hotSupplyTempC:            outlet.service === 'cold_only' ? 0 : outlet.open ? hotSupplyTempC : 0,
    hotSupplyAvailableFlowLpm: outlet.service === 'cold_only' ? 0 : hotAvailFlow,
    deliveredTempC:            outlet.open ? Math.round(outlet.deliveredTempC ?? COLD_INLET_TEMP_C) : COLD_INLET_TEMP_C,
    deliveredFlowLpm:          Math.round(outlet.flowLpm * 10) / 10,
    note,
  }
}

// ─── Cylinder adapter ─────────────────────────────────────────────────────────

function buildCylinderViewModel(
  state: DrawOffDisplayState,
  systemChoice: SimulatorSystemChoice,
  cylinderType?: CylinderType,
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
  // Mixergy is a cylinder type, not a system type.
  // Use cylinderType when available; fall back to legacy systemChoice === 'mixergy'
  // for backwards compatibility with callers that have not yet been updated.
  const isMixergy     = cylinderType === 'mixergy' || systemChoice === 'mixergy'
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

// ─── Pipework advisory ────────────────────────────────────────────────────────

/**
 * Inline advisory shown for open-vented systems when flow stability is
 * marginal or limited, explaining that performance depends on pipework layout.
 *
 * Only rendered when systemChoice === 'open_vented' AND flowStability is
 * 'marginal' or 'limited' — so the label always reflects a constrained state.
 */
function PipeworkPerformanceAdvisory() {
  return (
    <details className="draw-off-pipework-advisory" data-testid="draw-off-pipework-advisory">
      <summary className="draw-off-pipework-advisory__summary">
        Limited by tank-fed supply + pipework resistance
      </summary>
      <div className="draw-off-pipework-advisory__body">
        <p>
          Tank-fed systems rely on the height of the cold-water storage tank above the outlets.
          Pressure and flow are also influenced by pipe size, length, and fittings.
        </p>
        <p>Potential improvements to consider:</p>
        <ul>
          <li>Increase pipe size to bathroom (e.g. 15 mm → 22 mm)</li>
          <li>Add a dedicated cold feed to key outlets</li>
          <li>Reduce long runs or restrictive fittings</li>
        </ul>
        <p>
          A qualified installer can assess whether these changes would improve performance.
          Where tank height is fundamentally limited, a pump or mains-fed supply
          may be required.
        </p>
      </div>
    </details>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DrawOffStatusPanelProps {
  state: DrawOffDisplayState
  systemChoice: SimulatorSystemChoice
  /**
   * Cylinder technology type — drives Mixergy-specific behaviour in the cylinder
   * status card.  When provided, takes precedence over the legacy
   * `systemChoice === 'mixergy'` check.  Mixergy is a cylinder type, not a
   * system type: it is valid alongside any stored-cylinder system (unvented,
   * vented, heat pump) but NEVER for combi.
   */
  cylinderType?: CylinderType
  /** Mains dynamic pressure (bar) from system inputs — drives outlet flow physics. */
  mainsPressureBar?: number
  /** Mains dynamic flow rate (L/min) from system inputs — drives outlet delivery rate. */
  mainsFlowLpm?: number
  /**
   * Combi boiler DHW plate-HEX rated output (kW).
   * Used to compute the thermal flow limit: max hot-water flow = kW / (0.06977 × ΔT_hex).
   * Falls back to DEFAULT_COMBI_DHW_OUTPUT_KW (30 kW) when not provided.
   */
  boilerDhwOutputKw?: number
  /**
   * Cold-water inlet temperature (°C).
   * Used with boilerDhwOutputKw to compute the combi thermal flow limit.
   * Falls back to COLD_INLET_TEMP_C (10 °C) when not provided.
   */
  coldInletTempC?: number
  /**
   * Flow stability classification from the draw-off model.
   * When 'marginal' or 'limited' on an open-vented system, surfaces the
   * pipework-dependent performance advisory in the panel.
   */
  flowStability?: DrawOffFlowStability
  mode: 'auto' | 'manual'
  heatingEnabled: boolean
  shower: boolean
  bath: boolean
  kitchen: boolean
  coldTap: boolean
  onSetMode: (mode: 'auto' | 'manual') => void
  onToggleHeating: () => void
  onToggleShower: () => void
  onToggleBath: () => void
  onToggleKitchen: () => void
  onToggleColdTap: () => void
  onPresetOne: () => void
  onPresetTwo: () => void
  onPresetBathFill: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DrawOffStatusPanel({ state, systemChoice, cylinderType, mainsPressureBar: _mainsPressureBar, mainsFlowLpm, boilerDhwOutputKw, coldInletTempC: coldInletTempCProp, flowStability, ...controls }: DrawOffStatusPanelProps) {
  const openCount    = state.outletStates.filter(o => o.open).length
  const concurrent   = openCount >= 2
  const isCombi      = systemChoice === 'combi'
  // Resolve the effective mains flow — use the real survey/input value when available.
  const effectiveMainsFlowLpm = mainsFlowLpm ?? DEFAULT_MAINS_FLOW_RATE_LPM
  // Resolve boiler DHW output and cold inlet temp for combi thermal limit calculation.
  const effectiveBoilerKw     = boilerDhwOutputKw ?? DEFAULT_COMBI_DHW_OUTPUT_KW
  const effectiveColdTempC    = coldInletTempCProp ?? COLD_INLET_TEMP_C
  const hotSupplyTempC = state.storedHotWaterState
    ? Math.round(state.storedHotWaterState.topTempC)
    : HOT_SUPPLY_COMBI_TEMP_C

  // Count concurrent mains-fed outlets so each card shows its proportional
  // cold-supply share rather than the full incoming mains flow.
  const openMainsFedCount = Math.max(1, state.outletStates.filter(o => o.open && o.coldSource !== 'cws').length)

  const outletCards   = state.outletStates.map(o => outletToViewModel(o, hotSupplyTempC, concurrent, effectiveMainsFlowLpm, isCombi, openMainsFedCount, effectiveBoilerKw, effectiveColdTempC))
  const cylinderData  = buildCylinderViewModel(state, systemChoice, cylinderType)

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
        <button
          className={`sim-demand-btn sim-demand-btn--outlet${controls.coldTap ? ' sim-demand-btn--active' : ''}`}
          onClick={controls.onToggleColdTap}
        >Cold tap</button>
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

      {/* ── Pipework advisory (open-vented with marginal/limited flow) ────── */}
      {systemChoice === 'open_vented' && (flowStability === 'marginal' || flowStability === 'limited') && (
        <PipeworkPerformanceAdvisory />
      )}

    </div>
  )
}
