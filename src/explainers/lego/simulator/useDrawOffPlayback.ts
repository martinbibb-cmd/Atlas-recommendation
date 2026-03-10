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

// ─── Outlet state builder ─────────────────────────────────────────────────────

function buildOutletStates(
  diagramState: SystemDiagramDisplayState,
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
    const concurrent = (showerOpen ? 1 : 0) + (bathOpen ? 1 : 0) + (kitchenOpen ? 1 : 0) >= 2
    return [
      showerOpen ? {
        outletId: 'shower', label: 'Shower', open: true,
        service: 'mixed_hot_running', flowLpm: concurrent ? 7.8 : 9.0, deliveredTempC: concurrent ? 43 : 45,
        isConstrained: concurrent,
        constraintReason: concurrent ? 'On-demand hot water at capacity — concurrent demand' : undefined,
        coldSource, hotSource,
      } : closedShower,
      bathOpen
        ? {
            outletId: 'bath', label: 'Bath', open: true,
            service: 'mixed_hot_running', flowLpm: concurrent ? 7.2 : 8.2, deliveredTempC: concurrent ? 41 : 44,
            isConstrained: concurrent,
            constraintReason: concurrent ? 'On-demand hot water at capacity — concurrent demand' : undefined,
            coldSource, hotSource,
          }
        : closedBath,
      kitchenOpen
        ? {
            outletId: 'kitchen', label: 'Kitchen tap', open: true,
            service: 'mixed_hot_running', flowLpm: concurrent ? 4.6 : 6.0, deliveredTempC: concurrent ? 40 : 44,
            isConstrained: concurrent,
            constraintReason: concurrent ? 'On-demand hot water at capacity — concurrent demand' : undefined,
            coldSource: 'mains', hotSource,
          }
        : closedKitchen,
    ]
  }

  // Stored / vented cylinder: concurrent draws remain strong because the
  // thermal store buffers demand.  Two outlets open simultaneously show the
  // stored advantage over on-demand.
  return [
    showerOpen ? {
      outletId: 'shower', label: 'Shower', open: true,
      service: 'mixed_hot_running', flowLpm: 9.5, deliveredTempC: 47,
      isConstrained: false, coldSource, hotSource,
    } : closedShower,
    bathOpen ? {
      outletId: 'bath', label: 'Bath', open: true,
      service: 'mixed_hot_running', flowLpm: 8.0, deliveredTempC: 45,
      isConstrained: false, coldSource, hotSource,
    } : closedBath,
    kitchenOpen
      ? {
          outletId: 'kitchen', label: 'Kitchen tap', open: true,
          service: 'mixed_hot_running', flowLpm: 5.5, deliveredTempC: 46,
          isConstrained: false, coldSource: 'mains', hotSource,
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
 */
export function useDrawOffPlayback(
  diagramState: SystemDiagramDisplayState,
  cylinderType: CylinderType = 'unvented',
  cylinderSizeLitres: number = 150,
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
    outletStates: buildOutletStates(diagramState),
    systemMode,
    isCylinder,
    serviceSwitchingActive,
    combiAtCapacity,
    storedHotWaterState,
  }
}
