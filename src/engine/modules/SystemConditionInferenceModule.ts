import type {
  HeatingConditionDiagnosticsV1,
  DhwConditionDiagnosticsV1,
} from '../../ui/fullSurvey/FullSurveyModelV1';
import type { NormalizerOutput } from '../schema/EngineInputV2_3';
import {
  inferDhwUseBand,
  inferPlateHexCondition,
  inferCylinderCondition,
} from './ComponentConditionModule';
import type {
  PlateHexCondition,
  CylinderCondition,
  WaterConditionInputs,
  UsageInputs,
  CylinderInputs,
} from './ComponentConditionModule';

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
  /**
   * Rich combi plate HEX condition inferred from water quality, usage intensity,
   * and observed hot-water performance symptoms. Includes foulingFactor for
   * physics application and confidence rating.
   */
  plateHexDetail: PlateHexCondition;
  /** Cylinder age band (for coil recovery and standing loss estimates). */
  cylinderAgeBand: AgeBand;
  /** Cylinder coil heat-transfer condition band. */
  coilCondition: ConditionBand;
  /**
   * Rich cylinder condition inferred from cylinder type, water quality, usage
   * intensity, and observed retention / recovery symptoms. Includes
   * insulationFactor and coilTransferFactor for physics application.
   */
  cylinderDetail: CylinderCondition;
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
  /** Number of regularly resident occupants — used to infer DHW use band. */
  occupancyCount?: number;
  /** Number of bathrooms — used alongside occupancyCount to infer DHW use band. */
  bathroomCount?: number;
  /** Peak number of simultaneously open hot-water outlets — refines DHW use band. */
  peakConcurrentOutlets?: number;
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

/**
 * Builds UsageInputs from the inference input, deriving dhwUseBand from
 * occupancy, bathroom count, and peak concurrent outlets.
 */
function buildUsageInputs(input: SystemConditionInferenceInput): UsageInputs {
  const occupancy       = input.occupancyCount ?? 2;
  const bathroomCount   = input.bathroomCount  ?? 1;
  const peakOutlets     = input.peakConcurrentOutlets;
  return {
    dhwUseBand:          inferDhwUseBand(occupancy, bathroomCount, peakOutlets),
    occupancy,
    simultaneousUseLikely: (peakOutlets ?? 0) >= 2,
  };
}

/**
 * Maps cylinderAgeEstimate survey field to CylinderInputs ageBand.
 * Note: '10_to_15' maps to the '10-20' model band (a conservative inclusive
 * range) and 'over_15' maps to '20+' as the most cautious available bucket.
 * This slight broadening of the 10-15 yr range is intentional — it avoids
 * creating a dead zone where 15-20 year cylinders receive no age penalty.
 */
function cylinderAgeEstimateToAgeBand(
  estimate: DhwConditionDiagnosticsV1['cylinderAgeEstimate'],
): CylinderInputs['ageBand'] {
  switch (estimate) {
    case 'under_5':  return '<5';
    case '5_to_10':  return '5-10';
    case '10_to_15': return '10-20';
    case 'over_15':  return '20+';
    default:         return undefined;
  }
}

/**
 * Resolves the cylinder type from survey fields.
 * cylinderType (new explicit field) takes precedence over the older
 * cylinderMaterial field which is mapped to a best-fit type.
 */
function resolveCylinderType(
  dc: DhwConditionDiagnosticsV1,
): CylinderInputs['cylinderType'] {
  if (dc.cylinderType) return dc.cylinderType;
  // Fall back to mapping from the older cylinderMaterial field
  switch (dc.cylinderMaterial) {
    case 'copper_vented':      return 'copper';
    case 'stainless_unvented': return 'modern_factory';
    case 'unknown':
    default:                   return 'unknown';
  }
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
  // Age-based fallback when no direct symptoms observed.
  // systemAgeYears is wired from currentBoilerAgeYears in sanitiseModelForEngine,
  // ensuring real survey age data reaches this inference when available.
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
  // Seed from postcode water hardness; amplify with DHW symptom observations
  // and system age — old systems in hard water areas accumulate substantial
  // scale regardless of observed symptoms.
  const dhwSymptomCount = countDhwScaleSymptoms(dc);

  let scaleRisk: RiskLevel = 'low';
  if (HARD_WATER_CATEGORIES.has(input.waterHardnessCategory ?? 'soft')) {
    // Hard water + symptoms → high; hard water + old system (≥15 yr) → high;
    // hard water alone → moderate
    const ageElevatesScale = ageYears >= 15;
    scaleRisk = (dhwSymptomCount >= 1 || ageElevatesScale) ? 'high' : 'moderate';
  } else if (MODERATE_WATER_CATEGORIES.has(input.waterHardnessCategory ?? 'soft')) {
    // Moderate hardness + symptoms or old system → moderate
    const ageElevatesScale = ageYears >= 20;
    scaleRisk = (dhwSymptomCount >= 1 || ageElevatesScale) ? 'moderate' : 'low';
  } else if (dhwSymptomCount >= 1) {
    // Soft water area but symptoms present — unexpected; flag moderate
    scaleRisk = 'moderate';
  }

  // ── Plate HEX condition (legacy ConditionBand) ────────────────────────────
  // When no explicit plateHexAgeYears is recorded, use systemAgeYears as a
  // proxy (the plate HEX is internal to the appliance and ages with it).
  let plateHexCondition: ConditionBand = 'unknown';
  const effectivePlateHexAge =
    typeof dc.plateHexAgeYears === 'number' ? dc.plateHexAgeYears : ageYears;
  if (effectivePlateHexAge > 0) {
    plateHexCondition = effectivePlateHexAge >= PLATE_HEX_DEGRADED_AGE_YEARS
      || dc.kettlingOrScaleSymptoms === true
      ? 'degraded'
      : 'good';
  } else if (dc.kettlingOrScaleSymptoms === true) {
    plateHexCondition = 'degraded';
  }

  // ── Plate HEX detail (rich multi-input model) ─────────────────────────────
  const waterForCondition = {
    hardnessBand: (input.waterHardnessCategory ?? 'soft') as WaterConditionInputs['hardnessBand'],
    softenerPresent: dc.softenerPresent ?? false,
  };
  const usageForCondition = buildUsageInputs(input);
  const plateHexDetail = inferPlateHexCondition(
    waterForCondition,
    usageForCondition,
    {
      applianceAgeYears: typeof dc.plateHexAgeYears === 'number' ? dc.plateHexAgeYears : undefined,
      hotWaterPerformanceBand: dc.hotWaterPerformanceBand,
    },
  );

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

  // ── Cylinder detail (rich multi-input model) ──────────────────────────────
  const cylinderAgeBandInput = cylinderAgeEstimateToAgeBand(dc.cylinderAgeEstimate);
  const resolvedCylinderType = resolveCylinderType(dc);
  const cylinderDetail = inferCylinderCondition(
    waterForCondition,
    usageForCondition,
    {
      cylinderType: resolvedCylinderType,
      ageBand: cylinderAgeBandInput,
      retentionBand: dc.cylinderRetentionBand,
    },
  );

  return {
    sludgeRisk,
    openVentedFaultRisk,
    pumpingOverPresent,
    scaleRisk,
    plateHexCondition,
    plateHexDetail,
    cylinderAgeBand,
    coilCondition,
    cylinderDetail,
    pumpingOverAdvisory,
  };
}
