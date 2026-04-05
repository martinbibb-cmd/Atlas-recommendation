/**
 * scanPackageImporter.ts
 *
 * Orchestrates the full Atlas Scan package import pipeline:
 *
 *   readScanPackage  → validate manifest  → importScanBundle  → result
 *
 * This is the single entry point for package-based imports.  It wraps the
 * existing importScanBundle pipeline with the manifest layer, and returns
 * a ScanPackageImportResult that drives the pre-import review screen and
 * post-import summary.
 *
 * Architecture contract:
 *   - raw package / manifest structures stay inside this boundary
 *   - callers receive only canonical draft state, provenance summary, and
 *     import metadata
 *   - no recommendation or simulation state is touched
 */

import { readScanPackage } from './scanPackageReader';
import { validateScanManifest, type ScanImportManifest } from './ScanImportManifest';
import { importScanBundle, type ScanImportResult } from '../importer/scanImporter';
import type { CanonicalFloorPlanDraft, ProvenanceSummary, ScanImportWarning } from '../importer/scanMapper';

// ─── Import readiness verdict ─────────────────────────────────────────────────

/**
 * Derived import readiness based on manifest contents and bundle validation.
 *
 * ready              — package is clean; import can proceed immediately
 * ready_with_warnings — import can proceed but warnings should be reviewed
 * blocked            — blocking issues prevent import without resolution
 */
export type ImportReadiness = 'ready' | 'ready_with_warnings' | 'blocked';

/**
 * Derive the import readiness verdict from a validated manifest and any
 * additional bundle-level warnings detected during the dry-run phase.
 */
export function deriveReadiness(
  manifest: ScanImportManifest,
  bundleWarnings: ScanImportWarning[],
): ImportReadiness {
  if (manifest.blockingIssues) return 'blocked';
  if (
    manifest.validationWarnings.length > 0 ||
    bundleWarnings.length > 0
  ) {
    return 'ready_with_warnings';
  }
  return 'ready';
}

// ─── Pre-import review data ───────────────────────────────────────────────────

/**
 * ScanPackageReview — the data shown on the pre-import review screen.
 *
 * Derived from the manifest before the user confirms the import.
 * The bundle is validated at this stage but not yet merged into any draft.
 */
export interface ScanPackageReview {
  /** Job reference from the manifest. */
  jobRef: string;
  /** Property address from the manifest. */
  propertyAddress: string;
  /** ISO-8601 timestamp when the package was generated. */
  generatedAt: string;
  /** Total rooms in the scan bundle. */
  roomCount: number;
  /** Rooms confirmed as reviewed by the scan operator. */
  reviewedRoomCount: number;
  /** Rooms captured by the scanner. */
  scannedRoomCount: number;
  /** Total detected objects. */
  totalObjects: number;
  /** Total photos. */
  totalPhotos: number;
  /** Whether the package contains evidence files. */
  evidenceIncluded: boolean;
  /** Count of detected evidence files. */
  evidenceFileCount: number;
  /** Whether blocking issues were flagged by the scan client. */
  blockingIssues: boolean;
  /** Human-readable warnings raised by the scan client. */
  validationWarnings: string[];
  /** Import readiness verdict. */
  readiness: ImportReadiness;
  /** What Atlas will do next on confirm. */
  importActions: string[];
}

// ─── Result types ─────────────────────────────────────────────────────────────

/** The package was read and reviewed; user confirmation is pending. */
export interface ScanPackageReviewReady {
  status: 'review_ready';
  review: ScanPackageReview;
  /** Parsed manifest — kept internally for the confirm step. */
  _manifest: ScanImportManifest;
  /** Parsed bundle raw — kept internally for the confirm step. */
  _bundleRaw: unknown;
}

/** Import confirmed: draft and summary available. */
export interface ScanPackageImportSuccess {
  status: 'imported';
  draft: CanonicalFloorPlanDraft;
  provenanceSummary: ProvenanceSummary;
  warnings: ScanImportWarning[];
  summary: ImportSummary;
}

/** Package read or manifest validation failed. */
export interface ScanPackageImportFailure {
  status: 'failed';
  errors: string[];
}

/** Bundle validation failed after manifest was accepted. */
export interface ScanPackageBundleFailure {
  status: 'bundle_invalid';
  errors: string[];
}

export type ScanPackageImportResult =
  | ScanPackageReviewReady
  | ScanPackageImportSuccess
  | ScanPackageImportFailure
  | ScanPackageBundleFailure;

// ─── Import summary ───────────────────────────────────────────────────────────

/**
 * ImportSummary — post-import summary shown after the draft has been hydrated.
 */
export interface ImportSummary {
  roomsImported: number;
  objectsImported: number;
  photosDetected: number;
  warningsCount: number;
  pendingReviewCount: number;
}

