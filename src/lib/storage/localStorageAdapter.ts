/**
 * src/lib/storage/localStorageAdapter.ts
 *
 * LocalStorageAdapter — browser-local implementation of StorageAdapter.
 *
 * Storage strategy
 * ────────────────
 * - tenants, brandProfiles, scanCaptures → localStorage (persist across tabs
 *   and browser restarts; fall back to sessionStorage when unavailable).
 * - visits → sessionStorage (tab-scoped; cleared when the tab closes).
 *
 * Wire format (per collection)
 * ────────────────────────────
 * Each collection is stored under its own key as a JSON envelope:
 *
 *   {
 *     schemaVersion: 1,
 *     <itemsField>: Record<string, T>   // field name varies per collection
 *   }
 *
 * The per-collection itemsField name preserves the format written by the
 * original per-store implementations so that existing stored data is read
 * without a migration step.
 *
 * Sync helpers
 * ────────────
 * Because Web Storage is synchronous, LocalStorageAdapter exposes both:
 *   - Synchronous helpers (listSync, getSync, upsertSync, deleteSync,
 *     readAllSync, replaceAllSync, clearSync) — used by store functions
 *     that must remain synchronous (e.g. React useState initialisers).
 *   - The async StorageAdapter interface methods — thin wrappers that resolve
 *     immediately, suitable for future cloud adapter compatibility.
 */

import type {
  StorageAdapter,
  StorageCollectionMap,
  StorageCollectionName,
  StorageResult,
} from './storageAdapter';

// ─── Constants ────────────────────────────────────────────────────────────────

const SCHEMA_VERSION = 1 as const;

// ─── Per-collection configuration ────────────────────────────────────────────

interface CollectionConfig {
  /** localStorage / sessionStorage key. */
  readonly key: string;
  /**
   * Name of the field inside the JSON envelope that holds the id → item map.
   * Matches the field name used by the original per-store implementations to
   * preserve backward compat with any existing stored data.
   */
  readonly field: string;
  /** Which Web Storage API to use for this collection. */
  readonly storageType: 'local' | 'session';
}

const COLLECTION_CONFIG: Readonly<Record<StorageCollectionName, CollectionConfig>> = {
  tenants: {
    key: 'atlas:tenants:v1',
    field: 'tenantsById',
    storageType: 'local',
  },
  brandProfiles: {
    key: 'atlas:brand-profiles:v1',
    field: 'profilesById',
    storageType: 'local',
  },
  visits: {
    key: 'atlas:visits:v1',
    field: 'visitsById',
    storageType: 'session',
  },
  scanCaptures: {
    key: 'atlas:scan-handoffs:v1',
    field: 'capturesByVisitId',
    storageType: 'local',
  },
  visitManifests: {
    key: 'atlas:visit-manifests:v1',
    field: 'manifestsByVisitId',
    storageType: 'local',
  },
};

// ─── LocalStorageAdapter ──────────────────────────────────────────────────────

/**
 * Browser-local StorageAdapter backed by localStorage / sessionStorage.
 *
 * Use the exported `localAdapter` singleton rather than constructing this
 * class directly unless you need an isolated instance (e.g. in tests).
 */
export class LocalStorageAdapter implements StorageAdapter {
  // ── Internal helpers ────────────────────────────────────────────────────────

  private getStorage(storageType: 'local' | 'session'): Storage | null {
    if (storageType === 'local') {
      try {
        if (typeof localStorage !== 'undefined') return localStorage;
      } catch {
        // localStorage may throw in restricted environments.
      }
      // Fall back to sessionStorage when localStorage is unavailable.
      try {
        if (typeof sessionStorage !== 'undefined') return sessionStorage;
      } catch {
        // sessionStorage also unavailable.
      }
      return null;
    } else {
      try {
        if (typeof sessionStorage !== 'undefined') return sessionStorage;
      } catch {
        // sessionStorage unavailable.
      }
      return null;
    }
  }

