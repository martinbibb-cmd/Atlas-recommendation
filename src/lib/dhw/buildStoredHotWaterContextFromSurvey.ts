/**
 * buildStoredHotWaterContextFromSurvey.ts
 *
 * Canonical bridge from FullSurveyModelV1 → StoredHotWaterContext.
 *
 * This is the single normalization layer that turns survey cylinder/water data
 * into simulator-ready stored hot water inputs.  Consumers (adaptFullSurveyToSimulatorInputs,
 * compare-mode seed generation, report adapters) should call this function instead
 * of reading survey cylinder fields directly.
 *
 * Design rules:
 *   - Reads both top-level EngineInputV2_3 fields AND fullSurvey.dhwCondition fields.
 *   - Engine-level fields take precedence over survey-layer diagnostics.
 *   - Known mains pressure / flow data is consumed here so that unvented suitability
 *     is not degraded by self-inflicted "missing" outcomes.
 *   - Gas supply confirmation is NOT a factor in this path.
 *   - Mixergy is kept as a distinct storageType — it is never collapsed into 'unvented'.
 *   - cylinder top height is NOT used as a core decision input.
 *   - hasEnoughDataForSuitability is true whenever the survey already contains
 *     enough information to judge suitability — bogus "missing" is avoided.
 */

import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';

// ─── Output type ──────────────────────────────────────────────────────────────

/**
 * Normalised stored hot water context derived from a FullSurveyModelV1.
 *
 * This is the canonical bridge type from survey state to simulator DHW judgement.
 * All fields that could not be determined from available survey data are null.
 */
