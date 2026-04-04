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
import type { SystemDiagramDisplayState, SimulatorSystemChoice } from './useSystemDiagramPlayback'
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

// ─── Shape state ──────────────────────────────────────────────────────────────

/**
 * Per-tick mutable shape state maintained as a ref — drives the
 * temporal smoothing / ramp-up / tail-off applied to the raw binary
 * values before they are written to the tick buffer.
 *
 * All values start at 0; they are updated inside the tick interval.
 */
type ShapeState = {
  /** Exponentially smoothed heat-source output value (kW). */
  smoothedHeatKw: number
  /**
   * Post-run residual (kW) — decays to 0 a few ticks after the heat
   * source switches to idle.  Represents purge / post-circulation tail.
   */
  postRunKw: number
  /**
   * Ticks of combi post-DHW purge remaining.  During these ticks a small
   * elevated output is maintained before CH ramps back up.
   */
  purgeTicksLeft: number
  /** Mode captured at the previous tick — used to detect transitions. */
  prevMode: SystemDiagramDisplayState['systemMode'] | null
}

function makeShapeState(): ShapeState {
  return { smoothedHeatKw: 0, postRunKw: 0, purgeTicksLeft: 0, prevMode: null }
}

// ─── Behaviour-family classification ──────────────────────────────────────────

/**
 * Coarse behavioural classification used for temporal shaping and ramp logic.
 *
 * This is a separate concept from the appliance-family union (`HeatSourceType`).
 * It translates the raw simulator domain types into a shaping-relevant axis:
 *   - combi             → fast DHW spike, service-switching purge
 *   - stored            → medium ramp, buffered draw
 *   - mixergy           → same ramp rate as stored (α = 0.28); reduced cycling vs combi
 *   - heat_pump         → slow ramp, long post-run tail
 *   - boiler_heating_only → medium ramp, no DHW cylinder
 */
type BehaviourFamily =
  | 'combi'
  | 'stored'
  | 'mixergy'
  | 'heat_pump'
  | 'boiler_heating_only'

/**
 * Derives the behaviour family from the current simulator display state.
 * This is the translation seam between simulator domain types and shaping logic —
 * shaping code must use this value, not raw `heatSourceType` comparisons.
 */
function deriveBehaviourFamily(state: SystemDiagramDisplayState): BehaviourFamily {
  if (state.heatSourceType === 'heat_pump') return 'heat_pump'
  if (state.heatSourceType === 'combi') return 'combi'
  if (state.cylinderVariant === 'mixergy') return 'mixergy'
  if (state.cylinderVariant === 'standard') return 'stored'
  // regular_boiler or system_boiler with no cylinder variant — heating only.
  return 'boiler_heating_only'
}

// ─── Approach-rate helpers ─────────────────────────────────────────────────────

/**
 * Returns α — the fraction of the gap between current and target that is
 * closed each tick (0 < α ≤ 1; larger = faster response).
 *
 * - Heat pumps: slow ramp (~8 s to 90 %)
 * - Combi DHW draw: fast hard spike (~1.5 s to 90 %)
 * - Stored / system boiler: medium ramp (~3 s to 90 %)
 * - Standard combi CH: medium ramp
 */
function approachRate(state: SystemDiagramDisplayState): number {
  const family = deriveBehaviourFamily(state)
  if (family === 'heat_pump') return 0.10
  if (family === 'combi' && state.systemMode === 'dhw_draw') return 0.65
  if (family === 'stored' || family === 'mixergy') return 0.28
  return 0.38
}

/**
 * Decay multiplier applied to the post-run residual each tick.
 * HP runs a longer, gentler post-circulation tail; boilers tail off faster.
 */
function postRunDecay(heatSourceType: SystemDiagramDisplayState['heatSourceType']): number {
  return heatSourceType === 'heat_pump' ? 0.72 : 0.50
}

// ─── Derivation helpers ────────────────────────────────────────────────────────

/**
 * Derive the raw (un-smoothed) heat-source output in kW for the current tick.
 *
 * For a heat pump the thermal output equals the space-heating demand (design
 * heat loss) — COP governs electrical consumption, not heat delivered.
 *
 * Exported for unit testing only; callers must use useBehaviourTimeline.
 */
