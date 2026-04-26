/**
 * ScenarioResult.ts — A single evaluated scenario option.
 *
 * Each scenario represents one possible system type (combi, system, regular, ashp)
 * assessed against the property's physics constraints. The ScenarioResult captures
 * the performance bands, key benefits/constraints, day-to-day outcomes, required
 * works, upgrade paths, and physics flags for that system type.
 *
 * Used by buildDecisionFromScenarios to select the recommended scenario and populate
 * AtlasDecisionV1.
 */

export type PerformanceBand =
  | 'excellent'
  | 'very_good'
  | 'good'
  | 'needs_setup'
  | 'poor';

export type ScenarioSystemType = 'combi' | 'system' | 'regular' | 'ashp';

/** Physics constraint flags surfaced per scenario for later visual rendering. */
export interface ScenarioPhysicsFlags {
  /** True when the primary pipe diameter limits achievable flow rate. */
  hydraulicLimit?: boolean;
  /** True when simultaneous DHW demand exceeds combi flow capacity. */
  combiFlowRisk?: boolean;
  /** True when the system requires ≥ 65 °C flow for existing emitters. */
  highTempRequired?: boolean;
  /** True when mains pressure constrains unvented or combi DHW performance. */
  pressureConstraint?: boolean;
}

/** Assessed performance across four dimensions for a single scenario. */
export interface ScenarioPerformance {
  hotWater: PerformanceBand;
  heating: PerformanceBand;
  efficiency: PerformanceBand;
  reliability: PerformanceBand;
}

/**
 * ScenarioResult
 *
 * One evaluated system option. A recommendation run typically produces 2–4
 * ScenarioResult entries (one per viable system type), from which
 * buildDecisionFromScenarios selects the recommended scenario.
 */
export interface ScenarioResult {
  /** Unique identifier for this scenario, e.g. 'combi', 'system_unvented'. */
  scenarioId: string;

  /** System type and display summary. */
  system: {
    type: ScenarioSystemType;
    summary: string;
  };

  /** Performance band assessments across four dimensions. */
  performance: ScenarioPerformance;

  /** Primary reasons this scenario excels for this property. */
  keyBenefits: string[];

  /** Primary limitations or trade-offs for this scenario. */
  keyConstraints: string[];

  /** What the customer will experience day-to-day with this system. */
  dayToDayOutcomes: string[];

  /** Works that must be carried out to install this scenario. */
  requiredWorks: string[];

  /** Future system upgrades that this scenario enables or supports. */
  upgradePaths: string[];

  /** Physics constraint flags — used for visual callouts and engineer notes. */
  physicsFlags: ScenarioPhysicsFlags;

  /**
   * Hard physics failures that disqualify this scenario (fail-severity engine flags).
   * Populated from the option card's fail-status planes and rejection reasons.
   */
  hardConstraints?: string[];

  /**
   * Warn-level performance degradation notes for this scenario.
   * Examples: short-draw efficiency collapse, reduced flow at low pressure.
   */
  performancePenalties?: string[];
}
