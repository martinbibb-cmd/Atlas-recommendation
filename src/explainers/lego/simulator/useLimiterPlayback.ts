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
import type { EmitterPrimaryDisplayState } from './useEmitterPrimaryModel'
import type { CylinderType, SystemCondition } from './systemInputsTypes'
import { MIXERGY_USABLE_RESERVE_FACTOR } from './systemInputsTypes'

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
  /**
   * Optional schematic component(s) to highlight when this limiter is active.
   * A string array allows highlighting both a node and a related pipe together
   * (e.g. `['boiler', 'pipe-return']` for the condensing-lost limiter).
   */
  targetComponent?: string | string[]
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

/**
 * DHW delivery target temperature in °C used for the combi flow-rate
 * calculation.  Together with the cold inlet temperature this defines the
 * temperature rise the boiler must provide:
 *
 *   ΔT = DHW_DELIVERY_TARGET_C − coldInletTempC
 */
const DHW_DELIVERY_TARGET_C = 45

// ─── Internal limiter detectors ───────────────────────────────────────────────

/**
 * Combi DHW output limit — fires when a combi boiler is serving a hot-water
 * draw, which by definition uses the full boiler output on the plate HEX.
 *
 * Trigger: heatSourceType === 'combi' AND a hot-water draw is in progress.
 *
 * @param combiPowerKw   Rated combi output in kW (default 30). Used to compute
 *   the achievable hot-water flow rate.
 * @param coldInletTempC Incoming cold water temperature in °C (default 10).
 *   The temperature rise ΔT = DHW_DELIVERY_TARGET_C − coldInletTempC, so a
 *   colder inlet means a larger rise and a lower achievable flow rate; a
 *   warmer inlet (summer) produces a smaller rise and higher flow rate.
 */
function detectCombiDhwLimit(
  state: SystemDiagramDisplayState,
  combiPowerKw: number,
  coldInletTempC: number,
): Limiter | null {
  if (state.heatSourceType !== 'combi') return null
  if (!state.hotDrawActive && state.systemMode !== 'dhw_draw') return null
  // Flow rate (L/min) = P_kW × 860 / (60 × ΔT_C)
  // 860: specific heat conversion factor (kJ/kg·°C → kW·s/L × 1/1000)
  // 60:  converts seconds to minutes
  const deltaT = DHW_DELIVERY_TARGET_C - coldInletTempC
  const flowLpm = Math.round(combiPowerKw * 860 / (60 * deltaT))
  return {
    id: 'combi_dhw_limit',
    severity: 'warning',
    title: 'Boiler DHW output limit',
    explanation: `${combiPowerKw} kW combi can supply ~${flowLpm} L/min at ${deltaT}°C rise.`,
    suggestedFix: 'Cylinder or lower simultaneous demand',
    targetComponent: ['boiler', 'pipe-dhw-hot'],
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
    targetComponent: ['mains', 'pipe-cold-feed'],
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
    targetComponent: ['boiler', 'pipe-return'],
  }
}

/**
 * Cylinder depleted — fires when stored cylinder energy has fallen below the
 * depletion threshold, indicating insufficient reserve for further draws.
 *
 * For Mixergy cylinders the effective usable fill is scaled by
 * MIXERGY_USABLE_RESERVE_FACTOR (1.2): stratification keeps the top section
 * at delivery temperature longer, so the limiter fires at a lower raw fill
 * fraction — reflecting the reduced reheat cycling in real-world operation.
 *
 * Trigger: (cylinderFillPct × usableReserveFactor) <= CYLINDER_DEPLETED_THRESHOLD.
 */
