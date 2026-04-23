/**
 * buildLifecycleAssessment.ts — Physics-grounded lifecycle model for the existing system.
 *
 * Derives a condition band (good / average / worn / at_risk) and an adjusted
 * lifespan range from:
 *  - boiler type (combi / system / regular)
 *  - age in years
 *  - water quality / scale risk
 *  - usage intensity (occupancy + bathroom count)
 *  - maintenance level
 *
 * Physics basis:
 *  - Scale reduces heat-exchanger efficiency ~7–25% per mm of deposit.
 *  - Silicate scaffolds in hard-water areas accelerate thermal degradation.
 *  - Heavy cycling and short-draw events increase heat-exchanger fatigue.
 *  - Age degradation is approximately 1–1.4% per year when maintenance is poor.
 *
 * IMPORTANT: The output never states "X years remaining".  The condition band
 * and summary are the customer-facing signal.  The lifespan range is shown in
 * the proof / engineer layer only.
 */

import type {
  LifecycleAssessment,
  LifecycleBoilerType,
  LifecycleCondition,
  LifecycleInfluencingFactors,
  MaintenanceLevel,
  ScaleRiskBand,
  UsageIntensityBand,
  WaterQualityBand,
} from '../../contracts/LifecycleAssessment';

// ─── Baseline lifespan by boiler type ────────────────────────────────────────
// Industry-standard typical service-life ranges (years) for domestic gas boilers.
// Source: HHIC / OFTEC / Gas Safe Register guidance; corroborated by Worcester
// Bosch and Viessmann warranty data.

const BASE_LIFESPAN: Record<LifecycleBoilerType, [number, number]> = {
  combi:   [10, 15],
  system:  [12, 18],
  regular: [15, 25],
};

// ─── Lifespan adjustment ─────────────────────────────────────────────────────

/**
 * adjustLifespan
 *
 * Applies physics-grounded penalties / bonuses to the baseline lifespan range.
 * Returns the adjusted [min, max] tuple with a hard floor of 5 years on min.
 *
 * Adjustments:
 *  - High scale risk       → −2 min, −3 max  (CaCO₃/silicate HX fatigue)
 *  - High usage intensity  → −1 min, −2 max  (cycling + short-draw wear)
 *  - Good maintenance      → +0 min, +2 max  (annual servicing extends upper band)
 */
function adjustLifespan(
  base: [number, number],
  factors: Pick<LifecycleInfluencingFactors, 'scaleRisk' | 'usageIntensity' | 'maintenanceLevel'>,
): [number, number] {
  let [min, max] = base;

  if (factors.scaleRisk === 'high') {
    min -= 2;
    max -= 3;
  }

  if (factors.usageIntensity === 'high') {
    min -= 1;
    max -= 2;
  }

  if (factors.maintenanceLevel === 'good') {
    max += 2;
  }

  return [Math.max(min, 5), max];
}

// ─── Condition band ───────────────────────────────────────────────────────────

/**
 * deriveCondition
 *
 * Maps system age against the adjusted lifespan range to a condition band.
 *
 *  age < 60% of adjusted min  → 'good'    (relatively modern)
 *  age < adjusted min         → 'average' (mid-life)
 *  age < adjusted max         → 'worn'    (approaching end of typical lifespan)
 *  age >= adjusted max        → 'at_risk' (beyond typical lifespan)
 */
function deriveCondition(age: number, adjustedRange: [number, number]): LifecycleCondition {
  const [min, max] = adjustedRange;
  if (age < min * 0.6) return 'good';
  if (age < min)       return 'average';
  if (age < max)       return 'worn';
  return 'at_risk';
}

// ─── Summary copy ─────────────────────────────────────────────────────────────

/**
 * buildLifecycleSummary
 *
 * Returns the customer-facing one-line condition summary.
 * All copy uses approved Atlas terminology (docs/atlas-terminology.md).
 * Never states exact remaining years.
 */
function buildLifecycleSummary(condition: LifecycleCondition): string {
  switch (condition) {
    case 'good':
      return 'Relatively modern — no immediate concerns';
    case 'average':
      return 'Mid-life — performance depends on condition and maintenance';
    case 'worn':
      return 'Approaching end of typical lifespan — reliability may decline';
    case 'at_risk':
      return 'Beyond typical lifespan — elevated risk of failure';
    case 'unknown':
    default:
      return 'Age unknown — condition cannot be assessed without further information';
  }
}

// ─── Risk indicators ──────────────────────────────────────────────────────────

/**
 * buildRiskIndicators
 *
 * Assembles physics-grounded risk signals for the engineer and portal
 * proof layer.  Each entry is a concise, factual statement.
 */
