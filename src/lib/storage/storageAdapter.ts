/**
 * src/lib/storage/storageAdapter.ts
 *
 * StorageAdapter — portable storage interface for Atlas Mind.
 *
 * Provides a single seam between tenant/brand/visit/scan-capture stores and
 * their backing storage layer.  The LocalStorageAdapter (same directory)
 * ships the browser-local implementation; a future Cloudflare D1 adapter can
 * be dropped in without touching the store logic.
 *
 * Collections
 * ───────────
 *   tenants        → TenantProfileV1
 *   brandProfiles  → BrandProfileV1
 *   visits         → AtlasVisit
 *   scanCaptures   → SessionCaptureV2
 *   visitManifests → ExternalVisitManifestV1
 *
 * Design rules
 * ────────────
 * - No React dependencies.
 * - All adapter methods return Promise<StorageResult<T>> so implementations
 *   can be async (cloud) or sync-wrapped (local).
 * - StorageResult wraps every operation in an ok/error discriminated union
 *   so callers never need to catch for expected failures.
 * - No auth, billing, or engine logic lives here.
 */

import type { TenantProfileV1 } from '../../features/tenants/tenantProfile';
import type { BrandProfileV1 } from '../../features/branding/brandProfile';
import type { AtlasVisit } from '../../features/visits/createAtlasVisit';
import type { SessionCaptureV2 } from '../../features/scanImport/contracts/sessionCaptureV2';
import type { ExternalVisitManifestV1 } from '../../contracts/ExternalVisitManifestV1';

// ─── Result wrapper ───────────────────────────────────────────────────────────

/**
 * Discriminated union wrapping every adapter operation.
 *
 * Callers pattern-match on `ok` rather than try/catching, keeping error
 * handling explicit and visible at each call site.
 */
export type StorageResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ─── Collection type map ──────────────────────────────────────────────────────

/**
 * Maps each storage collection name to its canonical item type.
 *
 * Add a new entry here when introducing a new persisted collection; the
 * TypeScript type system will then enforce correct item types at every
 * adapter call site.
 */
export type StorageCollectionMap = {
  tenants: TenantProfileV1;
  brandProfiles: BrandProfileV1;
  visits: AtlasVisit;
  scanCaptures: SessionCaptureV2;
  visitManifests: ExternalVisitManifestV1;
};

/** Union of all valid collection names (derived from StorageCollectionMap). */
export type StorageCollectionName = keyof StorageCollectionMap;

// ─── Adapter interface ────────────────────────────────────────────────────────

/**
 * Portable CRUD interface over named collections of typed records.
 *
 * Each item in a collection is addressed by a stable string `id`.  The adapter
 * makes no assumptions about that id — callers supply a domain-meaningful key
 * (e.g. `tenantId`, `brandId`, `visitId`).
 *
 * Implementations
 * ───────────────
 *   LocalStorageAdapter  — localStorage / sessionStorage (browser, offline-first)
 *   (future) D1Adapter   — Cloudflare D1 (cloud, multi-device)
 */
export interface StorageAdapter {
  /**
   * Returns all items in the collection as an array.
   * Resolves with an empty array when the collection is empty or unavailable.
   */
  list<K extends StorageCollectionName>(
    collection: K,
  ): Promise<StorageResult<StorageCollectionMap[K][]>>;

  /**
   * Returns a single item by its stable string id.
   * Resolves with `data: null` (not an error) when the item does not exist.
   */
  get<K extends StorageCollectionName>(
    collection: K,
    id: string,
  ): Promise<StorageResult<StorageCollectionMap[K] | null>>;

  /**
   * Inserts or fully replaces the item stored under `id`.
   * Resolves with `data: undefined` on success.
   */
  upsert<K extends StorageCollectionName>(
    collection: K,
    id: string,
    item: StorageCollectionMap[K],
  ): Promise<StorageResult<void>>;

  /**
   * Removes the item stored under `id`.
   * Resolves successfully even when no item exists for that id.
   */
  delete(
    collection: StorageCollectionName,
    id: string,
  ): Promise<StorageResult<void>>;
}
