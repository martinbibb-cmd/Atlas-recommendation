/**
 * src/lib/storage/d1Adapter.ts
 *
 * D1StorageAdapter — Cloudflare D1-backed implementation of StorageAdapter.
 *
 * This adapter is **disabled by default**.  The active adapter is selected
 * by adapterFactory.ts; LocalStorageAdapter (localAdapter) remains the
 * default for all existing browser behaviour.
 *
 * Architecture
 * ────────────
 * Each StorageAdapter collection maps to a dedicated D1 table (see migrations
 * 0013–0016).  Items are stored as a `payload_json` blob alongside stable
 * `created_at` / `updated_at` timestamps managed by the adapter.
 *
 *   Collection      Table
 *   ──────────────────────────────────────────
 *   tenants         atlas_adapter_tenants
 *   brandProfiles   atlas_adapter_brand_profiles
 *   visits          atlas_adapter_visits
 *   scanCaptures    atlas_adapter_scan_captures
 *
 * Design rules
 * ────────────
 * - No React dependencies.
 * - No auth, billing, or engine logic.
 * - All methods return StorageResult<T> — never throw for expected failures.
 * - A minimal D1DatabaseLike interface is used instead of the global
 *   D1Database type so that the adapter can be unit-tested without a real
 *   Cloudflare Workers runtime.
 */

import type {
  StorageAdapter,
  StorageCollectionMap,
  StorageCollectionName,
  StorageResult,
} from './storageAdapter';

// ─── D1 surface (minimal interface for testability) ───────────────────────────

/**
 * Minimal subset of the Cloudflare D1Database API needed by D1StorageAdapter.
 *
 * Using a minimal interface rather than the global `D1Database` type allows
 * this adapter to be instantiated and tested outside a real Cloudflare Workers
 * runtime — tests supply a mock that satisfies this shape.
 *
 * In production the Cloudflare `D1Database` type satisfies this interface; no
 * cast is required when passing `env.ATLAS_REPORTS_D1`.
 */
export interface D1DatabaseLike {
  prepare(query: string): D1StatementLike;
}

export interface D1StatementLike {
  bind(...values: unknown[]): D1BoundStatementLike;
}

export interface D1BoundStatementLike {
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ success: boolean; error?: string }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }>;
}

// ─── Row type ─────────────────────────────────────────────────────────────────

interface AdapterRow {
  id: string;
  payload_json: string;
}

// ─── Collection → table mapping ───────────────────────────────────────────────

/**
 * Maps each StorageCollectionName to the corresponding D1 table name.
 * Update this map (and add the matching migration) when introducing a new
 * collection.
 */
const D1_TABLE: Readonly<Record<StorageCollectionName, string>> = {
  tenants: 'atlas_adapter_tenants',
  brandProfiles: 'atlas_adapter_brand_profiles',
  visits: 'atlas_adapter_visits',
  scanCaptures: 'atlas_adapter_scan_captures',
};

// ─── D1StorageAdapter ─────────────────────────────────────────────────────────

/**
 * StorageAdapter implementation backed by a Cloudflare D1 database.
 *
 * Construct with a D1DatabaseLike binding (e.g. `env.ATLAS_REPORTS_D1`):
 *
 *   const adapter = new D1StorageAdapter(env.ATLAS_REPORTS_D1);
 *
 * Use adapterFactory.resolveStorageAdapter() to obtain the correct adapter
 * for the current runtime context rather than constructing this directly.
 */
export class D1StorageAdapter implements StorageAdapter {
  private readonly db: D1DatabaseLike;

  constructor(db: D1DatabaseLike) {
    this.db = db;
  }

  // ── list ───────────────────────────────────────────────────────────────────

  async list<K extends StorageCollectionName>(
    collection: K,
  ): Promise<StorageResult<StorageCollectionMap[K][]>> {
    const table = D1_TABLE[collection];
    try {
      const result = await this.db
        .prepare(`SELECT id, payload_json FROM ${table} ORDER BY updated_at DESC`)
        .bind()
        .all<AdapterRow>();

      if (!result.success) {
        return { ok: false, error: `D1 list failed for collection '${collection}'` };
      }

      const items = (result.results ?? []).map((row) =>
        JSON.parse(row.payload_json) as StorageCollectionMap[K],
      );
      return { ok: true, data: items };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // ── get ────────────────────────────────────────────────────────────────────

  async get<K extends StorageCollectionName>(
    collection: K,
    id: string,
  ): Promise<StorageResult<StorageCollectionMap[K] | null>> {
    const table = D1_TABLE[collection];
    try {
      const row = await this.db
        .prepare(`SELECT payload_json FROM ${table} WHERE id = ?`)
        .bind(id)
        .first<AdapterRow>();

      if (row === null) {
        return { ok: true, data: null };
      }

      const item = JSON.parse(row.payload_json) as StorageCollectionMap[K];
      return { ok: true, data: item };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // ── upsert ─────────────────────────────────────────────────────────────────

  async upsert<K extends StorageCollectionName>(
    collection: K,
    id: string,
    item: StorageCollectionMap[K],
  ): Promise<StorageResult<void>> {
    const table = D1_TABLE[collection];
    try {
      const payload = JSON.stringify(item);
      const now = new Date().toISOString();

      const result = await this.db
        .prepare(
          `INSERT INTO ${table} (id, payload_json, created_at, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             payload_json = excluded.payload_json,
             updated_at   = excluded.updated_at`,
        )
        .bind(id, payload, now, now)
        .run();

      if (!result.success) {
        return { ok: false, error: `D1 upsert failed for '${collection}' id='${id}'` };
      }
      return { ok: true, data: undefined };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // ── delete ─────────────────────────────────────────────────────────────────

  async delete(
    collection: StorageCollectionName,
    id: string,
  ): Promise<StorageResult<void>> {
    const table = D1_TABLE[collection];
    try {
      const result = await this.db
        .prepare(`DELETE FROM ${table} WHERE id = ?`)
        .bind(id)
        .run();

      if (!result.success) {
        return { ok: false, error: `D1 delete failed for '${collection}' id='${id}'` };
      }
      return { ok: true, data: undefined };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
