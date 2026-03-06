import type {
  HeatingConditionDiagnosticsV1,
  DhwConditionDiagnosticsV1,
} from '../../ui/fullSurvey/FullSurveyModelV1';
import type { NormalizerOutput } from '../schema/EngineInputV2_3';

// ─── Output types ─────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'moderate' | 'high';
export type ConditionBand = 'good' | 'degraded' | 'unknown';
export type AgeBand = 'new' | 'mid' | 'aged' | 'unknown';
export type OpenVentedFaultRisk = 'none' | 'possible' | 'likely';

/**
 * SystemConditionFlags
 *
 * Inferred model flags produced by the diagnostic inference layer.
 * These are derived from survey observations (HeatingConditionDiagnosticsV1
 * and DhwConditionDiagnosticsV1) and are consumed by the recommendation,
 * lab, and printout layers.
 *
 * They are NOT direct physics inputs — the physics layer applies penalties
 * only after the model topology has stabilised.
 */
export interface SystemConditionFlags {
  /** General CH primary-circuit contamination / magnetite sludge risk. */
  sludgeRisk: RiskLevel;
  /**
   * Open-vented hydraulic fault risk — separate from sludge.
   * Driven primarily by pumpingOverPresent; also elevated by circuit-type context.
   */
  openVentedFaultRisk: OpenVentedFaultRisk;
  /**
   * True when pumping over has been directly observed on the open vent pipe.
   * Hard advisory: this is a mechanical/layout fault that may require repiping.
   */
  pumpingOverPresent: boolean;
  /** DHW-side CaCO₃/silicate scale risk (postcode hardness + DHW symptoms). */
  scaleRisk: RiskLevel;
  /** Combi plate heat exchanger condition band. */
  plateHexCondition: ConditionBand;
  /** Cylinder age band (for coil recovery and standing loss estimates). */
  cylinderAgeBand: AgeBand;
  /** Cylinder coil heat-transfer condition band. */
  coilCondition: ConditionBand;
  /**
   * Advisory messages for the pumping over flag, when present.
   * Empty when pumpingOverPresent is false.
   */
  pumpingOverAdvisory: string[];
}

// ─── Input type ───────────────────────────────────────────────────────────────

