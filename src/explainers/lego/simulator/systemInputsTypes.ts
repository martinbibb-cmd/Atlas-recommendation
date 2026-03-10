/**
 * Shared types and constants for the System Inputs panel and its consumers.
 *
 * Kept in a separate file so that SystemInputsPanel.tsx can comply with the
 * react-refresh rule (only export components from .tsx files).
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export type PrimaryPipeSize = '15mm' | '22mm' | '28mm'
export type EmitterType = 'radiators' | 'oversized_radiators' | 'ufh'

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

export type SystemInputs = {
  /** Mains supply pressure in bar (1.5–6.0). */
  mainsPressureBar: number
  /** Incoming mains flow rate in L/min (10–50). */
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
}

export const DEFAULT_SYSTEM_INPUTS: SystemInputs = {
  mainsPressureBar: 2.5,
  mainsFlowLpm: 20,
  coldInletTempC: 10,
  cylinderType: 'unvented',
  cylinderSizeLitres: 150,
  combiPowerKw: 30,
  emitterCapacityFactor: 1.0,
  primaryPipeSize: '22mm',
  emitterType: 'radiators',
  weatherCompensation: false,
}
