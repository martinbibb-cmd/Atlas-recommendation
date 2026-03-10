// src/explainers/lego/simulator/useSystemDiagramPlayback.ts
//
// Drives the SystemDiagramPanel with a cycling demo sequence that mirrors
// the real service-arbitration rules already established in prior lab refactor
// work (serviceArbitration.ts).
//
// Guarantees:
//   - resolveServiceMode() from serviceArbitration.ts is the single source
//     of truth for which SystemMode is active at any moment.
//   - computeServiceSwitchingActive() from the same module controls the CH-
//     suppression flag (combi only).
//   - supplyOriginsForSystemType() from supplyOrigins.ts provides the
//     authoritative origin mapping for each system type.
//   - No Math.random() is used anywhere in the state machine.

import { useState, useEffect, useCallback } from 'react'
import type { SystemMode, SystemType, HeatSourceType } from '../animation/types'
import type { LabSupplyOrigins } from '../sim/supplyOrigins'
import { supplyOriginsForSystemType } from '../sim/supplyOrigins'
import { resolveServiceMode, computeServiceSwitchingActive } from '../animation/serviceArbitration'
import { deriveCondensingState } from '../sim/condensingState'
import type { CondensingState } from '../sim/condensingState'

// ─── Public state type ────────────────────────────────────────────────────────

/**
 * All display-relevant state the SystemDiagramPanel needs to drive its live
 * animated schematic.
 *
 * Sourced entirely from authoritative lab state:
 *   - systemMode from resolveServiceMode() (serviceArbitration.ts)
 *   - serviceSwitchingActive from computeServiceSwitchingActive() (same)
 *   - supplyOrigins from supplyOriginsForSystemType() (supplyOrigins.ts)
 *   - condensingState from deriveCondensingState() (condensingState.ts)
 */
