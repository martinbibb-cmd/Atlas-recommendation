import { SUPPORTED_DIAGRAM_RENDERER_IDS } from '../../diagrams/DiagramRenderer';
import { printEquivalentByAssetId } from '../../printEquivalents/printEquivalentRegistry';

export type VisualAssetSurfaceV1 = 'portal' | 'pdf' | 'print';
export type VisualAssetRendererStrategyV1 = 'diagram_component' | 'print_fallback';
export type VisualAssetCompositionArchetypeV1 =
  | 'hero'
  | 'explanation'
  | 'lived_experience'
  | 'practical_work'
  | 'reassurance'
  | 'quiet';

export interface VisualAssetManifestEntryV1 {
  readonly assetId: string;
  readonly supportedSurfaces: readonly VisualAssetSurfaceV1[];
  readonly rendererStrategy: VisualAssetRendererStrategyV1;
  readonly minSize: {
    readonly width: number;
    readonly height: number;
  };
  readonly allowedCompositionArchetypes: readonly VisualAssetCompositionArchetypeV1[];
  readonly altText: string;
  readonly printFallbackAssetId?: string;
}

const DEFAULT_VISUAL_ARCHETYPES: readonly VisualAssetCompositionArchetypeV1[] = [
  'hero',
  'explanation',
  'lived_experience',
  'practical_work',
  'reassurance',
];

