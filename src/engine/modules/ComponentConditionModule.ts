/**
 * ComponentConditionModule
 *
 * Infers degradation condition for the combi plate heat exchanger (plate HEX)
 * and hot-water cylinder from water quality, usage intensity, and observed
 * performance symptoms.
 *
 * Design principle: age is a supporting input, not the primary driver.
 * Condition is inferred from evidence — hard water + heavy use + poor symptoms
 * produces a worse score than a 12-year-old appliance in soft water with no
 * symptoms. This is more truthful and more defensible.
 *
 * Outputs are applied by the physics layer:
 *   effectiveCombiKw      = ratedKw × foulingFactor
 *   effectiveWarmupLag    = baseLagSeconds / foulingFactor
 *   standingLossKwh       = nominalStandingLossKwh × (1 / insulationFactor)
 *   reheatKw              = nominalReheatKw × coilTransferFactor
 */

// ─── Input Interfaces ─────────────────────────────────────────────────────────

/**
 * WaterConditionInputs
 *
 * Water quality context. hardnessBand is typically derived from postcode
 * lookup. softenerPresent significantly reduces scale risk on both plate HEX
 * and cylinder coil.
 */
export interface WaterConditionInputs {
  hardnessBand: 'soft' | 'moderate' | 'hard' | 'very_hard';
  softenerPresent: boolean;
  scalingRiskBand?: 'low' | 'medium' | 'high';
}

/**
 * UsageInputs
 *
 * DHW demand context. dhwUseBand is the primary usage driver — derive it via
 * inferDhwUseBand() when it is not supplied directly.
 */
export interface UsageInputs {
  dhwUseBand: 'low' | 'moderate' | 'high' | 'very_high';
  occupancy: number;
  simultaneousUseLikely: boolean;
}

/**
 * PlateHexInputs
 *
 * Component-specific inputs for the combi plate HEX condition model.
 * hotWaterPerformanceBand is the primary signal; applianceAgeYears is
 * a supporting input only.
 */
export interface PlateHexInputs {
  /** Combi appliance age in years — supporting input. */
  applianceAgeYears?: number;
  /**
   * Observed combi hot-water performance.
   * Ask: "How is the hot water performing?"
   * Defaults to 'good' when absent (lowest-alarm fallback).
   */
  hotWaterPerformanceBand?: 'good' | 'slightly_reduced' | 'fluctuating' | 'poor';
}

/**
 * CylinderInputs
 *
 * Component-specific inputs for the cylinder condition model.
 * cylinderType and retentionBand are the primary signals; ageBand is
 * a supporting input only.
 */
export interface CylinderInputs {
  /** Cylinder construction type — governs insulation baseline. */
  cylinderType: 'modern_factory' | 'foam_lagged' | 'copper' | 'mixergy' | 'unknown';
  /**
   * Approximate age band — supporting input.
   * Prefer retentionBand + cylinderType as primary condition drivers.
   */
  ageBand?: '<5' | '5-10' | '10-20' | '20+';
  /**
   * Observed hot-water retention / recovery performance.
   * Ask: "How well does the cylinder hold heat?"
   * Defaults to 'good' when absent (lowest-alarm fallback).
   */
  retentionBand?: 'good' | 'average' | 'poor';
}

// ─── Output Interfaces ────────────────────────────────────────────────────────

/**
 * PlateHexCondition
 *
 * Inferred condition of the combi plate heat exchanger.
 * foulingFactor (≤ 1.0) is applied by the physics layer:
 *   effectiveCombiKw   = ratedKw × foulingFactor
 *   effectiveWarmupLag = baseLagSeconds / foulingFactor
 */
