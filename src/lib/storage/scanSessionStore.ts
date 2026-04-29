/**
 * scanSessionStore.ts
 *
 * Offline-first Dexie (IndexedDB) store for PropertyScanSession records and
 * queued asset uploads.
 *
 * Architecture
 * ───────────
 *   All sessions are written to IDB immediately (offline-safe).
 *   A `syncToServer()` call pushes dirty sessions and queued asset blobs to
 *   the Cloudflare Functions API when the device is online.
 *
 * Database  : 'atlas-scan-share'  (shared singleton — see atlasDb.ts)
 * Version   : 2
 * Stores:
 *   sessions       — PropertyScanSession (minus non-serialisable fields)
 *   asset_queue    — Pending asset uploads (ArrayBuffer + metadata)
 */

import type { Table } from 'dexie';
import { getAtlasDb } from './atlasDb';
import type { PropertyScanSession } from '../../features/scanImport/session/propertyScanSession';

// ─── Stored session record ────────────────────────────────────────────────────

/**
 * Stored in IDB.  Identical to PropertyScanSession but with JSON-serialisable
 * floors/rooms/taggedObjects/photos replaced by a compact JSON string to keep
 * the Dexie schema simple and avoid nested-object indexing limitations.
 */
export interface StoredScanSession {
  /** Same as PropertyScanSession.id */
  id: string;
  jobReference: string;
  propertyAddress: string;
  createdAt: string;
  updatedAt: string;
  scanState: string;
  reviewState: string;
  syncState: string;
  remoteSessionId?: string;
  /** Full PropertyScanSession serialised as JSON (including floors/rooms/etc.) */
  payloadJson: string;
  /** True when the session has local changes not yet pushed to the server. */
  dirty: 1 | 0;
}

// ─── Asset upload queue ───────────────────────────────────────────────────────

export interface QueuedAsset {
  id?: number; // auto-increment IDB key
  sessionId: string;
  assetType: 'photo' | 'ply' | 'transcript' | 'scan_bundle';
  fileName: string;
  mimeType: string;
  data: ArrayBuffer;
  capturedAt?: string;
  metadataJson: string;
  /** Number of upload attempts made. */
  attempts: number;
}

// ─── Database accessors ───────────────────────────────────────────────────────

function getSessionsTable(): Table<StoredScanSession, string> {
  return getAtlasDb().table<StoredScanSession, string>('sessions');
}

function getAssetQueueTable(): Table<QueuedAsset, number> {
  return getAtlasDb().table<QueuedAsset, number>('asset_queue');
}

// ─── Public CRUD ──────────────────────────────────────────────────────────────

/** Save or update a session in IDB and mark it as dirty (pending sync). */
export async function upsertSession(session: PropertyScanSession): Promise<void> {
  const stored: StoredScanSession = {
    id: session.id,
    jobReference: session.jobReference,
    propertyAddress: session.propertyAddress,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    scanState: session.scanState,
    reviewState: session.reviewState,
    syncState: session.syncState,
    remoteSessionId: session.remoteSessionId,
    payloadJson: JSON.stringify(session),
    dirty: 1,
  };
  await getSessionsTable().put(stored);
}

/** Retrieve all stored sessions ordered newest-first. */
export async function listSessions(): Promise<StoredScanSession[]> {
  return getSessionsTable().orderBy('updatedAt').reverse().toArray();
}

/** Retrieve a single stored session by ID. */
export async function getSession(id: string): Promise<StoredScanSession | undefined> {
  return getSessionsTable().get(id);
}

/** Deserialise a StoredScanSession back to a PropertyScanSession. */
export function hydrateSession(stored: StoredScanSession): PropertyScanSession {
  return JSON.parse(stored.payloadJson) as PropertyScanSession;
}

/** Delete a session and its queued assets from IDB. */
export async function deleteSession(id: string): Promise<void> {
  await Promise.all([
    getSessionsTable().delete(id),
    getAssetQueueTable().where('sessionId').equals(id).delete(),
  ]);
}

