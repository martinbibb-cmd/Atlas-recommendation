/**
 * getFlueRulesForModel.ts — Manufacturer/model-specific flue rule lookup.
 *
 * This module provides the infrastructure for resolving the correct flue
 * equivalent-length rule set for a given manufacturer and model.
 *
 * Resolution order:
 *   1. Exact match: manufacturer + model.
 *   2. Range match: manufacturer + range (model omitted from entry).
 *   3. Manufacturer match: manufacturer only (range and model omitted).
 *   4. Generic fallback: `GENERIC_FLUE_RULE_ENTRY` (always available).
 *
 * The resolved result includes a computation-ready `FlueRuleSetV1`
 * (from `quotePlannerTypes.ts`) that can be passed directly to
 * `calculateFlueEquivalentLength`.
 *
 * Design rules:
 *   - Never invent manufacturer values.  Only `manufacturer_instructions`
 *     entries verified from source documents should carry that source label.
 *   - An absent `model` in the lookup is equivalent to "use the best
 *     available entry for this manufacturer".
 *   - `maxEquivalentLengthM` on the resolved catalog entry is forwarded
 *     into the computation rule set so the calculator can pass/fail.
 */

import type { FlueRuleSetV1 as CatalogEntryV1 } from './flueRuleTypes';
import type { FlueRuleSetV1 as ComputationRuleSetV1 } from '../calculators/quotePlannerTypes';
import { GENERIC_FLUE_RULE_ENTRY } from './genericFlueRules';
import seedData from './boilerFlueRules.seed.json';

// ─── Seed registry ────────────────────────────────────────────────────────────

/**
 * All known flue rule catalog entries.
 *
 * `seedData` is the static seed file.  In future, additional entries can be
 * merged in here from a dynamic source (database, remote config, etc.) without
 * changing the public API of `getFlueRulesForModel`.
 */
const FLUE_RULE_REGISTRY: CatalogEntryV1[] = seedData as CatalogEntryV1[];

// ─── Resolution result ────────────────────────────────────────────────────────

/**
 * The result returned by `getFlueRulesForModel`.
 */
export interface FlueRuleResolutionV1 {
  /**
   * Computation-ready rule set for use with `calculateFlueEquivalentLength`.
   * The `calculationMode` reflects whether a manufacturer-specific or generic
   * entry was resolved.
   */
  ruleSet: ComputationRuleSetV1;

  /**
   * The matched catalog entry, or `null` when the generic fallback was used.
   * Consumers may inspect this for UI labelling (manufacturer name, sourceRef).
   */
  matchedEntry: CatalogEntryV1 | null;

  /**
   * Indicates which rule source was resolved:
   *
   * - `'manufacturer_specific'` — a catalog entry for this manufacturer/model
   *   was found and used.
   * - `'generic_estimate'`      — no catalog entry matched; generic defaults
   *   were used.
   *
   * Use this to drive UI labels:
   *   - `'manufacturer_specific'` → "Manufacturer-specific"
   *   - `'generic_estimate'`      → "Generic estimate — check MI"
   */
  resolved: 'manufacturer_specific' | 'generic_estimate';
}

// ─── Label constants ──────────────────────────────────────────────────────────

/** UI label for a manufacturer-specific calculation. */
export const LABEL_MANUFACTURER_SPECIFIC = 'Manufacturer-specific' as const;

/** UI label for a generic-estimate fallback calculation. */
export const LABEL_GENERIC_ESTIMATE = 'Generic estimate — check MI' as const;

// ─── Lookup ───────────────────────────────────────────────────────────────────

/**
 * Resolves the best available flue rule set for a given manufacturer and model.
 *
 * @param manufacturer - Canonical manufacturer name (case-insensitive match).
 * @param model        - Specific model identifier (optional).
 * @param range        - Product range within the manufacturer (optional).
 *
 * @returns `FlueRuleResolutionV1` with a computation-ready rule set and
 *          metadata indicating whether a manufacturer-specific entry was found.
 */
