// src/explainers/lego/simulator/useEfficiencyPlayback.ts
//
// Display adapter: derives EfficiencyDisplayState from SystemDiagramDisplayState.
//
// Same discipline as useDrawOffPlayback and useHousePlayback:
//   - pure function, no simulation state, no Math.random()
//   - consumes existing trusted playback state only
//   - single mapping layer between diagram truth and panel rendering
//
// Architecture:
//   SimulatorDashboard
//     → useEfficiencyPlayback(diagramState)
//     → EfficiencyDisplayState
//     → EfficiencyPanel({ state })

import type { SystemMode } from '../animation/types'
import {
  isBoilerHeatSource,
  condensingStateDescription,
  deriveCondensingState,
  deriveCondensingQuality,
} from '../sim/condensingState'
import type { CondensingState, CondensingQuality } from '../sim/condensingState'
import type { SystemDiagramDisplayState } from './useSystemDiagramPlayback'
import type { EmitterPrimaryDisplayState } from './useEmitterPrimaryModel'
import type { SystemCondition } from './systemInputsTypes'

// ─── Public types ─────────────────────────────────────────────────────────────

export type SystemKind = 'boiler' | 'heat_pump'

/** Panel tone — drives badge / background colour. */
export type StatusTone = 'good' | 'warning' | 'poor' | 'idle'

/**
 * All display-relevant state the EfficiencyPanel needs to render a live
 * efficiency summary.
 *
 * Sourced entirely from SystemDiagramDisplayState; no second simulator.
 */