// ─── Asset queue ──────────────────────────────────────────────────────────────

/** Enqueue a binary asset to be uploaded on the next sync. */
export async function enqueueAsset(asset: Omit<QueuedAsset, 'id' | 'attempts'>): Promise<void> {
  await getAssetQueueTable().add({ ...asset, attempts: 0 });
}

// ─── Sync to server ───────────────────────────────────────────────────────────

const API_BASE = '/api/scan-sessions';

/** True when the device has a network connection (best-effort check). */
function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

/**
 * Push all dirty sessions and queued asset uploads to the server API.
 *
 * Should be called:
 *   - When the user presses "Export" in the ScanReviewToolbar.
 *   - Opportunistically when the app regains network connectivity.
 *
 * Silently no-ops when offline.  Individual failures are logged and retried
 * on the next call rather than aborting the whole batch.
 */
export async function syncToServer(): Promise<void> {
  if (!isOnline()) return;

  const sessions = getSessionsTable();
  const assetQueue = getAssetQueueTable();

  // ── 1. Sync dirty sessions ────────────────────────────────────────────────
  const dirtySessions = await sessions.where('dirty').equals(1).toArray();

  for (const stored of dirtySessions) {
    try {
      const session = hydrateSession(stored);

      if (!stored.remoteSessionId) {
        // Create new session on server.
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: session.id,
            job_reference: session.jobReference,
            property_address: session.propertyAddress,
            scan_state: session.scanState,
            review_state: session.reviewState,
          }),
        });
        if (!res.ok) throw new Error(`POST scan-session failed: ${res.status}`);
        const json = (await res.json()) as { ok: boolean; id?: string };
        if (!json.ok || !json.id) throw new Error('Server returned ok:false on session create');
        // Mark as synced.
        await sessions.update(stored.id, {
          dirty: 0,
          remoteSessionId: json.id,
          syncState: 'uploaded',
        });
      } else {
        // Update existing session state on server.
        const res = await fetch(`${API_BASE}/${stored.remoteSessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scan_state: session.scanState,
            review_state: session.reviewState,
            sync_state: 'uploaded',
          }),
        });
        if (!res.ok) throw new Error(`PATCH scan-session failed: ${res.status}`);
        await sessions.update(stored.id, { dirty: 0, syncState: 'uploaded' });
      }
    } catch (err) {
      console.error('[Atlas] Session sync failed:', stored.id, err);
      await sessions.update(stored.id, { syncState: 'failed_upload' });
    }
  }

  // ── 2. Upload queued assets ────────────────────────────────────────────────
  const pendingAssets = await assetQueue
    .where('attempts')
    .below(3) // skip permanently-failed items
    .toArray();

  for (const queued of pendingAssets) {
    // Resolve the remote session ID for this asset's session.
    const parent = await sessions.get(queued.sessionId);
    const remoteId = parent?.remoteSessionId;
    if (!remoteId) {
      // Session not yet synced — skip asset; it will be retried once the
      // session is created on the server.
      continue;
    }

    try {
      const form = new FormData();
      form.append(
        'file',
        new File([queued.data], queued.fileName, { type: queued.mimeType }),
      );
      form.append('asset_type', queued.assetType);
      if (queued.capturedAt) form.append('captured_at', queued.capturedAt);
      form.append('metadata', queued.metadataJson);

      const res = await fetch(`${API_BASE}/${remoteId}/assets`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error(`Asset upload failed: ${res.status}`);

      // Remove from queue on success.
      if (queued.id != null) {
        await assetQueue.delete(queued.id);
      }
    } catch (err) {
      console.error('[Atlas] Asset upload failed:', queued.id, err);
      if (queued.id != null) {
        await assetQueue.update(queued.id, { attempts: queued.attempts + 1 });
      }
    }
  }
}
