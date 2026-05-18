export interface VisualEducationLibrarySurface {
  id: 'visual-primitive-gallery' | 'visual-topology-gallery' | 'analogy-overlay-gallery';
  codeName: 'VisualPrimitiveGallery' | 'VisualTopologyGallery' | 'AnalogyOverlayGallery';
  commonName: 'Visual Primitive Gallery' | 'Visual Topology Gallery' | 'Analogy Overlay Gallery';
  routePath:
    | '/dev/visual-primitive-gallery'
    | '/dev/visual-topology-gallery'
    | '/dev/analogy-overlay-gallery';
  queryFlag:
    | 'visual-primitive-gallery=1'
    | 'visual-topology-gallery=1'
    | 'analogy-overlay-gallery=1';
  description: string;
}

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
