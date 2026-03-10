/**
 * Shared types and constants for the System Inputs panel and its consumers.
 *
 * Kept in a separate file so that SystemInputsPanel.tsx can comply with the
 * react-refresh rule (only export components from .tsx files).
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export type PrimaryPipeSize = '15mm' | '22mm' | '28mm'
export type EmitterType = 'radiators' | 'oversized_radiators' | 'ufh'

export type SystemInputs = {
  /** Mains supply pressure in bar (1.5–6.0). */
  mainsPressureBar: number
  /** Incoming mains flow rate in L/min (10–50). */
  mainsFlowLpm: number
  /** Cold water inlet temperature in °C (5–20). */
  coldInletTempC: number
  /** Stored cylinder volume in litres (100–400). Unused for combi. */
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
  cylinderSizeLitres: 200,
  combiPowerKw: 30,
  emitterCapacityFactor: 1.0,
  primaryPipeSize: '22mm',
  emitterType: 'radiators',
  weatherCompensation: false,
}
