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
import type { HeatSourceKindV1, HotWaterKindV1 } from '../model/QuoteInstallationPlanV1';

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

// ─── Gas boiler family constants ──────────────────────────────────────────────

/**
 * Proposed-system values that belong to a gas boiler family.
 *
 * Used by both ProposedSystemStep (to gate ASHP → gas normal tile visibility)
 * and InstallationSpecificationStepper (to detect the ASHP exception path).
 * Defined here so both consumers can import from a single source of truth.
 */
export const GAS_BOILER_PROPOSED_VALUES = new Set<Exclude<UiProposedSystemLabel, 'unknown'>>([
  'combi',
  'system_boiler',
  'regular_open_vent',
]);

/**
 * Type guard that returns true when the given proposed-system label belongs
 * to a gas boiler family.
 */
export function isGasBoilerProposedValue(
  value: UiProposedSystemLabel,
): value is Exclude<UiProposedSystemLabel, 'unknown' | 'heat_pump'> {
  return GAS_BOILER_PROPOSED_VALUES.has(value as Exclude<UiProposedSystemLabel, 'unknown'>);
}

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

// ─── Existence step labels ───────────────────────────────────────────────────

/** The three existence-step tile choices shown in the new CurrentSystemStep. */
export type UiExistenceLabel = 'has_wet_heating' | 'no_wet_heating' | 'partial_abandoned';

// ─── Current heat source tile labels ─────────────────────────────────────────

/** Heat-source tile choices shown in CurrentHeatSourceStep. */
export type UiCurrentHeatSourceLabel =
  | 'combi_boiler'
  | 'regular_boiler'
  | 'system_boiler'
  | 'storage_combi'
  | 'heat_pump'
  | 'warm_air'
  | 'back_boiler'
  | 'direct_electric'
  | 'other_heat_source'
  | 'none';

// ─── Current hot water tile labels ───────────────────────────────────────────

/** Hot-water/cylinder tile choices shown in CurrentHotWaterStep. */
export type UiCurrentHotWaterLabel =
  | 'no_cylinder'
  | 'vented_cylinder'
  | 'unvented_cylinder'
  | 'thermal_store'
  | 'mixergy_or_stratified'
  | 'integrated_store'
  | 'other_hot_water';

// ─── Current primary circuit tile labels ────────────────────────────────────

/** Primary-circuit tile choices shown in CurrentPrimaryCircuitStep. */
export type UiCurrentPrimaryCircuitLabel =
  | 'open_vented_primary'
  | 'sealed_primary'
  | 'needs_technical_review'
  /**
   * Used in the canonical current-system summary when the primary circuit
   * was not separately recorded for this heat source type (e.g. a combi
   * boiler where circuit type is not a separate survey field), or when
   * there is genuinely no primary wet-heating circuit.
   * Displayed as "Not separately recorded" rather than "Missing from survey".
   */
  | 'not_applicable';

// ─── Proposed heat source tile labels ────────────────────────────────────────

/** Proposed heat-source tile choices shown in ProposedHeatSourceStep. */
export type UiProposedHeatSourceLabel =
  | 'combi_boiler'
  | 'regular_boiler'
  | 'system_boiler'
  | 'storage_combi'
  | 'heat_pump'
  | 'other_approved';

// ─── Proposed hot water tile labels ──────────────────────────────────────────

/** Proposed hot-water/cylinder tile choices shown in ProposedHotWaterStep. */
export type UiProposedHotWaterLabel =
  | 'retain_existing'
  | 'vented_cylinder'
  | 'unvented_cylinder'
  | 'mixergy_or_stratified'
  | 'thermal_store'
  | 'heat_pump_cylinder'
  | 'no_stored_hot_water';

// ─── Mapping helpers ──────────────────────────────────────────────────────────

/**
 * Whether a current heat source label means "has a boiler of some kind".
 * Used to determine whether to show primary-circuit step.
 */
