// src/explainers/lego/simulator/useBehaviourTimeline.ts
//
// Rolling timeline buffer for the live System Behaviour graph.
//
// Architecture:
//   SimulatorDashboard
//     → useBehaviourTimeline(diagramState, systemInputs)
//     → BehaviourTimelineState  { ticks, eventMarkers }
//     → BehaviourGraph({ timeline })
//
// All values are derived deterministically from live simulator state.
// No Math.random() is used.

import { useState, useEffect, useRef } from 'react'
import type { SystemDiagramDisplayState } from './useSystemDiagramPlayback'
import type { SystemInputs } from './systemInputsTypes'
import {
  computeCurrentEfficiencyPct,
  DEFAULT_NOMINAL_EFFICIENCY_PCT,
} from '../../../engine/utils/efficiency'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum ticks retained in the rolling buffer (≈ 60 s at 750 ms). */
const MAX_TICKS = 80

/** Interval between buffer ticks in milliseconds. */
const TICK_INTERVAL_MS = 750

/**
 * Fallback COP used when a heat pump system has no explicit COP reading.
 * Represents a reasonable mid-range ASHP COP at typical UK winter conditions.
 */
const DEFAULT_HEAT_PUMP_COP = 3.0

// ─── Public types ─────────────────────────────────────────────────────────────

/** One data point in the rolling behaviour buffer. */
export type BehaviourTick = {
  /** Sequential tick index — used as the x-axis key. */
  t: number
  /** Instantaneous heat-source output (kW). 0 when source is off. */
  heatKw: number
  /** Space-heating demand (kW). 0 when CH is not calling. */
  heatDemandKw: number
  /** DHW demand (kW). 0 when no hot draw is active. */
  dhwDemandKw: number
  /**
   * Boiler efficiency percentage (50–99) derived from condensing state.
   * Absent for heat pump systems and when the source is idle.
   */
  efficiencyPct: number | null
}

/** Kind identifier for an event marker — drives colour coding. */
export type BehaviourEventKind =
  | 'tap_opened'
  | 'heating_paused'
  | 'burner_ramped'
  | 'recovery'

/** An event detected from a state transition, annotated on the chart. */
export type BehaviourEventMarker = {
  /** Tick index at which the event was detected. */
  t: number
  /** Human-readable label shown on the chart. */
  label: string
  /** Event kind — drives colour coding. */
  kind: BehaviourEventKind
}

/** Full public state returned by the hook. */
export type BehaviourTimelineState = {
  /** Rolling buffer of data points, oldest first. */
  ticks: BehaviourTick[]
  /** Event markers visible in the current window. */
  eventMarkers: BehaviourEventMarker[]
}

// ─── Derivation helpers ────────────────────────────────────────────────────────

function deriveHeatKw(
  state: SystemDiagramDisplayState,
  inputs: SystemInputs,
): number {
  switch (state.systemMode) {
    case 'idle':
      return 0
    case 'dhw_draw':
      // Combi: full plate-HEX output.  Stored: cylinder draining, boiler not firing.
      return state.heatSourceType === 'combi' ? inputs.combiPowerKw : 0
    case 'heating':
    case 'dhw_reheat':
    case 'heating_and_reheat':
      return state.heatSourceType === 'heat_pump'
        ? parseFloat(((state.cop ?? DEFAULT_HEAT_PUMP_COP) * inputs.heatLossKw).toFixed(1))
        : inputs.boilerOutputKw
    default:
      return 0
  }
}

function deriveHeatDemandKw(
  state: SystemDiagramDisplayState,
  inputs: SystemInputs,
): number {
  // CH is demanding heat when actively heating and not service-switched.
  const chActive =
    (state.systemMode === 'heating' || state.systemMode === 'heating_and_reheat') &&
    !state.serviceSwitchingActive
  return chActive ? inputs.heatLossKw : 0
}

function deriveDhwDemandKw(
  state: SystemDiagramDisplayState,
  inputs: SystemInputs,
): number {
  if (!state.hotDrawActive && state.systemMode !== 'dhw_draw') return 0
  // Combi: full plate-HEX rate.  Stored: typical shower draw ≈ 60 % of nominal.
  return state.heatSourceType === 'combi'
    ? inputs.combiPowerKw
    : parseFloat((inputs.combiPowerKw * 0.6).toFixed(1))
}

function deriveEfficiencyPct(state: SystemDiagramDisplayState): number | null {
  // Heat pumps use COP, not SEDBUK efficiency.
  if (state.heatSourceType === 'heat_pump') return null
  // Null when the system is idle (not actively heating).
  if (state.systemMode === 'idle') {
    return null
  }
  if (!state.condensingState) return null
  switch (state.condensingState) {
    case 'condensing':
      return computeCurrentEfficiencyPct(DEFAULT_NOMINAL_EFFICIENCY_PCT, 0)
    case 'borderline':
      return computeCurrentEfficiencyPct(DEFAULT_NOMINAL_EFFICIENCY_PCT, 5)
    case 'not_condensing':
      return computeCurrentEfficiencyPct(DEFAULT_NOMINAL_EFFICIENCY_PCT, 10)
    default:
      return null
  }
}

