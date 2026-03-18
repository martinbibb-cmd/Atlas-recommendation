/**
 * Shared types and constants for the System Inputs panel and its consumers.
 *
 * Kept in a separate file so that SystemInputsPanel.tsx can comply with the
 * react-refresh rule (only export components from .tsx files).
 */

import type { DemandPresetId } from '../../../engine/schema/OccupancyPreset'

// ─── Public types ─────────────────────────────────────────────────────────────

export type PrimaryPipeSize = '15mm' | '22mm' | '28mm'

/**
 * Occupancy profile — describes the household's daily routine.
 *
 * Drives occupancy-aware auto-demo phases in useSystemDiagramPlayback and
 * adjusts the daily efficiency summary in useDailyEfficiencySummary.
 *
 * professional — works office hours (09–17); peak demand morning and evening.
 * steady_home  — home throughout the day; moderate, spread demand.
 * family       — school-age household; morning rush, school pick-up, evening peak.
 * shift        — irregular hours; demand offset from typical patterns.
 */
export type OccupancyProfile = 'professional' | 'steady_home' | 'family' | 'shift'
export type EmitterType = 'radiators' | 'oversized_radiators' | 'ufh'

/**
 * Heating control strategy / system layout.
 *
 * Exposed explicitly so the simulator does not silently assume S-plan for
 * all unvented cylinders or Y-plan for all open-vented cylinders.
 *
 * combi        — Combi boiler with plate heat exchanger. No cylinder or zone valves.
 * s_plan       — System boiler with S-plan zone valves (independent CH and DHW zones).
 * y_plan       — System / regular boiler with Y-plan mid-position valve.
 * heat_pump    — Heat pump primary layout with thermal store cylinder.
 */
export type ControlStrategy = 'combi' | 's_plan' | 'y_plan' | 'heat_pump'

/**
 * Physical condition of the heating system.
 *
 * clean   — well-maintained; no significant sludge or scale.
 * sludged — magnetite accumulation reducing heat transfer across the system.
 * scaled  — limescale build-up restricting heat-exchanger and boiler performance.
 */
export type SystemCondition = 'clean' | 'sludged' | 'scaled'

/**
 * Cylinder technology type.
 *
 * open_vented — tank-fed cold supply, typically smaller sizes.
 * unvented    — mains-fed cylinder, wider size range.
 * mixergy     — stratified mains-fed cylinder; usable reserve is greater
 *               than nominal fill because the top section stays hot even at
 *               moderate overall fill levels.
 */
export type CylinderType = 'open_vented' | 'unvented' | 'mixergy'

/**
 * Realistic cylinder volume options (litres) for each cylinder technology type.
 *
 * Sizes are derived from manufacturer ranges:
 *   open_vented : 98, 117, 140, 150
 *   unvented    : 120, 150, 180, 210, 250, 300
 *   mixergy     : 120, 150, 180, 210
 */
export const CYLINDER_SIZES_BY_TYPE: Record<CylinderType, readonly number[]> = {
  open_vented: [98, 117, 140, 150],
  unvented:    [120, 150, 180, 210, 250, 300],
  mixergy:     [120, 150, 180, 210],
}

/**
 * Usable hot-water reserve multiplier applied to Mixergy cylinders.
 *
 * Because Mixergy uses intelligent stratification to keep the top section at
 * delivery temperature even as the overall fill decreases, the effective usable
 * volume is approximately 20% greater than the raw fill fraction would suggest.
 * This shifts the cylinder_depleted limiter threshold lower — the alarm fires
 * later, reflecting the real-world benefit of demand mirroring and reduced
 * reheat cycling.
 */
export const MIXERGY_USABLE_RESERVE_FACTOR = 1.2

// Re-export for convenience — consumers can import DemandPresetId from here
// without needing to import directly from the engine schema.
export type { DemandPresetId }

