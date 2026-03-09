// src/explainers/lego/animation/serviceArbitration.ts
//
// Central service arbitration for the lab simulation layer.
//
// This module is the single source of truth for:
//   1. Resolving the active SystemMode from simulation inputs.
//   2. Computing the serviceSwitchingActive flag for combi systems.
//
// Rules encoded here:
//   Combi boiler
//     - DHW draw has absolute priority: if any hot-service outlet is drawing,
//       the boiler output is diverted entirely to the plate HEX and CH is
//       suspended (mode = 'dhw_draw').
//     - CH runs only when no DHW demand is active (mode = 'heating').
//     - serviceSwitchingActive is true ONLY when all of:
//         (a) system is combi,
//         (b) mode === 'dhw_draw', AND
//         (c) the user had space-heating enabled when the draw started.
//       This makes the CH-interruption explicit to the render layer without
//       requiring the renderer to re-derive it from systemMode.
//
//   Stored systems (cylinder — unvented or vented — and heat pump):
//     - CH and cylinder reheat are independent circuits; they can run in
//       parallel (S-plan) without either domain suppressing the other.
//     - serviceSwitchingActive is always false: stored DHW draw draws from
//       the thermal store rather than diverting the boiler, so there is no
//       combi-style CH interruption.
//     - S-plan topology allows CH + reheat simultaneously (mode = 'heating_and_reheat').
//     - Y-plan / no-topology treats demands as exclusive; priority:
//         1. heating_and_reheat (S-plan only)
//         2. heating
//         3. dhw_reheat
//         4. idle
//
// This module is intentionally free of particle / token / storage integration
// logic so that it can be unit-tested directly without constructing a full
// LabFrame or LabControls.  simulation.ts calls these helpers and owns the
// integration with the rest of the simulation state.

import type { SystemMode } from './types'

// ─── resolveServiceMode ───────────────────────────────────────────────────────

/**
 * Inputs required to resolve the current service mode.
 *
 * All booleans are pre-derived by the caller (simulation.ts) so the arbitration
 * function stays pure and easily testable.
 */
export type ServiceArbitrationInputs = {
  /**
   * True when the primary heat source is a combi boiler (on-demand DHW from an
   * integrated plate HEX; no separate storage cylinder).
   *
   * Must be derived from `heatSourceType === 'combi'` — NOT from `systemType` alone
   * so that system-boiler + cylinder configurations are never treated as combi.
   */
  isCombi: boolean
  /**
   * True when at least one hot-service outlet is actively drawing (hexFlowLpm > 0.01).
   *
   * Cold-only outlets (cold taps) must NOT contribute to this flag; their demand
   * bypasses the heat exchanger and must not trigger a combi service switch.
   */
  hotDrawActive: boolean
  /**
   * True when the space-heating demand is currently active (thermostat calling
   * for heat or user has enabled CH in the Play UI).
   */
  heatingEnabled: boolean
  /**
   * True when the system has a thermal store (cylinder or buffer).
   * False for pure combi systems.
   */
  hasStored: boolean
  /**
   * True when the cylinder store temperature has dropped below the reheat
   * threshold and recovery is required.
   * Only meaningful when hasStored is true.
   */
  storeNeedsReheat: boolean
  /**
   * True when the control topology allows simultaneous CH and cylinder reheat
   * (S-plan or S-plan multi-zone with two independent zone valves).
   */
  isSPlan: boolean
}

/**
 * Resolve the active service mode from the current simulation state.
 *
 * Returns the single authoritative `SystemMode` for this tick.  This is called
 * once per simulation step by `stepSimulation()` and placed on `LabFrame.systemMode`.
 *
 * Arbitration rules:
 *   Combi:
 *     hotDrawActive  → 'dhw_draw'   (DHW absolute priority; CH suspended)
 *     heatingEnabled → 'heating'
 *     else           → 'idle'
 *
 *   Stored (cylinder / heat pump):
 *     heatingEnabled && hasStored && storeNeedsReheat && isSPlan → 'heating_and_reheat'
 *     heatingEnabled                                              → 'heating'
 *     hasStored && storeNeedsReheat                              → 'dhw_reheat'
 *     else                                                        → 'idle'
 */
export function resolveServiceMode(inputs: ServiceArbitrationInputs): SystemMode {
  const { isCombi, hotDrawActive, heatingEnabled, hasStored, storeNeedsReheat, isSPlan } = inputs

  if (isCombi) {
    // Combi: DHW draw has absolute priority — CH is interrupted while a hot tap is open.
    if (hotDrawActive) return 'dhw_draw'
    if (heatingEnabled) return 'heating'
    return 'idle'
  }

  // Stored / heat-pump: CH and DHW are independent circuits.
  if (heatingEnabled && hasStored && storeNeedsReheat && isSPlan) {
    // S-plan: both zone valves may open simultaneously.
    return 'heating_and_reheat'
  }
  if (heatingEnabled) return 'heating'
  if (hasStored && storeNeedsReheat) return 'dhw_reheat'
  return 'idle'
}

// ─── computeServiceSwitchingActive ───────────────────────────────────────────

/**
 * Derive the combi service-switching flag from the resolved mode.
 *
 * Returns true ONLY when:
 *   (a) the system is a combi boiler,
 *   (b) the resolved mode is 'dhw_draw' (a hot-service draw is diverting the burner), AND
 *   (c) space-heating was enabled when the draw started.
 *
 * Condition (c) ensures the flag is true only when there is a genuine
 * interruption — DHW demand actively suppressing an in-progress CH call.
 * When the user has not requested CH, there is nothing to interrupt and
 * the renderer should not show "CH paused for DHW".
 *
 * For non-combi systems this always returns false: stored cylinders have
 * independent coil and primary circuits, so a DHW draw never interrupts CH.
 *
 * This value is placed on `LabFrame.serviceSwitchingActive` and propagated
 * to `PlaySceneModel.metadata.serviceSwitchingActive` by buildPlaySceneModel.
 * The renderer reads it from scene.metadata — it must NOT re-derive it.
 */
export function computeServiceSwitchingActive(params: {
  isCombi: boolean
  mode: SystemMode
  heatingEnabled: boolean
}): boolean {
  return params.isCombi && params.mode === 'dhw_draw' && params.heatingEnabled
}
