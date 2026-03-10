// src/explainers/lego/simulator/useLimiterPlayback.ts
//
// Display adapter: derives LimiterDisplayState from SystemDiagramDisplayState.
//
// Same discipline as useEfficiencyPlayback and useHousePlayback:
//   - pure function, no simulation state, no Math.random()
//   - consumes existing trusted playback state only
//   - single mapping layer between diagram truth and panel rendering
//
// Architecture:
//   SimulatorDashboard
//     → useLimiterPlayback(diagramState)
//     → LimiterDisplayState
//     → LimitersPanel({ state })

import { isBoilerHeatSource } from '../sim/condensingState'
import type { SystemDiagramDisplayState } from './useSystemDiagramPlayback'

// ─── Public types ─────────────────────────────────────────────────────────────

export type LimiterSeverity = 'info' | 'warning' | 'critical'

/**
 * A single active physics constraint detected from the simulator state.
 */
export type Limiter = {
  id: string
  severity: LimiterSeverity
  title: string
  explanation: string
  suggestedFix?: string
  /** Optional schematic component to highlight when this limiter is active. */
  targetComponent?: string
}

/**
 * All display-relevant limiter state the LimitersPanel needs to render.
 *
 * Sourced entirely from SystemDiagramDisplayState; no second simulator.
 */
