/**
 * flueRuleTypes.ts — Manufacturer/model-specific flue rule catalog types.
 *
 * `FlueRuleSetV1` is the catalog entry type for a manufacturer or model's
 * flue equivalent-length data.  It is distinct from the computation input
 * type in `quotePlannerTypes.ts` (which only contains numeric equivalents
 * and a `calculationMode` field).
 *
 * Design rules:
 *   - `source` must always be declared honestly.  Never set a `generic_estimate`
 *     entry to `manufacturer_instructions`.
 *   - `model` is optional — a rule can apply to an entire manufacturer or
 *     range when no model is specified.
 *   - `segmentEquivalents` keys match `FlueSegmentKind` names (snake_case).
 *   - If an equivalent is absent from `segmentEquivalents`, the generic
 *     default for that fitting is used as a fallback.
 */

// ─── Source provenance ────────────────────────────────────────────────────────

/**
 * How the equivalent-length values in this rule set were obtained.
 *
 * generic_estimate        — industry-wide defaults; not manufacturer-verified.
 * manufacturer_instructions — extracted from official manufacturer MI documents.
 * manual_entry            — entered manually by an engineer or data administrator.
 */
export type FlueRuleSource =
  | 'generic_estimate'
  | 'manufacturer_instructions'
  | 'manual_entry';

// ─── Segment equivalents ──────────────────────────────────────────────────────

/**
 * Equivalent lengths (in metres) for individual flue fittings.
 *
 * Keys match `FlueSegmentKind` (snake_case).  Any absent key means
 * "use the generic default for this fitting".
 */
export interface FlueSegmentEquivalentsV1 {
  /** Equivalent length (m) for a 90° elbow. */
  elbow_90?: number;
  /** Equivalent length (m) for a 45° elbow. */
  elbow_45?: number;
  /** Equivalent length (m) for a plume management kit. */
  plume_kit?: number;
  /** Equivalent length (m) for the flue terminal (horizontal or vertical). */
  terminal?: number;
  /** Equivalent length (m) for a flue adaptor or connector. */
  adaptor?: number;
}

// ─── Catalog entry ────────────────────────────────────────────────────────────

/**
 * A catalog entry recording the flue equivalent-length rules for a
 * specific manufacturer, range, and/or model.
 *
 * Used by `getFlueRulesForModel` to look up and return a computation-ready
 * rule set.  Entries marked with `source: 'generic_estimate'` are treated
 * as fallbacks and never labelled as manufacturer-verified data.
 */
export interface FlueRuleSetV1 {
  /**
   * Boiler manufacturer name.
   *
   * Use a canonical, human-readable name (e.g. "Worcester Bosch").
   * For the generic fallback entry, use the sentinel value "generic".
   */
  manufacturer: string;

  /**
   * Product range within the manufacturer's portfolio (e.g. "Greenstar 4000").
   * Omit when the rule applies to all ranges for this manufacturer.
   */
  range?: string;

  /**
   * Specific model identifier (e.g. "25i").
   * Omit when the rule applies to an entire range or manufacturer.
   */
  model?: string;

  /**
   * Flue system type the rule applies to (e.g. "60/100", "80/125").
   * Omit when the rule is independent of flue system diameter.
   */
  flueSystem?: string;

  /**
   * Maximum permitted equivalent flue length in metres.
   *
   * When absent, `getFlueRulesForModel` will return a result that produces
   * `needs_model_specific_check` in the calculator — never pass or fail
   * without a confirmed limit.
   */
  maxEquivalentLengthM?: number;

  /**
   * Per-fitting equivalent lengths for this entry.
   *
   * Any fitting kind not present here falls back to the generic estimate.
   */
  segmentEquivalents: FlueSegmentEquivalentsV1;

  /**
   * Provenance of the values in this entry.
   *
   * Must be `generic_estimate` for the built-in generic fallback.
   * Use `manufacturer_instructions` only when values are extracted from
   * verified manufacturer installation manuals.
   */
  source: FlueRuleSource;

  /**
   * Reference for the source (e.g. document title, URL, or MI revision).
   * Omit for generic estimates.
   */
  sourceRef?: string;

  /**
   * Free-text notes for administrators and reviewers.
   * Must include "DEMO — not_for_live_quote" for placeholder entries.
   */
  notes?: string;
}
