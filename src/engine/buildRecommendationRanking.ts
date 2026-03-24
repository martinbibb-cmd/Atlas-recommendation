/**
 * buildRecommendationRanking — PR12: trade-off tag helpers.
 *
 * PR12 cleanup: removed legacy option-score adjustment functions
 * (computeSpaceRankingAdjustments, computeDisruptionRankingAdjustments,
 * computeMainsFlowRankingAdjustments).  Those functions ranked candidates
 * by adjusting OptionScoringV1 scores — a path that is now superseded by
 * the evidence-backed recommendation engine (buildRecommendationsFromEvidence).
 *
 * What remains here are the two human-readable trade-off tag helpers consumed
 * by buildAdviceFromCompare to surface concise explanations for the simulator
 * compare UI.  These are presentation helpers, not ranking logic.
 */

import type { EngineInputV2_3 } from './schema/EngineInputV2_3';

/** Reasoning tag: space constraint drives combi preference. */
const TAG_SPACE_CONSTRAINED = 'Space constrained — combi preferred';
/** Reasoning tag: high demand overrides space preference. */
const TAG_HIGH_DEMAND_OVERRIDE = 'High demand — stored hot water required despite space impact';

/** Reasoning tag: low disruption tolerance drives lower-upheaval path. */
const TAG_LOW_DISRUPTION = 'Lower-disruption path preferred due to household installation tolerance';
/** Reasoning tag: high disruption tolerance allows upgrade-heavy pathway. */
const TAG_HIGH_DISRUPTION = 'Heat pump remains a strong option because major upgrade works are acceptable';

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

/**
 * Derive a human-readable disruption trade-off tag for advice output.
 *
 * Used by buildAdviceFromCompare to surface a concise explanation of
 * why a particular system was recommended given the user's disruption tolerance.
 *
 * @param systemType      The recommended system type ('combi' | 'stored' | 'heat_pump').
 * @param input           Engine input containing preferences.
 * @returns               Explanation tag string, or null when no disruption trade-off applies.
 */
export function deriveDisruptionTradeOffTag(
  systemType: 'combi' | 'stored' | 'heat_pump',
  input: EngineInputV2_3,
): string | null {
  const tolerance = input.preferences?.disruptionTolerance ?? 'medium';

  if (tolerance === 'medium') return null;

  if (tolerance === 'low') {
    // Combi or basic stored — lower-disruption path preferred
    if (systemType === 'combi' || systemType === 'stored') {
      return TAG_LOW_DISRUPTION;
    }
  }

  if (tolerance === 'high') {
    // Heat pump path — major enabling works acceptable
    if (systemType === 'heat_pump') {
      return TAG_HIGH_DISRUPTION;
    }
  }

  return null;
}
