/**
 * src/lib/storage/storageDiagnostics.ts
 *
 * Storage diagnostics and safe migration utilities for Atlas Mind developer tooling.
 *
 * Provides:
 *   - gatherStorageDiagnostics  — inspect active adapter, item counts, error state
 *   - exportLocalCollection      — snapshot a collection from localAdapter as JSON
 *   - importCollectionIntoAdapter — bulk-upsert an exported snapshot into any adapter
 *   - clearLocalCollection        — wipe one collection from localAdapter
 *   - copyLocalToAdapter          — copy every collection from local into a target adapter
 *
 * Design rules
 * ────────────
 * - No React dependencies.
 * - No auth, billing, or engine logic.
 * - All mutating operations are developer-only and require explicit caller intent.
 * - Never clear all collections in a single call — always target one collection.
 */

import type { StorageAdapter, StorageCollectionName } from './storageAdapter';
import { D1_ADAPTER_REQUESTED } from './adapterFactory';
import { LocalStorageAdapter, localAdapter } from './localStorageAdapter';

// ─── Collection list ──────────────────────────────────────────────────────────

/**
 * Ordered list of all StorageCollectionName values.
 * Import this constant rather than duplicating the list at each call site.
 */
export const ALL_COLLECTIONS: readonly StorageCollectionName[] = [
  'tenants',
  'brandProfiles',
  'visits',
  'scanCaptures',
  'visitManifests',
  'userProfiles',
] as const;

// ─── Diagnostic types ─────────────────────────────────────────────────────────

/** Snapshot of a single collection's diagnostic state. */
export interface CollectionSnapshot {
  collection: StorageCollectionName;
  /** Number of items currently stored in the collection. */
  count: number;
  /** Non-null when the adapter returned an error reading this collection. */
  error: string | null;
}

/** Full diagnostic report for the active storage adapter. */
export interface StorageDiagnosticsResult {
  /** Which adapter is actively handling read/write operations. */
  activeAdapterKind: 'local' | 'd1';
  /** True when VITE_STORAGE_ADAPTER=d1 is set in the build environment. */
  d1Requested: boolean;
  /** Per-collection item counts and error flags. */
  collections: CollectionSnapshot[];
  /** Last error seen across any collection, or null when all reads succeeded. */
  lastError: string | null;
  /** ISO-8601 timestamp when the diagnostics were gathered. */
  gatheredAt: string;
}

// ─── Export / import types ────────────────────────────────────────────────────

/**
 * Portable JSON envelope for a single collection export.
 *
 * Preserves storage keys so that a round-trip import restores the exact same
 * id → item mapping.  The `items` field is typed as `Record<string, unknown>`
 * because the JSON round-trip loses TypeScript type information; the import
 * helper casts items back to the correct domain type at call time.
 */
export interface CollectionExport {
  /** Schema version — always 1. */
  schemaVersion: 1;
  /** The collection this export belongs to. */
  collection: StorageCollectionName;
  /** ISO-8601 timestamp when the export was created. */
  exportedAt: string;
  /** id → item map, preserving the storage keys used by the adapter. */
  items: Record<string, unknown>;
}

// ─── Copy result types ────────────────────────────────────────────────────────

