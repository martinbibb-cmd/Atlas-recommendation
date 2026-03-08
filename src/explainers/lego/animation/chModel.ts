// src/explainers/lego/animation/chModel.ts

/**
 * Specific heat capacity of water used in the CH energy balance (kJ/(kg·K)).
 *
 * Q = ṁ × cₚ × ΔT
 * where ṁ is in kg/s (≈ L/s for water) and Q is in kW.
 */
export const CP_WATER_KJ_PER_KG_K = 4.18

/**
 * Default design ΔT (°C) for a standard UK radiator system (70/50 °C).
 * Used to derive the primary-circuit flow rate from source output when no
 * explicit `flowRateLps` is supplied.
 */
export const DEFAULT_CH_DESIGN_DELTA_T_C = 20

/**
 * A single heating emitter branch (radiator loop, UFH loop, zone).
 *
 * Based on the model proposed in the physics-engine upgrade:
 *
 *   totalDemandKw = sum(activeLoads.demandKw)
 *   deliveredKw   = min(sourceOutputKw, totalDemandKw)
 */
export type HeatingLoad = {
  /** Unique branch identifier (e.g. 'zone_1', 'radiator_loop'). */
  id: string
  /** Current demand power for this branch (kW). */
  demandKw: number
  /** Optional maximum rated output for this branch (kW). */
  maxKw?: number
  /** Whether this branch is currently open and demanding heat. */
  active: boolean
}

/**
 * Result of a central-heating energy balance computation.
 *
 * Derived from the standard heat-transfer equation:
 *   Q = ṁ × cₚ × ΔT
 *
 * where:
 *   Q    — thermal power delivered (kW)
 *   ṁ    — mass flow rate (kg/s ≈ L/s for water)
 *   cₚ   — specific heat capacity of water (4.18 kJ/(kg·K))
 *   ΔT   — temperature difference flow − return (°C)
 *
 * Return temperature is derived — not guessed — from delivered power and
 * circuit flow rate, grounding the visualisation in real physics.
 */
export type ChHeatBalance = {
  /** Sum of all active emitter load demands (kW). */
  totalDemandKw: number
  /** Delivered power — limited by source output (kW). */
  deliveredKw: number
  /** Flow temperature at the heat source outlet (°C). */
  flowTempC: number
  /**
   * Return temperature at the heat source inlet (°C).
   * Derived: returnTempC = flowTempC − deliveredKw / (flowRateLps × 4.18)
   */
  returnTempC: number
  /** Primary-circuit volumetric flow rate (L/s). */
  flowRateLps: number
}

/**
 * Compute the central-heating energy balance (Layer A — energy balance only).
 *
 * Implements the standard heat-balance formula:
 *   Q  = ṁ × cₚ × ΔT
 *   ΔT = Q / (ṁ × cₚ)
 *   returnTempC = flowTempC − ΔT
 *
 * Rules:
 *   - Only `active` loads contribute to `totalDemandKw`.
 *   - `deliveredKw = min(sourceOutputKw, totalDemandKw)` — source-limited.
 *   - If `flowRateLps` is absent it is derived from `sourceOutputKw` at the
 *     conventional 20 °C design ΔT (UK standard 70/50 °C radiator design point)
 *     so temperatures are always physically meaningful without requiring an
 *     explicit flow rate from the caller.
 */
export function computeChHeatBalance(params: {
  /** Maximum output the heat source can deliver to the CH circuit (kW). */
  sourceOutputKw: number
  /** Emitter branches — only `active` loads are included. */
  loads: HeatingLoad[]
  /** Target flow temperature leaving the heat source (°C). */
  targetFlowTempC: number
  /**
   * Primary-circuit volumetric flow rate (L/s).
   * When absent, derived from `sourceOutputKw` at the conventional design ΔT.
   */
  flowRateLps?: number
}): ChHeatBalance {
  const activeLoads = params.loads.filter(l => l.active)
  const totalDemandKw = activeLoads.reduce((sum, l) => sum + l.demandKw, 0)

  // Delivered power is source-limited.
  const deliveredKw = Math.min(params.sourceOutputKw, totalDemandKw)

  // Derive flow rate: use supplied value, or infer from source at design ΔT.
  const flowRateLps = (params.flowRateLps != null && params.flowRateLps > 0)
    ? params.flowRateLps
    : params.sourceOutputKw > 0
      ? params.sourceOutputKw / (CP_WATER_KJ_PER_KG_K * DEFAULT_CH_DESIGN_DELTA_T_C)
      : 0

  // Return temperature derived from energy extraction.
  // ΔT = Q / (ṁ × cₚ) = deliveredKw / (flowRateLps × CP_WATER_KJ_PER_KG_K)
  const deltaT = flowRateLps > 0
    ? deliveredKw / (flowRateLps * CP_WATER_KJ_PER_KG_K)
    : 0

  return {
    totalDemandKw,
    deliveredKw,
    flowTempC: params.targetFlowTempC,
    returnTempC: params.targetFlowTempC - deltaT,
    flowRateLps,
  }
}
