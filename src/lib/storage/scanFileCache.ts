/**
 * scanFileCache.ts
 *
 * Dexie-based IndexedDB wrapper for scan files received via the Web Share
 * Target API.
 *
 * The service worker (public/sw.js) writes to the same 'atlas-scan-share'
 * database using the native IDB API.  This module reads from it using Dexie
 * so the React app can retrieve shared files after the service worker
 * redirects to /?receive-scan=1.
 *
 * Database  : 'atlas-scan-share'
 * Version   : 1
 * Store     : 'incoming'
 *   id         — auto-increment primary key
 *   name       — original filename
 *   mimeType   — MIME type (e.g. 'application/json', 'model/ply')
 *   data       — ArrayBuffer of file bytes
 *   receivedAt — Unix ms timestamp
 */

import Dexie from 'dexie';
import type { Table } from 'dexie';

// ─── Schema ───────────────────────────────────────────────────────────────────

export interface ScanFileEntry {
  id?: number;
  name: string;
  mimeType: string;
  data: ArrayBuffer;
  receivedAt: number;
}

// ─── Database ─────────────────────────────────────────────────────────────────

class ScanShareDb extends Dexie {
  incoming!: Table<ScanFileEntry, number>;

  constructor() {
    super('atlas-scan-share');
    this.version(1).stores({
      incoming: '++id, receivedAt',
    });
  }
}

/** Singleton instance — created lazily so tests can avoid opening IDB. */
let _db: ScanShareDb | null = null;

function getDb(): ScanShareDb {
  if (!_db) _db = new ScanShareDb();
  return _db;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the most recently received scan file, or undefined if none exists.
 * Used by ReceiveScanPage on mount to hydrate the import flow.
 */
export async function getLatestScanFile(): Promise<ScanFileEntry | undefined> {
  const db = getDb();
  const entries = await db.incoming.orderBy('receivedAt').reverse().limit(1).toArray();
  return entries[0];
}

/**
 * Returns all pending scan file entries ordered newest-first.
 */
export async function getAllScanFiles(): Promise<ScanFileEntry[]> {
  const db = getDb();
  return db.incoming.orderBy('receivedAt').reverse().toArray();
}

/**
 * Removes all entries from the incoming store.
 * Call after the import flow has consumed the file.
 */
export async function clearScanFiles(): Promise<void> {
  const db = getDb();
  await db.incoming.clear();
}

/**
 * Removes a single entry by id.
 */
export async function deleteScanFile(id: number): Promise<void> {
  const db = getDb();
  await db.incoming.delete(id);
}

/**
 * Converts a ScanFileEntry's ArrayBuffer to a File object.
 * Useful for bridging to APIs that expect a File (e.g. FileList).
 */
export function scanEntryToFile(entry: ScanFileEntry): File {
  return new File([entry.data], entry.name, {
    type: entry.mimeType || 'application/octet-stream',
    lastModified: entry.receivedAt,
  });
}
