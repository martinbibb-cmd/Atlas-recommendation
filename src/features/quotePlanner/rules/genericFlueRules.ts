/**
 * genericFlueRules.ts — Generic fallback flue rule catalog entry.
 *
 * This module exports the built-in generic fallback `FlueRuleSetV1` catalog
 * entry used by `getFlueRulesForModel` when no manufacturer/model-specific
 * entry is available.
 *
 * These values are conservative industry estimates for planning purposes only.
 * They must never be presented as manufacturer-verified data.
 */

import type { FlueRuleSetV1 } from './flueRuleTypes';

/**
 * Generic fallback catalog entry.
 *
 * `source` is `'generic_estimate'` — this must never be changed.
 * Any calculation using this entry must declare `calculationMode === 'generic_estimate'`
 * and display the "Generic estimate — check MI" label in the UI.
 */
export const GENERIC_FLUE_RULE_ENTRY: FlueRuleSetV1 = {
  manufacturer: 'generic',
  segmentEquivalents: {
    /** 90° elbow: 2.0 m equivalent length (common industry estimate). */
    elbow_90: 2.0,
    /** 45° elbow: 1.0 m equivalent length (common industry estimate). */
    elbow_45: 1.0,
    /**
     * Plume management kit: 0 m default.
     * Many manufacturers impose no equivalent-length penalty for approved plume
     * kits.  Where a penalty applies, a manufacturer-specific entry must be used.
     */
    plume_kit: 0,
    /**
     * Flue terminal: 0 m default.
     * Equivalent length is measured from boiler spigot to terminal outlet.
     */
    terminal: 0,
  },
  source: 'generic_estimate',
  notes:
    'Industry generic estimates for planning use only. ' +
    'Always verify against the boiler manufacturer\'s flue installation guide.',
};
