/**
 * buildCurrentInstallationSummaryFromCanonicalSurvey.ts
 *
 * Adapter: maps the existing Atlas canonical survey / engine input into a
 * `CanonicalCurrentSystemSummary` for use in the Installation Specification
 * current-system read-only summary step.
 *
 * This is the **single authoritative bridge** between survey truth and
 * the Installation Specification current-system display.
 *
 * Design rules:
 *   - Never re-collects current-system data — reads from existing survey fields.
 *   - Priority: systemBuilder (richest) → currentSystem (engine-normalised) →
 *     flat legacy fields (currentHeatSourceType, dhwStorageType) → null.
 *   - Only returns null for a field when that fact is genuinely absent from
 *     all survey layers; use 'not_applicable' when it is structurally irrelevant.
 *   - Does NOT invent cylinder type or primary circuit from heat source alone —
 *     only infers what the survey actually contains or what is structurally
 *     certain (e.g. combi → no separate cylinder).
 *   - No engine calls, no mutations, no React dependencies.
 */

import type {
  CanonicalCurrentSystemSummary,
  UiCurrentHeatSourceLabel,
  UiCurrentHotWaterLabel,
  UiCurrentPrimaryCircuitLabel,
} from '../ui/installationSpecificationUiTypes';

// ─── Input shape ─────────────────────────────────────────────────────────────

/**
 * Minimal input accepted by the adapter.
 *
 * Structurally compatible with:
 *   - `FullSurveyModelV1` (the complete survey model)
 *   - `EngineInputV2_3` (the engine contract subset)
 *   - Legacy visit payloads with only flat fields
 *
 * All fields are optional — the adapter produces as much information as is
 * available and leaves unknown fields as null.
 */
export interface CanonicalSurveyAdapterInput {
  /**
   * Flat legacy heat-source type — used when systemBuilder is absent.
   * Maps: 'combi' → combi_boiler, 'system' → system_boiler,
   *       'regular' → regular_boiler, 'ashp' → heat_pump, 'other' → other_heat_source.
   */
  currentHeatSourceType?: 'combi' | 'system' | 'regular' | 'ashp' | 'other';

  /**
   * Flat legacy DHW storage type — used when systemBuilder is absent.
   */
  dhwStorageType?: 'none' | 'vented' | 'unvented' | 'mixergy' | 'thermal_store' | 'heat_pump_cylinder';

  /**
   * Structured current system — engine-normalised (from EngineInputV2_3).
   */
  currentSystem?: {
    boiler?: {
      type?: 'combi' | 'system' | 'regular' | 'back_boiler' | 'unknown';
    };
    heatingSystemType?: 'open_vented' | 'sealed' | 'unknown';
  };

  /**
   * DHW architecture — used as last-resort hot-water classification.
   */
  dhw?: {
    architecture: 'on_demand' | 'stored_standard' | 'stored_mixergy' | 'unknown';
  };

  /**
   * Extended survey data available in FullSurveyModelV1.fullSurvey.
   */
  fullSurvey?: {
    /** System Architecture step — richest source for current system data. */
    systemBuilder?: {
      heatSource: 'regular' | 'system' | 'combi' | 'storage_combi' | null;
      dhwType: 'open_vented' | 'unvented' | 'thermal_store' | 'plate_hex' | 'small_store' | null;
      heatingSystemType: 'open_vented' | 'sealed' | 'unknown' | null;
    };
    /** Heating/primary circuit condition observations — direct site evidence. */
    heatingCondition?: {
      systemCircuitType?: 'open_vented' | 'sealed' | 'unknown';
    };
    /** DHW condition diagnostics — captures current cylinder type. */
    dhwCondition?: {
      currentCylinderPresent?: boolean;
      currentCylinderType?: 'vented' | 'unvented' | 'mixergy' | 'unknown';
      cylinderInstallLocation?: 'airing_cupboard' | 'utility_room' | 'garage' | 'basement' | 'unknown';
    };
  };
}

// ─── Heat source mapping ──────────────────────────────────────────────────────

/**
 * Maps the systemBuilder heatSource to a UiCurrentHeatSourceLabel.
 */
function mapSystemBuilderHeatSource(
  heatSource: 'regular' | 'system' | 'combi' | 'storage_combi' | null | undefined,
): UiCurrentHeatSourceLabel | null {
  switch (heatSource) {
    case 'combi':         return 'combi_boiler';
    case 'system':        return 'system_boiler';
    case 'regular':       return 'regular_boiler';
    case 'storage_combi': return 'storage_combi';
    default:              return null;
  }
}

/**
 * Maps the engine-normalised currentSystem.boiler.type to a UiCurrentHeatSourceLabel.
 */
