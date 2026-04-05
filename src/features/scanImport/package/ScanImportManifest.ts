/**
 * ScanImportManifest.ts
 *
 * Type definitions and validator for the Atlas Scan export manifest.
 *
 * The manifest.json file is produced by the Atlas Scan client alongside
 * scan_bundle.json and optional evidence files.  It provides a pre-import
 * summary that Atlas uses to show a review screen before hydrating the
 * floor-plan draft.
 *
 * NOTE: When @atlas/contracts publishes a canonical ScanImportManifest type,
 * this local definition should be replaced with a re-export from that package.
 */

// ─── Manifest type ────────────────────────────────────────────────────────────

/**
 * Package statistics embedded in the manifest, summarising what the package
 * contains so Atlas can show a pre-import review without opening the bundle.
 */
export interface ScanPackageStats {
  /** Total number of rooms captured in the scan bundle. */
  roomCount: number;
  /** Rooms that were marked as reviewed by the scan operator. */
  reviewedRoomCount: number;
  /** Rooms captured by the scanner (may differ from reviewedRoomCount). */
  scannedRoomCount: number;
  /** Total detected objects across all rooms. */
  totalObjects: number;
  /** Total photos attached to this package. */
  totalPhotos: number;
}

/**
 * ScanImportManifest — the top-level manifest.json contract.
 *
 * version           — manifest contract version (currently '1.0')
 * jobRef            — human-readable job / visit reference
 * propertyAddress   — free-text property address string
 * generatedAt       — ISO-8601 timestamp of when the package was generated
 * bundleFile        — filename of the scan bundle (typically scan_bundle.json)
 * stats             — pre-computed summary counts
 * evidenceIncluded  — whether the package contains evidence files
 * evidenceFiles     — list of evidence file paths relative to package root
 * blockingIssues    — true if the scan client detected issues that should
 *                     prevent import without manual resolution
 * validationWarnings — human-readable warning strings raised by the scan client
 */
export interface ScanImportManifest {
  version: '1.0';
  jobRef: string;
  propertyAddress: string;
  generatedAt: string;
  bundleFile: string;
  stats: ScanPackageStats;
  evidenceIncluded: boolean;
  evidenceFiles: string[];
  blockingIssues: boolean;
  validationWarnings: string[];
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ManifestValidationSuccess {
  ok: true;
  manifest: ScanImportManifest;
}

export interface ManifestValidationFailure {
  ok: false;
  errors: string[];
}

export type ManifestValidationResult =
  | ManifestValidationSuccess
  | ManifestValidationFailure;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
}

function validateStats(v: unknown, path: string): string[] {
  if (!isObject(v)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isNumber(v['roomCount']))         errors.push(`${path}.roomCount: must be a number`);
  if (!isNumber(v['reviewedRoomCount'])) errors.push(`${path}.reviewedRoomCount: must be a number`);
  if (!isNumber(v['scannedRoomCount']))  errors.push(`${path}.scannedRoomCount: must be a number`);
  if (!isNumber(v['totalObjects']))      errors.push(`${path}.totalObjects: must be a number`);
  if (!isNumber(v['totalPhotos']))       errors.push(`${path}.totalPhotos: must be a number`);
  return errors;
}

/**
 * validateScanManifest — validates an unknown value against the
 * ScanImportManifest contract.
 *
 * Returns a ManifestValidationResult discriminated union.
 */
export function validateScanManifest(input: unknown): ManifestValidationResult {
  if (!isObject(input)) {
    return { ok: false, errors: ['Manifest must be a non-null JSON object'] };
  }

  const errors: string[] = [];

  if (input['version'] !== '1.0') {
    errors.push(`version: must be '1.0', got '${String(input['version'])}'`);
  }
  if (!isString(input['jobRef']))           errors.push('jobRef: must be a string');
  if (!isString(input['propertyAddress']))  errors.push('propertyAddress: must be a string');
  if (!isString(input['generatedAt']))      errors.push('generatedAt: must be a string');
  if (!isString(input['bundleFile']))       errors.push('bundleFile: must be a string');
  errors.push(...validateStats(input['stats'], 'stats'));
  if (!isBoolean(input['evidenceIncluded'])) errors.push('evidenceIncluded: must be a boolean');
  if (!isStringArray(input['evidenceFiles'])) errors.push('evidenceFiles: must be an array of strings');
  if (!isBoolean(input['blockingIssues']))   errors.push('blockingIssues: must be a boolean');
  if (!isStringArray(input['validationWarnings'])) {
    errors.push('validationWarnings: must be an array of strings');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Construct the manifest explicitly so TypeScript can verify the shape
  // rather than relying on an unsafe cast from Record<string, unknown>.
  const rawStats = input['stats'] as Record<string, unknown>;
  const manifest: ScanImportManifest = {
    version: input['version'] as ScanImportManifest['version'],
    jobRef: input['jobRef'] as string,
    propertyAddress: input['propertyAddress'] as string,
    generatedAt: input['generatedAt'] as string,
    bundleFile: input['bundleFile'] as string,
    stats: {
      roomCount: rawStats['roomCount'] as number,
      reviewedRoomCount: rawStats['reviewedRoomCount'] as number,
      scannedRoomCount: rawStats['scannedRoomCount'] as number,
      totalObjects: rawStats['totalObjects'] as number,
      totalPhotos: rawStats['totalPhotos'] as number,
    },
    evidenceIncluded: input['evidenceIncluded'] as boolean,
    evidenceFiles: input['evidenceFiles'] as string[],
    blockingIssues: input['blockingIssues'] as boolean,
    validationWarnings: input['validationWarnings'] as string[],
  };

  return { ok: true, manifest };
}
