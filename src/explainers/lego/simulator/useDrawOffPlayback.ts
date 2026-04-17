// src/explainers/lego/simulator/useDrawOffPlayback.ts
//
// Display adapter hook that drives DrawOffStatusPanel with synthetic outlet
// states derived from SystemDiagramDisplayState.
//
// This is a pure display adapter — no second simulation path.  It maps the
// current demo phase onto per-outlet display states so the Draw-Off panel
// visibly reacts to playback.
//
// Architecture mirrors useHousePlayback: consumes SystemDiagramDisplayState,
// produces display state for the panel.
//
// System-specific behaviour preserved:
//   - Combi: concurrent demand shows concurrency pain (bath constrained).
//   - Stored / vented: concurrent draws remain strong until reheat matters.
//   - Vented: cold supply correctly labelled as tank-fed (CWS).

import type { SystemDiagramDisplayState } from './useSystemDiagramPlayback'
import type { OutletDisplayState } from '../state/outletDisplayState'
import type { SystemMode } from '../animation/types'
import type { CylinderType } from './systemInputsTypes'
import { useStoredHotWaterPlayback } from './useStoredHotWaterPlayback'
import type { StoredHotWaterDisplayState } from './useStoredHotWaterPlayback'

// ─── Physics constants ────────────────────────────────────────────────────────

/**
 * Default cold-main flow budget used in the demo when no real survey value is
 * available.  Matches DEFAULT_MAINS_FLOW_RATE_LPM in DrawOffStatusPanel.
 */
const DEMO_MAINS_FLOW_LPM = 12

/** Default combi DHW boiler output (kW) used in the demo when no survey value is available. */
const DEFAULT_COMBI_DHW_OUTPUT_KW = 30

/** Default cold inlet temperature (°C) used in the demo. */
const DEFAULT_COLD_INLET_TEMP_C = 10

/** Nominal solo-outlet delivered flows for a stored (cylinder) system (L/min). */
const STORED_SOLO_FLOW_LPM = {
  shower:  9.5,
  bath:    8.0,
  kitchen: 5.5,
} as const

/**
 * Natural (unconstrained) demand for each combi outlet at full pressure (L/min).
 * Represents what each appliance draws when boiler output and mains supply are ample.
 */
const COMBI_NATURAL_DEMAND_LPM: Record<string, number> = {
  shower:  9.0,
  bath:    8.2,
  kitchen: 6.0,
}

/**
 * Solo delivery temperature for each combi outlet (°C).
 * Used with cold inlet temperature to compute the hot-water fraction (and thus
 * the kW draw on the HEX) for each outlet independently of the HEX setpoint.
 */
const COMBI_SOLO_DELIVERY_TEMP_C: Record<string, number> = {
  shower:  45,
  bath:    44,
  kitchen: 44,
}

/**
 * Maximum temperature penalty (°C) applied to delivered temperature when the
 * boiler or mains is at its limit under concurrent demand.  The penalty scales
 * linearly from 0 (no constraint) to this value (fully constrained / throttle=0).
 */
const MAX_CONCURRENT_TEMP_PENALTY_C = 5

// ─── Public state type ────────────────────────────────────────────────────────

/**
 * All display-relevant state the DrawOffStatusPanel needs.
 *
 * Sourced entirely from SystemDiagramDisplayState — no independent simulation.
 */
export type DrawOffDisplayState = {
  /** Per-outlet display states derived from the current demo phase. */
  outletStates: OutletDisplayState[]
  /** Current system operating mode — drives system-level context messages. */
  systemMode: SystemMode
  /** True when the system has a hot-water cylinder (stored or vented). */
  isCylinder: boolean
  /**
   * True when a combi boiler has diverted to the DHW plate HEX, temporarily
   * suspending CH.  Authoritative source: SystemDiagramDisplayState.
   */
  serviceSwitchingActive: boolean
  /**
   * True when the combi boiler is under peak concurrent DHW demand and cannot
   * sustain setpoint temperature across all open outlets.
   */
  combiAtCapacity: boolean
  /**
   * Stored hot water reserve state — present for cylinder systems only.
   * Null for combi (no thermal store).
   */
  storedHotWaterState: StoredHotWaterDisplayState | null
}

// ─── Combi physics ────────────────────────────────────────────────────────────