export interface SystemConditionInferenceInput {
  heatingCondition?: HeatingConditionDiagnosticsV1;
  dhwCondition?: DhwConditionDiagnosticsV1;
  /** Water hardness category from postcode lookup — seeds scale risk. */
  waterHardnessCategory?: NormalizerOutput['waterHardnessCategory'];
  /** System age in years — used as a proxy sludge risk multiplier when direct symptoms absent. */
  systemAgeYears?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Number of heating-condition symptom flags above which sludgeRisk elevates
const SLUDGE_MODERATE_THRESHOLD = 1;
const SLUDGE_HIGH_THRESHOLD = 3;

// Water hardness categories that seed moderate or high scale risk
const HARD_WATER_CATEGORIES = new Set<NormalizerOutput['waterHardnessCategory']>(['hard', 'very_hard']);
const MODERATE_WATER_CATEGORIES = new Set<NormalizerOutput['waterHardnessCategory']>(['moderate']);

// Plate HEX age above which the condition is considered degraded
const PLATE_HEX_DEGRADED_AGE_YEARS = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countHeatingSymptoms(hc: HeatingConditionDiagnosticsV1): number {
  let count = 0;
  if (hc.radiatorsColdAtBottom)            count++;
  if (hc.radiatorsHeatingUnevenly)          count++;
  if (hc.bleedWaterColour === 'brown' || hc.bleedWaterColour === 'black') count++;
  if (hc.magneticDebrisEvidence)            count++;
  if (hc.pumpSpeedHigh)                     count++;
  if (hc.repeatedPumpOrValveReplacements)   count++;
  if (hc.boilerCavitationOrNoise)           count++;
  return count;
}

function countDhwScaleSymptoms(dc: DhwConditionDiagnosticsV1): number {
  let count = 0;
  if (dc.kettlingOrScaleSymptoms)   count++;
  if (dc.immersionFailureHistory)   count++;
  return count;
}

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * inferSystemConditionFlags
 *
 * Converts raw survey-layer observations (HeatingConditionDiagnosticsV1 and
 * DhwConditionDiagnosticsV1) into deterministic model flags for the downstream
 * recommendation, lab, and printout layers.
 *
 * Architecture:
 *   Survey layer → [this function] → SystemConditionFlags → physics/penalties (deferred)
 *
 * Important distinctions:
 *  - sludgeRisk:           general CH contamination / magnetite fouling
 *  - scaleRisk:            DHW-side CaCO₃ / silicate limescale
 *  - pumpingOverPresent:   open-vented hydraulic fault (NOT a sludge sub-flag)
 *  - openVentedFaultRisk:  overall risk of an open-vented circuit fault
 *
 * Pumping over triggers a hard advisory because it typically indicates a
 * blockage or restriction around the feed-and-vent connection and may require
 * repiping rather than chemical treatment alone.
 */
export function inferSystemConditionFlags(
  input: SystemConditionInferenceInput,
): SystemConditionFlags {
  const hc = input.heatingCondition ?? {};
  const dc = input.dhwCondition ?? {};

  // ── Pumping over (hard flag) ──────────────────────────────────────────────
  const pumpingOverPresent = hc.pumpingOverObserved === true;

  // ── Open-vented fault risk ────────────────────────────────────────────────
  let openVentedFaultRisk: OpenVentedFaultRisk = 'none';
  if (pumpingOverPresent) {
    openVentedFaultRisk = 'likely';
  } else if (hc.systemCircuitType === 'open_vented') {
    // Open-vented system without observed pumping over — base elevated risk
    openVentedFaultRisk = 'possible';
  }

  // ── Pumping over advisory text ────────────────────────────────────────────
  const pumpingOverAdvisory: string[] = [];
  if (pumpingOverPresent) {
    pumpingOverAdvisory.push(
      'Pumping over indicates a circulation fault around the feed-and-vent connection, ' +
      'typically due to a blockage or poor pipe geometry. This is usually a mechanical issue ' +
      'and may require repiping rather than chemical treatment alone.'
    );
    if (hc.systemCircuitType === 'open_vented') {
      pumpingOverAdvisory.push(
        'The open vented central heating circuit should be inspected for blockage or ' +
        'restriction between the cold feed and the open vent pipe before any other work proceeds.'
      );
    } else if (!hc.systemCircuitType || hc.systemCircuitType === 'unknown') {
      pumpingOverAdvisory.push(
        'Confirm whether the system is open vented — pumping over is only possible ' +
        'on an open vented central heating circuit.'
      );
    }
  }

  // ── Sludge risk ───────────────────────────────────────────────────────────
  const symptomCount = countHeatingSymptoms(hc);
  // Age-based fallback when no direct symptoms observed
  const ageYears = input.systemAgeYears ?? 0;
  let ageSymptomProxy = 0;
  if (ageYears >= 20) ageSymptomProxy = 3;
  else if (ageYears >= 10) ageSymptomProxy = 1;

  const effectiveSymptomCount = symptomCount > 0 ? symptomCount : ageSymptomProxy;

  let sludgeRisk: RiskLevel = 'low';
  if (effectiveSymptomCount >= SLUDGE_HIGH_THRESHOLD) {
    sludgeRisk = 'high';
  } else if (effectiveSymptomCount >= SLUDGE_MODERATE_THRESHOLD) {
    sludgeRisk = 'moderate';
  }

  // ── Scale risk ────────────────────────────────────────────────────────────
  // Seed from postcode water hardness; amplify with DHW symptom observations.
  const dhwSymptomCount = countDhwScaleSymptoms(dc);

  let scaleRisk: RiskLevel = 'low';
  if (HARD_WATER_CATEGORIES.has(input.waterHardnessCategory ?? 'soft')) {
    scaleRisk = dhwSymptomCount >= 1 ? 'high' : 'moderate';
  } else if (MODERATE_WATER_CATEGORIES.has(input.waterHardnessCategory ?? 'soft')) {
    scaleRisk = dhwSymptomCount >= 1 ? 'moderate' : 'low';
  } else if (dhwSymptomCount >= 1) {
    // Soft water area but symptoms present — unexpected; flag moderate
    scaleRisk = 'moderate';
  }

  // ── Plate HEX condition ───────────────────────────────────────────────────
  let plateHexCondition: ConditionBand = 'unknown';
  if (dc.plateHexAgeYears !== undefined && dc.plateHexAgeYears !== 'unknown') {
    plateHexCondition = dc.plateHexAgeYears >= PLATE_HEX_DEGRADED_AGE_YEARS
      || dc.kettlingOrScaleSymptoms === true
      ? 'degraded'
      : 'good';
  } else if (dc.kettlingOrScaleSymptoms === true) {
    plateHexCondition = 'degraded';
  }

  // ── Cylinder age band ─────────────────────────────────────────────────────
  let cylinderAgeBand: AgeBand = 'unknown';
  switch (dc.cylinderAgeEstimate) {
    case 'under_5':  cylinderAgeBand = 'new';     break;
    case '5_to_10':  cylinderAgeBand = 'mid';     break;
    case '10_to_15':
    case 'over_15':  cylinderAgeBand = 'aged';    break;
    case 'unknown':  cylinderAgeBand = 'unknown'; break;
  }

  // ── Coil condition ────────────────────────────────────────────────────────
  // Derived from cylinder age band + scale risk + kettling symptoms.
  let coilCondition: ConditionBand = 'unknown';
  if (cylinderAgeBand === 'new') {
    coilCondition = 'good';
  } else if (cylinderAgeBand === 'aged' || scaleRisk === 'high' || dc.kettlingOrScaleSymptoms === true) {
    coilCondition = 'degraded';
  } else if (cylinderAgeBand === 'mid') {
    coilCondition = scaleRisk === 'moderate' ? 'degraded' : 'good';
  }

  return {
    sludgeRisk,
    openVentedFaultRisk,
    pumpingOverPresent,
    scaleRisk,
    plateHexCondition,
    cylinderAgeBand,
    coilCondition,
    pumpingOverAdvisory,
  };
}
