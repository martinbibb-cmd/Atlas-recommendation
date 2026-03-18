/**
 * buildRecommendationRanking
 *
 * Derives space-priority score adjustments for recommendation ranking.
 *
 * This module implements the "preferences axis" — a user-expressed preference
 * dimension that sits alongside the physics-based eligibility gates.
 *
 * Rules:
 *  - Physics guardrails always win: high demand and low flow penalties cannot
 *    be overridden by space preference.
 *  - combi (on-demand DHW) gains a positive boost when spacePriority is high/medium.
 *  - Stored-cylinder options (stored_vented, stored_unvented, system_unvented, ashp)
 *    receive a penalty proportional to spacePriority.
 *  - All adjustments are additive on top of the base option score.
 */

import type { EngineInputV2_3 } from './schema/EngineInputV2_3';
import type { OptionCardV1 } from '../contracts/EngineOutputV1';

/** Option IDs that require a stored hot-water cylinder. */
const REQUIRES_CYLINDER_IDS: ReadonlySet<OptionCardV1['id']> = new Set([
  'stored_vented', 'stored_unvented', 'system_unvented', 'ashp',
]);

/** Maximum score penalty applied to stored systems at spacePriority='high'. */
const MAX_STORED_PENALTY = 15;

/** Maximum score boost applied to combi at spacePriority='high'. */
const MAX_COMBI_BOOST = 12;

/** Guard rail: always penalise combi when DHW demand is high. */
const HIGH_DEMAND_COMBI_PENALTY = 20;

/** Guard rail: always penalise combi when mains flow is too low to sustain delivery. */
const LOW_FLOW_COMBI_PENALTY = 25;

/**
 * Minimum mains flow (L/min) below which combi is considered pressure/flow-limited.
 * Mirrors the ignition threshold in CombiDhwModule.ts.
 */
const LOW_FLOW_THRESHOLD_LPM = 2.5;

/**
 * Resolved space weight for the three priority levels.
 * Used as a multiplier on stored penalties and combi boosts.
 */
const SPACE_WEIGHT: Record<NonNullable<EngineInputV2_3['preferences']>['spacePriority'] & string, number> = {
  low:    0,
  medium: 0.5,
  high:   1,
};

/** Reasoning tag: space constraint drives combi preference. */
const TAG_SPACE_CONSTRAINED = 'Space constrained — combi preferred';
/** Reasoning tag: high demand overrides space preference. */
const TAG_HIGH_DEMAND_OVERRIDE = 'High demand — stored hot water required despite space impact';

export interface SpaceRankingAdjustment {
  /** Additive score delta (positive = boost, negative = penalty). */
  delta: number;
  /** Human-readable label for score breakdown. */
  label: string;
  /** Penalty/boost ID for the score breakdown. */
  id: string;
}

/**
 * Compute the space-priority score adjustment for a single option.
 *
 * @param optionId  The option card ID (e.g. 'combi', 'stored_unvented').
 * @param input     The engine input containing preferences and DHW signals.
 * @returns         Array of adjustments to apply to the option score.
 */
export function computeSpaceRankingAdjustments(
  optionId: OptionCardV1['id'],
  input: EngineInputV2_3,
): SpaceRankingAdjustment[] {
  const adjustments: SpaceRankingAdjustment[] = [];

  const spacePriority = input.preferences?.spacePriority ?? 'low';
  const spaceWeight = SPACE_WEIGHT[spacePriority] ?? 0;

  // ── Stored-cylinder penalty ───────────────────────────────────────────────
  if (REQUIRES_CYLINDER_IDS.has(optionId) && spaceWeight > 0) {
    const penalty = Math.round(MAX_STORED_PENALTY * spaceWeight);
    adjustments.push({
      delta: -penalty,
      label: spacePriority === 'high'
        ? 'Space constrained — cylinder install disadvantaged'
        : 'Space preference — compact system preferred',
      id: spacePriority === 'high'
        ? 'space_pref.high_stored'
        : 'space_pref.medium_stored',
    });
  }

  // ── Combi boost ───────────────────────────────────────────────────────────
  if (optionId === 'combi' && spaceWeight > 0) {
    const boost = Math.round(MAX_COMBI_BOOST * spaceWeight);

    // Resolve mains flow (nested object takes priority)
    const flowLpm = input.mains?.flowRateLpm ?? input.mainsDynamicFlowLpm;
    const isLowFlow = flowLpm != null && flowLpm < LOW_FLOW_THRESHOLD_LPM;

    // Resolve high-demand signal from occupancy
    const isHighDemand =
      (input.occupancyCount != null && input.occupancyCount >= 4) ||
      (input.peakConcurrentOutlets != null && input.peakConcurrentOutlets >= 2) ||
      (input.bathroomCount != null && input.bathroomCount >= 2);

    if (boost > 0) {
      adjustments.push({
        delta: boost,
        label: 'Space constrained — compact on-demand system preferred',
        id: 'space_pref.combi_boost',
      });
    }

    // Physics guardrails — override the boost with hard penalties
    if (isHighDemand) {
      adjustments.push({
        delta: -HIGH_DEMAND_COMBI_PENALTY,
        label: 'High DHW demand — stored hot water required despite space preference',
        id: 'space_pref.high_demand_override',
      });
    }

    if (isLowFlow) {
      adjustments.push({
        delta: -LOW_FLOW_COMBI_PENALTY,
        label: 'Low mains flow — combi delivery limited despite space preference',
        id: 'space_pref.low_flow_override',
      });
    }
  }

  return adjustments;
}

/**
 * Derive a human-readable space trade-off tag for advice output.
 *
 * Used by buildAdviceFromCompare to surface a concise explanation of
 * why a particular system was recommended given the user's space preference.
 *
 * @param systemType      The recommended system type ('combi' | 'stored' | 'heat_pump').
 * @param input           Engine input containing preferences and demand signals.
 * @returns               Explanation tag string, or null when no space trade-off applies.
 */
export function deriveSpaceTradeOffTag(
  systemType: 'combi' | 'stored' | 'heat_pump',
  input: EngineInputV2_3,
): string | null {
  const spacePriority = input.preferences?.spacePriority ?? 'low';

  if (spacePriority === 'low') return null;

  const isHighDemand =
    (input.occupancyCount != null && input.occupancyCount >= 4) ||
    (input.peakConcurrentOutlets != null && input.peakConcurrentOutlets >= 2) ||
    (input.bathroomCount != null && input.bathroomCount >= 2);

  if (systemType === 'combi') {
    if (isHighDemand) {
      return TAG_HIGH_DEMAND_OVERRIDE;
    }
    return TAG_SPACE_CONSTRAINED;
  }

  if (systemType === 'stored' || systemType === 'heat_pump') {
    if (isHighDemand) {
      return TAG_HIGH_DEMAND_OVERRIDE;
    }
    if (spacePriority === 'high') {
      return TAG_SPACE_CONSTRAINED;
    }
  }

  return null;
}