export type StoredHotWaterContext = {
  /**
   * Physical installation type of the stored hot water system.
   * 'none' when the system is a combi or no cylinder is installed.
   */
  storageType: 'none' | 'vented' | 'unvented' | 'mixergy' | 'heat_pump_cylinder';
  /** Nominal cylinder volume (litres), or null if not captured. */
  cylinderVolumeLitres: number | null;
  /**
   * Available CWS gravity head (metres) above draw-off point.
   * Only relevant for vented (tank-fed) systems.
   * null when not measured or not applicable.
   */
  cwsHeadMetres: number | null;
  /**
   * Dynamic mains pressure (bar) at the meter / incoming point.
   * Derived from confirmed measurements only (mainsPressureRecorded respected).
   * null when not measured or recording flag is false.
   */
  mainsDynamicPressureBar: number | null;
  /**
   * Confirmed dynamic mains flow (L/min).
   * Only populated when mainsDynamicFlowLpmKnown === true.
   * null when unconfirmed or absent.
   */
  mainsFlowLpm: number | null;
  /**
   * Cylinder store temperature setpoint (°C), or null to use engine defaults.
   * Reflects explicit storeTempC override when present.
   */
  storedWaterTempC: number | null;
  /**
   * True when the survey already contains enough information to judge stored
   * hot water suitability without surfacing bogus "data missing" outcomes.
   *
   * Rules:
   *   - 'none'                 → false (no stored system to evaluate)
   *   - 'vented'               → true  (gravity supply; no pressure data required)
   *   - 'unvented'             → true when mainsFlowLpm is confirmed
   *   - 'mixergy'              → true when mainsFlowLpm is confirmed (unvented supply)
   *   - 'heat_pump_cylinder'   → true  (COP penalty always applies regardless of flow data)
   */
  hasEnoughDataForSuitability: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive StorageType from FullSurveyModelV1 fields.
 *
 * Resolution order (first match wins):
 *   1. currentCylinderPresent === false → 'none'
 *   2. dhwStorageType (engine-level field) — explicit and authoritative
 *   3. fullSurvey.dhwCondition.currentCylinderType
 *   4. dhwStorageRegime === 'heat_pump_cylinder'
 *   5. currentHeatSourceType inference (combi→none, regular→vented, system→unvented, ashp→heat_pump_cylinder)
 *   6. Default: 'vented' (most common UK stored arrangement)
 */
function deriveStorageType(
  survey: FullSurveyModelV1,
): StoredHotWaterContext['storageType'] {
  // 1. Explicitly no cylinder present
  if (survey.currentCylinderPresent === false) {
    return 'none';
  }

  // 2. Engine-level dhwStorageType field is authoritative when set
  if (survey.dhwStorageType != null) {
    return survey.dhwStorageType;
  }

  // 3. Survey-layer current cylinder type (under fullSurvey.dhwCondition)
  const cylType = survey.fullSurvey?.dhwCondition?.currentCylinderType;
  if (cylType === 'vented') return 'vented';
  if (cylType === 'unvented') return 'unvented';
  if (cylType === 'mixergy') return 'mixergy';
  // 'unknown' falls through to further inference below

  // 4. Storage regime (heat pump specific)
  if (survey.dhwStorageRegime === 'heat_pump_cylinder') {
    return 'heat_pump_cylinder';
  }

  // 5. Infer from heat source type
  const heatSource = survey.currentHeatSourceType;
  if (heatSource === 'combi') return 'none';
  if (heatSource === 'regular') return 'vented';
  if (heatSource === 'ashp') return 'heat_pump_cylinder';
  if (heatSource === 'system') {
    // System boilers with a stainless cylinder → unvented; copper → vented
    const mat = survey.fullSurvey?.dhwCondition?.cylinderMaterial;
    if (mat === 'stainless_unvented') return 'unvented';
    if (mat === 'copper_vented') return 'vented';
    // Modern system boilers are overwhelmingly paired with unvented cylinders
    return 'unvented';
  }

  // 6. Safe default: vented (the most common UK stored DHW arrangement)
  return 'vented';
}

/**
 * Resolve cylinder volume from engine-level field or survey diagnostic.
 *
 * Engine-level `cylinderVolumeLitres` takes precedence.
 * Falls back to fullSurvey.dhwCondition.currentCylinderVolumeLitres when set
 * to a numeric value (the 'unknown' sentinel is treated as absent).
 */
function resolveCylinderVolumeLitres(survey: FullSurveyModelV1): number | null {
  if (survey.cylinderVolumeLitres != null) {
    return survey.cylinderVolumeLitres;
  }
  const surveyVol = survey.fullSurvey?.dhwCondition?.currentCylinderVolumeLitres;
  if (typeof surveyVol === 'number') {
    return surveyVol;
  }
  return null;
}

/**
 * Resolve CWS head from engine-level field or survey diagnostic.
 *
 * Engine-level `cwsHeadMetres` takes precedence.
 * Falls back to fullSurvey.dhwCondition.currentCwsHeadMetres when set to a
 * numeric value ('unknown' sentinel is treated as absent).
 */
function resolveCwsHeadMetres(survey: FullSurveyModelV1): number | null {
  if (survey.cwsHeadMetres != null) {
    return survey.cwsHeadMetres;
  }
  const surveyHead = survey.fullSurvey?.dhwCondition?.currentCwsHeadMetres;
  if (typeof surveyHead === 'number') {
    return surveyHead;
  }
  return null;
}

/**
 * Resolve dynamic mains pressure from confirmed measurements.
 *
 * Returns null when mainsPressureRecorded === false (flow-only test, no gauge).
 * Prefers the explicit `dynamicMainsPressureBar` alias over the legacy
 * `dynamicMainsPressure` field (mirrors CwsSupplyModule behaviour).
 */
function resolveMainsDynamicPressureBar(survey: FullSurveyModelV1): number | null {
  // Respect the explicit "no pressure recorded" flag
  if (survey.mainsPressureRecorded === false) {
    return null;
  }
  const bar = survey.dynamicMainsPressureBar ?? survey.dynamicMainsPressure;
  if (bar != null && bar > 0) {
    return bar;
  }
  return null;
}

/**
 * Resolve confirmed mains flow (L/min).
 *
 * Only returns a value when mainsDynamicFlowLpmKnown === true AND a positive
 * flow is present.  Unconfirmed estimates are discarded.
 */
function resolveMainsFlowLpm(survey: FullSurveyModelV1): number | null {
  if (
    survey.mainsDynamicFlowLpmKnown === true &&
    survey.mainsDynamicFlowLpm != null &&
    survey.mainsDynamicFlowLpm > 0
  ) {
    return survey.mainsDynamicFlowLpm;
  }
  return null;
}

/**
 * Determine whether the survey contains enough data to judge stored hot water
 * suitability without surfacing bogus "data missing" outcomes.
 *
 * Vented systems can be evaluated using head alone (gravity system — no mains
 * pressure evidence needed).  Unvented and Mixergy systems require confirmed
 * mains flow because unvented eligibility cannot be asserted without it.
 * Heat pump cylinders always have enough data because the COP penalty applies
 * unconditionally.
 */
function deriveHasEnoughData(
  storageType: StoredHotWaterContext['storageType'],
  mainsFlowLpm: number | null,
): boolean {
  switch (storageType) {
    case 'none':
      return false;
    case 'vented':
      // Gravity supply: suitability can be judged without pressure/flow data
      return true;
    case 'unvented':
    case 'mixergy':
      // Mains-pressure systems: confirmed flow is required for suitability
      return mainsFlowLpm !== null;
    case 'heat_pump_cylinder':
      // COP penalty is unconditional — always enough data
      return true;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the canonical stored hot water context from a FullSurveyModelV1.
 *
 * This is the single source of truth for cylinder / water data used by the
 * simulator adapter, compare mode, and report adapters.
 *
 * @param survey  Completed (or partial) FullSurveyModelV1.
 * @returns       Normalised StoredHotWaterContext ready for simulator or engine use.
 */
export function buildStoredHotWaterContextFromSurvey(
  survey: FullSurveyModelV1,
): StoredHotWaterContext {
  const storageType = deriveStorageType(survey);
  const cylinderVolumeLitres = resolveCylinderVolumeLitres(survey);
  const cwsHeadMetres = resolveCwsHeadMetres(survey);
  const mainsDynamicPressureBar = resolveMainsDynamicPressureBar(survey);
  const mainsFlowLpm = resolveMainsFlowLpm(survey);
  const storedWaterTempC = survey.storeTempC ?? null;
  const hasEnoughDataForSuitability = deriveHasEnoughData(storageType, mainsFlowLpm);

  return {
    storageType,
    cylinderVolumeLitres,
    cwsHeadMetres,
    mainsDynamicPressureBar,
    mainsFlowLpm,
    storedWaterTempC,
    hasEnoughDataForSuitability,
  };
}
