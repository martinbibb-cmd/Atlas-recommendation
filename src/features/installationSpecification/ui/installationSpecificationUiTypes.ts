/**
 * installationSpecificationUiTypes.ts
 *
 * UI-layer type definitions for the Installation Specification visual stepper.
 *
 * These types map the engineer-visible tile labels to the engine-layer
 * `QuoteSystemFamily` used by `classifyQuoteJob`.  The mapping is one-way
 * (UI → engine) and lossy for display-only labels (e.g. "Storage combi"
 * and "Thermal store" both map to existing stored-DHW families).
 *
 * Design rules:
 *   - No engine calls here — pure data mapping.
 *   - UiCurrentSystemLabel covers the full 8-tile set from the problem statement.
 *   - UiProposedSystemLabel covers only systems that Atlas recommends.
 *   - uiLabelToFamily is deterministic and total (no throws).
 */

import type { QuoteSystemFamily } from '../calculators/quotePlannerTypes';

// ─── Current-system tile labels ───────────────────────────────────────────────

/**
 * The eight tile choices shown in CurrentSystemStep.
 * These map to `QuoteSystemFamily` via `uiLabelToFamily`.
 */
export type UiCurrentSystemLabel =
  | 'combi'
  | 'system_boiler'
  | 'regular_open_vent'
  | 'storage_combi'
  | 'thermal_store'
  | 'heat_pump'
  | 'warm_air'
  | 'unknown';

// ─── Proposed-system tile labels ──────────────────────────────────────────────

/**
 * Tile choices shown in ProposedSystemStep.
 * Restricted to systems that Atlas can recommend.
 */
export type UiProposedSystemLabel =
  | 'combi'
  | 'system_boiler'
  | 'regular_open_vent'
  | 'heat_pump'
  | 'unknown';

// ─── Family mapping ───────────────────────────────────────────────────────────

/**
 * Map a UI tile label to the nearest `QuoteSystemFamily` for plan classification.
 *
 * "Storage combi" → `system_stored` (combi with integrated storage cylinder; mapped to
 *                     the nearest stored-DHW family since there is no distinct engine type).
 * "Thermal store"  → `regular_stored` (gravity/vented stored DHW).
 * "Warm air"      → `unknown` (no equivalent in the engine family set).
 */
export function uiLabelToFamily(
  label: UiCurrentSystemLabel | UiProposedSystemLabel,
): QuoteSystemFamily {
  switch (label) {
    case 'combi':             return 'combi';
    case 'system_boiler':     return 'system_stored';
    case 'regular_open_vent': return 'regular_stored';
    case 'storage_combi':     return 'system_stored';
    case 'thermal_store':     return 'regular_stored';
    case 'heat_pump':         return 'heat_pump';
    case 'warm_air':          return 'unknown';
    case 'unknown':           return 'unknown';
  }
}
