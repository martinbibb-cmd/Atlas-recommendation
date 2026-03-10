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
} from '../sim/condensingState'
import type { CondensingState } from '../sim/condensingState'
import type { SystemDiagramDisplayState } from './useSystemDiagramPlayback'

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
   * Condensing classification for boiler systems.
   * Absent for heat pump systems — must never show a fake condensing badge
   * for heat pumps.
   */
  condensingState?: CondensingState
  /**
   * Coefficient of Performance for heat pump systems.
   * Not available in the current demo phase; reserved for future wiring.
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

function derivePenalties(diagramState: SystemDiagramDisplayState): string[] {
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

  return penalties
}

// ─── Public hook ──────────────────────────────────────────────────────────────

/**
 * Display adapter: maps SystemDiagramDisplayState → EfficiencyDisplayState.
 *
 * Called as a pure function (no React state) so it can be unit-tested directly
 * in the same way as useDrawOffPlayback and useHousePlayback.
 */
export function useEfficiencyPlayback(
  diagramState: SystemDiagramDisplayState,
): EfficiencyDisplayState {
  const systemKind: SystemKind = isBoilerHeatSource(diagramState.heatSourceType)
    ? 'boiler'
    : 'heat_pump'

  const { condensingState, returnTempC, systemMode } = diagramState

  return {
    systemKind,
    returnTempC,
    condensingState,
    headlineEfficiencyText: deriveHeadline(systemKind, systemMode, condensingState),
    statusDescription: deriveStatusDescription(systemKind, systemMode, condensingState),
    penalties: derivePenalties(diagramState),
    statusTone: deriveStatusTone(systemKind, systemMode, condensingState),
  }
}
