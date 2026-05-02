/**
 * scanHandoffStore.ts
 *
 * Persistence helpers for scan handoff captures in Atlas Mind.
 *
 * Stores received SessionCaptureV2 payloads keyed by visitId so that the
 * evidence can be retrieved when the engineer opens the visit in Mind.
 *
 * Storage strategy
 * ────────────────
 * All reads and writes are delegated to localAdapter (LocalStorageAdapter),
 * which targets localStorage for the scanCaptures collection (persists across
 * sessions) with a sessionStorage fallback when localStorage is unavailable.
 *
 * Storage key:  atlas:scan-handoffs:v1
 *
 * Design rules
 * ────────────
 * - No React dependencies — pure storage functions usable anywhere.
 * - Each write replaces only the entry for that visitId (other entries are preserved).
 * - storeScanCapture throws on serialisation failure so callers can decide whether
 *   to surface a warning; all other errors are swallowed with a best-effort policy.
 */

import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import { localAdapter } from '../../lib/storage/localStorageAdapter';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Storage key used by the underlying adapter for the scanCaptures collection. */
export const SCAN_HANDOFF_STORAGE_KEY = 'atlas:scan-handoffs:v1';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Store (or overwrite) the SessionCaptureV2 for the given visitId.
 *
 * Preserves all other visitId entries in the store.
 *
 * @throws Error when JSON serialisation fails.
 */
export function storeScanCapture(
  visitId: string,
  capture: SessionCaptureV2,
): void {
  localAdapter.upsertSync('scanCaptures', visitId, capture);
}

/**
 * Retrieve the stored SessionCaptureV2 for a given visitId.
 *
 * Returns null when no capture has been stored for that visit.
 */
export function getScanCapture(visitId: string): SessionCaptureV2 | null {
  return localAdapter.getSync('scanCaptures', visitId);
}

/**
 * Remove the stored capture for a given visitId.
 *
 * Silently no-ops when no capture exists for that visitId.
 */
export function removeScanCapture(visitId: string): void {
  localAdapter.deleteSync('scanCaptures', visitId);
}

/**
 * Returns a snapshot of all stored captures keyed by visitId.
 * Returns an empty object when the store is empty or unavailable.
 */
export function listScanCaptures(): Record<string, SessionCaptureV2> {
  return localAdapter.readAllSync('scanCaptures');
}

/**
 * Clear all stored scan handoff captures.
 * Used by cache-bust and test teardown.
 */
export function clearScanHandoffStore(): void {
  localAdapter.clearSync('scanCaptures');
}