export function getFlueRulesForModel(
  manufacturer: string,
  model?: string,
  range?: string,
): FlueRuleResolutionV1 {
  const mfrLower = manufacturer.trim().toLowerCase();

  // ── 1. Exact match: manufacturer + model ─────────────────────────────────
  if (model !== undefined) {
    const modelLower = model.trim().toLowerCase();
    const exactMatch = FLUE_RULE_REGISTRY.find(
      (entry) =>
        entry.manufacturer.toLowerCase() === mfrLower &&
        entry.model !== undefined &&
        entry.model.toLowerCase() === modelLower,
    );
    if (exactMatch) {
      return buildResolution(exactMatch, 'manufacturer_specific');
    }
  }

  // ── 2. Range match: manufacturer + range (no model on entry) ─────────────
  if (range !== undefined) {
    const rangeLower = range.trim().toLowerCase();
    const rangeMatch = FLUE_RULE_REGISTRY.find(
      (entry) =>
        entry.manufacturer.toLowerCase() === mfrLower &&
        entry.range !== undefined &&
        entry.range.toLowerCase() === rangeLower &&
        entry.model === undefined,
    );
    if (rangeMatch) {
      return buildResolution(rangeMatch, 'manufacturer_specific');
    }
  }

  // ── 3. Manufacturer-only match ────────────────────────────────────────────
  const mfrMatch = FLUE_RULE_REGISTRY.find(
    (entry) =>
      entry.manufacturer.toLowerCase() === mfrLower &&
      entry.range === undefined &&
      entry.model === undefined,
  );
  if (mfrMatch) {
    return buildResolution(mfrMatch, 'manufacturer_specific');
  }

  // ── 4. Generic fallback ───────────────────────────────────────────────────
  return buildResolution(GENERIC_FLUE_RULE_ENTRY, 'generic_estimate', true);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Converts a catalog entry into a computation-ready `ComputationRuleSetV1`
 * and wraps it with resolution metadata.
 *
 * @param entry     - The matched (or generic) catalog entry.
 * @param resolved  - Whether the entry is manufacturer-specific or generic.
 * @param isGeneric - When `true`, `matchedEntry` is set to `null` in the result.
 */
function buildResolution(
  entry: CatalogEntryV1,
  resolved: FlueRuleResolutionV1['resolved'],
  isGeneric = false,
): FlueRuleResolutionV1 {
  const eq = entry.segmentEquivalents;

  const ruleSet: ComputationRuleSetV1 = {
    elbow90EquivalentLengthM:
      eq.elbow_90 ?? GENERIC_FLUE_RULE_ENTRY.segmentEquivalents.elbow_90!,
    elbow45EquivalentLengthM:
      eq.elbow_45 ?? GENERIC_FLUE_RULE_ENTRY.segmentEquivalents.elbow_45!,
    plumeKitEquivalentLengthM:
      eq.plume_kit ?? GENERIC_FLUE_RULE_ENTRY.segmentEquivalents.plume_kit!,
    terminalEquivalentLengthM:
      eq.terminal ?? GENERIC_FLUE_RULE_ENTRY.segmentEquivalents.terminal!,
    calculationMode: isGeneric ? 'generic_estimate' : 'manufacturer_specific',
  };

  return {
    ruleSet,
    matchedEntry: isGeneric ? null : entry,
    resolved,
  };
}

/**
 * Returns the UI label string for a resolved flue rule result.
 *
 * @param resolved - The `resolved` field from `FlueRuleResolutionV1`.
 */
export function getFlueRuleUiLabel(
  resolved: FlueRuleResolutionV1['resolved'],
): typeof LABEL_MANUFACTURER_SPECIFIC | typeof LABEL_GENERIC_ESTIMATE {
  return resolved === 'manufacturer_specific'
    ? LABEL_MANUFACTURER_SPECIFIC
    : LABEL_GENERIC_ESTIMATE;
}
