/**
 * waterQualityTypes.ts
 *
 * UI state model for the water quality block in the Services step.
 * Captures supply-side scaling and fouling risk as structured input for
 * later degradation, reliability, and longevity modelling.
 *
 * Water quality is a property of incoming supply, not the appliance, and
 * therefore belongs in the Services step rather than asset health.
 */

// ─── Hardness band ────────────────────────────────────────────────────────────

/** CaCO₃ hardness classification aligned with Drinking Water Inspectorate bands. */
export type HardnessBand = 'soft' | 'moderate' | 'hard' | 'very_hard' | 'unknown';

// ─── Risk levels ──────────────────────────────────────────────────────────────

export type ScaleRiskLevel = 'low' | 'medium' | 'high' | 'unknown';

// ─── Confidence source ────────────────────────────────────────────────────────

/**
 * How the water quality data was obtained.
 * - 'lookup'   — derived from postcode lookup against regional hardness data
 * - 'user'     — explicitly confirmed or entered by the user
 * - 'assumed'  — lookup failed; fallback to regional default
 * - 'unknown'  — not yet determined
 */
export type WaterQualitySource = 'lookup' | 'user' | 'assumed' | 'unknown';

// ─── Complete UI state ────────────────────────────────────────────────────────

/**
 * WaterQualityState
 *
 * Lean UI model that captures the incoming water supply chemistry.
 * Deliberately minimal — normalised into a canonical services object
 * by waterQualityNormalizer before being passed downstream.
 *
 * Fields
 * ──────
 * source          — confidence provenance (lookup / user / assumed / unknown)
 * postcode        — postcode used for the lookup (may differ from property postcode
 *                   if user overrides)
 * hardnessBand    — CaCO₃ classification band
 * hardnessPpm     — CaCO₃ level in mg/L; null if unknown
 * limescaleRisk   — overall limescale risk classification
 * silicateRisk    — silicate scaffold risk (London Basin / Dorset Chalk geology)
 * confidenceNote  — human-readable note about data confidence
 */
export type WaterQualityState = {
  source: WaterQualitySource;
  postcode: string | null;
  hardnessBand: HardnessBand;
  hardnessPpm: number | null;
  limescaleRisk: ScaleRiskLevel;
  silicateRisk: ScaleRiskLevel;
  confidenceNote: string | null;
};

export const INITIAL_WATER_QUALITY_STATE: WaterQualityState = {
  source: 'unknown',
  postcode: null,
  hardnessBand: 'unknown',
  hardnessPpm: null,
  limescaleRisk: 'unknown',
  silicateRisk: 'unknown',
  confidenceNote: null,
};