function buildRiskIndicators(
  age: number,
  condition: LifecycleCondition,
  factors: LifecycleInfluencingFactors,
): string[] {
  const indicators: string[] = [];

  if (condition === 'at_risk') {
    indicators.push('System age exceeds the typical upper lifespan for this boiler type');
  } else if (condition === 'worn') {
    indicators.push('System age is within the wear band — elevated failure probability');
  }

  if (factors.scaleRisk === 'high') {
    indicators.push(
      'High scale risk: CaCO₃/silicate deposits accelerate heat-exchanger degradation and reduce efficiency',
    );
  } else if (factors.scaleRisk === 'medium') {
    indicators.push('Moderate scale risk: periodic descaling recommended to maintain DHW performance');
  }

  if (factors.usageIntensity === 'high') {
    indicators.push(
      'High usage intensity: frequent cycling and peak-demand draws increase component wear rate',
    );
  }

  if (factors.maintenanceLevel === 'poor') {
    indicators.push('Poor maintenance history: annual servicing gaps correlate with accelerated boiler wear');
  } else if (factors.maintenanceLevel === 'unknown') {
    indicators.push('Maintenance history unknown — service records should be verified before commissioning');
  }

  if (age >= 20 && factors.waterQuality === 'very_hard') {
    indicators.push(
      'Very hard water over 20+ years: significant scale accumulation on primary and DHW heat exchangers likely',
    );
  }

  return indicators;
}

// ─── Usage intensity derivation ───────────────────────────────────────────────

/**
 * deriveUsageIntensity
 *
 * Maps occupancy count and bathroom count to a usage intensity band.
 * Consistent with the DHW use-band logic in ComponentConditionModule.
 */
function deriveUsageIntensity(
  occupancyCount: number,
  bathroomCount: number,
): UsageIntensityBand {
  if (occupancyCount >= 4 || bathroomCount >= 2) return 'high';
  if (occupancyCount >= 3) return 'medium';
  return 'low';
}

// ─── Scale risk mapping ───────────────────────────────────────────────────────

/**
 * deriveScaleRisk
 *
 * Maps the water quality band (from postcode lookup or survey) to a scale
 * risk band for the lifecycle model.  Mirrors the scale risk logic in
 * SystemConditionInferenceModule but expressed as a simpler three-tier band.
 */
function deriveScaleRisk(waterQuality: WaterQualityBand, ageYears: number): ScaleRiskBand {
  if (waterQuality === 'very_hard') return 'high';
  if (waterQuality === 'hard') return ageYears >= 10 ? 'high' : 'medium';
  if (waterQuality === 'moderate') return ageYears >= 15 ? 'medium' : 'low';
  return 'low';
}

// ─── Public input type ────────────────────────────────────────────────────────

export interface BuildLifecycleAssessmentInput {
  /** Type of the existing boiler/system. */
  boilerType: LifecycleBoilerType;
  /** Approximate age in years. Use 0 when unknown. */
  ageYears: number;
  /** Water hardness category from postcode lookup or survey. */
  waterQuality?: WaterQualityBand;
  /** Number of regularly resident occupants (for usage intensity derivation). */
  occupancyCount?: number;
  /** Number of bathrooms (for usage intensity derivation). */
  bathroomCount?: number;
  /** Maintenance history level declared or inferred from survey. */
  maintenanceLevel?: MaintenanceLevel;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * buildLifecycleAssessment
 *
 * Produces a LifecycleAssessment from survey inputs.  All fields are
 * physics-derived — no heuristic smoothing or random variation.
 *
 * When ageYears === 0 or boilerType is absent, condition defaults to
 * 'unknown' and summary reflects that uncertainty.
 */
export function buildLifecycleAssessment(
  input: BuildLifecycleAssessmentInput,
): LifecycleAssessment {
  const {
    boilerType,
    ageYears,
    waterQuality = 'unknown',
    occupancyCount = 2,
    bathroomCount = 1,
    maintenanceLevel = 'unknown',
  } = input;

  const typicalRange = BASE_LIFESPAN[boilerType];
  const usageIntensity = deriveUsageIntensity(occupancyCount, bathroomCount);
  const scaleRisk = deriveScaleRisk(waterQuality, ageYears);

  const factors: LifecycleInfluencingFactors = {
    waterQuality,
    scaleRisk,
    usageIntensity,
    maintenanceLevel,
  };

  // When age is genuinely unknown (0), skip condition derivation.
  let condition: LifecycleCondition = 'unknown';
  const adjustedRange = adjustLifespan(typicalRange, factors);

  if (ageYears > 0) {
    condition = deriveCondition(ageYears, adjustedRange);
  }

  const riskIndicators = buildRiskIndicators(ageYears, condition, factors);
  const summary = buildLifecycleSummary(condition);

  return {
    currentSystem: {
      type: boilerType,
      ageYears,
      condition,
    },
    expectedLifespan: {
      typicalRangeYears: typicalRange,
      adjustedRangeYears: adjustedRange,
    },
    influencingFactors: factors,
    riskIndicators,
    summary,
  };
}
