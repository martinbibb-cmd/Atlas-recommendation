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
}

// ─── Outlet state builder ─────────────────────────────────────────────────────

function buildOutletStates(
  diagramState: SystemDiagramDisplayState,
): OutletDisplayState[] {
  const { hotDrawActive, serviceSwitchingActive, supplyOrigins, systemType } = diagramState

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

  if (!hotDrawActive) {
    return [closedShower, closedBath, closedKitchen]
  }

  if (isCombi) {
    // Combi: when serviceSwitchingActive a concurrent draw is in progress.
    // Surface a second open outlet (bath) to illustrate on-demand constraint.
    const concurrent = serviceSwitchingActive
    return [
      {
        outletId: 'shower', label: 'Shower', open: true,
        service: 'mixed_hot_running', flowLpm: 9.0, deliveredTempC: 45,
        isConstrained: false, coldSource, hotSource,
      },
      concurrent
        ? {
            outletId: 'bath', label: 'Bath', open: true,
            service: 'mixed_hot_running', flowLpm: 7.8, deliveredTempC: 42,
            isConstrained: true,
            constraintReason: 'On-demand hot water at capacity — concurrent demand',
            coldSource, hotSource,
          }
        : closedBath,
      closedKitchen,
    ]
  }

  // Stored / vented cylinder: concurrent draws remain strong because the
  // thermal store buffers demand.  Two outlets open simultaneously show the
  // stored advantage over on-demand.
  return [
    {
      outletId: 'shower', label: 'Shower', open: true,
      service: 'mixed_hot_running', flowLpm: 9.5, deliveredTempC: 47,
      isConstrained: false, coldSource, hotSource,
    },
    {
      outletId: 'bath', label: 'Bath', open: true,
      service: 'mixed_hot_running', flowLpm: 8.0, deliveredTempC: 45,
      isConstrained: false, coldSource, hotSource,
    },
    closedKitchen,
  ]
}

// ─── Public hook ──────────────────────────────────────────────────────────────

/**
 * Display adapter that derives draw-off outlet display state from the
 * authoritative SystemDiagramDisplayState.
 *
 * Mirrors useHousePlayback: consumes SystemDiagramDisplayState and produces
 * DrawOffDisplayState for the panel.  No simulation path is created here.
 */
export function useDrawOffPlayback(
  diagramState: SystemDiagramDisplayState,
): DrawOffDisplayState {
  const { systemMode, systemType, serviceSwitchingActive } = diagramState

  const isCylinder = systemType !== 'combi'

  // combiAtCapacity: combi is serving peak concurrent DHW demand.
  // Derived from serviceSwitchingActive (CH paused for DHW) on a combi system.
  const combiAtCapacity = systemType === 'combi' && serviceSwitchingActive

  return {
    outletStates: buildOutletStates(diagramState),
    systemMode,
    isCylinder,
    serviceSwitchingActive,
    combiAtCapacity,
  }
}