/**
 * Result of the combi outlet flow calculation.
 *
 * `flows`       — delivered mixed flow (L/min) per outlet id.
 * `throttle`    — ratio applied to natural demand (1 = no constraint, < 1 = constrained).
 * `throttledBy` — which constraint is binding: boiler output, cold mains, or neither.
 */
interface CombiFlowResult {
  flows:       Record<string, number>
  throttle:    number
  throttledBy: 'boiler' | 'mains' | 'none'
}

/**
 * Compute physics-derived outlet flow rates for a combi system.
 *
 * For each open outlet the kW required to supply its hot-water fraction is:
 *   kW_i = 0.06977 × demand_i × (T_delivery_i − T_cold)
 *
 * The total kW demand is compared against the boiler's DHW output and the
 * total volume demand against the cold-mains supply.  The binding constraint
 * (whichever is more restrictive) sets a throttle factor applied uniformly
 * to all open outlets.  Uniformly reducing each outlet's flow preserves the
 * hot/cold mixing ratio, so delivery temperatures are unaffected.
 */
function computeCombiOutletFlows(
  openOutletIds: string[],
  boilerDhwOutputKw: number,
  coldInletTempC:    number,
  mainsFlowLpm:      number,
): CombiFlowResult {
  if (openOutletIds.length === 0) {
    return { flows: {}, throttle: 1, throttledBy: 'none' }
  }

  // Total kW needed = Σ (0.06977 × demand × ΔT_delivery)
  const totalKwNeeded = openOutletIds.reduce((sum, id) => {
    const demand      = COMBI_NATURAL_DEMAND_LPM[id]  ?? 0
    const deliveryTempC = COMBI_SOLO_DELIVERY_TEMP_C[id] ?? 40
    return sum + 0.06977 * demand * (deliveryTempC - coldInletTempC)
  }, 0)

  // Total volume demand = Σ demand_i (all water comes from the cold main)
  const totalDemandLpm = openOutletIds.reduce(
    (sum, id) => sum + (COMBI_NATURAL_DEMAND_LPM[id] ?? 0), 0,
  )

  const throttleBoiler = totalKwNeeded   > 0 ? Math.min(boilerDhwOutputKw / totalKwNeeded, 1) : 1
  const throttleMains  = totalDemandLpm  > 0 ? Math.min(mainsFlowLpm      / totalDemandLpm,  1) : 1
  const throttle = Math.min(throttleBoiler, throttleMains)

  const throttledBy: CombiFlowResult['throttledBy'] =
    throttle >= 1              ? 'none'
    : throttleBoiler <= throttleMains ? 'boiler'
    : 'mains'

  const flows: Record<string, number> = {}
  for (const id of openOutletIds) {
    flows[id] = Math.round((COMBI_NATURAL_DEMAND_LPM[id] ?? 0) * throttle * 10) / 10
  }

  return { flows, throttle, throttledBy }
}



