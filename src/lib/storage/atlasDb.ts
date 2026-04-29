/**
 * atlasDb.ts
 *
 * Shared Dexie (IndexedDB) singleton for all Atlas scan data.
 *
 * A single database instance is used throughout the app to avoid conflicts
 * that arise from multiple Dexie instances opening the same IDB database with
 * different version numbers.
 *
 * Database  : 'atlas-scan-share'
 * Versions:
 *   1 — incoming   : scan files received via the Web Share Target
 *   2 — sessions   : PropertyScanSession records (offline-first store)
 *       asset_queue : pending binary asset uploads
 *
 * The service worker (public/sw.js) also opens 'atlas-scan-share' and must be
 * kept in sync with the version number defined here.
 */

import Dexie from 'dexie';

export class AtlasScanDb extends Dexie {
  constructor() {
    super('atlas-scan-share');

    // ── Version 1 — Web Share Target incoming file cache ─────────────────────
    this.version(1).stores({
      incoming: '++id, receivedAt',
    });

    // ── Version 2 — Scan session store + asset upload queue ──────────────────
    this.version(2).stores({
      incoming: '++id, receivedAt',
      sessions: 'id, updatedAt, dirty, syncState',
      asset_queue: '++id, sessionId, attempts',
    });
  }
}

let _db: AtlasScanDb | null = null;

/**
 * Returns the singleton AtlasScanDb instance, creating it on first call.
 * All Atlas scan storage modules must use this function rather than
 * constructing their own Dexie instances for 'atlas-scan-share'.
 */
export function getAtlasDb(): AtlasScanDb {
  if (!_db) _db = new AtlasScanDb();
  return _db;
}
