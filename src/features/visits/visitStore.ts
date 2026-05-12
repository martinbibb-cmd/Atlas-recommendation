/**
 * src/features/visits/visitStore.ts
 *
 * Visit storage helpers for Atlas Mind.
 *
 * Persists and retrieves the active AtlasVisit so that a page reload within
 * the same browser tab can restore the in-progress visit.
 *
 * Storage strategy
 * ────────────────
 * All reads and writes are delegated to localAdapter (LocalStorageAdapter),
 * which targets sessionStorage for the visits collection.  The tab-scoped
 * nature of sessionStorage ensures the visit is cleared automatically when
 * the tab is closed.
 *
 * The active visit is stored under the reserved id 'active' within the
 * visits collection.
 *
 * Design rules
 * ────────────
 * - sessionStorage scope: cleared automatically when the tab is closed.
 * - Reads are defensive: missing or invalid data returns null.
 * - No React dependencies — pure storage functions usable anywhere.
 */

import type { AtlasVisit } from './createAtlasVisit';
import { localAdapter } from '../../lib/storage/localStorageAdapter';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Reserved id used to address the single active visit in the visits collection. */
const ACTIVE_VISIT_ID = 'active' as const;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Persists an AtlasVisit to the visits collection.
 * Silently no-ops if the underlying storage is unavailable.
 */
export function storeActiveVisit(visit: AtlasVisit): void {
  try {
    localAdapter.upsertSync('visits', ACTIVE_VISIT_ID, visit);
  } catch {
    // Storage quota exceeded or unavailable — best effort.
  }
}

/**
 * Retrieves the previously stored AtlasVisit.
 *
 * Returns null when:
 *  - No value has been stored yet.
 *  - The stored value is missing required `visitId` or `brandId` fields.
 */
export function retrieveActiveVisit(): AtlasVisit | null {
  const visit = localAdapter.getSync('visits', ACTIVE_VISIT_ID);
  if (!visit) return null;
  if (
    typeof visit.visitId !== 'string' ||
    visit.visitId.trim().length === 0 ||
    typeof visit.brandId !== 'string' ||
    visit.brandId.trim().length === 0 ||
    (visit.atlasUserId !== undefined &&
      (typeof visit.atlasUserId !== 'string' || visit.atlasUserId.trim().length === 0)) ||
    (visit.workspaceId !== undefined &&
      (typeof visit.workspaceId !== 'string' || visit.workspaceId.trim().length === 0))
  ) {
    return null;
  }
  return visit;
}

/**
 * Removes the stored AtlasVisit.
 * Called when the engineer ends or discards the active visit.
 */
export function clearActiveVisit(): void {
  localAdapter.deleteSync('visits', ACTIVE_VISIT_ID);
}
