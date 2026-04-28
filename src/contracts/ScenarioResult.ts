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

import type { ScenarioDisplayIdentity } from './ScenarioDisplayIdentity';

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

  /**
   * Physics-derived efficiency metric for this scenario.
   *
   * kind 'eta' — boiler seasonal efficiency fraction expressed as percentage
   *               points (e.g. 92 for a 92 % SEDBUK condensing boiler).
   * kind 'cop'  — heat-pump Coefficient of Performance (e.g. 3.3 for ASHP at
   *               design conditions: −3 °C outdoor, 45 °C flow temperature).
   *
   * Absent when the engine cannot resolve a reliable numeric efficiency for
   * this option; the ComparisonMatrix falls back to the PerformanceBand label.
   */
  efficiencyMetric?: {
    kind: 'cop' | 'eta';
    value: number;
  };

  /**
   * Optional DHW subtype for stored-water scenarios.
   *
   * Set to 'mixergy' when the engine's Mixergy recommendation applies —
   * i.e. when the stored-water option is an unvented class but mains supply
   * does not fully meet the standard unvented requirement, making a Mixergy
   * (pressure-tolerant) cylinder the preferred DHW appliance.
   *
   * Engine / contract metadata only — do not branch on this in presentation
   * components.  Use scenario.display (resolved by buildScenarioDisplayIdentity)
   * for all customer-facing copy.
   */
  dhwSubtype?: 'mixergy';

  /**
   * Pre-resolved display identity for this scenario.
   *
   * Populated by buildScenariosFromEngineOutput (and any other adapter that
   * constructs ScenarioResult values).  All customer-facing surfaces must use
   * these fields rather than reconstructing names from system.type or family
   * label maps.
   *
   * When absent (e.g. in unit-test stubs that pre-date this field), callers
   * should fall back to buildScenarioDisplayIdentity(scenario).
   */
  display?: ScenarioDisplayIdentity;
}
