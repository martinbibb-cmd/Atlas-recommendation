/**
 * flueEquivalentLength.ts — Flue equivalent-length calculator for the Atlas Quote Planner.
 *
 * Calculates the total equivalent length of a flue run by summing:
 *   1. Physical straight-pipe lengths.
 *   2. Fitting resistance contributions from elbows and accessories.
 *
 * Design rules:
 *   - If a segment's `equivalentLengthM` is not provided, look it up from the
 *     supplied rule set by segment kind.
 *   - If `maxEquivalentLengthM` is absent, the result is
 *     `needs_model_specific_check` — never pass or fail without a limit.
 *   - Generic rule sets produce `generic_estimate` mode output.
 *   - All assumptions made during the calculation are recorded in the output.
 *
 * Model-specific lookup:
 *   Use `calculateFlueEquivalentLengthForModel` to resolve the correct rule
 *   set automatically for a given manufacturer and model, falling back to
 *   generic estimates when no manufacturer entry is available.
 */

import type {
  QuoteFlueRouteV1,
  QuoteFlueCalculationV1,
  QuoteFlueCalculationResult,
  FlueRuleSetV1,
  FlueSegmentKind,
} from './quotePlannerTypes';
import {
  GENERIC_FLUE_RULES,
  GENERIC_FLUE_ASSUMPTION_90,
  GENERIC_FLUE_ASSUMPTION_45,
  GENERIC_FLUE_ASSUMPTION_OFFSET,
  GENERIC_FLUE_ASSUMPTION_PLUME,
  GENERIC_FLUE_ASSUMPTION_TERMINAL,
} from './genericFlueRules';
import {
  getFlueRulesForModel,
  type FlueRuleResolutionV1,
} from '../rules/getFlueRulesForModel';

// ─── Assumption helpers ───────────────────────────────────────────────────────

/** Maps a segment kind to its assumption string when the generic rule is applied. */
function genericAssumptionForKind(kind: FlueSegmentKind): string | null {
  switch (kind) {
    case 'elbow_90':
      return GENERIC_FLUE_ASSUMPTION_90;
    case 'elbow_45':
      return GENERIC_FLUE_ASSUMPTION_45;
    case 'offset':
      return GENERIC_FLUE_ASSUMPTION_OFFSET;
    case 'plume_kit':
      return GENERIC_FLUE_ASSUMPTION_PLUME;
    case 'terminal':
    case 'vertical_terminal':
    case 'horizontal_terminal':
      return GENERIC_FLUE_ASSUMPTION_TERMINAL;
    default:
      return null;
  }
}

/** Look up the generic equivalent length for a fitting kind from the rule set. */
function lookupEquivalentLength(
  kind: FlueSegmentKind,
  ruleSet: FlueRuleSetV1,
): number {
  switch (kind) {
    case 'elbow_90':
      return ruleSet.elbow90EquivalentLengthM;
    case 'elbow_45':
      return ruleSet.elbow45EquivalentLengthM;
    case 'offset':
      // An offset is equivalent to two 45° elbows in generic estimation.
      return ruleSet.elbow45EquivalentLengthM * 2;
    case 'plume_kit':
      return ruleSet.plumeKitEquivalentLengthM;
    case 'terminal':
    case 'vertical_terminal':
    case 'horizontal_terminal':
      return ruleSet.terminalEquivalentLengthM;
    case 'roof_flashing':
    case 'straight':
    case 'other':
      // Straight segments and accessories with no resistance contribution
      // default to 0 additional equivalent length.
      return 0;
  }
}

// ─── calculateFlueEquivalentLength ───────────────────────────────────────────

/**
 * Calculate the total equivalent length of a flue route.
 *
 * @param flueRoute - The complete flue route with segments and optional max limit.
 * @param ruleSet   - Rule set to look up equivalent lengths for fittings.
 *                    Defaults to the generic estimate rule set.
 *
 * @returns QuoteFlueCalculationV1 with all calculated values and result status.
 */