export const VISUAL_ASSET_MANIFEST: readonly VisualAssetManifestEntryV1[] = [
  {
    assetId: 'pressure_vs_storage',
    supportedSurfaces: ['portal', 'pdf', 'print'],
    rendererStrategy: 'diagram_component',
    minSize: { width: 520, height: 320 },
    allowedCompositionArchetypes: DEFAULT_VISUAL_ARCHETYPES,
    altText: 'Pressure force and stored hot-water volume shown as separate limits.',
  },
  {
    assetId: 'warm_vs_hot_radiators',
    supportedSurfaces: ['portal', 'pdf', 'print'],
    rendererStrategy: 'diagram_component',
    minSize: { width: 520, height: 320 },
    allowedCompositionArchetypes: DEFAULT_VISUAL_ARCHETYPES,
    altText: 'Low-temperature warm-for-longer radiator operation compared with hotter bursts.',
  },
  {
    assetId: 'water_main_limitation',
    supportedSurfaces: ['portal', 'pdf', 'print'],
    rendererStrategy: 'diagram_component',
    minSize: { width: 520, height: 320 },
    allowedCompositionArchetypes: DEFAULT_VISUAL_ARCHETYPES,
    altText: 'Mains supply limitation shown along the delivery path.',
  },
  {
    assetId: 'open_vented_to_unvented',
    supportedSurfaces: ['portal', 'pdf', 'print'],
    rendererStrategy: 'diagram_component',
    minSize: { width: 560, height: 340 },
    allowedCompositionArchetypes: DEFAULT_VISUAL_ARCHETYPES,
    altText: 'Open-vented layout transitioning to sealed circuit with unvented cylinder.',
  },
  {
    assetId: 'system_fit_decision_map',
    supportedSurfaces: ['portal', 'pdf', 'print'],
    rendererStrategy: 'diagram_component',
    minSize: { width: 560, height: 340 },
    allowedCompositionArchetypes: DEFAULT_VISUAL_ARCHETYPES,
    altText: 'Decision path linking household evidence to selected system fit.',
  },
  {
    assetId: 'stored_hot_water_recovery_timeline',
    supportedSurfaces: ['portal', 'pdf', 'print'],
    rendererStrategy: 'diagram_component',
    minSize: { width: 560, height: 300 },
    allowedCompositionArchetypes: DEFAULT_VISUAL_ARCHETYPES,
    altText: 'Stored hot-water reserve and recovery over a typical day.',
  },
  {
    assetId: 'warm_radiator_emitter_sizing',
    supportedSurfaces: ['portal', 'pdf', 'print'],
    rendererStrategy: 'diagram_component',
    minSize: { width: 520, height: 320 },
    allowedCompositionArchetypes: DEFAULT_VISUAL_ARCHETYPES,
    altText: 'Emitter sizing impact at lower flow temperatures.',
  },
  {
    assetId: 'flow_restriction_bottleneck',
    supportedSurfaces: ['portal', 'pdf', 'print'],
    rendererStrategy: 'diagram_component',
    minSize: { width: 520, height: 320 },
    allowedCompositionArchetypes: DEFAULT_VISUAL_ARCHETYPES,
    altText: 'Flow bottleneck reducing delivery at peak draw.',
  },
  {
    assetId: 'weather_compensation_curve',
    supportedSurfaces: ['portal', 'pdf', 'print'],
    rendererStrategy: 'diagram_component',
    minSize: { width: 520, height: 320 },
    allowedCompositionArchetypes: DEFAULT_VISUAL_ARCHETYPES,
    altText: 'Weather compensation supporting steadier operation.',
  },
  {
    assetId: 'stratified_cylinder_mixergy',
    supportedSurfaces: ['portal', 'pdf', 'print'],
    rendererStrategy: 'diagram_component',
    minSize: { width: 520, height: 320 },
    allowedCompositionArchetypes: DEFAULT_VISUAL_ARCHETYPES,
    altText: 'Stratified cylinder behaviour for staged hot-water delivery.',
  },
  {
    assetId: 'powerflush_condition_led',
    supportedSurfaces: ['portal', 'pdf', 'print'],
    rendererStrategy: 'diagram_component',
    minSize: { width: 520, height: 320 },
    allowedCompositionArchetypes: DEFAULT_VISUAL_ARCHETYPES,
    altText: 'Condition-led cleaning path for system protection.',
  },
  {
    assetId: 'magnetic_filter_capture',
    supportedSurfaces: ['portal', 'pdf', 'print'],
    rendererStrategy: 'diagram_component',
    minSize: { width: 520, height: 320 },
    allowedCompositionArchetypes: DEFAULT_VISUAL_ARCHETYPES,
    altText: 'Magnetic filter capture path before sensitive components.',
  },
  {
    assetId: 'system_pressure_window',
    supportedSurfaces: ['portal', 'pdf', 'print'],
    rendererStrategy: 'diagram_component',
    minSize: { width: 520, height: 320 },
    allowedCompositionArchetypes: DEFAULT_VISUAL_ARCHETYPES,
    altText: 'Healthy sealed-system pressure operating window.',
  },
  {
    assetId: 'heat_pump_defrost',
    supportedSurfaces: ['portal', 'pdf', 'print'],
    rendererStrategy: 'print_fallback',
    printFallbackAssetId: 'heat_pump_defrost',
    minSize: { width: 520, height: 320 },
    allowedCompositionArchetypes: DEFAULT_VISUAL_ARCHETYPES,
    altText: 'Heat-pump defrost cycle timeline showing normal short recovery pauses.',
  },
] as const;

const visualAssetManifestById = new Map(VISUAL_ASSET_MANIFEST.map((entry) => [entry.assetId, entry]));
const supportedDiagramIdSet = new Set<string>(SUPPORTED_DIAGRAM_RENDERER_IDS);

export function getVisualAssetManifestEntry(assetId: string): VisualAssetManifestEntryV1 | undefined {
  return visualAssetManifestById.get(assetId);
}

export function getVisualAssetRendererAvailability(assetId: string): {
  readonly hasDiagramRenderer: boolean;
  readonly hasPrintFallback: boolean;
} {
  const manifest = getVisualAssetManifestEntry(assetId);
  if (manifest == null) {
    return {
      hasDiagramRenderer: false,
      hasPrintFallback: false,
    };
  }
  const hasDiagramRenderer = supportedDiagramIdSet.has(assetId);
  const printFallbackAssetId = manifest.printFallbackAssetId ?? assetId;
  const hasPrintFallback = printEquivalentByAssetId.has(printFallbackAssetId);
  return {
    hasDiagramRenderer,
    hasPrintFallback,
  };
}

export function listManifestAssetIds(): string[] {
  return VISUAL_ASSET_MANIFEST.map((entry) => entry.assetId);
}
