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
 * - Primary:  localStorage (survives page reload and tab close — appropriate
 *             for persisting received scan evidence between sessions).
 * - Fallback: sessionStorage (used when localStorage is unavailable, e.g.
 *             private browsing with storage disabled).
 * - Reads are defensive: malformed or missing data returns null / empty.
 *
 * Storage key:  atlas:scan-handoffs:v1
 *
 * Store shape:
 *   {
 *     schemaVersion: 1,
 *     capturesByVisitId: Record<string, SessionCaptureV2>
 *   }
 *
 * Design rules
 * ────────────
 * - No React dependencies — pure storage functions usable anywhere.
 * - Each write replaces only the entry for that visitId (other entries are preserved).
 * - storeScanCapture throws on serialisation failure so callers can decide whether
 *   to surface a warning; all other errors are swallowed with a best-effort policy.
 */

import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';

// ─── Constants ────────────────────────────────────────────────────────────────

export const SCAN_HANDOFF_STORAGE_KEY = 'atlas:scan-handoffs:v1';

const SCHEMA_VERSION = 1 as const;

// ─── Store shape ──────────────────────────────────────────────────────────────

interface ScanHandoffStoreShape {
  schemaVersion: typeof SCHEMA_VERSION;
  capturesByVisitId: Record<string, SessionCaptureV2>;
}

// ─── Storage access helpers ───────────────────────────────────────────────────

function getStorage(): Storage | null {
  try {
    // Prefer localStorage so captures persist across sessions.
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // localStorage may throw in some environments.
  }
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    // sessionStorage also unavailable.
  }
  return null;
}

// ─── Store read / write helpers ───────────────────────────────────────────────

function readStore(): ScanHandoffStoreShape {
  const storage = getStorage();
  if (!storage) {
    return { schemaVersion: SCHEMA_VERSION, capturesByVisitId: {} };
  }
  try {
    const raw = storage.getItem(SCAN_HANDOFF_STORAGE_KEY);
    if (!raw) return { schemaVersion: SCHEMA_VERSION, capturesByVisitId: {} };
    const parsed = JSON.parse(raw) as Partial<ScanHandoffStoreShape>;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      parsed.schemaVersion !== SCHEMA_VERSION ||
      typeof parsed.capturesByVisitId !== 'object' ||
      parsed.capturesByVisitId === null
    ) {
      return { schemaVersion: SCHEMA_VERSION, capturesByVisitId: {} };
    }
    return parsed as ScanHandoffStoreShape;
  } catch {
    return { schemaVersion: SCHEMA_VERSION, capturesByVisitId: {} };
  }
}

function writeStore(store: ScanHandoffStoreShape): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(SCAN_HANDOFF_STORAGE_KEY, JSON.stringify(store));
}

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
  const store = readStore();
  store.capturesByVisitId[visitId] = capture;
  writeStore(store);
}

/**
 * Retrieve the stored SessionCaptureV2 for a given visitId.
 *
 * Returns null when no capture has been stored for that visit.
 */
export function getScanCapture(visitId: string): SessionCaptureV2 | null {
  const store = readStore();
  return store.capturesByVisitId[visitId] ?? null;
}

/**
 * Remove the stored capture for a given visitId.
 *
 * Silently no-ops when no capture exists for that visitId.
 */
export function removeScanCapture(visitId: string): void {
  try {
    const store = readStore();
    delete store.capturesByVisitId[visitId];
    writeStore(store);
  } catch {
    // Best effort.
  }
}

/**
 * Returns a snapshot of all stored captures keyed by visitId.
 * Returns an empty object when the store is empty or unavailable.
 */
export function listScanCaptures(): Record<string, SessionCaptureV2> {
  return { ...readStore().capturesByVisitId };
}

/**
 * Clear all stored scan handoff captures.
 * Used by cache-bust and test teardown.
 */
export function clearScanHandoffStore(): void {
  try {
    const storage = getStorage();
    storage?.removeItem(SCAN_HANDOFF_STORAGE_KEY);
  } catch {
    // Best effort.
  }
}