function detectCylinderDepleted(
  state: SystemDiagramDisplayState,
  cylinderType: CylinderType | undefined,
): Limiter | null {
  if (state.cylinderFillPct === undefined) return null
  const usableReserveFactor = cylinderType === 'mixergy' ? MIXERGY_USABLE_RESERVE_FACTOR : 1.0
  const effectiveFill = state.cylinderFillPct * usableReserveFactor
  if (effectiveFill > CYLINDER_DEPLETED_THRESHOLD) return null
  return {
    id: 'cylinder_depleted',
    severity: 'critical',
    title: 'Cylinder stored energy depleted',
    explanation: `Hot water reserve at ${Math.round(state.cylinderFillPct * 100)}% — reheating before further draw.`,
    suggestedFix: 'Reheat cycle required before further draw',
    targetComponent: ['cylinder', 'pipe-stored-hot'],
  }
}

/**
 * Mixergy stratification advantage — informational limiter that surfaces the
 * demand-mirroring benefit of a Mixergy cylinder during an active DHW draw.
 *
 * Trigger: cylinderType === 'mixergy' AND a hot-water draw is in progress.
 * Severity: info.
 *
 * This makes the stratification benefit visible at the moment it matters most
 * and explains why the cylinder_depleted threshold is effectively lower for
 * Mixergy compared with a standard cylinder of the same nominal volume.
 */
function detectMixergyStratification(
  state: SystemDiagramDisplayState,
  cylinderType: CylinderType | undefined,
): Limiter | null {
  if (cylinderType !== 'mixergy') return null
  if (!state.hotDrawActive) return null
  return {
    id: 'mixergy_stratification',
    severity: 'info',
    title: 'Mixergy stratification active',
    explanation: 'Intelligent stratification keeps the top section hot — demand is mirrored directly, reducing reheat cycling compared with a standard cylinder.',
    targetComponent: 'cylinder',
  }
}

/**
 * Emitter undersized — fires when the required flow temperature exceeds 65°C,
 * indicating that emitters are too small to allow low-temperature operation.
 *
 * Trigger: requiredFlowTempC > 65.
 *
 * Target highlight: emitters (radiator nodes in the schematic).
 */
function detectEmitterUndersized(
  emitterState: EmitterPrimaryDisplayState | undefined,
): Limiter | null {
  if (!emitterState) return null
  if (emitterState.requiredFlowTempC <= 65) return null
  return {
    id: 'emitter_undersized',
    severity: 'warning',
    title: 'Emitters too small for low-temperature operation',
    explanation: `Required flow temperature ${emitterState.requiredFlowTempC.toFixed(0)}°C — larger emitters or UFH would allow a lower flow temperature.`,
    suggestedFix: 'Increase emitter size or switch to underfloor heating',
    targetComponent: 'emitters',
  }
}

/**
 * Primary circuit limit — fires when the building's heat demand exceeds the
 * maximum transportable heat for the selected primary pipe size.
 *
 * Trigger: heatDemandKw > primaryCapacityKw.
 *
 * Target highlight: pipe-flow (primary supply pipe in the schematic).
 */
function detectPrimaryCircuitLimit(
  emitterState: EmitterPrimaryDisplayState | undefined,
): Limiter | null {
  if (!emitterState) return null
  if (emitterState.primaryAdequate) return null
  return {
    id: 'primary_circuit_limit',
    severity: 'warning',
    title: 'Primary pipework restricting heat transport',
    explanation: `${emitterState.primaryCapacityKw} kW pipe capacity — system requires ${emitterState.heatDemandKw} kW. Upgrade to larger bore pipe.`,
    suggestedFix: 'Upsize primary pipework to 22 mm or 28 mm',
    targetComponent: 'pipe-flow',
  }
}

/**
 * Low temperature capable — informational limiter that fires when the
 * required flow temperature is below 50°C, confirming that the emitter
 * system supports low-temperature and heat pump operation.
 *
 * Trigger: requiredFlowTempC < 50.
 * Severity: info.
 */
function detectLowTempCapable(
  emitterState: EmitterPrimaryDisplayState | undefined,
): Limiter | null {
  if (!emitterState) return null
  if (emitterState.requiredFlowTempC >= 50) return null
  return {
    id: 'low_temp_capable',
    severity: 'info',
    title: 'Emitters support low-temperature operation',
    explanation: `Required flow temperature ${emitterState.requiredFlowTempC.toFixed(0)}°C — compatible with heat pump or condensing boiler at maximum efficiency.`,
    targetComponent: 'emitters',
  }
}