function mapEngineBoilerType(
  type: 'combi' | 'system' | 'regular' | 'back_boiler' | 'unknown' | undefined,
): UiCurrentHeatSourceLabel | null {
  switch (type) {
    case 'combi':      return 'combi_boiler';
    case 'system':     return 'system_boiler';
    case 'regular':    return 'regular_boiler';
    case 'back_boiler': return 'back_boiler';
    default:           return null;
  }
}

/**
 * Maps the flat legacy currentHeatSourceType to a UiCurrentHeatSourceLabel.
 */
function mapFlatHeatSourceType(
  type: 'combi' | 'system' | 'regular' | 'ashp' | 'other' | undefined,
): UiCurrentHeatSourceLabel | null {
  switch (type) {
    case 'combi':   return 'combi_boiler';
    case 'system':  return 'system_boiler';
    case 'regular': return 'regular_boiler';
    case 'ashp':    return 'heat_pump';
    case 'other':   return 'other_heat_source';
    default:        return null;
  }
}

/**
 * Derives the current heat source label in priority order:
 * 1. systemBuilder.heatSource (richest — direct survey answer)
 * 2. currentSystem.boiler.type (engine-normalised)
 * 3. currentHeatSourceType (flat legacy field)
 * 4. null (genuinely absent)
 */
function deriveHeatSource(input: CanonicalSurveyAdapterInput): UiCurrentHeatSourceLabel | null {
  return (
    mapSystemBuilderHeatSource(input.fullSurvey?.systemBuilder?.heatSource) ??
    mapEngineBoilerType(input.currentSystem?.boiler?.type) ??
    mapFlatHeatSourceType(input.currentHeatSourceType) ??
    null
  );
}

// ─── Hot water mapping ────────────────────────────────────────────────────────

/**
 * Returns true when a heat source label is a combi-type appliance.
 * Combi and storage_combi have no separate cylinder — DHW is instantaneous.
 */
function isCombiHeatSource(heatSource: UiCurrentHeatSourceLabel | null): boolean {
  return heatSource === 'combi_boiler' || heatSource === 'storage_combi';
}

/**
 * Maps the systemBuilder dhwType to a UiCurrentHotWaterLabel.
 * 'plate_hex' and 'small_store' are combi-internal — mapped to no_cylinder.
 */
function mapSystemBuilderDhwType(
  dhwType: 'open_vented' | 'unvented' | 'thermal_store' | 'plate_hex' | 'small_store' | null | undefined,
): UiCurrentHotWaterLabel | null {
  switch (dhwType) {
    case 'open_vented':  return 'vented_cylinder';
    case 'unvented':     return 'unvented_cylinder';
    case 'thermal_store': return 'thermal_store';
    case 'plate_hex':    return 'no_cylinder';
    case 'small_store':  return 'integrated_store';
    default:             return null;
  }
}

/**
 * Maps the flat dhwStorageType to a UiCurrentHotWaterLabel.
 */
function mapFlatDhwStorageType(
  type: 'none' | 'vented' | 'unvented' | 'mixergy' | 'thermal_store' | 'heat_pump_cylinder' | undefined,
): UiCurrentHotWaterLabel | null {
  switch (type) {
    case 'none':              return 'no_cylinder';
    case 'vented':            return 'vented_cylinder';
    case 'unvented':          return 'unvented_cylinder';
    case 'mixergy':           return 'mixergy_or_stratified';
    case 'thermal_store':     return 'thermal_store';
    case 'heat_pump_cylinder': return 'unvented_cylinder';
    default:                  return null;
  }
}

/**
 * Maps the dhwCondition.currentCylinderType to a UiCurrentHotWaterLabel.
 */
function mapDhwConditionCylinderType(
  type: 'vented' | 'unvented' | 'mixergy' | 'unknown' | undefined,
): UiCurrentHotWaterLabel | null {
  switch (type) {
    case 'vented':   return 'vented_cylinder';
    case 'unvented': return 'unvented_cylinder';
    case 'mixergy':  return 'mixergy_or_stratified';
    default:         return null;
  }
}

/**
 * Maps dhw.architecture to a UiCurrentHotWaterLabel as a last-resort fallback.
 */
function mapDhwArchitecture(
  arch: 'on_demand' | 'stored_standard' | 'stored_mixergy' | 'unknown' | undefined,
): UiCurrentHotWaterLabel | null {
  switch (arch) {
    case 'on_demand':      return 'no_cylinder';
    case 'stored_mixergy': return 'mixergy_or_stratified';
    // 'stored_standard' is intentionally not mapped — we cannot determine
    // vented vs unvented from architecture alone without further survey data.
    default: return null;
  }
}

/**
 * Derives the current hot-water label in priority order:
 * 1. If heat source is combi/storage_combi → no_cylinder (structurally certain)
 * 2. systemBuilder.dhwType (direct survey answer)
 * 3. dhwCondition.currentCylinderType (observed cylinder type)
 * 4. dhwStorageType (engine-normalised flat field)
 * 5. dhw.architecture (very coarse last-resort)
 * 6. null (genuinely absent)
 */
