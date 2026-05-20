import type { CanonicalVisitPackageV1 } from './CanonicalVisitPackageV1';

export const VISIT_PACKAGE_PDF_ENVELOPE_SCHEMA = 'atlas.visit-package-pdf-envelope' as const;
export const VISIT_PACKAGE_PDF_ENVELOPE_VERSION = '1.0' as const;

export interface VisitPackagePdfVisibleContentV1 {
  readonly customerPropertySummary: readonly string[];
  readonly recommendationSummary?: string;
  readonly generatedOutputStatus: string;
  readonly openWithAtlasInstructions: readonly string[];
}

export interface VisitPackagePdfEnvelopeV1 {
  readonly schema: typeof VISIT_PACKAGE_PDF_ENVELOPE_SCHEMA;
  readonly version: typeof VISIT_PACKAGE_PDF_ENVELOPE_VERSION;
  readonly generatedAt: string;
  readonly visitReference: string;
  readonly title: string;
  readonly visibleContent: VisitPackagePdfVisibleContentV1;
  readonly canonicalVisitPackage: CanonicalVisitPackageV1;
}