export function calculateFlueEquivalentLength(
  flueRoute: QuoteFlueRouteV1,
  ruleSet: FlueRuleSetV1 = GENERIC_FLUE_RULES,
): QuoteFlueCalculationV1 {
  let physicalLengthM = 0;
  let equivalentLengthM = 0;
  const assumptionsSet = new Set<string>();

  for (const segment of flueRoute.segments) {
    // Accumulate physical length from straight segments.
    if (segment.physicalLengthM !== undefined && segment.physicalLengthM > 0) {
      physicalLengthM += segment.physicalLengthM;
      equivalentLengthM += segment.physicalLengthM;
    }

    // Determine the fitting's equivalent-length contribution.
    if (segment.kind !== 'straight') {
      let fittingEquivalentM: number;
      let usedGenericRule = false;

      if (segment.equivalentLengthM !== undefined) {
        // Caller-supplied value takes precedence.
        fittingEquivalentM = segment.equivalentLengthM;
      } else {
        // Fall back to rule set lookup.
        fittingEquivalentM = lookupEquivalentLength(segment.kind, ruleSet);
        usedGenericRule = ruleSet.calculationMode === 'generic_estimate';
      }

      equivalentLengthM += fittingEquivalentM;

      if (usedGenericRule) {
        const assumption = genericAssumptionForKind(segment.kind);
        if (assumption) {
          assumptionsSet.add(assumption);
        }
      }
    }
  }

  const maxEquivalentLengthM = flueRoute.maxEquivalentLengthM ?? null;
  const remainingAllowanceM =
    maxEquivalentLengthM !== null ? maxEquivalentLengthM - equivalentLengthM : null;

  let result: QuoteFlueCalculationResult;
  if (maxEquivalentLengthM === null) {
    result = 'needs_model_specific_check';
  } else if (equivalentLengthM > maxEquivalentLengthM) {
    result = 'exceeds_allowance';
  } else {
    result = 'within_allowance';
  }

  const assumptions = Array.from(assumptionsSet);

  return {
    physicalLengthM,
    equivalentLengthM,
    maxEquivalentLengthM,
    remainingAllowanceM,
    result,
    calculationMode: ruleSet.calculationMode,
    assumptions,
  };
}

// ─── Model-aware convenience wrapper ─────────────────────────────────────────

/**
 * Result of `calculateFlueEquivalentLengthForModel`.
 *
 * Combines the standard calculation output with the rule-resolution metadata
 * so consumers can drive UI labels without a separate lookup call.
 */
export interface FlueEquivalentLengthForModelResultV1 {
  /** Full calculation output (same shape as `QuoteFlueCalculationV1`). */
  calculation: QuoteFlueCalculationV1;
  /**
   * Resolution metadata from `getFlueRulesForModel`.
   * Use `resolution.resolved` to drive the UI label:
   *   - `'manufacturer_specific'` → "Manufacturer-specific"
   *   - `'generic_estimate'`      → "Generic estimate — check MI"
   */
  resolution: FlueRuleResolutionV1;
}

/**
 * Calculates flue equivalent length using the best available rule set for
 * the specified manufacturer and model.
 *
 * If a catalog entry exists for the manufacturer/model combination, it is used
 * and the result is labelled `manufacturer_specific`.  Otherwise, the generic
 * estimate rule set is used and the result is labelled `generic_estimate`.
 *
 * When the matched catalog entry provides a `maxEquivalentLengthM`, it is
 * merged into the flue route before calculation so that pass/fail is
 * automatically determined.  An explicit `maxEquivalentLengthM` on the
 * `flueRoute` takes precedence over the catalog value.
 *
 * @param flueRoute    - The complete flue route with segments and optional max limit.
 * @param manufacturer - Canonical manufacturer name (case-insensitive).
 * @param model        - Specific model identifier (optional).
 * @param range        - Product range (optional; used when model is absent).
 *
 * @returns Combined calculation and resolution result.
 */
export function calculateFlueEquivalentLengthForModel(
  flueRoute: QuoteFlueRouteV1,
  manufacturer: string,
  model?: string,
  range?: string,
): FlueEquivalentLengthForModelResultV1 {
  const resolution = getFlueRulesForModel(manufacturer, model, range);

  // If the catalog entry provides a maxEquivalentLengthM and the route does
  // not already specify one, forward the catalog value into the route.
  const effectiveMaxM =
    flueRoute.maxEquivalentLengthM ??
    resolution.matchedEntry?.maxEquivalentLengthM;

  const effectiveRoute: QuoteFlueRouteV1 =
    effectiveMaxM !== undefined && effectiveMaxM !== flueRoute.maxEquivalentLengthM
      ? { ...flueRoute, maxEquivalentLengthM: effectiveMaxM }
      : flueRoute;

  const calculation = calculateFlueEquivalentLength(effectiveRoute, resolution.ruleSet);

  return { calculation, resolution };
}