/**
 * System condition — fires when the system is sludged or scaled, indicating
 * that heat transfer is being restricted by contamination.
 *
 * Sludge (magnetite) coats radiator surfaces and restricts flow.
 * Scale coats the heat exchanger and reduces thermal conductivity.
 *
 * Trigger: systemCondition !== 'clean'.
 * Severity: warning.
 */
function detectSystemCondition(
  systemCondition: SystemCondition | undefined,
): Limiter | null {
  if (!systemCondition || systemCondition === 'clean') return null
  if (systemCondition === 'sludged') {
    return {
      id: 'sludge_build_up',
      severity: 'warning',
      title: 'Magnetite sludge accumulation',
      explanation: 'Sludge coating radiator surfaces is reducing heat transfer and restricting circulation.',
      suggestedFix: 'Power flush and fit magnetic filter',
      targetComponent: 'boiler',
    }
  }
  return {
    id: 'scale_build_up',
    severity: 'warning',
    title: 'Scale restricting heat exchanger',
    explanation: 'Limescale build-up is reducing heat exchanger efficiency and increasing return temperatures.',
    suggestedFix: 'Descale heat exchanger — consider water softener or inhibitor dosing',
    targetComponent: 'boiler',
  }
}

// ─── Public hook ──────────────────────────────────────────────────────────────

/**
 * Display adapter: maps SystemDiagramDisplayState → LimiterDisplayState.
 *
 * Detects up to 9 distinct physics constraints from the current state and
 * surfaces at most MAX_LIMITERS, ordered critical → warning → info so the
 * most severe constraints are always visible.
 *
 * Called as a pure function (no React state) so it can be unit-tested directly
 * in the same way as useEfficiencyPlayback.
 *
 * @param combiPowerKw   Rated combi output in kW (default 30). Used for the
 *   DHW-flow calculation in the combi_dhw_limit explanation string.
 * @param coldInletTempC Incoming cold water temperature in °C (default 10).
 *   Combined with DHW_DELIVERY_TARGET_C to compute the actual temperature rise
 *   and the resulting achievable flow rate — so the limiter explanation
 *   updates interactively as the user changes the System Inputs slider.
 * @param emitterState   Optional emitter/primary circuit model state. When
 *   supplied, enables emitter_undersized, primary_circuit_limit, and
 *   low_temp_capable limiters.
 * @param cylinderType   Optional cylinder technology type. When 'mixergy', the
 *   cylinder_depleted threshold is scaled by MIXERGY_USABLE_RESERVE_FACTOR and
 *   the mixergy_stratification info limiter is enabled during DHW draws.
 * @param systemCondition  Optional physical condition of the heating system.
 *   When 'sludged' or 'scaled', fires a warning limiter describing the impact
 *   on heat transfer.
 */
export function useLimiterPlayback(
  diagramState: SystemDiagramDisplayState,
  combiPowerKw: number = 30,
  coldInletTempC: number = 10,
  emitterState?: EmitterPrimaryDisplayState,
  cylinderType?: CylinderType,
  systemCondition?: SystemCondition,
): LimiterDisplayState {
  const candidates: Array<Limiter | null> = [
    detectCylinderDepleted(diagramState, cylinderType),
    detectCombiDhwLimit(diagramState, combiPowerKw, coldInletTempC),
    detectConcurrentDemand(diagramState),
    detectCondensingLost(diagramState),
    detectEmitterUndersized(emitterState),
    detectPrimaryCircuitLimit(emitterState),
    detectMainsFlowLimit(diagramState),
    detectSystemCondition(systemCondition),
    detectLowTempCapable(emitterState),
    detectMixergyStratification(diagramState, cylinderType),
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