function deriveHotWater(
  input: CanonicalSurveyAdapterInput,
  heatSource: UiCurrentHeatSourceLabel | null,
): UiCurrentHotWaterLabel | null {
  // Structurally certain: combi/storage_combi never has a separate cylinder.
  if (isCombiHeatSource(heatSource)) return 'no_cylinder';

  return (
    mapSystemBuilderDhwType(input.fullSurvey?.systemBuilder?.dhwType) ??
    mapDhwConditionCylinderType(input.fullSurvey?.dhwCondition?.currentCylinderType) ??
    mapFlatDhwStorageType(input.dhwStorageType) ??
    mapDhwArchitecture(input.dhw?.architecture) ??
    null
  );
}

// ─── Primary circuit mapping ──────────────────────────────────────────────────

/**
 * Maps a circuit type string ('open_vented' | 'sealed' | 'unknown') to a label.
 * Returns null for 'unknown' — we only assert what we know.
 */
function mapCircuitType(
  circuit: 'open_vented' | 'sealed' | 'unknown' | null | undefined,
): UiCurrentPrimaryCircuitLabel | null {
  switch (circuit) {
    case 'open_vented': return 'open_vented_primary';
    case 'sealed':      return 'sealed_primary';
    default:            return null;
  }
}

/**
 * Derives the current primary circuit label in priority order:
 * 1. heatingCondition.systemCircuitType (direct site observation — highest confidence)
 * 2. systemBuilder.heatingSystemType (direct survey answer)
 * 3. currentSystem.heatingSystemType (engine-normalised)
 * 4. If heat source is combi → 'not_applicable' (primary circuit not a separate survey field)
 * 5. null (genuinely absent — not enough data)
 */
function derivePrimaryCircuit(
  input: CanonicalSurveyAdapterInput,
  heatSource: UiCurrentHeatSourceLabel | null,
): UiCurrentPrimaryCircuitLabel | null {
  const fromHeatingCondition = mapCircuitType(input.fullSurvey?.heatingCondition?.systemCircuitType);
  if (fromHeatingCondition != null) return fromHeatingCondition;

  const fromSystemBuilder = mapCircuitType(input.fullSurvey?.systemBuilder?.heatingSystemType);
  if (fromSystemBuilder != null) return fromSystemBuilder;

  const fromCurrentSystem = mapCircuitType(input.currentSystem?.heatingSystemType);
  if (fromCurrentSystem != null) return fromCurrentSystem;

  // Combi boilers: primary circuit was not captured as a separate survey field.
  // This is structurally expected — use 'not_applicable' rather than showing
  // "Missing from canonical survey".
  if (isCombiHeatSource(heatSource)) return 'not_applicable';

  return null;
}

// ─── Location labels ──────────────────────────────────────────────────────────

const CYLINDER_LOCATION_LABELS: Record<string, string> = {
  airing_cupboard: 'Airing cupboard',
  utility_room:    'Utility room',
  garage:          'Garage',
  basement:        'Basement',
};

function deriveCylinderLocation(input: CanonicalSurveyAdapterInput): string | undefined {
  const loc = input.fullSurvey?.dhwCondition?.cylinderInstallLocation;
  if (loc == null || loc === 'unknown') return undefined;
  return CYLINDER_LOCATION_LABELS[loc] ?? undefined;
}

// ─── Main adapter ─────────────────────────────────────────────────────────────

/**
 * Build a `CanonicalCurrentSystemSummary` from existing Atlas survey data.
 *
 * This is the primary hydration path for the Installation Specification
 * current-system read-only summary step.
 *
 * The function reads all available survey layers in priority order and
 * returns as much information as is genuinely present.  It never invents
 * data that was not recorded by the surveyor.
 *
 * @param input  Canonical survey / engine input for the visit.
 *               Compatible with FullSurveyModelV1, EngineInputV2_3, and
 *               legacy visit payloads.
 * @returns      A CanonicalCurrentSystemSummary with null fields only where
 *               the data is genuinely absent from all survey layers.
 */
export function buildCurrentInstallationSummaryFromCanonicalSurvey(
  input: CanonicalSurveyAdapterInput,
): CanonicalCurrentSystemSummary {
  const heatSource    = deriveHeatSource(input);
  const hotWater      = deriveHotWater(input, heatSource);
  const primaryCircuit = derivePrimaryCircuit(input, heatSource);
  const cylinderLocation = deriveCylinderLocation(input);

  return {
    heatSource,
    hotWater,
    primaryCircuit,
    ...(cylinderLocation != null ? { cylinderLocation } : {}),
  };
}