export type SystemDiagramDisplayState = {
  systemMode: SystemMode
  systemType: SystemType
  heatSourceType: HeatSourceType
  /**
   * True when a combi boiler has diverted output to the plate HEX for a DHW
   * draw that interrupted an active CH call.  Always false for stored systems.
   *
   * Source: computeServiceSwitchingActive() in serviceArbitration.ts.
   */
  serviceSwitchingActive: boolean
  /**
   * Authoritative supply origins for this system type.
   * Presence of onDemandHot vs dhwHotStore drives combi vs stored rendering.
   */
  supplyOrigins: LabSupplyOrigins
  /**
   * Boiler condensing classification derived from return-water temperature.
   * Absent when no boiler is present (heat pump systems).
   */
  condensingState?: CondensingState
  /**
   * True when the user is actively drawing hot water from a stored cylinder.
   * Distinct from systemMode === 'dhw_draw' which is combi-only.
   *
   * For stored systems this drives the cylinder→outlets animated path without
   * conflating draw with reheat in the service mode enum.
   */
  hotDrawActive: boolean
  /**
   * Fractional fill level of the stored cylinder (0–1).
   * Absent for combi systems.
   */
  cylinderFillPct?: number
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const PHASE_DURATION_MS = 4_500

/**
 * Demo phases for a combi system.
 * Inputs that feed resolveServiceMode() at each phase.
 */
type CombiPhase = {
  heatingEnabled: boolean
  hotDrawActive: boolean
  /** Simulated CH return temperature for condensing classification. */
  returnTempC: number
}

const COMBI_PHASES: CombiPhase[] = [
  { heatingEnabled: false, hotDrawActive: false, returnTempC: 45 }, // idle
  { heatingEnabled: true,  hotDrawActive: false, returnTempC: 43 }, // heating — condensing
  { heatingEnabled: true,  hotDrawActive: true,  returnTempC: 52 }, // DHW draw (CH interrupted)
  { heatingEnabled: true,  hotDrawActive: false, returnTempC: 45 }, // heating resumes
  { heatingEnabled: false, hotDrawActive: false, returnTempC: 48 }, // cooling down
]

/**
 * Demo phases for a stored (unvented cylinder, S-plan) system.
 */
type StoredPhase = {
  heatingEnabled: boolean
  storeNeedsReheat: boolean
  hotDrawActive: boolean
  returnTempC: number
  cylinderFillPct: number
}

const STORED_PHASES: StoredPhase[] = [
  { heatingEnabled: false, storeNeedsReheat: false, hotDrawActive: false, returnTempC: 46, cylinderFillPct: 0.70 }, // idle
  { heatingEnabled: true,  storeNeedsReheat: false, hotDrawActive: false, returnTempC: 44, cylinderFillPct: 0.68 }, // CH only
  { heatingEnabled: true,  storeNeedsReheat: false, hotDrawActive: true,  returnTempC: 44, cylinderFillPct: 0.55 }, // draw from cylinder
  { heatingEnabled: true,  storeNeedsReheat: true,  hotDrawActive: false, returnTempC: 44, cylinderFillPct: 0.45 }, // S-plan: CH + reheat
  { heatingEnabled: false, storeNeedsReheat: true,  hotDrawActive: false, returnTempC: 46, cylinderFillPct: 0.62 }, // reheat only
]

function buildCombiState(phase: CombiPhase): SystemDiagramDisplayState {
  const systemType: SystemType = 'combi'
  const heatSourceType: HeatSourceType = 'combi'
  const mode = resolveServiceMode({
    isCombi: true,
    hotDrawActive: phase.hotDrawActive,
    heatingEnabled: phase.heatingEnabled,
    // Combi boilers have no thermal store; hasStored / storeNeedsReheat / isSPlan
    // must be false so the arbitration logic never enters the stored-system branch.
    hasStored: false,
    storeNeedsReheat: false,
    isSPlan: false,
  })
  const serviceSwitchingActive = computeServiceSwitchingActive({
    isCombi: true,
    mode,
    heatingEnabled: phase.heatingEnabled,
  })
  return {
    systemMode: mode,
    systemType,
    heatSourceType,
    serviceSwitchingActive,
    supplyOrigins: supplyOriginsForSystemType(systemType),
    condensingState: deriveCondensingState(phase.returnTempC),
    hotDrawActive: phase.hotDrawActive,
  }
}

function buildStoredState(phase: StoredPhase): SystemDiagramDisplayState {
  const systemType: SystemType = 'unvented_cylinder'
  const heatSourceType: HeatSourceType = 'system_boiler'
  const mode = resolveServiceMode({
    isCombi: false,
    hotDrawActive: phase.hotDrawActive,
    heatingEnabled: phase.heatingEnabled,
    hasStored: true,
    storeNeedsReheat: phase.storeNeedsReheat,
    isSPlan: true,
  })
  return {
    systemMode: mode,
    systemType,
    heatSourceType,
    serviceSwitchingActive: false, // always false for stored
    supplyOrigins: supplyOriginsForSystemType(systemType),
    condensingState: deriveCondensingState(phase.returnTempC),
    hotDrawActive: phase.hotDrawActive,
    cylinderFillPct: phase.cylinderFillPct,
  }
}

// ─── Public hook ──────────────────────────────────────────────────────────────

export type UseSystemDiagramPlaybackResult = {
  state: SystemDiagramDisplayState
  systemType: SystemType
  setSystemType: (t: SystemType) => void
}

export function useSystemDiagramPlayback(): UseSystemDiagramPlaybackResult {
  const [systemType, setSystemTypeState] = useState<SystemType>('combi')
  const [phase, setPhase] = useState(0)

  const setSystemType = useCallback((t: SystemType) => {
    setSystemTypeState(t)
    setPhase(0)
  }, [])

  useEffect(() => {
    const phases = systemType === 'combi' ? COMBI_PHASES.length : STORED_PHASES.length
    const timer = setInterval(() => {
      setPhase(prev => (prev + 1) % phases)
    }, PHASE_DURATION_MS)
    return () => clearInterval(timer)
  }, [systemType])

  const state: SystemDiagramDisplayState =
    systemType === 'combi'
      ? buildCombiState(COMBI_PHASES[phase] ?? COMBI_PHASES[0])
      : buildStoredState(STORED_PHASES[phase] ?? STORED_PHASES[0])

  return { state, systemType, setSystemType }
}