export function isBoilerHeatSource(label: UiCurrentHeatSourceLabel): boolean {
  return (
    label === 'combi_boiler' ||
    label === 'regular_boiler' ||
    label === 'system_boiler' ||
    label === 'storage_combi' ||
    label === 'back_boiler'
  );
}

/**
 * Whether a current heat source label means "has a combi-type appliance"
 * (so the hot-water cylinder step should be skipped for current system).
 */
export function isCombiHeatSource(label: UiCurrentHeatSourceLabel): boolean {
  return label === 'combi_boiler' || label === 'storage_combi';
}

/**
 * Whether a proposed heat source label means "has a combi-type appliance"
 * (so the proposed hot-water cylinder step should be skipped).
 */
export function isProposedCombi(label: UiProposedHeatSourceLabel): boolean {
  return label === 'combi_boiler' || label === 'storage_combi';
}

/**
 * Whether a proposed heat source label is a heat pump.
 */
export function isProposedHeatPump(label: UiProposedHeatSourceLabel): boolean {
  return label === 'heat_pump';
}

// ─── Canonical current system summary ────────────────────────────────────────

/**
 * A read-only summary of the current installation, sourced from the canonical
 * survey.  This is passed into the Installation Specification stepper so that
 * the spec tool can show existing system facts without re-collecting them.
 *
 * All fields are nullable — when a field is absent, the UI shows
 * "Missing from canonical survey" rather than "Unknown".
 */
export interface CanonicalCurrentSystemSummary {
  /** Current heat source from canonical survey, or null when not recorded. */
  heatSource: UiCurrentHeatSourceLabel | null;
  /** Current hot-water arrangement from canonical survey, or null when not recorded. */
  hotWater: UiCurrentHotWaterLabel | null;
  /** Current primary circuit type from canonical survey, or null when not recorded. */
  primaryCircuit: UiCurrentPrimaryCircuitLabel | null;
  /** Human-readable boiler/heat-source location label, if known. */
  boilerLocation?: string;
  /** Human-readable cylinder/store location label, if known. */
  cylinderLocation?: string;
  /**
   * Inferred boiler condition band from the survey.
   * Derived by sanitiseModelForEngine from boiler age, condensing status, and
   * surveyor-observed symptoms.  Absent when no boiler condition data exists.
   */
  boilerConditionBand?: 'good' | 'moderate' | 'poor' | 'severe';
  /**
   * System age in years (typically sourced from currentBoilerAgeYears).
   * Used to display age-context in the current system summary step.
   * Absent when age was not recorded.
   */
  systemAgeYears?: number;
}

/**
 * Whether a proposed heat source label is a gas boiler type
 * (for ASHP-to-gas gate logic).
 */
export function isGasBoilerProposedHeatSource(label: UiProposedHeatSourceLabel): boolean {
  return (
    label === 'combi_boiler' ||
    label === 'regular_boiler' ||
    label === 'system_boiler' ||
    label === 'storage_combi'
  );
}

/** Map UiCurrentHeatSourceLabel to HeatSourceKindV1. */
export function currentHeatSourceToKind(label: UiCurrentHeatSourceLabel): HeatSourceKindV1 {
  switch (label) {
    case 'combi_boiler':    return 'combi_boiler';
    case 'regular_boiler':  return 'regular_boiler';
    case 'system_boiler':   return 'system_boiler';
    case 'storage_combi':   return 'storage_combi';
    case 'heat_pump':       return 'heat_pump';
    case 'warm_air':        return 'warm_air';
    case 'back_boiler':     return 'back_boiler';
    case 'direct_electric': return 'direct_electric';
    case 'other_heat_source': return 'other';
    case 'none':            return 'none';
  }
}

