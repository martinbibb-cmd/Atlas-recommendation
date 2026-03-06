// src/explainers/lego/sim/supplyModel.ts
//
// Explicit supply model for the Atlas simulation engine.
//
// Models the two supply domains that affect DHW performance:
//   1. Cold source conditions — what is feeding the DHW service?
//   2. Hot water service source — how is hot water being delivered?
//
// This replaces hidden assumptions with an explicit, topology-aware model
// so Play mode and Compare mode can distinguish between:
//   - mains-fed systems (combi, unvented cylinder)
//   - tank-fed / gravity-fed systems (vented cylinder)
//
// Design rule: supply conditions are derived from topology and user-controlled
// inlet parameters. The simulator must not default all systems to mains-fed.

// ─── Supply mode discriminant ─────────────────────────────────────────────────

export type SupplyMode = 'mains' | 'cws_tank'

// ─── Mains-fed supply model ───────────────────────────────────────────────────

/**
 * Supply model for mains-fed systems.
 *
 * Used for:
 *   - Combination boilers (on-demand hot water)
 *   - Unvented cylinders (mains-fed replenishment)
 *   - Mixergy cylinders (mains-fed replenishment)
 *
 * Possible bottlenecks:
 *   - mains dynamic flow
 *   - mains pressure
 *   - boiler thermal capacity (combi only)
 */
export type MainsSupplyModel = {
  mode: 'mains'
  /** Cold inlet temperature (°C). Typical UK range: 5–20°C. */
  inletTempC: number
  /**
   * Dynamic mains flow rate (L/min).
   * This is the practical limit imposed by mains pressure and pipe diameter.
   * Typical domestic range: 6–25 L/min.
   */
  dynamicFlowLpm: number
  /**
   * Dynamic mains pressure (bar).
   * Optional — used for detailed bottleneck analysis.
   * Typical domestic range: 0.5–4.0 bar.
   */
  dynamicPressureBar?: number
}

// ─── Tank-fed (CWS) supply model ──────────────────────────────────────────────

/**
 * Qualitative preset for CWS (cold-water storage cistern) head pressure.
 *
 * poor    — low head (≤ 1.5 m): shower may struggle
 * typical — normal domestic head (~3 m)
 * good    — high head (~5 m): good gravity supply
 */
export type TankSupplyQuality = 'poor' | 'typical' | 'good'

/** Estimated flow rate (L/min) derived from each tank supply quality preset. */
export const TANK_SUPPLY_FLOW_LPM: Record<TankSupplyQuality, number> = {
  poor:    9,   // 1.5 m head × 6 L/min per metre
  typical: 18,  // 3.0 m head × 6 L/min per metre
  good:    30,  // 5.0 m head × 6 L/min per metre
}

/**
 * Supply model for tank-fed (vented) systems.
 *
 * Used for:
 *   - Vented cylinders (gravity / CWS cistern fed)
 *
 * Possible bottlenecks:
 *   - gravity head / CWS tank height
 *   - distribution pipework
 *   - store depletion
 *
 * NOT a mains bottleneck: a vented cylinder is replenished from a CWS cistern,
 * not the mains, so mains pressure is not the limiting factor.
 */
export type TankSupplyModel = {
  mode: 'cws_tank'
  /** Cold inlet temperature (°C). Typical UK range: 5–20°C. */
  inletTempC: number
  /**
   * Qualitative head quality preset.
   * Maps to an effective flow rate via TANK_SUPPLY_FLOW_LPM.
   */
  headQuality: TankSupplyQuality
  /**
   * Estimated effective flow rate (L/min) at the outlet.
   * Derived from headQuality when not explicitly provided.
   */
  estimatedFlowLpm?: number
}

// ─── Unified supply model ─────────────────────────────────────────────────────

/**
 * Discriminated union of all supply model variants.
 *
 * Use the `mode` field to narrow to a specific variant:
 *
 *   if (supply.mode === 'mains') {
 *     // MainsSupplyModel — combi, unvented cylinder, Mixergy
 *   } else {
 *     // TankSupplyModel — vented cylinder
 *   }
 */
export type SupplyModel = MainsSupplyModel | TankSupplyModel