function buildImportSummary(
  draft: CanonicalFloorPlanDraft,
  provenanceSummary: ProvenanceSummary,
  warnings: ScanImportWarning[],
  manifest: ScanImportManifest,
): ImportSummary {
  // Count unreviewed entities as pending-review
  let pendingReview = 0;
  for (const floor of draft.floors) {
    for (const room of floor.rooms) {
      if (room.provenance?.reviewStatus === 'unreviewed') pendingReview++;
    }
  }

  return {
    roomsImported: provenanceSummary.totalRooms,
    objectsImported: manifest.stats.totalObjects,
    photosDetected: manifest.stats.totalPhotos,
    warningsCount: warnings.length,
    pendingReviewCount: pendingReview,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * reviewScanPackage — phase 1 of the package import flow.
 *
 * Reads the package files, validates the manifest, does a dry-run bundle
 * validation, and returns a ScanPackageReviewReady result for display on
 * the pre-import review screen.
 *
 * Call confirmScanPackageImport with the returned result to proceed.
 */
export async function reviewScanPackage(
  files: FileList,
): Promise<ScanPackageReviewReady | ScanPackageImportFailure | ScanPackageBundleFailure> {
  // 1. Read package files
  const readResult = await readScanPackage(files);
  if (!readResult.ok) {
    return { status: 'failed', errors: readResult.errors };
  }

  // 2. Validate manifest
  const manifestResult = validateScanManifest(readResult.manifestRaw);
  if (!manifestResult.ok) {
    return {
      status: 'failed',
      errors: manifestResult.errors.map(e => `manifest.json — ${e}`),
    };
  }

  const manifest = manifestResult.manifest;

  // 3. Dry-run bundle validation (validate + map to get warnings, but don't
  //    merge yet — user must confirm first)
  const bundleResult = importScanBundle(readResult.bundleRaw);

  if (
    bundleResult.status === 'rejected_invalid' ||
    bundleResult.status === 'rejected_unsupported_version'
  ) {
    const errors =
      bundleResult.status === 'rejected_invalid'
        ? bundleResult.errors
        : [
            `scan_bundle.json version '${bundleResult.version}' is not supported. ` +
              `Supported: ${bundleResult.supportedVersions.join(', ')}`,
          ];
    return { status: 'bundle_invalid', errors };
  }

  const bundleWarnings =
    bundleResult.status === 'success_with_warnings' ? bundleResult.warnings : [];
  const readiness = deriveReadiness(manifest, bundleWarnings);

  const importActions: string[] = [
    'Create draft floor plan',
    ...(bundleWarnings.length > 0 || manifest.validationWarnings.length > 0
      ? ['Mark some items as pending review']
      : []),
    ...(manifest.evidenceIncluded ? ['Register evidence presence'] : []),
    'Preserve provenance and source bundle reference',
  ];

  const review: ScanPackageReview = {
    jobRef: manifest.jobRef,
    propertyAddress: manifest.propertyAddress,
    generatedAt: manifest.generatedAt,
    roomCount: manifest.stats.roomCount,
    reviewedRoomCount: manifest.stats.reviewedRoomCount,
    scannedRoomCount: manifest.stats.scannedRoomCount,
    totalObjects: manifest.stats.totalObjects,
    totalPhotos: manifest.stats.totalPhotos,
    evidenceIncluded: manifest.evidenceIncluded,
    evidenceFileCount: readResult.evidenceCount,
    blockingIssues: manifest.blockingIssues,
    validationWarnings: manifest.validationWarnings,
    readiness,
    importActions,
  };

  return {
    status: 'review_ready',
    review,
    _manifest: manifest,
    _bundleRaw: readResult.bundleRaw,
  };
}

/**
 * confirmScanPackageImport — phase 2 of the package import flow.
 *
 * Takes the review-ready result from reviewScanPackage and runs the full
 * import pipeline to produce the canonical floor-plan draft.
 *
 * Only call this after the user has reviewed and confirmed the pre-import
 * review screen.
 */
export function confirmScanPackageImport(
  reviewReady: ScanPackageReviewReady,
): ScanPackageImportSuccess | ScanPackageImportFailure {
  const importResult: ScanImportResult = importScanBundle(reviewReady._bundleRaw);

  if (
    importResult.status === 'rejected_invalid' ||
    importResult.status === 'rejected_unsupported_version'
  ) {
    const errors =
      importResult.status === 'rejected_invalid'
        ? importResult.errors
        : [
            `Bundle version '${importResult.version}' is not supported. ` +
              `Supported: ${importResult.supportedVersions.join(', ')}`,
          ];
    return { status: 'failed', errors };
  }

  const { draft, warnings, provenanceSummary } = importResult;
  const summary = buildImportSummary(
    draft,
    provenanceSummary,
    warnings,
    reviewReady._manifest,
  );

  return {
    status: 'imported',
    draft,
    provenanceSummary,
    warnings,
    summary,
  };
}