/** Map UiProposedHeatSourceLabel to HeatSourceKindV1. */
export function proposedHeatSourceToKind(label: UiProposedHeatSourceLabel): HeatSourceKindV1 {
  switch (label) {
    case 'combi_boiler':    return 'combi_boiler';
    case 'regular_boiler':  return 'regular_boiler';
    case 'system_boiler':   return 'system_boiler';
    case 'storage_combi':   return 'storage_combi';
    case 'heat_pump':       return 'heat_pump';
    case 'other_approved':  return 'other';
  }
}

/** Map UiCurrentHotWaterLabel to HotWaterKindV1. */
export function currentHotWaterToKind(label: UiCurrentHotWaterLabel): HotWaterKindV1 {
  switch (label) {
    case 'no_cylinder':          return 'none';
    case 'vented_cylinder':      return 'vented_cylinder';
    case 'unvented_cylinder':    return 'unvented_cylinder';
    case 'thermal_store':        return 'thermal_store';
    case 'mixergy_or_stratified': return 'mixergy_or_stratified';
    case 'integrated_store':     return 'integrated_store';
    case 'other_hot_water':      return 'other';
  }
}

/** Map UiProposedHotWaterLabel to HotWaterKindV1. */
export function proposedHotWaterToKind(label: UiProposedHotWaterLabel): HotWaterKindV1 {
  switch (label) {
    case 'retain_existing':       return 'existing_retained';
    case 'vented_cylinder':       return 'vented_cylinder';
    case 'unvented_cylinder':     return 'unvented_cylinder';
    case 'mixergy_or_stratified': return 'mixergy_or_stratified';
    case 'thermal_store':         return 'thermal_store';
    case 'heat_pump_cylinder':    return 'heat_pump_cylinder';
    case 'no_stored_hot_water':   return 'none';
  }
}

/**
 * Map a UiCurrentHeatSourceLabel to the nearest QuoteSystemFamily for backward-compat
 * classification in the existing classifyQuoteJob function.
 */
export function heatSourceToFamily(
  heatSource: UiCurrentHeatSourceLabel | UiProposedHeatSourceLabel,
): QuoteSystemFamily {
  switch (heatSource) {
    case 'combi_boiler':    return 'combi';
    case 'storage_combi':   return 'system_stored';
    case 'system_boiler':   return 'system_stored';
    case 'regular_boiler':  return 'regular_stored';
    case 'heat_pump':       return 'heat_pump';
    case 'other_approved':  return 'unknown';
    default:                return 'unknown';
  }
}

// ─── Reverse-mapping helpers (plan → UI state) ────────────────────────────────

/**
 * Map a HeatSourceKindV1 back to the nearest UiProposedHeatSourceLabel.
 * Returns null when there is no suitable proposed label for the given kind
 * (e.g. 'warm_air', 'none', 'direct_electric').
 */
export function kindToProposedHeatSource(kind: HeatSourceKindV1): UiProposedHeatSourceLabel | null {
  switch (kind) {
    case 'combi_boiler':    return 'combi_boiler';
    case 'regular_boiler':  return 'regular_boiler';
    case 'system_boiler':   return 'system_boiler';
    case 'storage_combi':   return 'storage_combi';
    case 'heat_pump':       return 'heat_pump';
    case 'other':           return 'other_approved';
    default:                return null;
  }
}

/**
 * Map a HotWaterKindV1 back to the nearest UiProposedHotWaterLabel.
 * Returns null when there is no suitable label (e.g. 'none' for combi paths
 * where hot water is inherent).
 */
export function kindToProposedHotWater(kind: HotWaterKindV1): UiProposedHotWaterLabel | null {
  switch (kind) {
    case 'existing_retained':     return 'retain_existing';
    case 'vented_cylinder':       return 'vented_cylinder';
    case 'unvented_cylinder':     return 'unvented_cylinder';
    case 'mixergy_or_stratified': return 'mixergy_or_stratified';
    case 'thermal_store':         return 'thermal_store';
    case 'heat_pump_cylinder':    return 'heat_pump_cylinder';
    case 'none':                  return 'no_stored_hot_water';
    default:                      return null;
  }
}