  private readItems<K extends StorageCollectionName>(
    collection: K,
  ): Record<string, StorageCollectionMap[K]> {
    const config = COLLECTION_CONFIG[collection];
    const storage = this.getStorage(config.storageType);
    if (!storage) return {};
    try {
      const raw = storage.getItem(config.key);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        parsed['schemaVersion'] !== SCHEMA_VERSION
      ) {
        return {};
      }
      const items = parsed[config.field];
      if (typeof items !== 'object' || items === null) return {};
      return items as Record<string, StorageCollectionMap[K]>;
    } catch {
      return {};
    }
  }

  private writeItems<K extends StorageCollectionName>(
    collection: K,
    items: Record<string, StorageCollectionMap[K]>,
  ): void {
    const config = COLLECTION_CONFIG[collection];
    const storage = this.getStorage(config.storageType);
    if (!storage) return;
    const envelope: Record<string, unknown> = {
      schemaVersion: SCHEMA_VERSION,
      [config.field]: items,
    };
    storage.setItem(config.key, JSON.stringify(envelope));
  }

  // ── Sync helpers ─────────────────────────────────────────────────────────────
  // Used by store functions whose public API must remain synchronous.

  /** Returns all items in the collection as an array. */
  listSync<K extends StorageCollectionName>(collection: K): StorageCollectionMap[K][] {
    return Object.values(this.readItems(collection)) as StorageCollectionMap[K][];
  }

  /**
   * Returns all items in the collection as an id-keyed record.
   * Equivalent to `list` but preserves the id keys for callers that need them.
   */
  readAllSync<K extends StorageCollectionName>(
    collection: K,
  ): Record<string, StorageCollectionMap[K]> {
    return { ...this.readItems(collection) };
  }

  /** Returns a single item by its id, or `null` when not found. */
  getSync<K extends StorageCollectionName>(
    collection: K,
    id: string,
  ): StorageCollectionMap[K] | null {
    return this.readItems(collection)[id] ?? null;
  }

  /** Inserts or fully replaces the item stored under `id`. */
  upsertSync<K extends StorageCollectionName>(
    collection: K,
    id: string,
    item: StorageCollectionMap[K],
  ): void {
    const items = this.readItems(collection);
    items[id] = item;
    this.writeItems(collection, items);
  }

  /**
   * Atomically replaces the entire collection with the supplied id-keyed
   * record.  Used by bulk-replace operations such as saveTenantStore.
   */
  replaceAllSync<K extends StorageCollectionName>(
    collection: K,
    items: Record<string, StorageCollectionMap[K]>,
  ): void {
    this.writeItems(collection, { ...items });
  }

  /** Removes the item stored under `id`.  Silently no-ops when absent. */
  deleteSync(collection: StorageCollectionName, id: string): void {
    try {
      const items = this.readItems(collection);
      delete items[id];
      this.writeItems(collection, items);
    } catch {
      // Best effort.
    }
  }

  /**
   * Removes the entire collection from storage.
   * Used by bulk-clear operations such as clearScanHandoffStore.
   */
  clearSync(collection: StorageCollectionName): void {
    try {
      const config = COLLECTION_CONFIG[collection];
      const storage = this.getStorage(config.storageType);
      storage?.removeItem(config.key);
    } catch {
      // Best effort.
    }
  }

  // ── StorageAdapter async interface ──────────────────────────────────────────
  // These wrap the synchronous helpers in immediately-resolved Promises,
  // satisfying the StorageAdapter contract for future async implementations.

  async list<K extends StorageCollectionName>(
    collection: K,
  ): Promise<StorageResult<StorageCollectionMap[K][]>> {
    return { ok: true, data: this.listSync(collection) };
  }

  async get<K extends StorageCollectionName>(
    collection: K,
    id: string,
  ): Promise<StorageResult<StorageCollectionMap[K] | null>> {
    return { ok: true, data: this.getSync(collection, id) };
  }

  async upsert<K extends StorageCollectionName>(
    collection: K,
    id: string,
    item: StorageCollectionMap[K],
  ): Promise<StorageResult<void>> {
    try {
      this.upsertSync(collection, id, item);
      return { ok: true, data: undefined };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async delete(
    collection: StorageCollectionName,
    id: string,
  ): Promise<StorageResult<void>> {
    this.deleteSync(collection, id);
    return { ok: true, data: undefined };
  }
}

// ─── Default singleton ────────────────────────────────────────────────────────

/**
 * Default LocalStorageAdapter instance shared across all stores.
 *
 * Import this singleton from store modules rather than constructing a new
 * instance.  Tests may construct isolated instances to avoid cross-test
 * pollution.
 */
export const localAdapter = new LocalStorageAdapter();