function buildOutletStates(
  diagramState: SystemDiagramDisplayState,
  mainsFlowBudgetLpm: number,
  boilerDhwOutputKw:  number,
  coldInletTempC:     number,
): OutletDisplayState[] {
  const { hotDrawActive: legacyHotDrawActive, serviceSwitchingActive, supplyOrigins, systemType, outletDemands } = diagramState

  // Hot source from supply origins — authoritative, never inferred from systemType.
  const hotSource: OutletDisplayState['hotSource'] =
    supplyOrigins.onDemandHot ? 'on_demand'
    : supplyOrigins.dhwHotStore ? 'stored'
    : undefined

  // Cold source: vented systems draw from CWS tank; all others from mains.
  const coldSource: OutletDisplayState['coldSource'] =
    supplyOrigins.cwsTankCold ? 'cws' : 'mains'

  const isCombi = systemType === 'combi'

  const closedShower: OutletDisplayState = {
    outletId: 'shower', label: 'Shower',
    open: false, service: 'off', flowLpm: 0, isConstrained: false, coldSource,
  }
  const closedBath: OutletDisplayState = {
    outletId: 'bath', label: 'Bath',
    open: false, service: 'off', flowLpm: 0, isConstrained: false, coldSource,
  }
  const closedKitchen: OutletDisplayState = {
    outletId: 'kitchen', label: 'Kitchen tap',
    open: false, service: 'off', flowLpm: 0, isConstrained: false, coldSource: 'mains',
  }

  const showerOpen = outletDemands ? outletDemands.shower : legacyHotDrawActive
  const bathOpen = outletDemands ? outletDemands.bath : (!systemType || systemType === 'combi' ? serviceSwitchingActive : legacyHotDrawActive)
  const kitchenOpen = outletDemands ? outletDemands.kitchen : false
  const hotDrawActive = showerOpen || bathOpen || kitchenOpen

  if (!hotDrawActive) {
    return [closedShower, closedBath, closedKitchen]
  }

  if (isCombi) {
    // Build the list of open outlet ids to pass to the physics model.
    const openOutletIds = [
      ...(showerOpen  ? ['shower']  : []),
      ...(bathOpen    ? ['bath']    : []),
      ...(kitchenOpen ? ['kitchen'] : []),
    ]

    // Physics-derived outlet flows:
    //   - boiler output (kW) limits how much hot the HEX can supply
    //   - cold mains capacity (L/min) limits total outlet volume (all water from mains)
    const { flows, throttle, throttledBy } = computeCombiOutletFlows(
      openOutletIds, boilerDhwOutputKw, coldInletTempC, mainsFlowBudgetLpm,
    )

    const isConstrained = throttle < 1
    const constraintReason = isConstrained
      ? throttledBy === 'mains'
        ? `Cold main at ${mainsFlowBudgetLpm} L/min — concurrent demand reduces per-outlet flow`
        : 'On-demand hot water at capacity — boiler output reached under concurrent demand'
      : undefined

    // Delivery temperature: solo temps when unconstrained; apply a small
    // temperature penalty proportional to the throttle shortfall when constrained.
    const tempPenalty = isConstrained ? Math.round((1 - throttle) * MAX_CONCURRENT_TEMP_PENALTY_C) : 0

    return [
      showerOpen ? {
        outletId: 'shower', label: 'Shower', open: true,
        service: 'mixed_hot_running',
        flowLpm: flows['shower'] ?? 0,
        deliveredTempC: COMBI_SOLO_DELIVERY_TEMP_C['shower'] - tempPenalty,
        isConstrained,
        constraintReason,
        coldSource, hotSource,
      } : closedShower,
      bathOpen
        ? {
            outletId: 'bath', label: 'Bath', open: true,
            service: 'mixed_hot_running',
            flowLpm: flows['bath'] ?? 0,
            deliveredTempC: COMBI_SOLO_DELIVERY_TEMP_C['bath'] - tempPenalty,
            isConstrained,
            constraintReason,
            coldSource, hotSource,
          }
        : closedBath,
      kitchenOpen
        ? {
            outletId: 'kitchen', label: 'Kitchen tap', open: true,
            service: 'mixed_hot_running',
            flowLpm: flows['kitchen'] ?? 0,
            deliveredTempC: COMBI_SOLO_DELIVERY_TEMP_C['kitchen'] - tempPenalty,
            isConstrained,
            constraintReason,
            coldSource: 'mains', hotSource,
          }
        : closedKitchen,
    ]
  }

  // Stored / vented cylinder: the thermal store buffers hot demand, but ALL
  // outlets still share a single cold-mains budget when they are mains-fed.
  // CWS-fed outlets (vented systems) draw from the cold-water storage cistern
  // and do NOT compete for the pressurised mains supply.
  //
  // Mains-fed outlets: apply proportional throttle when combined demand exceeds
  // the mains flow budget.
  const isMainsFedStore = coldSource !== 'cws'
  const mainsOpenDemand =
    (showerOpen  && isMainsFedStore ? STORED_SOLO_FLOW_LPM.shower  : 0) +
    (bathOpen    && isMainsFedStore ? STORED_SOLO_FLOW_LPM.bath    : 0) +
    (kitchenOpen                    ? STORED_SOLO_FLOW_LPM.kitchen : 0)

  // Throttle is the fraction of demand each mains outlet actually receives.
  // When the total demand fits within the budget, throttle = 1 (no reduction).
  const mainsThrottle = (isMainsFedStore && mainsOpenDemand > mainsFlowBudgetLpm)
    ? mainsFlowBudgetLpm / mainsOpenDemand
    : 1
  const mainsConstrained = mainsThrottle < 1
  const mainsConstraintReason = mainsConstrained
    ? `Shared cold main at ${mainsFlowBudgetLpm} L/min — concurrent demand reduces per-outlet flow`
    : undefined

  return [
    showerOpen ? {
      outletId: 'shower', label: 'Shower', open: true,
      service: 'mixed_hot_running',
      flowLpm: Math.round(STORED_SOLO_FLOW_LPM.shower * (isMainsFedStore ? mainsThrottle : 1) * 10) / 10,
      deliveredTempC: 47,
      isConstrained: isMainsFedStore && mainsConstrained,
      constraintReason: isMainsFedStore ? mainsConstraintReason : undefined,
      coldSource, hotSource,
    } : closedShower,
    bathOpen ? {
      outletId: 'bath', label: 'Bath', open: true,
      service: 'mixed_hot_running',
      flowLpm: Math.round(STORED_SOLO_FLOW_LPM.bath * (isMainsFedStore ? mainsThrottle : 1) * 10) / 10,
      deliveredTempC: 45,
      isConstrained: isMainsFedStore && mainsConstrained,
      constraintReason: isMainsFedStore ? mainsConstraintReason : undefined,
      coldSource, hotSource,
    } : closedBath,
    kitchenOpen
      ? {
          outletId: 'kitchen', label: 'Kitchen tap', open: true,
          service: 'mixed_hot_running',
          flowLpm: Math.round(STORED_SOLO_FLOW_LPM.kitchen * mainsThrottle * 10) / 10,
          deliveredTempC: 46,
          isConstrained: mainsConstrained,
          constraintReason: mainsConstraintReason,
          coldSource: 'mains', hotSource,
        }
      : closedKitchen,
  ]
}

