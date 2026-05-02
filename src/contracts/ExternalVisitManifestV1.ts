/**
 * ExternalVisitManifestV1.ts — External visit save manifest contract.
 *
 * Purpose
 * ───────
 * A reference-only manifest that records where a client's visit files live in
 * their own external storage.  Atlas persists this manifest so it can locate
 * client-owned files without storing any file content, raw survey data,
 * transcripts, photos, or floor plans.
 *
 * Design rules
 * ────────────
 * - Stores references only — no file blobs, no file content.
 * - No raw survey data, no transcript text.
 * - No photo metadata beyond the ClientFileReferenceV1 reference record.
 * - The summary carries counts and file-kind presence only — no names,
 *   addresses, or any other customer content.
 * - The `files` field is a BLOCKED_CUSTOMER_KEY in the analytics privacy
 *   guard; manifests must never enter the analytics or CSV export pipeline.
 * - No engine or recommendation logic lives in this module.
 */

import {
  validateClientFileReferenceV1Fields,
  type ClientFileKind,
  type ClientFileReferenceV1,
} from './ClientFileReferenceV1';

// ─── Summary ──────────────────────────────────────────────────────────────────

/**
 * Aggregate counts derived from the manifest's file list.
 *
 * Privacy invariants
 * ──────────────────
 * - Contains counts and file-kind labels only.
 * - Must never carry file names, addresses, URIs, or any customer content.
 */
export interface ExternalVisitManifestSummaryV1 {
  /** Total number of file references in this manifest. */
  totalFiles: number;

  /**
   * Distinct file kinds present across all references.
   * Ordered deterministically (alphabetical) so equality checks are stable.
   */
  fileKindsPresent: ClientFileKind[];

  /**
   * Count of references per file kind.
   * Only kinds with at least one reference appear as keys.
   */
  countByKind: Partial<Record<ClientFileKind, number>>;
}

// ─── Manifest ─────────────────────────────────────────────────────────────────

/**
 * ExternalVisitManifestV1
 *
 * A structured record of where a client's visit-related files are stored.
 * Atlas persists this manifest to support structured external save; it does
 * not persist any file content.
 *
 * Storage
 * ───────
 * Persisted in the `visitManifests` storage collection, keyed by `visitId`.
 * One manifest per visit; upsert replaces the previous version.
 *
 * Privacy invariants
 * ──────────────────
 * - The `files` array is BLOCKED from analytics and CSV export pipelines.
 * - `summary` carries counts only and is safe for internal logging, but must
 *   not be forwarded to analytics events as a nested object.
 * - `visitId` and `tenantId` are IDs only and are allowlisted for analytics.
 */
export interface ExternalVisitManifestV1 {
  /** Discriminant — always "1". */
  version: '1';

  /** Atlas visit identifier this manifest belongs to. */
  visitId: string;

  /** Tenant identifier that owns this visit. */
  tenantId: string;

  /** ISO-8601 timestamp when this manifest was first created. */
  createdAt: string;

  /** ISO-8601 timestamp when this manifest was last updated. */
  updatedAt: string;

  /**
   * References to client-owned files associated with this visit.
   *
   * ⚠ Privacy — must NOT be included in analytics events or CSV exports.
   * The `files` key is a BLOCKED_CUSTOMER_KEY in the analytics privacy guard.
   */
  files: ClientFileReferenceV1[];

  /**
   * Aggregate summary derived from `files`.
   * Contains counts and file-kind labels only — no customer content.
   */
  summary: ExternalVisitManifestSummaryV1;
}

// ─── Summary builder ──────────────────────────────────────────────────────────

/**
 * Derives an ExternalVisitManifestSummaryV1 from an array of
 * ClientFileReferenceV1 records.
 *
 * The summary contains counts only — it carries no URIs, names, or other
 * customer content from the individual file references.
 */
export function buildManifestSummary(
  files: ClientFileReferenceV1[],
): ExternalVisitManifestSummaryV1 {
  const countByKind: Partial<Record<ClientFileKind, number>> = {};

  for (const file of files) {
    countByKind[file.fileKind] = (countByKind[file.fileKind] ?? 0) + 1;
  }

  const fileKindsPresent = (Object.keys(countByKind) as ClientFileKind[]).sort();

  return {
    totalFiles: files.length,
    fileKindsPresent,
    countByKind,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns a list of field-level validation errors for an unknown
 * ExternalVisitManifestV1 candidate.  An empty array means the value is valid.
 */
export function validateExternalVisitManifestV1Fields(
  raw: Record<string, unknown>,
): string[] {
  const errors: string[] = [];

  if (raw['version'] !== '1') {
    errors.push(`version: expected '1', got '${String(raw['version'])}'`);
  }
  if (typeof raw['visitId'] !== 'string' || raw['visitId'].trim().length === 0) {
    errors.push('visitId: must be a non-empty string');
  }
  if (typeof raw['tenantId'] !== 'string' || raw['tenantId'].trim().length === 0) {
    errors.push('tenantId: must be a non-empty string');
  }
  if (typeof raw['createdAt'] !== 'string' || raw['createdAt'].trim().length === 0) {
    errors.push('createdAt: must be a non-empty string');
  }
  if (typeof raw['updatedAt'] !== 'string' || raw['updatedAt'].trim().length === 0) {
    errors.push('updatedAt: must be a non-empty string');
  }

  // files: must be an array of valid ClientFileReferenceV1 items
  if (!Array.isArray(raw['files'])) {
    errors.push('files: must be an array');
  } else {
    for (let i = 0; i < (raw['files'] as unknown[]).length; i++) {
      const item = (raw['files'] as unknown[])[i];
      if (!isObject(item)) {
        errors.push(`files[${i}]: must be an object`);
      } else {
        const itemErrors = validateClientFileReferenceV1Fields(item);
        for (const e of itemErrors) {
          errors.push(`files[${i}].${e}`);
        }
      }
    }
  }

  // summary: required object with expected shape
  if (!isObject(raw['summary'])) {
    errors.push('summary: must be an object');
  } else {
    const s = raw['summary'];
    if (typeof s['totalFiles'] !== 'number' || !Number.isInteger(s['totalFiles']) || (s['totalFiles'] as number) < 0) {
      errors.push('summary.totalFiles: must be a non-negative integer');
    }
    if (!Array.isArray(s['fileKindsPresent'])) {
      errors.push('summary.fileKindsPresent: must be an array');
    } else {
      for (let i = 0; i < (s['fileKindsPresent'] as unknown[]).length; i++) {
        if (typeof (s['fileKindsPresent'] as unknown[])[i] !== 'string') {
          errors.push(`summary.fileKindsPresent[${i}]: must be a string`);
        }
      }
    }
    if (!isObject(s['countByKind'])) {
      errors.push('summary.countByKind: must be an object');
    }
  }

  return errors;
}

/**
 * Type guard: returns true when value is a structurally valid
 * ExternalVisitManifestV1.
 */
export function isExternalVisitManifestV1(value: unknown): value is ExternalVisitManifestV1 {
  if (!isObject(value)) return false;
  return validateExternalVisitManifestV1Fields(value).length === 0;
}
