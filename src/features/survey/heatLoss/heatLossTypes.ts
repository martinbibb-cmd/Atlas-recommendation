/**
 * heatLossTypes.ts
 *
 * UI state model for the House / Heat Loss step.
 *
 * Captures:
 *   1) Heat loss context — peak loss estimate, confidence, and key drivers.
 *   2) Roof / solar inputs — roof form, main usable orientation, shading,
 *      and current/planned PV + battery.
 *
 * These inputs live in survey state only. They are not yet consumed directly
 * by EngineInputV2_3 — they feed the insight and potential sections of the
 * insight page.
 */

// ─── Roof form ────────────────────────────────────────────────────────────────

/**
 * Physical form of the main roof.
 * Influences PV yield potential and, to a lesser extent, heat loss.
 */
export type RoofType = 'pitched' | 'flat' | 'hipped' | 'dormer' | 'unknown';

// ─── Compass orientation ──────────────────────────────────────────────────────

/**
 * Eight-point compass direction for the main usable roof face.
 * The surveyor picks the direction the roof slope faces outward (i.e. where
 * solar panels would point) — not the direction the house faces.
 */
export type CompassOrientation = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/**
 * Persisted survey value for roof orientation — one of the 8 compass directions
 * or 'unknown' when not yet captured.
 */
export type RoofOrientation = CompassOrientation | 'unknown';

// ─── Shading ──────────────────────────────────────────────────────────────────

/** Degree of shading on the main usable roof face during peak sun hours. */
export type ShadingLevel =
  | 'little_or_none'
  | 'some'
  | 'heavy'
  | 'unknown';

// ─── PV / battery status ─────────────────────────────────────────────────────

/** Whether photovoltaic panels are absent, existing, or planned. */
export type PvStatus = 'none' | 'existing' | 'planned';

/** Whether a battery storage system is absent, existing, or planned. */
export type BatteryStatus = 'none' | 'existing' | 'planned';

// ─── Complete UI state ────────────────────────────────────────────────────────

/**
 * HeatLossState
 *
 * Combines the heat-loss context block with the roof / solar block.
 *
 * Fields
 * ──────
 * estimatedPeakHeatLossW  — peak design heat loss in watts (null = not entered)
 * heatLossConfidence      — how certain we are of the estimate
 * roofType                — physical roof form
 * roofOrientation         — main usable roof face compass direction
 * shadingLevel            — shading on that face
 * pvStatus                — PV panel presence
 * batteryStatus           — battery storage presence
 */
export type HeatLossState = {
  /** Peak design heat loss in watts. null = not yet entered / unknown. */
  estimatedPeakHeatLossW: number | null;
  /** Confidence level for the heat-loss estimate. */
  heatLossConfidence: 'measured' | 'estimated' | 'default' | 'unknown';
  /** Physical form of the roof. */
  roofType: RoofType;
  /** Main usable roof face direction (where panels would point). */
  roofOrientation: RoofOrientation;
  /** Degree of shading on the main usable roof face. */
  shadingLevel: ShadingLevel;
  /** PV panel status. */
  pvStatus: PvStatus;
  /** Battery storage status. */
  batteryStatus: BatteryStatus;
};

export const INITIAL_HEAT_LOSS_STATE: HeatLossState = {
  estimatedPeakHeatLossW: null,
  heatLossConfidence: 'unknown',
  roofType: 'unknown',
  roofOrientation: 'unknown',
  shadingLevel: 'unknown',
  pvStatus: 'none',
  batteryStatus: 'none',
};