/** Result of copying one collection from local into a target adapter. */
export interface CollectionCopyResult {
  /** Number of items successfully written to the target adapter. */
  copied: number;
  /** Per-item error messages for any items that failed to write. */
  errors: string[];
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

/**
 * Gathers a diagnostic snapshot of the given storage adapter.
 *
 * Calls `list` on every known collection and records item counts and errors.
 * The adapter parameter allows callers to pass either the localAdapter or a
 * D1StorageAdapter — the report reflects whichever adapter is supplied.
 *
 * @param adapter  The adapter to inspect (typically the result of resolveStorageAdapter).
 */
export async function gatherStorageDiagnostics(
  adapter: StorageAdapter,
): Promise<StorageDiagnosticsResult> {
  const activeAdapterKind: 'local' | 'd1' = adapter instanceof LocalStorageAdapter ? 'local' : 'd1';
  const collections: CollectionSnapshot[] = [];
  let lastError: string | null = null;

  for (const col of ALL_COLLECTIONS) {
    const result = await adapter.list(col);
    if (result.ok) {
      collections.push({ collection: col, count: result.data.length, error: null });
    } else {
      collections.push({ collection: col, count: 0, error: result.error });
      lastError = result.error;
    }
  }

  return {
    activeAdapterKind,
    d1Requested: D1_ADAPTER_REQUESTED,
    collections,
    lastError,
    gatheredAt: new Date().toISOString(),
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Exports all items from a collection out of localAdapter as a portable
 * CollectionExport envelope.
 *
 * Uses `readAllSync` so that storage keys (item IDs) are preserved in the
 * export — a round-trip import via `importCollectionIntoAdapter` will
 * reconstruct the exact same id → item mapping.
 *
 * @param collection  The collection to export.
 */
export function exportLocalCollection(collection: StorageCollectionName): CollectionExport {
  const items = localAdapter.readAllSync(collection);
  return {
    schemaVersion: 1,
    collection,
    exportedAt: new Date().toISOString(),
    items: items as Record<string, unknown>,
  };
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Imports items from a CollectionExport envelope into the given adapter.
 *
 * Each item is written individually via `adapter.upsert`.  Failures are
 * collected rather than aborting the import early so that partial data is
 * still written and the caller can report which items failed.
 *
 * @param adapter  Destination adapter (localAdapter or a D1StorageAdapter).
 * @param payload  A CollectionExport produced by exportLocalCollection.
 */
export async function importCollectionIntoAdapter(
  adapter: StorageAdapter,
  payload: CollectionExport,
): Promise<{ imported: number; errors: string[] }> {
  const { collection, items } = payload;
  let imported = 0;
  const errors: string[] = [];

  for (const [id, item] of Object.entries(items)) {
    // The JSON round-trip loses TypeScript types; cast back to the domain type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await adapter.upsert(collection, id, item as any);
    if (result.ok) {
      imported++;
    } else {
      errors.push(`${id}: ${result.error}`);
    }
  }

  return { imported, errors };
}

// ─── Clear ────────────────────────────────────────────────────────────────────

/**
 * Clears all items in a single collection from localAdapter.
 *
 * Uses `clearSync` for an atomic wipe of the entire storage key.  The caller
 * MUST obtain explicit user confirmation before calling this function.
 *
 * This function only operates on localAdapter — never call it to clear
 * a remote/D1 collection without an explicit migration plan.
 *
 * @param collection  The collection to clear.
 */
export function clearLocalCollection(collection: StorageCollectionName): void {
  localAdapter.clearSync(collection);
}

// ─── Copy local → adapter ─────────────────────────────────────────────────────

/**
 * Copies all items from every localAdapter collection into the given target
 * adapter.
 *
 * Intended for use when migrating browser-local data into a D1-backed adapter.
 * Each item is written via `targetAdapter.upsert`; failures are recorded
 * per-collection rather than aborting the copy.
 *
 * The caller MUST obtain explicit user confirmation before calling this
 * function, and SHOULD perform a dry run first by calling
 * `dryRunLocalToAdapter` to preview what would be copied.
 *
 * @param targetAdapter  The adapter to copy data into.
 */
export async function copyLocalToAdapter(
  targetAdapter: StorageAdapter,
): Promise<Record<StorageCollectionName, CollectionCopyResult>> {
  const results = {} as Record<StorageCollectionName, CollectionCopyResult>;

  for (const col of ALL_COLLECTIONS) {
    const items = localAdapter.readAllSync(col);
    const collectionResult: CollectionCopyResult = { copied: 0, errors: [] };

    for (const [id, item] of Object.entries(items)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await targetAdapter.upsert(col, id, item as any);
      if (r.ok) {
        collectionResult.copied++;
      } else {
        collectionResult.errors.push(`${id}: ${r.error}`);
      }
    }

    results[col] = collectionResult;
  }

  return results;
}

/**
 * Dry-run preview of what copyLocalToAdapter would copy.
 *
 * Returns per-collection item counts without writing anything.  Use this to
 * show the developer exactly how many items would be migrated before asking
 * for confirmation.
 *
 * @param _targetAdapter  Provided for API symmetry with copyLocalToAdapter; not used.
 */
export function dryRunLocalToAdapter(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _targetAdapter: StorageAdapter,
): Record<StorageCollectionName, { itemCount: number }> {
  const preview = {} as Record<StorageCollectionName, { itemCount: number }>;
  for (const col of ALL_COLLECTIONS) {
    const items = localAdapter.readAllSync(col);
    preview[col] = { itemCount: Object.keys(items).length };
  }
  return preview;
}
