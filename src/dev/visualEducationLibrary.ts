export interface VisualEducationLibrarySurface {
  id: 'visual-primitive-gallery' | 'visual-topology-gallery' | 'analogy-overlay-gallery' | 'sealed-unvented-explainer-slice';
  codeName: 'VisualPrimitiveGallery' | 'VisualTopologyGallery' | 'AnalogyOverlayGallery' | 'SealedUnventedExplainerSlicePage';
  commonName: 'Visual Primitive Gallery' | 'Visual Topology Gallery' | 'Analogy Overlay Gallery' | 'Sealed + Unvented Explainer Slice';
  routePath:
    | '/dev/visual-primitive-gallery'
    | '/dev/visual-topology-gallery'
    | '/dev/analogy-overlay-gallery'
    | '/dev/sealed-unvented-explainer-slice';
  queryFlag:
    | 'visual-primitive-gallery=1'
    | 'visual-topology-gallery=1'
    | 'analogy-overlay-gallery=1'
      | 'sealed-unvented-explainer-slice=1';
  description: string;
  isGoldenReference?: boolean;
  actionLabel?: string;
}

export interface VisualEducationLibraryHubRoute {
  id: 'visual-education-library-qa-hub';
  codeName: 'VisualEducationLibraryQaHubPage';
  commonName: 'Visual Education Library QA Hub';
  routePath: '/dev/visual-education-library';
  queryFlag: 'visual-education-library=1';
  description: string;
}

export interface VisualEducationLegacySurfaceLink {
  label: 'Legacy Diagram Fixture' | 'Library Explorer';
  routePath: '/dev/diagram-fixture' | '/dev/library-explorer';
  queryFlag: 'diagram-fixture=1' | 'library-explorer=1';
  description: string;
}

export const VISUAL_EDUCATION_LIBRARY_QA_HUB: VisualEducationLibraryHubRoute = {
  id: 'visual-education-library-qa-hub',
  codeName: 'VisualEducationLibraryQaHubPage',
  commonName: 'Visual Education Library QA Hub',
  routePath: '/dev/visual-education-library',
  queryFlag: 'visual-education-library=1',
  description:
    'Front door for the visual education QA surfaces, with direct links to the primitive, topology, overlay, and legacy diagram fixtures.',
};

export const VISUAL_EDUCATION_LIBRARY_SURFACES: readonly VisualEducationLibrarySurface[] = [
  {
    id: 'visual-primitive-gallery',
    codeName: 'VisualPrimitiveGallery',
    commonName: 'Visual Primitive Gallery',
    routePath: '/dev/visual-primitive-gallery',
    queryFlag: 'visual-primitive-gallery=1',
    description:
      'Canonical physical primitive QA gallery with no-label, print-safe, and recognisability review fixtures.',
  },
  {
    id: 'visual-topology-gallery',
    codeName: 'VisualTopologyGallery',
    commonName: 'Visual Topology Gallery',
    routePath: '/dev/visual-topology-gallery',
    queryFlag: 'visual-topology-gallery=1',
    description:
      'Canonical topology QA gallery for flow/return traceability, layout realism, and print-safe review.',
  },
  {
    id: 'analogy-overlay-gallery',
    codeName: 'AnalogyOverlayGallery',
    commonName: 'Analogy Overlay Gallery',
    routePath: '/dev/analogy-overlay-gallery',
    queryFlag: 'analogy-overlay-gallery=1',
    description:
      'Anchored overlay QA gallery showing narration modes without hiding the baseline physical topology.',
  },
  {
    id: 'sealed-unvented-explainer-slice',
    codeName: 'SealedUnventedExplainerSlicePage',
    commonName: 'Sealed + Unvented Explainer Slice',
    routePath: '/dev/sealed-unvented-explainer-slice',
    queryFlag: 'sealed-unvented-explainer-slice=1',
    description:
      'Single customer explainer slice proving hydraulic truth → physical topology → optional analogy overlays with mobile and print-safe previews.',
    isGoldenReference: true,
    actionLabel: 'Open golden reference',
  },
] as const;

export const VISUAL_EDUCATION_LEGACY_SURFACE_LINKS: readonly VisualEducationLegacySurfaceLink[] = [
  {
    label: 'Legacy Diagram Fixture',
    routePath: '/dev/diagram-fixture',
    queryFlag: 'diagram-fixture=1',
    description: 'Legacy heating diagram fixture kept for comparison against the newer PR1/PR2/PR3 galleries.',
  },
  {
    label: 'Library Explorer',
    routePath: '/dev/library-explorer',
    queryFlag: 'library-explorer=1',
    description: 'Concept backlog and content coverage surface — useful, but not the new visual gallery front door.',
  },
] as const;

export function getVisualEducationLibrarySurface(
  codeName: VisualEducationLibrarySurface['codeName'],
): VisualEducationLibrarySurface {
  const surface = VISUAL_EDUCATION_LIBRARY_SURFACES.find((entry) => entry.codeName === codeName);
  if (surface == null) {
    throw new Error(`Unknown visual education library surface: ${codeName}`);
  }
  return surface;
}

export function resolveActiveVisualEducationLibrarySurface(
  locationLike: Pick<Location, 'pathname' | 'search'>,
): VisualEducationLibrarySurface | null {
  const params = new URLSearchParams(locationLike.search);
  return (
    VISUAL_EDUCATION_LIBRARY_SURFACES.find(
      (surface) =>
        locationLike.pathname === surface.routePath || params.get(surface.queryFlag.split('=')[0]) === '1',
    ) ?? null
  );
}

export function isVisualEducationLibraryQaHubRoute(
  locationLike: Pick<Location, 'pathname' | 'search'>,
): boolean {
  const params = new URLSearchParams(locationLike.search);
  return (
    locationLike.pathname === VISUAL_EDUCATION_LIBRARY_QA_HUB.routePath
    || params.get(VISUAL_EDUCATION_LIBRARY_QA_HUB.queryFlag.split('=')[0]) === '1'
  );
}
