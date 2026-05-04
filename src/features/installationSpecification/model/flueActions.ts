/**
 * flueActions.ts
 *
 * Pure action helpers for managing `QuotePlanCandidateFlueRouteV1` entries.
 *
 * Design rules:
 *   - All functions are pure and side-effect-free.
 *   - Segment mutations always return a new object — no in-place mutation.
 *   - Calculation is re-run whenever segments or max allowance change.
 *   - ruleSource is always `generic_estimate` until a manufacturer rule set
 *     is explicitly provided.
 *   - No React dependencies — usable in reducers, tests, and non-React contexts.
 */

import type { QuotePlanCandidateFlueRouteV1, FlueFamily } from './QuoteInstallationPlanV1';
import type { QuoteFlueSegmentV1 } from '../calculators/quotePlannerTypes';
import { calculateFlueEquivalentLength } from '../calculators/flueEquivalentLength';
import { GENERIC_FLUE_RULES } from '../calculators/genericFlueRules';

// Monotonic counter for stable IDs within the same millisecond.
let _flueRouteIdCounter = 0;

// ─── Build helpers ────────────────────────────────────────────────────────────

/**
 * Creates a new empty flue route draft.
 *
 * Starts with no segments and `generic_estimate` calculation mode.
 * The engineer fills in family, location links, and segments interactively.
 */
export function buildFlueRouteDraft(
  family: FlueFamily = 'unknown',
  boilerLocationId?: string,
  terminalLocationId?: string,
): QuotePlanCandidateFlueRouteV1 {
  const flueRouteId = `flue-${Date.now()}-${++_flueRouteIdCounter}`;
  return {
    flueRouteId,
    confidence:        'estimated',
    family,
    boilerLocationId,
    terminalLocationId,
    calculationMode:   'generic_estimate',
    geometry: {
      segments: [],
    },
  };
}

// ─── Family / location updates ────────────────────────────────────────────────

/**
 * Updates the flue family on a route draft.
 *
 * Returns a new object — the original is not mutated.
 */
export function updateFlueFamily(
  route: QuotePlanCandidateFlueRouteV1,
  family: FlueFamily,
): QuotePlanCandidateFlueRouteV1 {
  return { ...route, family };
}

/**
 * Updates the boiler and/or terminal location links on a route draft.
 *
 * Returns a new object — the original is not mutated.
 */
export function updateFlueLocations(
  route: QuotePlanCandidateFlueRouteV1,
  boilerLocationId: string | undefined,
  terminalLocationId: string | undefined,
): QuotePlanCandidateFlueRouteV1 {
  return { ...route, boilerLocationId, terminalLocationId };
}

// ─── Segment mutations ────────────────────────────────────────────────────────

/**
 * Appends a segment to a flue route and recalculates the equivalent length.
 *
 * Returns a new route object — the original is not mutated.
 */
export function addFlueSegment(
  route: QuotePlanCandidateFlueRouteV1,
  segment: QuoteFlueSegmentV1,
  maxEquivalentLengthM?: number,
): QuotePlanCandidateFlueRouteV1 {
  const existingSegments = route.geometry?.segments ?? [];
  const updatedSegments = [...existingSegments, segment];
  return recalculate(route, updatedSegments, maxEquivalentLengthM);
}

/**
 * Removes the segment at the given index and recalculates the equivalent length.
 *
 * Out-of-range indices are silently ignored (returns the route unchanged).
 * Returns a new route object — the original is not mutated.
 */
export function removeFlueSegment(
  route: QuotePlanCandidateFlueRouteV1,
  index: number,
  maxEquivalentLengthM?: number,
): QuotePlanCandidateFlueRouteV1 {
  const existingSegments = route.geometry?.segments ?? [];
  if (index < 0 || index >= existingSegments.length) return route;
  const updatedSegments = existingSegments.filter((_, i) => i !== index);
  return recalculate(route, updatedSegments, maxEquivalentLengthM);
}

/**
 * Replaces the full segment list and recalculates the equivalent length.
 *
 * Returns a new route object — the original is not mutated.
 */
export function replaceFlueSegments(
  route: QuotePlanCandidateFlueRouteV1,
  segments: QuoteFlueSegmentV1[],
  maxEquivalentLengthM?: number,
): QuotePlanCandidateFlueRouteV1 {
  return recalculate(route, segments, maxEquivalentLengthM);
}

// ─── Max allowance update ─────────────────────────────────────────────────────

/**
 * Updates the manufacturer max equivalent length and recalculates.
 *
 * Pass `undefined` to remove the max allowance (reverts result to
 * `needs_model_specific_check`).
 */
export function updateMaxEquivalentLength(
  route: QuotePlanCandidateFlueRouteV1,
  maxEquivalentLengthM: number | undefined,
): QuotePlanCandidateFlueRouteV1 {
  const segments = route.geometry?.segments ?? [];
  return recalculate(route, segments, maxEquivalentLengthM);
}

// ─── Manual override ──────────────────────────────────────────────────────────

/**
 * Applies a manual-override calculation to the route.
 *
 * Use when the engineer wants to enter the equivalent length directly,
 * bypassing the segment-level calculation.  Sets `calculationMode` to
 * `manual_override`.
 */
export function applyManualOverride(
  route: QuotePlanCandidateFlueRouteV1,
  equivalentLengthM: number,
  maxEquivalentLengthM?: number,
): QuotePlanCandidateFlueRouteV1 {
  const max = maxEquivalentLengthM ?? null;
  const remaining = max !== null ? max - equivalentLengthM : null;
  const result =
    max === null
      ? ('needs_model_specific_check' as const)
      : equivalentLengthM > max
        ? ('exceeds_allowance' as const)
        : ('within_allowance' as const);

  return {
    ...route,
    calculationMode: 'manual_override',
    calculation: {
      physicalLengthM:     equivalentLengthM, // best estimate in override mode
      equivalentLengthM,
      maxEquivalentLengthM: max,
      remainingAllowanceM: remaining,
      result,
      calculationMode:     'manual_override',
      assumptions:         ['Manual override: engineer-entered equivalent length.'],
    },
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Builds an updated geometry + calculation from a new segment list. */
function recalculate(
  route: QuotePlanCandidateFlueRouteV1,
  segments: QuoteFlueSegmentV1[],
  maxEquivalentLengthM?: number,
): QuotePlanCandidateFlueRouteV1 {
  const flueRouteInput = { segments, maxEquivalentLengthM };
  const calculation = calculateFlueEquivalentLength(flueRouteInput, GENERIC_FLUE_RULES);
  return {
    ...route,
    calculationMode: 'generic_estimate',
    geometry:        { segments, maxEquivalentLengthM },
    calculation,
  };
}
