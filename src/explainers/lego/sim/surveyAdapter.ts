// src/explainers/lego/sim/surveyAdapter.ts
//
// Survey-backed lab input adapter.
//
// Maps existing survey / engine outputs into lab-safe playback inputs.
// The lab can then run in two modes:
//
//   demo          — generic defaults; no survey data provided.
//   survey_backed — real survey-derived values used wherever available;
//                   demo defaults are used for any absent fields.
//
// This adapter is the single gate between survey data and lab physics.
// It must never mutate the source object and must never throw — all
// missing fields produce clean fallbacks.

import type { LabPlaybackInputs, LabPlaybackMode } from '../animation/types'

// ─── Minimum thresholds for "survey_backed" classification ───────────────────

/**
 * The minimum set of output fields required to consider a playback session
 * "survey-backed".  At least one of these must be non-null in the derived
 * `LabPlaybackInputs` object.
 *
 * Rationale: if the caller only passes e.g. an occupancy string but no
 * physics-affecting value, we still class it as demo to avoid misleading
 * the user that survey physics are in play.
 *
 * These are `LabPlaybackInputs` field names — we check the *output* (`inputs`),
 * not the raw survey input.  This correctly handles the confirmed-flow gate:
 * an unconfirmed `mainsDynamicFlowLpm` is discarded by the adapter and never
 * written to `inputs.dynamicFlowLpm`, so it correctly does not trigger
 * survey_backed mode.
 */
const PHYSICS_OUTPUT_FIELDS: Array<keyof LabPlaybackInputs> = [
  'heatLossWatts',
  'buildingMass',
  'tauHours',
  'dynamicMainsPressureBar',
  'dynamicFlowLpm',
  'currentHeatSourceType',
  'dhwTankType',
]

// ─── Input type ───────────────────────────────────────────────────────────────

/**
 * Raw survey / engine values that may be present for a property.
 *
 * All fields are optional.  The adapter produces clean lab playback inputs
 * and a mode classification regardless of which fields are populated.
 *
 * Field names mirror the engine schema where possible to keep the mapping
 * transparent, but the adapter shields the lab from engine-schema churn.
 */
export type SurveyAdapterInput = {
  /** Peak building heat loss (W). From EngineInputV2_3.heatLossWatts. */
  heatLossWatts?: number
  /** Building thermal mass. From EngineInputV2_3.buildingMass. */
  buildingMass?: 'light' | 'medium' | 'heavy'
  /**
   * Derived thermal time constant (hours).
   * If the engine has already derived τ (e.g. from FabricModelModule), pass it
   * here to avoid re-deriving from heatLossWatts + buildingMass.
   */
  tauHours?: number
  /** Dynamic mains pressure (bar). Prefers dynamicMainsPressureBar; falls back to dynamicMainsPressure. */
  dynamicMainsPressureBar?: number
  /** Legacy dynamic pressure field alias. */
  dynamicMainsPressure?: number
  /** Static mains pressure (bar). */
  staticMainsPressureBar?: number
  /** Measured dynamic mains flow rate (L/min). */
  mainsDynamicFlowLpm?: number
  /** True when mainsDynamicFlowLpm is a confirmed measured reading. */
  mainsDynamicFlowLpmKnown?: boolean
  /** Current heat source type from the survey. */
  currentHeatSourceType?: 'combi' | 'system' | 'regular' | 'ashp' | 'other'
  /** DHW cylinder type from the survey. */
  dhwTankType?: 'standard' | 'mixergy'
  /** Occupancy signature key (context only — not used for physics gating). */
  occupancySignature?: string
}

// ─── Adapter result ───────────────────────────────────────────────────────────

/**
 * Result of adapting survey inputs for lab playback.
 */
export type SurveyAdapterResult = {
  /** Derived lab playback inputs. Empty object when no physics fields are present. */
  inputs: LabPlaybackInputs
  /** Whether the lab has enough survey data to classify as survey-backed. */
  mode: LabPlaybackMode
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

/**
 * Map survey / engine outputs into lab playback inputs.
 *
 * Rules:
 *   - Only confirmed measured flow readings (mainsDynamicFlowLpmKnown === true)
 *     are promoted to dynamicFlowLpm; unconfirmed estimates are discarded so
 *     the lab never presents a heuristic as a measured value.
 *   - Dynamic pressure prefers the explicit `dynamicMainsPressureBar` alias;
 *     falls back to the legacy `dynamicMainsPressure` field.
 *   - mode === 'survey_backed' only when at least one physics-affecting field
 *     is present; purely contextual fields (occupancySignature) do not qualify.
 *   - The returned object is a plain value — no mutation of the input.
 */
export function adaptSurveyInputs(survey: SurveyAdapterInput): SurveyAdapterResult {
  const inputs: LabPlaybackInputs = {}

  // Heat loss / building mass / tau
  if (survey.heatLossWatts != null && survey.heatLossWatts > 0) {
    inputs.heatLossWatts = survey.heatLossWatts
  }
  if (survey.buildingMass != null) {
    inputs.buildingMass = survey.buildingMass
  }
  if (survey.tauHours != null && survey.tauHours > 0) {
    inputs.tauHours = survey.tauHours
  }

  // Mains pressure
  const dynBar = survey.dynamicMainsPressureBar ?? survey.dynamicMainsPressure
  if (dynBar != null && dynBar > 0) {
    inputs.dynamicMainsPressureBar = dynBar
  }
  if (survey.staticMainsPressureBar != null && survey.staticMainsPressureBar > 0) {
    inputs.staticMainsPressureBar = survey.staticMainsPressureBar
  }

  // Measured flow — only promote confirmed measured readings
  if (
    survey.mainsDynamicFlowLpm != null &&
    survey.mainsDynamicFlowLpm > 0 &&
    survey.mainsDynamicFlowLpmKnown === true
  ) {
    inputs.dynamicFlowLpm = survey.mainsDynamicFlowLpm
  }

  // System context
  if (survey.currentHeatSourceType != null) {
    inputs.currentHeatSourceType = survey.currentHeatSourceType
  }
  if (survey.dhwTankType != null) {
    inputs.dhwTankType = survey.dhwTankType
  }

  // Occupancy (context only)
  if (survey.occupancySignature != null) {
    inputs.occupancySignature = survey.occupancySignature
  }

  // Determine mode: survey_backed when at least one physics output field is present.
  // We check `inputs` (the output), not the raw `survey`, so that unconfirmed flow
  // readings that were discarded by the adapter correctly do not trigger survey_backed.
  const hasPhysics = PHYSICS_OUTPUT_FIELDS.some(f => inputs[f] != null)
  const mode: LabPlaybackMode = hasPhysics ? 'survey_backed' : 'demo'

  return { inputs, mode }
}

// ─── Mode derivation helper ───────────────────────────────────────────────────

/**
 * Derive the playback mode from a `LabPlaybackInputs` object that has already
 * been created (e.g. by `adaptSurveyInputs` or programmatically).
 *
 * Returns 'survey_backed' when at least one physics-affecting field is populated.
 * Returns 'demo' when the inputs object is absent or contains only context fields.
 */
export function derivePlaybackMode(inputs: LabPlaybackInputs | undefined): LabPlaybackMode {
  if (inputs == null) return 'demo'
  const physicsInputFields: Array<keyof LabPlaybackInputs> = [
    'heatLossWatts',
    'buildingMass',
    'tauHours',
    'dynamicMainsPressureBar',
    'dynamicFlowLpm',
    'currentHeatSourceType',
    'dhwTankType',
  ]
  return physicsInputFields.some(f => inputs[f] != null) ? 'survey_backed' : 'demo'
}