export type EfficiencyDisplayState = {
  /** Whether the heat source is a boiler or a heat pump. */
  systemKind: SystemKind
  /**
   * Return-water temperature for boiler systems (°C).
   * Absent for heat pump systems.
   */
  returnTempC?: number
  /**
   * Physics-derived required flow temperature (°C).
   * Present when the emitter primary model is active.
   */
  requiredFlowTempC?: number
  /**
   * Condensing classification for boiler systems.
   * Absent for heat pump systems — must never show a fake condensing badge
   * for heat pumps.
   */
  condensingState?: CondensingState
  /**
   * Richer condensing operating quality for boiler systems.
   *
   * Separates design-load behaviour from current-load behaviour so the
   * simulator can show "standard radiators CAN condense at lower loads"
   * rather than just a binary condensing/not-condensing flag.
   *
   * Present when the emitter primary model is active (i.e. both design-load
   * and current-load return temperatures are available).
   * Absent for heat pump systems.
   */
  condensingQuality?: CondensingQuality
  /**
   * Coefficient of Performance for heat pump systems.
   * When the emitter primary model is available, derived from flow temperature
   * using COP ≈ 5 − (flowTemp − 35)/15, clamped to [2.5, 4.5].
   */
  cop?: number
  /** One-line headline describing the current efficiency status. */
  headlineEfficiencyText: string
  /**
   * Short explanatory sentence for the current condensing / efficiency state.
   * Shown below the headline.  Empty string when not applicable.
   */
  statusDescription: string
  /** Up to two short penalty bullets currently relevant to system state. */
  penalties: string[]
  /** Drives panel badge / background colour. */
  statusTone: StatusTone
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function deriveStatusTone(
  systemKind: SystemKind,
  systemMode: SystemMode,
  condensingState?: CondensingState,
): StatusTone {
  if (systemMode === 'idle') return 'idle'
  if (systemKind === 'heat_pump') return 'good'
  if (!condensingState) return 'idle'
  switch (condensingState) {
    case 'condensing':     return 'good'
    case 'borderline':     return 'warning'
    case 'not_condensing': return 'poor'
  }
}

function deriveHeadline(
  systemKind: SystemKind,
  systemMode: SystemMode,
  condensingState?: CondensingState,
): string {
  if (systemMode === 'idle') return 'System idle'
  if (systemKind === 'heat_pump') return 'Heat pump running'
  if (!condensingState) return 'Awaiting data'
  switch (condensingState) {
    case 'condensing':     return 'Condensing active'
    case 'borderline':     return 'Near condensing threshold'
    case 'not_condensing': return 'Not condensing'
  }
}

function deriveStatusDescription(
  systemKind: SystemKind,
  systemMode: SystemMode,
  condensingState?: CondensingState,
): string {
  if (systemMode === 'idle' || systemKind === 'heat_pump' || !condensingState) {
    return ''
  }
  return condensingStateDescription(condensingState)
}

function derivePenalties(
  diagramState: SystemDiagramDisplayState,
  systemCondition?: SystemCondition,
): string[] {
  const penalties: string[] = []

  if (diagramState.serviceSwitchingActive) {
    penalties.push('CH paused during on-demand hot water')
  }

  if (
    isBoilerHeatSource(diagramState.heatSourceType) &&
    diagramState.condensingState === 'not_condensing'
  ) {
    penalties.push('High return temp reducing condensing gain')
  }

  if (systemCondition === 'sludged') {
    penalties.push('Magnetite sludge reducing heat transfer')
  } else if (systemCondition === 'scaled') {
    penalties.push('Scale build-up restricting heat exchanger')
  }

  return penalties
}

// ─── Public hook ──────────────────────────────────────────────────────────────

/**
 * Display adapter: maps SystemDiagramDisplayState → EfficiencyDisplayState.
 *
 * Called as a pure function (no React state) so it can be unit-tested directly
 * in the same way as useDrawOffPlayback and useHousePlayback.
 *
 * @param emitterState     Optional emitter primary model state. When supplied:
 *   - Return temperature is derived from emitter physics rather than phase scripts.
 *   - Heat pump COP is derived from the required flow temperature.
 *   - Condensing state is re-derived from the physics-based return temperature.
 * @param systemCondition  Optional system condition. When 'sludged' or 'scaled',
 *   adds a heat-transfer penalty to the efficiency summary.
 */
export function useEfficiencyPlayback(
  diagramState: SystemDiagramDisplayState,
  emitterState?: EmitterPrimaryDisplayState,
  systemCondition?: SystemCondition,
): EfficiencyDisplayState {
  const systemKind: SystemKind = isBoilerHeatSource(diagramState.heatSourceType)
    ? 'boiler'
    : 'heat_pump'

  const { systemMode } = diagramState

  // When emitter physics model is available, use its derived temperatures.
  // This connects emitter adequacy to condensing/COP behaviour.
  const returnTempC = systemKind === 'boiler'
    ? (emitterState?.estimatedReturnTempC ?? diagramState.returnTempC)
    : undefined
  // Heat pump systems do not have a return-water condensing threshold —
  // they operate below the dew-point limit by design. Exposing returnTempC
  // for heat pumps would be misleading in the efficiency panel, so it is
  // intentionally absent.

  const condensingState = systemKind === 'boiler' && returnTempC !== undefined
    ? deriveCondensingState(returnTempC)
    : diagramState.condensingState

  // Heat pump COP: use emitter-model estimate (flow-temp derived) when available,
  // fall back to phase-scripted COP.
  const cop = systemKind === 'heat_pump'
    ? (emitterState?.estimatedCop ?? diagramState.cop)
    : undefined

  const requiredFlowTempC = emitterState?.requiredFlowTempC

  // Condensing quality: separates design-load from current-load behaviour.
  // Only applicable to boiler systems with a live emitter model.
  const condensingQuality = systemKind === 'boiler' && emitterState != null
    ? deriveCondensingQuality(
        emitterState.estimatedReturnTempC,
        emitterState.currentLoadReturnTempC,
      )
    : undefined

  return {
    systemKind,
    returnTempC,
    requiredFlowTempC,
    condensingState,
    condensingQuality,
    cop,
    headlineEfficiencyText: deriveHeadline(systemKind, systemMode, condensingState),
    statusDescription: deriveStatusDescription(systemKind, systemMode, condensingState),
    penalties: derivePenalties({ ...diagramState, condensingState }, systemCondition),
    statusTone: deriveStatusTone(systemKind, systemMode, condensingState),
  }
}
