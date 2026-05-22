import type { CanonicalVisitPackageV1 } from './CanonicalVisitPackageV1';
import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';

export const VISIT_PACKAGE_PDF_ENVELOPE_SCHEMA = 'atlas.visit-package-pdf-envelope' as const;
export const VISIT_PACKAGE_PDF_ENVELOPE_VERSION = '1.0' as const;

export interface VisitPackagePdfVisibleContentV1 {
  readonly customerPropertySummary: readonly string[];
  readonly recommendationSummary?: string;
  readonly generatedOutputStatus: string;
  readonly openWithAtlasInstructions: readonly string[];
}

/**
 * Machine-readable context describing how the engine processed the survey
 * data to produce the recommendation advice embedded in this PDF.
 */
export interface VisitPackagePdfProcessingContextV1 {
  /** Atlas engine version used to derive the recommendation. */
  readonly atlasEngineVersion: string;
  /** Recommended system label, if a recommendation was produced. */
  readonly recommendedSystemLabel?: string;
  /** Plain-language notes explaining key processing decisions. */
  readonly processingNotes: readonly string[];
}

export interface VisitPackagePdfEnvelopeV1 {
  readonly schema: typeof VISIT_PACKAGE_PDF_ENVELOPE_SCHEMA;
  readonly version: typeof VISIT_PACKAGE_PDF_ENVELOPE_VERSION;
  readonly generatedAt: string;
  readonly visitReference: string;
  readonly title: string;
  readonly visibleContent: VisitPackagePdfVisibleContentV1;
  readonly canonicalVisitPackage: CanonicalVisitPackageV1;
  /** Scan capture packages for this visit, when available. */
  readonly scanPackages?: readonly SessionCaptureV2[];
  /** Machine-readable context describing engine processing for this visit. */
  readonly processingContext?: VisitPackagePdfProcessingContextV1;
}
