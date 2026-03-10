/**
 * Shared types and constants for the System Inputs panel and its consumers.
 *
 * Kept in a separate file so that SystemInputsPanel.tsx can comply with the
 * react-refresh rule (only export components from .tsx files).
 */

// ─── Public types ─────────────────────────────────────────────────────────────

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
}

export const DEFAULT_SYSTEM_INPUTS: SystemInputs = {
  mainsPressureBar: 2.5,
  mainsFlowLpm: 20,
  coldInletTempC: 10,
  cylinderSizeLitres: 200,
  combiPowerKw: 30,
}
