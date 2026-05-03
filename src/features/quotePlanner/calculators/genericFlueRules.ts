/**
 * genericFlueRules.ts — Generic default equivalent-length rules for flue segments.
 *
 * These are estimate defaults only. They must never be presented as
 * manufacturer-specific data. All calculations that use this rule set must
 * declare calculationMode === 'generic_estimate'.
 *
 * Sources / references:
 *   - 90° elbow 2.0 m — common industry estimate used for comparative purposes.
 *   - 45° elbow 1.0 m — common industry estimate.
 *   - Plume kit and terminal: 0 m default; individual manufacturers may differ.
 *
 * These values are conservative estimates for planning use only.
 * Always verify against the boiler manufacturer's flue installation guide.
 */

import type { FlueRuleSetV1 } from './quotePlannerTypes';

// ─── Default rule set ─────────────────────────────────────────────────────────

/**
 * Generic flue rule set.
 *
 * Provides conservative equivalent-length defaults for common flue accessories.
 * Declared as `generic_estimate` — never manufacturer truth.
 */
export const GENERIC_FLUE_RULES: FlueRuleSetV1 = {
  /** 90° elbow: 2.0 m equivalent length (industry generic estimate). */
  elbow90EquivalentLengthM: 2.0,
  /** 45° elbow: 1.0 m equivalent length (industry generic estimate). */
  elbow45EquivalentLengthM: 1.0,
  /**
   * Plume management kit: 0 m default.
   * Some manufacturers charge no equivalent-length penalty for their approved
   * plume kits; where a penalty applies, override with a manufacturer-specific rule set.
   */
  plumeKitEquivalentLengthM: 0,
  /**
   * Flue terminal: 0 m default.
   * The terminal is the endpoint of the flue run; equivalent length is typically
   * counted from the boiler spigot to the terminal outlet (not beyond).
   */
  terminalEquivalentLengthM: 0,
  /** This rule set is a generic estimate — not manufacturer-verified data. */
  calculationMode: 'generic_estimate',
};

// ─── Assumption strings ───────────────────────────────────────────────────────

/**
 * Standard assumption text appended to generic-estimate calculations.
 * Used in QuoteFlueCalculationV1.assumptions.
 */
export const GENERIC_FLUE_ASSUMPTION_90 =
  'Generic estimate: 90° elbow assumed at 2.0 m equivalent length. Verify against manufacturer flue guide.';

export const GENERIC_FLUE_ASSUMPTION_45 =
  'Generic estimate: 45° elbow assumed at 1.0 m equivalent length. Verify against manufacturer flue guide.';

export const GENERIC_FLUE_ASSUMPTION_PLUME =
  'Generic estimate: plume management kit assumed at 0 m equivalent length. Verify against manufacturer flue guide.';

export const GENERIC_FLUE_ASSUMPTION_TERMINAL =
  'Generic estimate: flue terminal assumed at 0 m equivalent length. Verify against manufacturer flue guide.';