export function deriveRawHeatKw(
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
      // Heat pump thermal output equals the space-heating demand (design heat
      // loss).  COP determines electrical consumption, not heat delivered.
      // Formerly: COP × heatLossKw — which would inflate a 14 kW heat loss to
      // ~42–51 kW and falsely imply the HP is oversized for the home.
      return state.heatSourceType === 'heat_pump'
        ? inputs.heatLossKw
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

// ─── Shaped heat-output helper ─────────────────────────────────────────────────

/**
 * Applies deterministic temporal shaping to the raw binary heat-source output.
 *
 * The function updates `shape` in place and returns the shaped output kW.
 *
 * Behaviour per system type:
 *   - Heat pump   — slow exponential ramp (α = 0.10), long post-run tail
 *   - Combi DHW   — fast hard spike (α = 0.65), 2-tick post-draw purge
 *   - Stored/system boiler — medium ramp (α = 0.28), brief tail
 *   - Combi CH    — medium ramp (α = 0.38), brief tail
 */
function applyShaping(
  rawTarget: number,
  shape: ShapeState,
  state: SystemDiagramDisplayState,
): number {
  const prevMode = shape.prevMode
  const currMode = state.systemMode

  // ── Transition detection ──────────────────────────────────────────────────

  // Active → idle: seed the post-run residual from the current smoothed level.
  const justStopped =
    prevMode !== null &&
    prevMode !== 'idle' &&
    currMode === 'idle'

  // Combi DHW draw just ended (service switching resumes CH): start purge phase.
  const combiPurgeStart =
    state.heatSourceType === 'combi' &&
    prevMode === 'dhw_draw' &&
    currMode !== 'dhw_draw'

  // ── Update shape state ────────────────────────────────────────────────────

  const α = approachRate(state)
  shape.smoothedHeatKw = shape.smoothedHeatKw + α * (rawTarget - shape.smoothedHeatKw)

  if (justStopped) {
    // Post-run: inject a residual proportional to the last output level.
    shape.postRunKw = Math.max(shape.postRunKw, shape.smoothedHeatKw * 0.30)
    shape.purgeTicksLeft = 0
  } else if (combiPurgeStart) {
    // Combi: brief purge after DHW draw — burner stays slightly elevated
    // for one or two ticks before CH ramp restarts.
    shape.purgeTicksLeft = 2
    shape.postRunKw = 0
  } else if (shape.purgeTicksLeft > 0) {
    shape.purgeTicksLeft -= 1
    // During purge hold a small residual above normal to simulate the
    // post-DHW momentary overshoot before CH recovery.
    shape.postRunKw = shape.smoothedHeatKw * 0.15
  } else {
    // Normal decay of post-run tail.
    shape.postRunKw = shape.postRunKw * postRunDecay(state.heatSourceType)
    if (shape.postRunKw < 0.05) shape.postRunKw = 0
  }

  shape.prevMode = currMode

  return Math.max(0, shape.smoothedHeatKw + shape.postRunKw)
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
 * When `systemChoice` changes the entire buffer is cleared immediately so
 * that stale data from the previous system type is never shown alongside
 * data from the new one.
 *
 * The raw binary values from the simulator state are passed through
 * `applyShaping` before being written to the buffer, giving the graph
 * ramp-up, modulation-settle, and tail-off characteristics appropriate
 * to each system type:
 *   - combi  → bursty / spiky DHW draw, fast CH recovery
 *   - stored → buffered / steadier, gentle reheat signature
 *   - HP     → slow smooth ramp, long post-run tail
 *
 * @param diagramState   Live simulator state from useSystemDiagramPlayback.
 * @param systemInputs   Current system inputs (heat loss, output ratings, etc.).
 * @param systemChoice   Current system choice — triggers a full buffer reset on change.
 */
export function useBehaviourTimeline(
  diagramState: SystemDiagramDisplayState,
  systemInputs: SystemInputs,
  systemChoice: SimulatorSystemChoice,
): BehaviourTimelineState {
  const tickRef = useRef(0)
  const prevStateRef = useRef<SystemDiagramDisplayState | null>(null)
  const eventsRef = useRef<BehaviourEventMarker[]>([])
  const diagramStateRef = useRef(diagramState)
  const systemInputsRef = useRef(systemInputs)
  const shapeRef = useRef<ShapeState>(makeShapeState())
  const [state, setState] = useState<BehaviourTimelineState>({ ticks: [], eventMarkers: [] })

  // Keep refs in sync with latest props without re-mounting the interval.
  diagramStateRef.current = diagramState
  systemInputsRef.current = systemInputs

  // Reset the entire buffer when the system type changes so that stale
  // data from the previous system is never rendered alongside new data.
  useEffect(() => {
    setState({ ticks: [], eventMarkers: [] })
    eventsRef.current = []
    prevStateRef.current = null
    shapeRef.current = makeShapeState()
  }, [systemChoice])

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

      // Derive raw (binary) values, then apply temporal shaping.
      const rawHeatKw = deriveRawHeatKw(currState, currInputs)
      const shapedHeatKw = applyShaping(rawHeatKw, shapeRef.current, currState)

      const tick: BehaviourTick = {
        t,
        heatKw: shapedHeatKw,
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
