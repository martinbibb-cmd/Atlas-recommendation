/**
 * src/features/externalFiles/externalVisitManifestStore.ts
 *
 * Manifest store for external visit file references.
 *
 * Persists and retrieves ExternalVisitManifestV1 records so that Atlas can
 * track where a client's visit files live without storing any file content.
 *
 * Design rules
 * ────────────
 * - Stores references only — no file blobs, no file content.
 * - The `visitManifests` collection is keyed by visitId.
 * - All writes rebuild the manifest summary from the current files array.
 * - No React dependencies — pure storage functions usable anywhere.
 * - Separate from the analytics pipeline — manifests must never enter
 *   analyticsStore or be forwarded to trackEvent.
 */

import { localAdapter } from '../../lib/storage/localStorageAdapter';
import {
  buildManifestSummary,
  type ExternalVisitManifestV1,
} from '../../contracts/ExternalVisitManifestV1';
import type { ClientFileReferenceV1 } from '../../contracts/ClientFileReferenceV1';

// ─── Collection constant ──────────────────────────────────────────────────────

const COLLECTION = 'visitManifests' as const;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the manifest for the given visitId, or null when none exists.
 */
export function loadManifestForVisit(visitId: string): ExternalVisitManifestV1 | null {
  return localAdapter.getSync(COLLECTION, visitId);
}

/**
 * Persists a manifest.  Rebuilds the summary from the current files array
 * before writing so the stored summary is always consistent.
 */
export function saveManifest(manifest: ExternalVisitManifestV1): void {
  const withSummary: ExternalVisitManifestV1 = {
    ...manifest,
    summary: buildManifestSummary(manifest.files),
    updatedAt: new Date().toISOString(),
  };
  try {
    localAdapter.upsertSync(COLLECTION, manifest.visitId, withSummary);
  } catch {
    // Storage quota exceeded or unavailable — best effort.
  }
}

/**
 * Removes the manifest for the given visitId.
 * Silently no-ops when no manifest exists.
 */
export function deleteManifestForVisit(visitId: string): void {
  localAdapter.deleteSync(COLLECTION, visitId);
}

/**
 * Adds or replaces a single ClientFileReferenceV1 within the manifest for
 * the given visitId and tenantId.  Creates the manifest when it does not
 * already exist.
 *
 * The `referenceId` field on the fileRef is used as the unique key — if a
 * reference with the same referenceId already exists it is replaced.
 */
export function upsertFileReference(
  visitId: string,
  tenantId: string,
  fileRef: ClientFileReferenceV1,
): void {
  const existing = loadManifestForVisit(visitId);
  const now = new Date().toISOString();

  if (existing) {
    const files = existing.files.filter((f) => f.referenceId !== fileRef.referenceId);
    files.push(fileRef);
    saveManifest({ ...existing, files });
  } else {
    const manifest: ExternalVisitManifestV1 = {
      version: '1',
      visitId,
      tenantId,
      createdAt: now,
      updatedAt: now,
      files: [fileRef],
      summary: buildManifestSummary([fileRef]),
    };
    saveManifest(manifest);
  }
}

/**
 * Removes a single file reference by referenceId from the manifest.
 * Silently no-ops when the manifest or reference does not exist.
 */
export function removeFileReference(visitId: string, referenceId: string): void {
  const existing = loadManifestForVisit(visitId);
  if (!existing) return;
  const files = existing.files.filter((f) => f.referenceId !== referenceId);
  saveManifest({ ...existing, files });
}