export type SystemInputs = {
  /**
   * Richer lifestyle preset from the Full Survey.
   *
   * When set, this drives the per-preset occupancy table in
   * useSystemDiagramPlayback and provides a specific demand-style label in the
   * simulator UI — replacing the blunt 4-profile OccupancyProfile mapping.
   *
   * Falls back to `occupancyProfile` when absent (e.g. in the Quick-choice
   * path or when no survey has been completed).
   */
  demandPreset?: DemandPresetId
  /** Household occupancy profile — drives auto-demo demand windows and daily efficiency summary. */
  occupancyProfile: OccupancyProfile
  /** Mains supply pressure in bar (0.5–6.0). */
  mainsPressureBar: number
  /** Incoming mains flow rate in L/min (3–50). */
  mainsFlowLpm: number
  /** Cold water inlet temperature in °C (5–20). */
  coldInletTempC: number
  /** Cylinder technology type. Unused for combi. */
  cylinderType: CylinderType
  /** Stored cylinder nominal volume in litres. Must be a valid entry in CYLINDER_SIZES_BY_TYPE[cylinderType]. Unused for combi. */
  cylinderSizeLitres: number
  /** Combi boiler rated output in kW (18–42). Unused for stored/HP systems. */
  combiPowerKw: number
  /**
   * Actual building heat loss at design conditions (kW).
   *
   * Represents the thermal demand the heating system must meet on the coldest
   * design day.  Used instead of the hardcoded BASE_HEAT_DEMAND_KW in the
   * emitter model so the simulator reflects the real property.
   *
   * Range: 3–30 kW (typical UK dwellings span ~4 kW for a well-insulated flat
   * to ~25 kW for a larger Victorian semi).
   */
  heatLossKw: number
  /**
   * Selected boiler heating output rating (kW).
   *
   * Controls two downstream physics effects in the emitter model:
   *   1. System ΔT — a boiler oversized relative to the heat loss pumps more
   *      water per unit time, reducing the flow→return temperature drop and
   *      raising return temperature (worse condensing).
   *   2. Pipe sizing — the primary pipework must transport the boiler's maximum
   *      firing rate; values exceeding the pipe capacity trigger the
   *      primary_circuit_limit warning and highlight the primary supply pipe.
   *
   * Range: 9–45 kW (covers micro-CHP-class to large commercial-domestic).
   */
  boilerOutputKw: number
  /**
   * Emitter surface area multiplier relative to standard sizing (0.5–2.0).
   * 1.0 = standard radiators sized for 70°C flow; >1.0 = oversized.
   */
  emitterCapacityFactor: number
  /** Nominal bore of the primary circuit pipework. */
  primaryPipeSize: PrimaryPipeSize
  /** Type of heat emitter installed. */
  emitterType: EmitterType
  /**
   * Whether weather compensation (outdoor-reset flow temperature control)
   * is active. Reduces required flow temperature by ~5°C.
   */
  weatherCompensation: boolean
  /**
   * Whether load compensation is active.
   *
   * Load compensation modulates the boiler's target flow temperature in
   * proportion to actual heat demand, rather than running at a fixed
   * high setpoint.  This typically reduces the average operating flow
   * temperature by ~10–15°C compared to a fixed setpoint, lowering the
   * average return temperature and increasing the proportion of time the
   * boiler spends in the condensing range.
   *
   * Displayed alongside `weatherCompensation` — both can be active
   * simultaneously.
   */
  loadCompensation: boolean
  /**
   * Physical condition of the heating system.
   * Affects heat transfer efficiency and surfaces as a penalty / limiter.
   */
  systemCondition: SystemCondition
  /**
   * Heating control strategy / system layout.
   *
   * Exposed explicitly so the simulator does not silently assume S-plan
   * for all unvented cylinders or Y-plan for all open-vented cylinders.
   */
  controlStrategy: ControlStrategy
}

export const DEFAULT_SYSTEM_INPUTS: SystemInputs = {
  occupancyProfile: 'professional',
  mainsPressureBar: 2.5,
  mainsFlowLpm: 20,
  coldInletTempC: 10,
  cylinderType: 'unvented',
  cylinderSizeLitres: 150,
  combiPowerKw: 30,
  heatLossKw: 14,
  boilerOutputKw: 24,
  emitterCapacityFactor: 1.0,
  primaryPipeSize: '22mm',
  emitterType: 'radiators',
  weatherCompensation: false,
  loadCompensation: false,
  systemCondition: 'clean',
  controlStrategy: 'combi',
}
