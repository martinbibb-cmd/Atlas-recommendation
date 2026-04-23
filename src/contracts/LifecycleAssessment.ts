/**
 * LifecycleAssessment.ts — Current-system lifecycle model.
 *
 * Captures the age, condition band, adjusted lifespan, influencing factors,
 * risk indicators, and human-readable summary for the existing boiler or
 * heating system. This is physics-grounded (scale accumulation, usage wear,
 * maintenance level) and deliberately avoids predicting exact remaining years.
 *
 * Design rules:
 *  - condition band (good / average / worn / at_risk) is what the customer sees.
 *  - adjustedRangeYears is derived from baseline + influencing factors — never
 *    presented as "X years remaining".
 *  - summary uses approved terminology from docs/atlas-terminology.md.
 */

export type LifecycleBoilerType = 'combi' | 'system' | 'regular';

export type LifecycleCondition =
  | 'unknown'
  | 'good'
  | 'average'
  | 'worn'
  | 'at_risk';

export type WaterQualityBand =
  | 'soft'
  | 'moderate'
  | 'hard'
  | 'very_hard'
  | 'unknown';

export type ScaleRiskBand = 'low' | 'medium' | 'high';

export type UsageIntensityBand = 'low' | 'medium' | 'high';

export type MaintenanceLevel = 'unknown' | 'poor' | 'average' | 'good';

/** Factors that influence the adjusted lifespan estimate. */
export interface LifecycleInfluencingFactors {
  /** Water hardness category from postcode / survey. */
  waterQuality: WaterQualityBand;
  /** Scale risk derived from water quality + DHW symptoms + system age. */
  scaleRisk: ScaleRiskBand;
  /** DHW + heating usage intensity derived from occupancy and bathroom count. */
  usageIntensity: UsageIntensityBand;
  /** Maintenance history level declared by the customer or inferred from survey. */
  maintenanceLevel: MaintenanceLevel;
}

/**
 * LifecycleAssessment
 *
 * Produced by buildLifecycleAssessment. Embedded in AtlasDecisionV1 and used
 * by the customer visualisation (timeline bar) and engineer prep surface.
 *
 * Important: typicalRangeYears reflects the BASE_LIFESPAN for this boiler type.
 * adjustedRangeYears is the physics-adjusted range after applying influencing
 * factors. Neither range should be presented to the customer as a prediction
 * of exact remaining service life.
 */
export interface LifecycleAssessment {
  currentSystem: {
    type: LifecycleBoilerType;
    /** Approximate age in years from the survey input. */
    ageYears: number;
    /** Condition band derived from age vs adjusted lifespan. */
    condition: LifecycleCondition;
  };

  expectedLifespan: {
    /** Industry baseline lifespan for this boiler type (unmodified). */
    typicalRangeYears: [number, number];
    /** Lifespan range after applying influencing factors. */
    adjustedRangeYears: [number, number];
  };

  /** Physics-grounded factors that adjust the lifespan estimate. */
  influencingFactors: LifecycleInfluencingFactors;

  /**
   * Observable or inferred risk signals for this specific system.
   * Shown to engineers and in the portal "proof" layer.
   */
  riskIndicators: string[];

  /** Human-readable condition summary for the customer surface. */
  summary: string;
}