export interface PlateHexCondition {
  conditionBand: 'good' | 'moderate' | 'poor' | 'severe';
  /** 1.0 = clean; 0.7 = severely fouled. */
  foulingFactor: number;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * CylinderCondition
 *
 * Inferred condition of the hot-water cylinder.
 *   standingLossKwh = nominalStandingLossKwh × (1 / insulationFactor)
 *   reheatKw        = nominalReheatKw × coilTransferFactor
 */
export interface CylinderCondition {
  /** 1.0 = as-new insulation; lower values increase standing loss. */
  insulationFactor: number;
  /** 1.0 = clean coil; lower values reduce reheat rate. */
  coilTransferFactor: number;
  conditionBand: 'good' | 'moderate' | 'poor' | 'severe';
  confidence: 'low' | 'medium' | 'high';
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Plate HEX fouling score thresholds
const PLATE_HEX_MODERATE_SCORE = 3;
const PLATE_HEX_POOR_SCORE     = 6;
const PLATE_HEX_SEVERE_SCORE   = 9;

// Plate HEX fouling factors per band
const FOULING_FACTOR_GOOD     = 1.00;
const FOULING_FACTOR_MODERATE = 0.90;
const FOULING_FACTOR_POOR     = 0.80;
const FOULING_FACTOR_SEVERE   = 0.70;

// Cylinder coil score thresholds
const COIL_MODERATE_SCORE = 2;
const COIL_POOR_SCORE     = 4;
const COIL_SEVERE_SCORE   = 6;

// Cylinder coil transfer factors per band
const COIL_FACTOR_GOOD     = 1.00;
const COIL_FACTOR_MODERATE = 0.90;
const COIL_FACTOR_POOR     = 0.80;
const COIL_FACTOR_SEVERE   = 0.70;

// Insulation factor baselines by cylinder type
const INSULATION_BASELINE: Record<CylinderInputs['cylinderType'], number> = {
  modern_factory: 0.97,
  foam_lagged:    0.88,
  copper:         0.80,
  mixergy:        0.98,
  unknown:        0.88,
};

// ─── DHW Use Band Helper ──────────────────────────────────────────────────────

/**
 * inferDhwUseBand
 *
 * Derives a DHW usage intensity band from occupancy count, bathroom count, and
 * optional peak-concurrent-outlet count. Use this to produce
 * UsageInputs.dhwUseBand when it is not supplied directly.
 *
 * 3 or more concurrent outlets always yields very_high regardless of occupancy.
 *
 * Score-based thresholds (when outlets < 3):
 *   occupancy ≥ 5 → +3, ≥ 4 → +2, ≥ 3 → +1
 *   bathrooms ≥ 3 → +2, ≥ 2 → +1
 *   peakOutlets ≥ 2 → +1
 *
 * Bands: 0 → low, 1 → moderate, 2-3 → high, 4+ → very_high
 */
export function inferDhwUseBand(
  occupancy: number,
  bathroomCount: number,
  peakConcurrentOutlets?: number,
): UsageInputs['dhwUseBand'] {
  // 3+ concurrent outlets is always very_high demand
  if ((peakConcurrentOutlets ?? 0) >= 3) return 'very_high';

  let score = 0;

  if (occupancy >= 5)      score += 3;
  else if (occupancy >= 4) score += 2;
  else if (occupancy >= 3) score += 1;

  if (bathroomCount >= 3)      score += 2;
  else if (bathroomCount >= 2) score += 1;

  if ((peakConcurrentOutlets ?? 0) >= 2) score += 1;

  if (score >= 4) return 'very_high';
  if (score >= 2) return 'high';
  if (score >= 1) return 'moderate';
  return 'low';
}

// ─── Plate HEX Inference ─────────────────────────────────────────────────────

/**
 * inferPlateHexCondition
 *
 * Infers the combi plate HEX condition from water quality, usage intensity,
 * and observed hot-water performance symptoms.
 *
 * Performance band is the dominant driver. Water hardness (without a softener)
 * and usage intensity amplify risk. Age is a supporting factor only.
 *
 * Fouling score (higher = worse):
 *   Performance band (primary):  good=0 / slightly_reduced=3 / fluctuating=4 / poor=6
 *   Water hardness (no softener): soft=0 / moderate=1 / hard=2 / very_hard=3
 *   Water hardness (softener):    0 / 0 / 0 / very_hard=1 (residual risk)
 *   Usage intensity:              low=0 / moderate=0 / high=1 / very_high=2
 *   Age (supporting):             <10yr=0 / ≥10yr=1 / ≥15yr=2
 *
 * Condition bands:
 *   0-2 → good      (foulingFactor 1.00)
 *   3-5 → moderate  (foulingFactor 0.90)
 *   6-8 → poor      (foulingFactor 0.80)
 *   9+  → severe    (foulingFactor 0.70)
 */
export function inferPlateHexCondition(
  water: WaterConditionInputs,
  usage: UsageInputs,
  hex: PlateHexInputs,
): PlateHexCondition {
  let score = 0;

  // Performance band — dominant driver
  const performanceBand = hex.hotWaterPerformanceBand ?? 'good';
  switch (performanceBand) {
    case 'slightly_reduced': score += 3; break;
    case 'fluctuating':      score += 4; break;
    case 'poor':             score += 6; break;
    case 'good':
    default:                             break;
  }

  // Water hardness (adjusted for softener)
  if (!water.softenerPresent) {
    switch (water.hardnessBand) {
      case 'very_hard': score += 3; break;
      case 'hard':      score += 2; break;
      case 'moderate':  score += 1; break;
      case 'soft':
      default:                       break;
    }
  } else {
    // Softener eliminates most scale risk; residual risk in very hard areas only
    if (water.hardnessBand === 'very_hard') score += 1;
  }

  // Usage intensity
  switch (usage.dhwUseBand) {
    case 'very_high': score += 2; break;
    case 'high':      score += 1; break;
    default:                       break;
  }

  // Age — supporting factor only
  const age = hex.applianceAgeYears ?? 0;
  if (age >= 15)      score += 2;
  else if (age >= 10) score += 1;

  // Map score to condition band and fouling factor
  let conditionBand: PlateHexCondition['conditionBand'];
  let foulingFactor: number;

  if (score >= PLATE_HEX_SEVERE_SCORE) {
    conditionBand = 'severe';
    foulingFactor = FOULING_FACTOR_SEVERE;
  } else if (score >= PLATE_HEX_POOR_SCORE) {
    conditionBand = 'poor';
    foulingFactor = FOULING_FACTOR_POOR;
  } else if (score >= PLATE_HEX_MODERATE_SCORE) {
    conditionBand = 'moderate';
    foulingFactor = FOULING_FACTOR_MODERATE;
  } else {
    conditionBand = 'good';
    foulingFactor = FOULING_FACTOR_GOOD;
  }

  // Confidence: high when we have a specific performance band AND hardness data;
  // medium when we have one of those signals; low when relying on defaults only.
  const hasPerformanceSignal = hex.hotWaterPerformanceBand !== undefined;
  const hasHardnessSignal    = water.hardnessBand !== 'soft';

  const confidence: PlateHexCondition['confidence'] =
    hasPerformanceSignal && hasHardnessSignal ? 'high' :
    hasPerformanceSignal || hasHardnessSignal ? 'medium' :
    'low';

  return { conditionBand, foulingFactor, confidence };
}

// ─── Cylinder Inference ───────────────────────────────────────────────────────

/**
 * inferCylinderCondition
 *
 * Infers the hot-water cylinder condition from cylinder type, age band, water
 * quality, usage intensity, and observed retention / recovery symptoms.
 *
 * insulationFactor:
 *   Baseline from cylinder type; reduced by age and retention symptoms.
 *   modern_factory=0.97, mixergy=0.98, foam_lagged=0.88, copper=0.80, unknown=0.88
 *
 * coilTransferFactor:
 *   Scored from water hardness, usage intensity, age, and retention symptoms.
 *
 * Overall conditionBand = worst of insulation and coil bands.
 */
export function inferCylinderCondition(
  water: WaterConditionInputs,
  usage: UsageInputs,
  cyl: CylinderInputs,
): CylinderCondition {

  // ── Insulation factor ───────────────────────────────────────────────────────
  let insulationFactor = INSULATION_BASELINE[cyl.cylinderType];

  // Age degradation of insulation
  switch (cyl.ageBand) {
    case '20+':   insulationFactor -= 0.06; break;
    case '10-20': insulationFactor -= 0.03; break;
    case '5-10':  insulationFactor -= 0.01; break;
    default:                                break;
  }

  // Retention symptoms
  const retentionBand = cyl.retentionBand ?? 'good';
  switch (retentionBand) {
    case 'poor':    insulationFactor -= 0.08; break;
    case 'average': insulationFactor -= 0.03; break;
    default:                                  break;
  }

  insulationFactor = Math.max(0.65, parseFloat(insulationFactor.toFixed(2)));

  // ── Coil transfer factor ────────────────────────────────────────────────────
  let coilScore = 0;

  // Water hardness (main scale driver on coil)
  if (!water.softenerPresent) {
    switch (water.hardnessBand) {
      case 'very_hard': coilScore += 3; break;
      case 'hard':      coilScore += 2; break;
      case 'moderate':  coilScore += 1; break;
      default:                           break;
    }
  } else {
    // Softener residual risk
    if (water.hardnessBand === 'very_hard') coilScore += 1;
  }

  // Usage intensity
  switch (usage.dhwUseBand) {
    case 'very_high': coilScore += 2; break;
    case 'high':      coilScore += 1; break;
    default:                           break;
  }

  // Age
  switch (cyl.ageBand) {
    case '20+':   coilScore += 2; break;
    case '10-20': coilScore += 1; break;
    default:                       break;
  }

  // Retention symptoms (imply coil fouling as well as insulation loss)
  switch (retentionBand) {
    case 'poor':    coilScore += 2; break;
    case 'average': coilScore += 1; break;
    default:                         break;
  }

  let coilTransferFactor: number;
  if (coilScore >= COIL_SEVERE_SCORE) {
    coilTransferFactor = COIL_FACTOR_SEVERE;
  } else if (coilScore >= COIL_POOR_SCORE) {
    coilTransferFactor = COIL_FACTOR_POOR;
  } else if (coilScore >= COIL_MODERATE_SCORE) {
    coilTransferFactor = COIL_FACTOR_MODERATE;
  } else {
    coilTransferFactor = COIL_FACTOR_GOOD;
  }

  // ── Overall condition band ──────────────────────────────────────────────────
  const conditionBand = worstBand(
    insulationBandFor(insulationFactor),
    coilBandFor(coilTransferFactor),
  );

  // ── Confidence ──────────────────────────────────────────────────────────────
  const hasTypeSignal      = cyl.cylinderType !== 'unknown';
  const hasRetentionSignal = cyl.retentionBand !== undefined && cyl.retentionBand !== 'good';

  const confidence: CylinderCondition['confidence'] =
    hasTypeSignal && hasRetentionSignal ? 'high' :
    hasTypeSignal || hasRetentionSignal ? 'medium' :
    'low';

  return { insulationFactor, coilTransferFactor, conditionBand, confidence };
}

// ─── Boiler Condition Inference ───────────────────────────────────────────────

/**
 * BoilerConditionInputs
 *
 * Signals used to infer boiler-side condition. These are distinct from
 * DHW-side degradation (plate HEX fouling, cylinder insulation/coil).
 *
 * Age and condensing status are the primary drivers. Oversize band captures
 * short-cycling stress. Surveyor symptom flags are supporting inputs.
 */
export interface BoilerConditionInputs {
  /** Boiler age in years — primary degradation driver. */
  ageYears?: number;
  /** Condensing capability declared or inferred from the boiler. */
  condensing?: 'yes' | 'no' | 'unknown';
  /**
   * Oversize band from BoilerSizingModule — proxy for short-cycling stress.
   * Aggressive oversizing increases on/off frequency and reduces in-home efficiency.
   */
  oversizeBand?: 'well_matched' | 'mild_oversize' | 'oversized' | 'aggressive';
  /** Surveyor-observed boiler noise or cavitation — direct sign of combustion/flow stress. */
  boilerCavitationOrNoise?: boolean;
  /**
   * History of repeated pump or valve replacements — indicates system contamination
   * that also stresses the boiler primary circuit.
   */
  repeatedPumpOrValveReplacements?: boolean;
}

/**
 * BoilerCondition
 *
 * Inferred boiler-side condition. Distinct from plate HEX and cylinder condition.
 *
 * This covers combustion/modulation/condensing/cycling degradation only.
 * It does not capture DHW-side (plate HEX fouling) or storage-side (cylinder) issues.
 */
export interface BoilerCondition {
  conditionBand: 'good' | 'moderate' | 'poor' | 'severe';
  confidence: 'low' | 'medium' | 'high';
}

// Boiler condition score thresholds
const BOILER_MODERATE_SCORE = 3;
const BOILER_POOR_SCORE     = 6;
const BOILER_SEVERE_SCORE   = 9;

/**
 * inferBoilerCondition
 *
 * Infers boiler-side condition from age, condensing status, oversizing (cycling
 * stress), and surveyor-observed symptoms.
 *
 * Boiler condition covers combustion / modulation / condensing / cycling
 * degradation only. It is entirely separate from plate HEX fouling (DHW side)
 * and cylinder condition (storage side).
 *
 * Scoring (higher = worse):
 *   Age:                          ≥20yr=4 / ≥15yr=3 / ≥12yr=2 / ≥8yr=1 / <8yr=0
 *   Non-condensing:               'no'=3 / 'unknown'+age≥15=1 / otherwise=0
 *   Oversize / cycling stress:    aggressive=3 / oversized=2 / mild_oversize=1
 *   Boiler cavitation or noise:   +2
 *   Repeated pump/valve failures: +1
 *
 * Condition bands:
 *   0-2 → good
 *   3-5 → moderate
 *   6-8 → poor
 *   9+  → severe
 */
export function inferBoilerCondition(
  inputs: BoilerConditionInputs,
): BoilerCondition {
  let score = 0;

  // Age — primary degradation driver
  const age = inputs.ageYears ?? 0;
  if (age >= 20)      score += 4;
  else if (age >= 15) score += 3;
  else if (age >= 12) score += 2;
  else if (age >= 8)  score += 1;

  // Non-condensing penalty
  if (inputs.condensing === 'no') {
    score += 3;
  } else if (inputs.condensing === 'unknown' && age >= 15) {
    // Old unknown — likely non-condensing (pre-2005 era)
    score += 1;
  }

  // Oversize / cycling stress
  const OVERSIZE_SCORE: Partial<Record<NonNullable<BoilerConditionInputs['oversizeBand']>, number>> = {
    aggressive:    3,
    oversized:     2,
    mild_oversize: 1,
  };
  score += OVERSIZE_SCORE[inputs.oversizeBand ?? 'well_matched'] ?? 0;

  // Surveyor symptoms
  if (inputs.boilerCavitationOrNoise)          score += 2;
  if (inputs.repeatedPumpOrValveReplacements)  score += 1;

  // Map score to condition band
  let conditionBand: BoilerCondition['conditionBand'];
  if (score >= BOILER_SEVERE_SCORE) {
    conditionBand = 'severe';
  } else if (score >= BOILER_POOR_SCORE) {
    conditionBand = 'poor';
  } else if (score >= BOILER_MODERATE_SCORE) {
    conditionBand = 'moderate';
  } else {
    conditionBand = 'good';
  }

  // Confidence: high when age AND condensing status are known;
  // medium when one signal is present; low when relying on defaults only.
  const hasAgeSignal        = inputs.ageYears !== undefined;
  const hasCondensingSignal = inputs.condensing !== undefined && inputs.condensing !== 'unknown';

  const confidence: BoilerCondition['confidence'] =
    hasAgeSignal && hasCondensingSignal ? 'high' :
    hasAgeSignal || hasCondensingSignal ? 'medium' :
    'low';

  return { conditionBand, confidence };
}

// ─── Internal band helpers ────────────────────────────────────────────────────

type ConditionBand4 = PlateHexCondition['conditionBand'];

function insulationBandFor(factor: number): ConditionBand4 {
  if (factor >= 0.95) return 'good';
  if (factor >= 0.85) return 'moderate';
  if (factor >= 0.75) return 'poor';
  return 'severe';
}

function coilBandFor(factor: number): ConditionBand4 {
  if (factor >= 0.95) return 'good';
  if (factor >= 0.85) return 'moderate';
  if (factor >= 0.75) return 'poor';
  return 'severe';
}

const BAND_ORDER: ConditionBand4[] = ['good', 'moderate', 'poor', 'severe'];

function worstBand(a: ConditionBand4, b: ConditionBand4): ConditionBand4 {
  return BAND_ORDER.indexOf(a) >= BAND_ORDER.indexOf(b) ? a : b;
}
