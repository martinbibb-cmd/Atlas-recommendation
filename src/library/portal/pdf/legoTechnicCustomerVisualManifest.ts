import { educationalAnimationRegistry } from '../../animations/educationalAnimationRegistry';
import { printEquivalentRegistry } from '../../printEquivalents/printEquivalentRegistry';
import { VISUAL_ASSET_MANIFEST } from './visualAssetManifest';

export type LegoTechnicCustomerVisualClassification =
  | 'lego_technic_canonical'
  | 'retired_non_physical'
  | 'dev_only';

export type LegoTechnicCustomerVisualRenderer =
  | 'diagram_component'
  | 'educational_animation'
  | 'portal_custom_graphic'
  | 'print_fallback'
  | 'none';

export type LegoTechnicCustomerVisualSurface =
  | 'customer_pdf'
  | 'customer_portal'
  | 'mobile_portal'
  | 'print_preview';

export interface LegoTechnicCustomerVisualManifestEntry {
  readonly visualId: string;
  readonly rendererFamily: Exclude<LegoTechnicCustomerVisualRenderer, 'none'>;
  readonly classification: LegoTechnicCustomerVisualClassification;
  readonly reason?: string;
}

export const LEGACY_CUSTOMER_PORTAL_GRAPHIC_IDS = [
  'atlas_heat_flow_graphic',
  'atlas_system_state_graphic',
  'atlas_water_reserve_graphic',
] as const;

const RETIRED_VISUAL_REASON =
  'Retired from customer surfaces until rebuilt in Atlas Lego Technic physical-system language.';

const canonicalDiagramEntries: LegoTechnicCustomerVisualManifestEntry[] = VISUAL_ASSET_MANIFEST
  .filter((entry) => entry.assetId !== 'heat_pump_defrost')
  .map((entry) => ({
    visualId: entry.assetId,
    rendererFamily: 'diagram_component',
    classification: 'lego_technic_canonical',
  }));

const retiredAnimationEntries: LegoTechnicCustomerVisualManifestEntry[] = educationalAnimationRegistry.map((entry) => ({
  visualId: entry.animationId,
  rendererFamily: 'educational_animation',
  classification: 'retired_non_physical',
  reason: entry.replacementNeededReason ?? RETIRED_VISUAL_REASON,
}));

const retiredPrintFallbackEntries: LegoTechnicCustomerVisualManifestEntry[] = printEquivalentRegistry
  .map((entry) => ({
    visualId: entry.assetId,
    rendererFamily: 'print_fallback' as const,
    classification: 'retired_non_physical' as const,
    reason: RETIRED_VISUAL_REASON,
  }))
  .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.visualId === entry.visualId) === index);

const retiredLegacyPortalGraphicEntries: LegoTechnicCustomerVisualManifestEntry[] =
  LEGACY_CUSTOMER_PORTAL_GRAPHIC_IDS.map((visualId) => ({
    visualId,
    rendererFamily: 'portal_custom_graphic',
    classification: 'retired_non_physical',
    reason: RETIRED_VISUAL_REASON,
  }));

export const legoTechnicCustomerVisualManifest: readonly LegoTechnicCustomerVisualManifestEntry[] = [
  ...canonicalDiagramEntries,
  ...retiredAnimationEntries,
  ...retiredPrintFallbackEntries,
  ...retiredLegacyPortalGraphicEntries,
];

const legoTechnicCustomerVisualManifestById = new Map(
  legoTechnicCustomerVisualManifest.map((entry) => [entry.visualId, entry]),
);

export function getLegoTechnicCustomerVisualManifestEntry(visualId: string):
LegoTechnicCustomerVisualManifestEntry | undefined {
  return legoTechnicCustomerVisualManifestById.get(visualId);
}

export function listKnownCustomerFacingVisualIds(): string[] {
  return [
    ...new Set([
      ...VISUAL_ASSET_MANIFEST.map((entry) => entry.assetId),
      ...educationalAnimationRegistry.map((entry) => entry.animationId),
      ...printEquivalentRegistry.map((entry) => entry.assetId),
      ...LEGACY_CUSTOMER_PORTAL_GRAPHIC_IDS,
    ]),
  ];
}

export interface LegoTechnicCustomerVisualDecision {
  readonly requestedVisualId?: string;
  readonly classification: LegoTechnicCustomerVisualClassification | 'unlisted';
  readonly rendererUsed: LegoTechnicCustomerVisualRenderer;
  readonly allowed: boolean;
  readonly blockedReason?: string;
}

function formatSurfaceLabel(surface: LegoTechnicCustomerVisualSurface): string {
  switch (surface) {
    case 'customer_pdf':
      return 'customer PDF';
    case 'customer_portal':
      return 'customer portal';
    case 'mobile_portal':
      return 'mobile portal';
    case 'print_preview':
      return 'print preview';
    default:
      return surface;
  }
}

export function resolveLegoTechnicCustomerVisualDecision(input: {
  readonly visualId?: string;
  readonly rendererUsed: LegoTechnicCustomerVisualRenderer;
  readonly surface: LegoTechnicCustomerVisualSurface;
}): LegoTechnicCustomerVisualDecision {
  const { visualId, rendererUsed, surface } = input;
  if (visualId == null || visualId.trim().length === 0) {
    return {
      requestedVisualId: visualId,
      classification: 'unlisted',
      rendererUsed,
      allowed: false,
      blockedReason: `No visual ID was declared for ${formatSurfaceLabel(surface)} rendering.`,
    };
  }
  const manifestEntry = getLegoTechnicCustomerVisualManifestEntry(visualId);
  if (manifestEntry == null) {
    return {
      requestedVisualId: visualId,
      classification: 'unlisted',
      rendererUsed,
      allowed: false,
      blockedReason: `Visual "${visualId}" is not listed in legoTechnicCustomerVisualManifest and is blocked for ${formatSurfaceLabel(surface)} rendering.`,
    };
  }
  if (manifestEntry.classification !== 'lego_technic_canonical') {
    return {
      requestedVisualId: visualId,
      classification: manifestEntry.classification,
      rendererUsed,
      allowed: false,
      blockedReason: manifestEntry.reason
        ?? `Visual "${visualId}" is classified as ${manifestEntry.classification} and is blocked for ${formatSurfaceLabel(surface)} rendering.`,
    };
  }
  if (rendererUsed !== 'diagram_component') {
    return {
      requestedVisualId: visualId,
      classification: manifestEntry.classification,
      rendererUsed,
      allowed: false,
      blockedReason: `Visual "${visualId}" requires ${rendererUsed}, but only canonical Lego Technic diagram components are allowed on ${formatSurfaceLabel(surface)}.`,
    };
  }
  return {
    requestedVisualId: visualId,
    classification: manifestEntry.classification,
    rendererUsed,
    allowed: true,
  };
}

export function isLegoTechnicCanonicalCustomerVisual(visualId: string): boolean {
  return getLegoTechnicCustomerVisualManifestEntry(visualId)?.classification === 'lego_technic_canonical';
}
