/**
 * types.ts
 *
 * Core type definitions for the PR 4 Recommended Upgrades Engine.
 *
 * The engine consumes a selected system spec and classified day outcomes
 * (from PR 3) and returns a deterministic package of recommended upgrades
 * with reasons and expected-effect tags.
 */

import type { HouseholdComposition } from '../../engine/schema/EngineInputV2_3';
import type { ClassifiedDaySchedule, OutcomeSystemSpec } from '../outcomes/types';

// ─── Upgrade taxonomy ─────────────────────────────────────────────────────────

/** Broad grouping used to cluster upgrades in the UI. */
export type UpgradeCategory =
  | 'water'
  | 'protection'
  | 'controls'
  | 'infrastructure';

/**
 * Intent tags that describe the expected improvement an upgrade will deliver.
 * These are consumed by PR 5 when re-running events against the upgraded spec.
 */
export type UpgradeEffectTag =
  | 'reduces_conflict'
  | 'reduces_reduced_events'
  | 'improves_bath_fill'
  | 'improves_hot_water_recovery'
  | 'improves_heating_stability'
  | 'improves_low_temp_suitability'
  | 'protects_system';

/** Discrete kinds of upgrade that the engine can recommend. */
export type UpgradeKind =
  | 'cylinder_size'
  | 'cylinder_type'
  | 'combi_size'
  | 'system_clean'
  | 'magnetic_filter'
  | 'controls_upgrade'
  | 'system_controls_plan'
  | 'primary_pipe_upgrade';

// ─── Upgrade model ────────────────────────────────────────────────────────────

/** A single recommended upgrade with reasoning and expected-effect metadata. */
export interface RecommendedUpgrade {
  /** Machine-readable kind identifier. */
  kind: UpgradeKind;
  /** Display grouping for the upgrade. */
  category: UpgradeCategory;
  /** Short human-readable label (e.g. "35 kW combi boiler"). */
  label: string;
  /** Explanation of why this upgrade was suggested for this household. */
  reason: string;
  /** Expected improvement tags, consumed by PR 5 re-simulation. */
  effectTags: UpgradeEffectTag[];
  /** Relative importance of this upgrade within the package. */
  priority: 'essential' | 'recommended' | 'best_fit';
  /**
   * Optional scalar or string value qualifying the upgrade
   * (e.g. cylinder size in litres, pipe bore in mm, boiler output in kW).
   */
  value?: string | number;
}

/** The full upgrade package produced for a given system and outcome set. */
export interface RecommendedUpgradePackage {
  /** System type the package is targeted at. */
  systemType: 'combi' | 'stored_water' | 'heat_pump';
  /** Ordered list of recommended upgrades. */
  upgrades: RecommendedUpgrade[];
}

// ─── Engine inputs ────────────────────────────────────────────────────────────

/**
 * All inputs required by the recommended-upgrades engine.
 *
 * systemSpec and outcomes come from PR 3; the remaining fields are optional
 * survey / engine context that sharpen upgrade recommendations.
 */
export interface RecommendUpgradesInputs {
  /** System specification evaluated by the PR 3 classifier. */
  systemSpec: OutcomeSystemSpec;
  /** Classified event schedule produced by PR 3. */
  outcomes: ClassifiedDaySchedule;

  // ── Survey / engine context ────────────────────────────────────────────────
  /** Nominal bore of the primary distribution pipework (mm). */
  primaryPipeSizeMm?: 15 | 22 | 28 | 35;
  /** Number of bathrooms (including en-suites) in the property. */
  bathroomCount?: number;
  /** Dynamic mains pressure at the property inlet (bar). */
  mainsDynamicPressureBar?: number;
  /** Household composition used for cylinder sizing heuristics. */
  householdComposition?: HouseholdComposition;
  /** Assessed condition of the primary system (scale / sludge / wear). */
  systemCondition?: 'clean' | 'average' | 'poor';
  /** Overall quality of zone controls / programmer / smart thermostat. */
  controlsQuality?: 'basic' | 'good' | 'excellent';
  /** Bath use frequency — used as a stored-water sizing helper. */
  bathUse?: 'rare' | 'sometimes' | 'frequent';
}
