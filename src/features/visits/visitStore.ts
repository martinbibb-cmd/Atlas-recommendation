/**
 * src/features/visits/visitStore.ts
 *
 * Visit storage helpers for Atlas Mind.
 *
 * Persists and retrieves the active AtlasVisit from sessionStorage so that a
 * page reload within the same browser tab can restore the in-progress visit.
 *
 * Design rules
 * ────────────
 * - sessionStorage scope: cleared automatically when the tab is closed.
 * - Reads are defensive: malformed or missing data returns null.
 * - No React dependencies — pure storage functions usable anywhere.
 */

import type { AtlasVisit } from './createAtlasVisit';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'atlas_mind_active_visit_v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Persists an AtlasVisit to sessionStorage.
 * Silently no-ops if sessionStorage is unavailable (e.g. SSR, private browsing with
 * storage disabled).
 */
export function storeActiveVisit(visit: AtlasVisit): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(visit));
  } catch {
    // Storage quota exceeded or unavailable — best effort.
  }
}

/**
 * Retrieves the previously stored AtlasVisit from sessionStorage.
 *
 * Returns null when:
 *  - No value has been stored yet.
 *  - The stored value is not valid JSON.
 *  - The parsed value is missing required `visitId` or `brandId` fields.
 */
export function retrieveActiveVisit(): AtlasVisit | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AtlasVisit>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (
      typeof parsed.visitId !== 'string' ||
      parsed.visitId.trim().length === 0 ||
      typeof parsed.brandId !== 'string' ||
      parsed.brandId.trim().length === 0
    ) {
      return null;
    }
    return parsed as AtlasVisit;
  } catch {
    return null;
  }
}

/**
 * Removes the stored AtlasVisit from sessionStorage.
 * Called when the engineer ends or discards the active visit.
 */
export function clearActiveVisit(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — best effort.
  }
}