// ─── Public hook ──────────────────────────────────────────────────────────────

/**
 * Display adapter that derives draw-off outlet display state from the
 * authoritative SystemDiagramDisplayState.
 *
 * Mirrors useHousePlayback: consumes SystemDiagramDisplayState and produces
 * DrawOffDisplayState for the panel.  No simulation path is created here.
 *
 * @param diagramState         Live display state from useSystemDiagramPlayback.
 * @param cylinderType         Cylinder technology type.  Defaults to 'unvented'.
 *                             Used to drive Mixergy-specific behaviour in storedHotWaterState.
 * @param cylinderSizeLitres   Nominal cylinder capacity in litres.  Defaults to 150.
 * @param mainsFlowLpm         Cold-mains supply capacity (L/min).  Used as the shared
 *                             flow budget for mains-fed outlets.  Defaults to DEMO_MAINS_FLOW_LPM.
 * @param boilerDhwOutputKw    Combi boiler DHW plate-HEX rated output (kW).  Used to
 *                             compute the maximum sustainable hot-water flow rate from
 *                             the HEX.  Defaults to DEFAULT_COMBI_DHW_OUTPUT_KW.
 * @param coldInletTempC       Cold-water inlet temperature (°C).  Used in the combi
 *                             thermal limit calculation.  Defaults to DEFAULT_COLD_INLET_TEMP_C.
 */
export function useDrawOffPlayback(
  diagramState: SystemDiagramDisplayState,
  cylinderType: CylinderType = 'unvented',
  cylinderSizeLitres: number = 150,
  mainsFlowLpm: number = DEMO_MAINS_FLOW_LPM,
  boilerDhwOutputKw: number = DEFAULT_COMBI_DHW_OUTPUT_KW,
  coldInletTempC: number = DEFAULT_COLD_INLET_TEMP_C,
): DrawOffDisplayState {
  const { systemMode, systemType, serviceSwitchingActive, outletDemands } = diagramState

  const isCylinder = systemType !== 'combi'

  // combiAtCapacity: combi is serving peak concurrent DHW demand.
  // Derived from serviceSwitchingActive (CH paused for DHW) on a combi system.
  const concurrentDemandCount = outletDemands ? ((outletDemands.shower ? 1 : 0) + (outletDemands.bath ? 1 : 0) + (outletDemands.kitchen ? 1 : 0)) : (diagramState.hotDrawActive ? (serviceSwitchingActive ? 2 : 1) : 0)
  const combiAtCapacity = systemType === 'combi' && serviceSwitchingActive && concurrentDemandCount >= 2

  // storedHotWaterState: present for cylinder systems, null for combi.
  const storedHotWaterState = useStoredHotWaterPlayback(diagramState, cylinderType, cylinderSizeLitres)

  return {
    outletStates: buildOutletStates(diagramState, mainsFlowLpm, boilerDhwOutputKw, coldInletTempC),
    systemMode,
    isCylinder,
    serviceSwitchingActive,
    combiAtCapacity,
    storedHotWaterState,
  }
}
