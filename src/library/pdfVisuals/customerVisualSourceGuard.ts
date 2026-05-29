import type { LegoTechnicCustomerVisualClassification } from '../portal/pdf/legoTechnicCustomerVisualManifest';

/**
 * Re-declared here to avoid a circular import with buildPortalJourneyPrintModel.
 * Must stay in sync with ScenarioNarrativeRouteIdV1 in that module.
 */
export type ScenarioNarrativeRouteIdV1 = 'regular_vented' | 'system_unvented' | 'combi' | 'heat_pump';

/**
 * The source kind of a visual asset as it relates to customer-facing routes.
 *
 * - library     – approved asset from the Visual Education Library (canonical)
 * - legoTechnix – canonical Lego Technic diagram projection (canonical)
 * - candidate   – under visual correction / not yet canonical (blocked for customers)
 * - legacy      – retired legacy renderer or archived comparison graphic (blocked)
 * - fallback    – unresolved fallback with no canonical renderer (blocked)
 */
export type CustomerVisualSourceKind = 'library' | 'legoTechnix' | 'legacy' | 'fallback' | 'candidate';

/** Source kinds that are allowed on customer-facing routes (portal + PDF). */
export const ALLOWED_CUSTOMER_VISUAL_SOURCE_KINDS: ReadonlySet<CustomerVisualSourceKind> = new Set([
  'library',
  'legoTechnix',
]);

/**
 * Code names of legacy/non-canonical surfaces that must not feed
 * customer portal or supporting PDF content.
 */
export const BLOCKED_CUSTOMER_VISUAL_SURFACE_CODEIDS: ReadonlySet<string> = new Set([
  'InsightPackDeck',
  'CustomerAdvicePrintPack',
  'AtlasFrameworkPrintPage',
  'UnifiedSimulatorView',
  'LifestyleInteractive',
  'LifestyleInteractiveCompare',
  'SealedUnventedExplainerSlicePage',
]);

/** Returns true only if the given source kind is allowed on customer-facing routes. */
export function isAllowedCustomerVisualSource(kind: CustomerVisualSourceKind): boolean {
  return ALLOWED_CUSTOMER_VISUAL_SOURCE_KINDS.has(kind);
}

/**
 * Maps a LegoTechnic visual classification (or `'unlisted'`) onto a
 * `CustomerVisualSourceKind` so the portal/PDF audit trail can carry a
 * human-readable source label.
 */
export function resolveCustomerVisualSourceKind(
  classification: LegoTechnicCustomerVisualClassification | 'unlisted',
): CustomerVisualSourceKind {
  switch (classification) {
    case 'lego_technic_canonical':
      return 'legoTechnix';
    case 'retired_non_physical':
      return 'legacy';
    case 'dev_only':
      return 'candidate';
    case 'unlisted':
      return 'fallback';
    default: {
      const _exhaustive: never = classification;
      return 'fallback';
    }
  }
}

/**
 * System types that are compatible with each approved customer PDF visual asset.
 * A visual absent from this map is considered universal (no system-type constraint).
 *
 * Key = visualAssetId, Value = set of compatible ScenarioNarrativeRouteIdV1 values.
 */
export const VISUAL_ASSET_SYSTEM_TYPE_CONSTRAINTS: ReadonlyMap<
  string,
  ReadonlySet<ScenarioNarrativeRouteIdV1>
> = new Map([
  ['warm_vs_hot_radiators',           new Set<ScenarioNarrativeRouteIdV1>(['heat_pump'])],
  ['warm_radiator_emitter_sizing',    new Set<ScenarioNarrativeRouteIdV1>(['heat_pump'])],
  ['open_vented_to_unvented',         new Set<ScenarioNarrativeRouteIdV1>(['regular_vented', 'system_unvented'])],
  ['stored_hot_water_recovery_timeline', new Set<ScenarioNarrativeRouteIdV1>(['regular_vented', 'system_unvented', 'heat_pump'])],
  ['stratified_cylinder_mixergy',     new Set<ScenarioNarrativeRouteIdV1>(['system_unvented', 'heat_pump'])],
  ['weather_compensation_curve',      new Set<ScenarioNarrativeRouteIdV1>(['heat_pump', 'combi'])],
]);

/**
 * Returns true if the given visual asset is compatible with the recommended
 * system type.  Visual assets without a constraint entry are compatible with
 * all system types.
 */
export function isVisualCompatibleWithRecommendedSystemType(
  visualAssetId: string,
  recommendedSystemType: ScenarioNarrativeRouteIdV1,
): boolean {
  const constraint = VISUAL_ASSET_SYSTEM_TYPE_CONSTRAINTS.get(visualAssetId);
  if (constraint == null) return true;
  return constraint.has(recommendedSystemType);
}

export interface CustomerVisualSystemTypeMismatch {
  readonly visualAssetId: string;
  readonly recommendedSystemType: ScenarioNarrativeRouteIdV1;
  readonly compatibleSystemTypes: readonly ScenarioNarrativeRouteIdV1[];
  readonly compatible: false;
  readonly reason: string;
}

export interface CustomerVisualSystemTypeMatch {
  readonly visualAssetId: string;
  readonly recommendedSystemType: ScenarioNarrativeRouteIdV1;
  readonly compatible: true;
}

export type CustomerVisualSystemTypeCompatibilityResult =
  | CustomerVisualSystemTypeMatch
  | CustomerVisualSystemTypeMismatch;

/**
 * Asserts that the given visual asset is compatible with the recommended system
 * type and returns a typed result.  Use this in audit builders to surface
 * mismatch diagnostics in the content source.
 */
export function assertVisualCompatibleWithRecommendation(input: {
  readonly visualAssetId: string;
  readonly recommendedSystemType: ScenarioNarrativeRouteIdV1;
}): CustomerVisualSystemTypeCompatibilityResult {
  const { visualAssetId, recommendedSystemType } = input;
  if (isVisualCompatibleWithRecommendedSystemType(visualAssetId, recommendedSystemType)) {
    return { visualAssetId, recommendedSystemType, compatible: true };
  }
  const constraint = VISUAL_ASSET_SYSTEM_TYPE_CONSTRAINTS.get(visualAssetId);
  const compatibleSystemTypes: readonly ScenarioNarrativeRouteIdV1[] = constraint
    ? [...constraint]
    : [];
  return {
    visualAssetId,
    recommendedSystemType,
    compatibleSystemTypes,
    compatible: false,
    reason: `Visual "${visualAssetId}" is only compatible with [${compatibleSystemTypes.join(', ')}] but recommendation is "${recommendedSystemType}".`,
  };
}

export interface CustomerPdfVisualSourceAuditV1 {
  /** Source kind per accepted visual asset ID (same order as `visualAssetIds`). */
  readonly sourceKinds: ReadonlyArray<{ visualAssetId: string; kind: CustomerVisualSourceKind; canonical: boolean }>;
  /** Visual asset IDs whose source kind is not in `ALLOWED_CUSTOMER_VISUAL_SOURCE_KINDS`. */
  readonly blockedSourceIds: readonly string[];
  /** System-type compatibility results for visuals that carry a constraint. */
  readonly systemTypeMismatches: readonly CustomerVisualSystemTypeMismatch[];
  /** Whether every accepted visual passes both the source-kind gate and the system-type gate. */
  readonly allVisualsCanonical: boolean;
}
