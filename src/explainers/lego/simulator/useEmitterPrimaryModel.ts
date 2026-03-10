// src/explainers/lego/simulator/useEmitterPrimaryModel.ts
//
// Display adapter: derives EmitterPrimaryDisplayState from emitter and pipe
// system inputs.
//
// Same discipline as useEfficiencyPlayback and useLimiterPlayback:
//   - pure function, no simulation state, no Math.random()
//   - single mapping layer between system inputs and panel rendering
//
// Core principle
// ──────────────
// The appliance does not decide efficiency — the system does.
//
// Efficiency emerges from:
//   Heat demand → Emitter output capacity → Required flow temperature
//   → Return temperature → Condensing / COP behaviour
//
// Architecture:
//   SimulatorDashboard
//     → useEmitterPrimaryModel(emitterInputs)
//     → EmitterPrimaryDisplayState
//     → EfficiencyPanel / Limiters / HouseView

import type { PrimaryPipeSize, EmitterType } from './systemInputsTypes'

// ─── Physical constants ───────────────────────────────────────────────────────

/**
 * Maximum heat transport capacity for each primary pipe size (kW).
 *
 * These are simplified linear approximations (heat transport ∝ pipe area
 * × velocity). They represent typical achievable capacity at normal pump
 * head for domestic wet central heating systems.
 */
export const PRIMARY_CAPACITY_KW: Record<PrimaryPipeSize, number> = {
  '15mm': 12,
  '22mm': 25,
  '28mm': 45,
}

/**
 * Emitter output multiplier relative to standard radiators sized at 70°C.
 *
 * A value > 1.0 means more emitter surface is available, so a lower flow
 * temperature achieves the same heat output (Output ∝ ΔT^n).
 */
export const EMITTER_TYPE_FACTOR: Record<EmitterType, number> = {
  radiators:            1.0,
  oversized_radiators:  1.3,
  ufh:                  1.8,
}

/** Design flow temperature for standard radiators (°C). */
const BASE_FLOW_TEMP_C = 70

/**
 * Representative building heat demand (kW).
 *
 * Used as the reference load for both the flow-temperature calculation and
 * the primary-circuit capacity check. Represents a medium UK semi-detached
 * home in winter conditions.
 */
export const BASE_HEAT_DEMAND_KW = 14

/** Minimum allowable flow temperature (°C). Heat pump lower bound. */
const FLOW_TEMP_MIN_C = 35

/** Maximum allowable flow temperature (°C). Safety / boiler limit. */
const FLOW_TEMP_MAX_C = 80

/** System ΔT between flow and return (°C). Typical domestic value. */
const DT_SYSTEM_C = 12

/** Weather-compensation flow temperature reduction (°C). */
const WEATHER_COMP_REDUCTION_C = 5

/** Heat pump COP floor. */
const COP_MIN = 2.5

/** Heat pump COP ceiling. */
const COP_MAX = 4.5

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Emitter and primary circuit inputs consumed by useEmitterPrimaryModel.
 * These are a subset of SystemInputs.
 */
export type EmitterPrimaryInputs = {
  emitterCapacityFactor: number
  primaryPipeSize: PrimaryPipeSize
  emitterType: EmitterType
  weatherCompensation: boolean
}

/**
 * Physics-derived display state for emitter adequacy and primary circuit
 * capacity. Consumed by useEfficiencyPlayback, useLimiterPlayback, and
 * HouseStatusPanel.
 */
export type EmitterPrimaryDisplayState = {
  /** Required flow temperature to meet building heat demand (°C). */
  requiredFlowTempC: number
  /** Estimated return water temperature (°C) = flowTemp − ΔTsystem. */
  estimatedReturnTempC: number
  /** True when emitters are large enough for low-temperature operation. */
  emitterAdequate: boolean
  /** True when the primary pipe can transport the required heat load. */
  primaryAdequate: boolean
  /** Building heat demand used for capacity comparisons (kW). */
  heatDemandKw: number
  /** Maximum heat transport capacity of the selected pipe size (kW). */
  primaryCapacityKw: number
  /**
   * Estimated COP based on the required flow temperature.
   * Calculated for all inputs; consumed only for heat pump systems.
   *
   * COP ≈ 5 − (flowTemp − 35) / 15, clamped to [2.5, 4.5].
   */
  estimatedCop: number
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function clampFlowTemp(temp: number): number {
  return Math.min(FLOW_TEMP_MAX_C, Math.max(FLOW_TEMP_MIN_C, temp))
}

function deriveCop(flowTempC: number): number {
  const raw = 5 - (flowTempC - 35) / 15
  return Math.min(COP_MAX, Math.max(COP_MIN, raw))
}

// ─── Public hook ──────────────────────────────────────────────────────────────

/**
 * Display adapter: maps EmitterPrimaryInputs → EmitterPrimaryDisplayState.
 *
 * Determines what flow temperature the system *requires* given the available
 * emitter surface area and primary pipe capacity, then derives the return
 * temperature and condensing / COP state from that flow temperature.
 *
 * This makes efficiency emerge from system physics rather than being
 * hard-coded per appliance.
 *
 * Called as a pure function (no React state) so it can be unit-tested
 * directly in the same way as useEfficiencyPlayback and useLimiterPlayback.
 */
export function useEmitterPrimaryModel(
  inputs: EmitterPrimaryInputs,
): EmitterPrimaryDisplayState {
  const { emitterCapacityFactor, primaryPipeSize, emitterType, weatherCompensation } = inputs

  const typeFactor = EMITTER_TYPE_FACTOR[emitterType]
  const primaryCapacityKw = PRIMARY_CAPACITY_KW[primaryPipeSize]

  // effectiveEmitterCapacity = BASE_HEAT_DEMAND_KW × emitterCapacityFactor × typeFactor
  //
  // flowTempRequired = BASE_FLOW_TEMP × (BASE_HEAT_DEMAND_KW / effectiveEmitterCapacity)
  //                  = BASE_FLOW_TEMP / (emitterCapacityFactor × typeFactor)
  //
  // This formula shows that more emitter area → lower required flow temperature.
  const rawFlowTemp = BASE_FLOW_TEMP_C / (emitterCapacityFactor * typeFactor)

  // Weather compensation lowers the flow temperature by tracking outdoor
  // conditions, reducing boiler cycling and improving condensing behaviour.
  const adjustedFlowTemp = weatherCompensation
    ? rawFlowTemp - WEATHER_COMP_REDUCTION_C
    : rawFlowTemp

  const requiredFlowTempC = clampFlowTemp(adjustedFlowTemp)
  const estimatedReturnTempC = requiredFlowTempC - DT_SYSTEM_C

  return {
    requiredFlowTempC,
    estimatedReturnTempC,
    // emitterAdequate: emitters support operating below the
    // emitter_undersized threshold (65°C).
    emitterAdequate: requiredFlowTempC <= 65,
    // primaryAdequate: the pipe can transport the full heat demand.
    primaryAdequate: BASE_HEAT_DEMAND_KW <= primaryCapacityKw,
    heatDemandKw: BASE_HEAT_DEMAND_KW,
    primaryCapacityKw,
    estimatedCop: deriveCop(requiredFlowTempC),
  }
}
