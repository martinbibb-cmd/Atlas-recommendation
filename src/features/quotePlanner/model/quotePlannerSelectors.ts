/**
 * quotePlannerSelectors.ts
 *
 * Pure data-selection helpers for `QuoteInstallationPlanV1`.
 *
 * All functions accept a plan and return plain values.
 * No engine calls, no physics, no mutations.
 *
 * Design rules:
 *   - Read-only: nothing here mutates the plan.
 *   - No React dependencies — usable in selectors, tests, and non-React contexts.
 *   - Confidence summaries reflect the lowest confidence level present.
 */

import type { QuoteInstallationPlanV1 } from './QuoteInstallationPlanV1';
import type {
  QuotePlanLocationV1,
  QuotePlanCandidateRouteV1,
  QuotePlanCandidateFlueRouteV1,
  QuotePlannerLocationKind,
  QuotePlannerRouteType,
} from './QuoteInstallationPlanV1';

// Re-export plan types for selector consumers.
export type {
  QuotePlanLocationV1,
  QuotePlanCandidateRouteV1,
  QuotePlanCandidateFlueRouteV1,
};

// ─── Confidence summary ───────────────────────────────────────────────────────

/**
 * Overall confidence summary for a quote plan.
 *
 * overallConfidence mirrors the lowest-confidence location in the plan:
 *   - 'needs_verification' if any location carries that level.
 *   - 'low'                if any location is 'low' (and none are needs_verification).
 *   - 'medium'             if any location is 'medium' (and none lower).
 *   - 'high'               when all locations are 'high'.
 *   - 'no_locations'       when the plan has no locations yet.
 *
 * `inferredCount`    — locations with provenance 'scan_inferred' (unreviewed).
 * `confirmedCount`   — locations with provenance 'scan_confirmed'.
 * `needsReviewCount` — locations with confidence 'needs_verification'.
 */
export interface QuotePlanConfidenceSummary {
  overallConfidence: 'high' | 'medium' | 'low' | 'needs_verification' | 'no_locations';
  inferredCount:    number;
  confirmedCount:   number;
  needsReviewCount: number;
  totalLocations:   number;
}

// ─── Minimum-data gate ────────────────────────────────────────────────────────

/**
 * The minimum set of location kinds required before the plan can proceed
 * to active planning (as opposed to evidence collection).
 *
 * Requires at least:
 *   - One `proposed_boiler` or `existing_boiler` location.
 *   - One `gas_meter` location.
 */
const MINIMUM_LOCATION_KINDS: QuotePlannerLocationKind[] = [
  'proposed_boiler',
  'existing_boiler',
  'gas_meter',
];

// ─── Selectors ────────────────────────────────────────────────────────────────

/**
 * All locations in the plan that match the given kind.
 */
export function getQuotePlanLocationsByKind(
  plan: QuoteInstallationPlanV1,
  kind: QuotePlannerLocationKind,
): QuotePlanLocationV1[] {
  return plan.locations.filter((loc) => loc.kind === kind);
}

/**
 * The first `proposed_boiler` location in the plan, or `undefined` when absent.
 */
export function getProposedBoilerLocation(
  plan: QuoteInstallationPlanV1,
): QuotePlanLocationV1 | undefined {
  return plan.locations.find((loc) => loc.kind === 'proposed_boiler');
}

/**
 * The first `existing_boiler` location in the plan, or `undefined` when absent.
 */
export function getExistingBoilerLocation(
  plan: QuoteInstallationPlanV1,
): QuotePlanLocationV1 | undefined {
  return plan.locations.find((loc) => loc.kind === 'existing_boiler');
}

/**
 * The first `gas_meter` location in the plan, or `undefined` when absent.
 */
export function getGasMeterLocation(
  plan: QuoteInstallationPlanV1,
): QuotePlanLocationV1 | undefined {
  return plan.locations.find((loc) => loc.kind === 'gas_meter');
}

/**
 * All `flue_terminal` locations in the plan.
 * Returns an empty array when no flue terminal candidates exist.
 */
export function getCandidateFlueTerminalLocations(
  plan: QuoteInstallationPlanV1,
): QuotePlanLocationV1[] {
  return plan.locations.filter((loc) => loc.kind === 'flue_terminal');
}

/**
 * All routes in the plan that match the given route type.
 */
export function getRoutesByType(
  plan: QuoteInstallationPlanV1,
  routeType: QuotePlannerRouteType,
): QuotePlanCandidateRouteV1[] {
  return plan.routes.filter((r) => r.routeType === routeType);
}

/**
 * Derives the confidence summary for the plan's locations.
 *
 * Uses a ranking order: needs_verification < low < medium < high.
 * The `overallConfidence` reflects the lowest rank present.
 */
export function getQuotePlanConfidenceSummary(
  plan: QuoteInstallationPlanV1,
): QuotePlanConfidenceSummary {
  const locations = plan.locations;

  if (locations.length === 0) {
    return {
      overallConfidence: 'no_locations',
      inferredCount: 0,
      confirmedCount: 0,
      needsReviewCount: 0,
      totalLocations: 0,
    };
  }

  let inferredCount    = 0;
  let confirmedCount   = 0;
  let needsReviewCount = 0;

  let hasNeedsVerification = false;
  let hasLow               = false;
  let hasMedium            = false;

  for (const loc of locations) {
    if (loc.provenance === 'scan_inferred') inferredCount++;
    if (loc.provenance === 'scan_confirmed') confirmedCount++;

    if (loc.confidence === 'needs_verification') {
      needsReviewCount++;
      hasNeedsVerification = true;
    } else if (loc.confidence === 'low') {
      hasLow = true;
    } else if (loc.confidence === 'medium') {
      hasMedium = true;
    }
  }

  let overallConfidence: QuotePlanConfidenceSummary['overallConfidence'];
  if (hasNeedsVerification) {
    overallConfidence = 'needs_verification';
  } else if (hasLow) {
    overallConfidence = 'low';
  } else if (hasMedium) {
    overallConfidence = 'medium';
  } else {
    overallConfidence = 'high';
  }

  return {
    overallConfidence,
    inferredCount,
    confirmedCount,
    needsReviewCount,
    totalLocations: locations.length,
  };
}

/**
 * Returns `true` when the plan contains the minimum set of locations required
 * to proceed to active quote planning:
 *
 *   - At least one `proposed_boiler` OR `existing_boiler` location.
 *   - At least one `gas_meter` location.
 *
 * The gate does not check confidence — a `needs_verification` location still
 * satisfies the minimum presence requirement.
 */
export function hasQuotePlannerMinimumLocations(
  plan: QuoteInstallationPlanV1,
): boolean {
  const kinds = new Set(plan.locations.map((loc) => loc.kind));

  // Evaluate directly against MINIMUM_LOCATION_KINDS so the gate stays in sync
  // with the constant definition.
  const boilerKinds = MINIMUM_LOCATION_KINDS.filter(
    (k) => k === 'proposed_boiler' || k === 'existing_boiler',
  );
  const gasMeterKinds = MINIMUM_LOCATION_KINDS.filter((k) => k === 'gas_meter');

  const hasBoilerLocation = boilerKinds.some((k) => kinds.has(k));
  const hasGasMeter       = gasMeterKinds.some((k) => kinds.has(k));

  return hasBoilerLocation && hasGasMeter;
}