export type LimiterDisplayState = {
  /** Up to 3 active limiters, ordered by severity (critical first). */
  activeLimiters: Limiter[]
  /** True when at least one critical limiter is active. */
  hasCritical: boolean
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** Return temperature above which condensing is lost (°C). */
const CONDENSING_RETURN_THRESHOLD_C = 55

/** Cylinder fill fraction below which we consider the store depleted. */
const CYLINDER_DEPLETED_THRESHOLD = 0.15

/** Maximum number of limiters surfaced in the panel. */
const MAX_LIMITERS = 3

/** Numeric priority for sorting — lower value appears first. */
const SEVERITY_ORDER: Record<LimiterSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

// ─── Internal limiter detectors ───────────────────────────────────────────────

/**
 * Combi DHW output limit — fires when a combi boiler is serving a hot-water
 * draw, which by definition uses the full boiler output on the plate HEX.
 *
 * Trigger: heatSourceType === 'combi' AND a hot-water draw is in progress.
 *
 * @param combiPowerKw  Rated combi output in kW (default 30). Used to compute
 *   the achievable hot-water flow rate at a 40 °C temperature rise.
 */
function detectCombiDhwLimit(
  state: SystemDiagramDisplayState,
  combiPowerKw: number,
): Limiter | null {
  if (state.heatSourceType !== 'combi') return null
  if (!state.hotDrawActive && state.systemMode !== 'dhw_draw') return null
  // Flow rate (L/min) = P_kW × 860 / (60 × ΔT_C)
  // 860: specific heat conversion factor (kJ/kg·°C → kW·s/L × 1/1000)
  // 60:  converts seconds to minutes
  // 40:  assumed DHW temperature rise in °C (cold inlet 10°C → delivery 50°C)
  const flowLpm = Math.round(combiPowerKw * 860 / (60 * 40))
  return {
    id: 'combi_dhw_limit',
    severity: 'warning',
    title: 'Boiler DHW output limit',
    explanation: `${combiPowerKw} kW combi can supply ~${flowLpm} L/min at 40°C rise.`,
    suggestedFix: 'Cylinder or lower simultaneous demand',
    targetComponent: 'boiler',
  }
}

/**
 * Concurrent demand — fires when 2 or more hot-water outlets are active at
 * the same time.
 *
 * Trigger: active outlet count >= 2.
 *
 * targetComponent is system-specific:
 *   - Combi:  plate HEX — all on-demand flow passes through it.
 *   - Stored: cylinder — concurrent draw depletes the reserve faster.
 */
function detectConcurrentDemand(state: SystemDiagramDisplayState): Limiter | null {
  const outlets = state.outletDemands
  if (!outlets) return null
  const activeCount = [outlets.shower, outlets.bath, outlets.kitchen].filter(Boolean).length
  if (activeCount < 2) return null
  const targetComponent = state.heatSourceType === 'combi' ? 'plate_hex' : 'cylinder'
  return {
    id: 'concurrent_demand',
    severity: 'warning',
    title: 'Concurrent hot water demand',
    explanation: `${activeCount} outlets open simultaneously — flow and temperature must be shared.`,
    suggestedFix: 'Unvented cylinder supports simultaneous draw',
    targetComponent,
  }
}

/**
 * Mains flow restriction — fires when multiple outlets are drawing from a
 * mains-fed cold supply simultaneously.
 *
 * Trigger: mains cold supply present AND 2 or more outlets active.
 */
function detectMainsFlowLimit(state: SystemDiagramDisplayState): Limiter | null {
  if (!state.supplyOrigins.mainsColdIn) return null
  const outlets = state.outletDemands
  if (!outlets) return null
  const activeCount = [outlets.shower, outlets.bath, outlets.kitchen].filter(Boolean).length
  if (activeCount < 2) return null
  return {
    id: 'mains_flow_limit',
    severity: 'info',
    title: 'Cold water supply limit',
    explanation: 'Incoming mains flow is restricting simultaneous draw.',
    suggestedFix: 'Check mains incoming flow rate',
    targetComponent: 'mains',
  }
}

/**
 * Condensing lost — fires when a boiler's return temperature has risen above
 * the condensing threshold, meaning latent heat recovery is unavailable.
 *
 * Trigger: boiler system AND returnTempC > CONDENSING_RETURN_THRESHOLD_C.
 */
function detectCondensingLost(state: SystemDiagramDisplayState): Limiter | null {
  if (!isBoilerHeatSource(state.heatSourceType)) return null
  if (state.returnTempC === undefined) return null
  if (state.returnTempC <= CONDENSING_RETURN_THRESHOLD_C) return null
  return {
    id: 'condensing_lost',
    severity: 'warning',
    title: 'High return temperature',
    explanation: `Return at ${state.returnTempC}°C — latent heat recovery unavailable.`,
    suggestedFix: 'Lower flow temperature or improve radiator sizing',
    targetComponent: 'boiler',
  }
}

/**
 * Cylinder depleted — fires when stored cylinder energy has fallen below the
 * depletion threshold, indicating insufficient reserve for further draws.
 *
 * Trigger: cylinderFillPct <= CYLINDER_DEPLETED_THRESHOLD.
 */
function detectCylinderDepleted(state: SystemDiagramDisplayState): Limiter | null {
  if (state.cylinderFillPct === undefined) return null
  if (state.cylinderFillPct > CYLINDER_DEPLETED_THRESHOLD) return null
  return {
    id: 'cylinder_depleted',
    severity: 'critical',
    title: 'Cylinder stored energy depleted',
    explanation: `Hot water reserve at ${Math.round(state.cylinderFillPct * 100)}% — reheating before further draw.`,
    suggestedFix: 'Reheat cycle required before further draw',
    targetComponent: 'cylinder',
  }
}

// ─── Public hook ──────────────────────────────────────────────────────────────

/**
 * Display adapter: maps SystemDiagramDisplayState → LimiterDisplayState.
 *
 * Detects up to 5 distinct physics constraints from the current state and
 * surfaces at most MAX_LIMITERS, ordered critical → warning → info so the
 * most severe constraints are always visible.
 *
 * Called as a pure function (no React state) so it can be unit-tested directly
 * in the same way as useEfficiencyPlayback.
 *
 * @param combiPowerKw  Rated combi output in kW (default 30). Used for the
 *   DHW-flow calculation in the combi_dhw_limit explanation string.
 */
export function useLimiterPlayback(
  diagramState: SystemDiagramDisplayState,
  combiPowerKw: number = 30,
): LimiterDisplayState {
  const candidates: Array<Limiter | null> = [
    detectCylinderDepleted(diagramState),
    detectCombiDhwLimit(diagramState, combiPowerKw),
    detectConcurrentDemand(diagramState),
    detectCondensingLost(diagramState),
    detectMainsFlowLimit(diagramState),
  ]

  const all = candidates
    .filter((l): l is Limiter => l !== null)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  const activeLimiters = all.slice(0, MAX_LIMITERS)

  return {
    activeLimiters,
    hasCritical: activeLimiters.some(l => l.severity === 'critical'),
  }
}
