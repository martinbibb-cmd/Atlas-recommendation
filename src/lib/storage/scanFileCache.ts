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
 * Database  : 'atlas-scan-share'  (shared singleton — see atlasDb.ts)
 * Store     : 'incoming'
 *   id         — auto-increment primary key
 *   name       — original filename
 *   mimeType   — MIME type (e.g. 'application/json', 'model/ply')
 *   data       — ArrayBuffer of file bytes
 *   receivedAt — Unix ms timestamp
 */

import type { Table } from 'dexie';
import { getAtlasDb } from './atlasDb';

// ─── Schema ───────────────────────────────────────────────────────────────────

export interface ScanFileEntry {
  id?: number;
  name: string;
  mimeType: string;
  data: ArrayBuffer;
  receivedAt: number;
}

// ─── Database accessor ────────────────────────────────────────────────────────

function getDb(): Table<ScanFileEntry, number> {
  return getAtlasDb().table<ScanFileEntry, number>('incoming');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the most recently received scan file, or undefined if none exists.
 * Used by ReceiveScanPage on mount to hydrate the import flow.
 */
export async function getLatestScanFile(): Promise<ScanFileEntry | undefined> {
  const table = getDb();
  const entries = await table.orderBy('receivedAt').reverse().limit(1).toArray();
  return entries[0];
}

/**
 * Returns all pending scan file entries ordered newest-first.
 */
export async function getAllScanFiles(): Promise<ScanFileEntry[]> {
  const table = getDb();
  return table.orderBy('receivedAt').reverse().toArray();
}

/**
 * Removes all entries from the incoming store.
 * Call after the import flow has consumed the file.
 */
export async function clearScanFiles(): Promise<void> {
  await getDb().clear();
}

/**
 * Removes a single entry by id.
 */
export async function deleteScanFile(id: number): Promise<void> {
  await getDb().delete(id);
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