// ─── Event detection ──────────────────────────────────────────────────────────

function detectEvents(
  prev: SystemDiagramDisplayState | null,
  curr: SystemDiagramDisplayState,
  t: number,
): BehaviourEventMarker[] {
  if (!prev) return []

  const prevMode = prev.systemMode
  const currMode = curr.systemMode

  // No change — no event to emit.
  if (
    prevMode === currMode &&
    prev.hotDrawActive === curr.hotDrawActive &&
    prev.serviceSwitchingActive === curr.serviceSwitchingActive
  ) {
    return []
  }

  const events: BehaviourEventMarker[] = []

  // Heating paused: combi service switching activated.
  if (!prev.serviceSwitchingActive && curr.serviceSwitchingActive) {
    events.push({ t, label: 'Heating paused', kind: 'heating_paused' })
  }

  // Tap opened: a hot draw started.
  if (!prev.hotDrawActive && curr.hotDrawActive) {
    events.push({ t, label: 'Tap opened', kind: 'tap_opened' })
  } else if (prevMode !== 'dhw_draw' && currMode === 'dhw_draw') {
    events.push({ t, label: 'Tap opened', kind: 'tap_opened' })
  }

  // Burner ramped: moved from idle to an active heating mode.
  if (
    prevMode === 'idle' &&
    (currMode === 'heating' ||
      currMode === 'dhw_reheat' ||
      currMode === 'heating_and_reheat' ||
      currMode === 'dhw_draw')
  ) {
    events.push({ t, label: 'Burner on', kind: 'burner_ramped' })
  }

  // Recovery: service switching ended (combi resumes CH after DHW).
  if (prev.serviceSwitchingActive && !curr.serviceSwitchingActive && !curr.hotDrawActive) {
    events.push({ t, label: 'Recovery', kind: 'recovery' })
  }

  // Demand satisfied: stored draw ended without reheat starting.
  if (prev.hotDrawActive && !curr.hotDrawActive && currMode !== 'dhw_reheat') {
    events.push({ t, label: 'Demand satisfied', kind: 'recovery' })
  }

  return events
}

// ─── Public hook ──────────────────────────────────────────────────────────────

/**
 * Maintains a rolling 60-second buffer of simulator behaviour data.
 *
 * Runs a fixed 750 ms interval that reads the latest diagramState and
 * systemInputs from refs — so the interval never needs to be torn down
 * when props change.  Event markers are detected from state transitions.
 *
 * @param diagramState   Live simulator state from useSystemDiagramPlayback.
 * @param systemInputs   Current system inputs (heat loss, output ratings, etc.).
 */
export function useBehaviourTimeline(
  diagramState: SystemDiagramDisplayState,
  systemInputs: SystemInputs,
): BehaviourTimelineState {
  const tickRef = useRef(0)
  const prevStateRef = useRef<SystemDiagramDisplayState | null>(null)
  const eventsRef = useRef<BehaviourEventMarker[]>([])
  const diagramStateRef = useRef(diagramState)
  const systemInputsRef = useRef(systemInputs)
  const [state, setState] = useState<BehaviourTimelineState>({ ticks: [], eventMarkers: [] })

  // Keep refs in sync with latest props without re-mounting the interval.
  diagramStateRef.current = diagramState
  systemInputsRef.current = systemInputs

  useEffect(() => {
    const interval = setInterval(() => {
      const currState = diagramStateRef.current
      const currInputs = systemInputsRef.current
      const t = tickRef.current++

      const newEvents = detectEvents(prevStateRef.current, currState, t)
      if (newEvents.length > 0) {
        eventsRef.current = [...eventsRef.current, ...newEvents].slice(-20)
      }
      // Snapshot the state for next tick's transition detection.
      prevStateRef.current = { ...currState }

      const tick: BehaviourTick = {
        t,
        heatKw: deriveHeatKw(currState, currInputs),
        heatDemandKw: deriveHeatDemandKw(currState, currInputs),
        dhwDemandKw: deriveDhwDemandKw(currState, currInputs),
        efficiencyPct: deriveEfficiencyPct(currState),
      }

      setState(prev => {
        const newTicks = [...prev.ticks, tick].slice(-MAX_TICKS)
        const minT = newTicks.length > 0 ? newTicks[0].t : 0
        const eventMarkers = eventsRef.current.filter(e => e.t >= minT)
        return { ticks: newTicks, eventMarkers }
      })
    }, TICK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, []) // Empty deps — interval reads from refs; no restart needed.

  return state
}
