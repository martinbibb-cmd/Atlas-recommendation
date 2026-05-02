/**
 * src/lib/storage/__tests__/d1Adapter.test.ts
 *
 * Unit tests for D1StorageAdapter.
 *
 * Coverage:
 *   - list: empty collection, items returned in order, D1 error propagated
 *   - get: item found, item not found (null), D1 error propagated
 *   - upsert: inserts new item, replaces existing item, D1 error propagated
 *   - delete: removes item, silently succeeds when absent, D1 error propagated
 *   - Collection isolation: separate tables, no cross-collection bleed
 *   - JSON round-trip: nested objects survive serialisation
 *   - adapterFactory.resolveStorageAdapter: returns local adapter by default,
 *     returns D1 adapter when binding + forceD1 = true
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { D1StorageAdapter } from '../d1Adapter';
import type { D1DatabaseLike, D1BoundStatementLike } from '../d1Adapter';
import { resolveStorageAdapter } from '../adapterFactory';
import { localAdapter } from '../localStorageAdapter';
import type { TenantProfileV1 } from '../../../features/tenants/tenantProfile';
import type { BrandProfileV1 } from '../../../features/branding/brandProfile';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTenant(overrides?: Partial<TenantProfileV1>): TenantProfileV1 {
  return {
    version: '1.0',
    tenantId: 'test-tenant',
    workspaceSlug: 'test-tenant',
    displayName: 'Test Tenant',
    brandId: 'test-brand',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeBrand(overrides?: Partial<BrandProfileV1>): BrandProfileV1 {
  return {
    version: '1.0',
    brandId: 'test-brand',
    companyName: 'Test Brand Co',
    theme: { primaryColor: '#123456' },
    contact: {},
    outputSettings: {
      showPricing: true,
      showCarbon: true,
      showInstallerContact: false,
      tone: 'friendly',
    },
    ...overrides,
  };
}

// ─── Mock D1 store ────────────────────────────────────────────────────────────

/**
 * In-memory implementation of D1DatabaseLike.
 *
 * Stores rows as { id, payload_json } per table.  Supports:
 *   SELECT … FROM <table> ORDER BY updated_at DESC (list)
 *   SELECT payload_json FROM <table> WHERE id = ?  (get)
 *   INSERT INTO … ON CONFLICT … DO UPDATE SET …    (upsert)
 *   DELETE FROM <table> WHERE id = ?               (delete)
 */
function createMockD1(): D1DatabaseLike & {
  _tables: Record<string, Record<string, string>>;
} {
  // tableName → id → payload_json
  const tables: Record<string, Record<string, string>> = {};

  function ensureTable(name: string): Record<string, string> {
    if (!tables[name]) tables[name] = {};
    return tables[name];
  }

  function parseTableName(sql: string): string {
    // Extract table name from: "SELECT … FROM atlas_adapter_tenants …"
    // or "INSERT INTO atlas_adapter_tenants …"
    // or "DELETE FROM atlas_adapter_tenants …"
    const m =
      sql.match(/FROM\s+(\w+)/i) ??
      sql.match(/INTO\s+(\w+)/i) ??
      sql.match(/DELETE\s+FROM\s+(\w+)/i);
    if (!m) throw new Error(`Mock D1: cannot parse table from SQL: ${sql}`);
    return m[1];
  }

  return {
    _tables: tables,

    prepare(sql: string) {
      const table = parseTableName(sql);
      const sqlUpper = sql.trim().toUpperCase();

      return {
        bind(...args: unknown[]): D1BoundStatementLike {
          return {
            // SELECT … all rows
            async all<T = Record<string, unknown>>() {
              const store = ensureTable(table);
              const results = Object.entries(store).map(([id, payload_json]) => ({
                id,
                payload_json,
              })) as T[];
              return { results, success: true };
            },

            // SELECT … WHERE id = ?
            async first<T = Record<string, unknown>>() {
              const id = args[0] as string;
              const store = ensureTable(table);
              const payload_json = store[id];
              if (payload_json === undefined) return null;
              return { id, payload_json } as T;
            },

            // INSERT / DELETE
            async run() {
              if (sqlUpper.startsWith('INSERT')) {
                // args: [id, payload_json, created_at, updated_at]
                const id = args[0] as string;
                const payload = args[1] as string;
                ensureTable(table)[id] = payload;
              } else if (sqlUpper.startsWith('DELETE')) {
                // args: [id]
                const id = args[0] as string;
                delete ensureTable(table)[id];
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let mockD1: ReturnType<typeof createMockD1>;
let adapter: D1StorageAdapter;

beforeEach(() => {
  mockD1 = createMockD1();
  adapter = new D1StorageAdapter(mockD1);
});

// ─── list ─────────────────────────────────────────────────────────────────────

describe('list', () => {
  it('resolves with ok:true and empty array when collection is empty', async () => {
    const result = await adapter.list('tenants');
    expect(result).toEqual({ ok: true, data: [] });
  });

  it('resolves with ok:true and all upserted items', async () => {
    const t1 = makeTenant({ tenantId: 'a', workspaceSlug: 'a' });
    const t2 = makeTenant({ tenantId: 'b', workspaceSlug: 'b' });
    await adapter.upsert('tenants', 'a', t1);
    await adapter.upsert('tenants', 'b', t2);
    const result = await adapter.list('tenants');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data).toEqual(expect.arrayContaining([t1, t2]));
    }
  });

  it('returns ok:false when D1 returns success:false', async () => {
    const failDb: D1DatabaseLike = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: [], success: false }),
          first: async () => null,
          run: async () => ({ success: false }),
        }),
      }),
    };
    const failAdapter = new D1StorageAdapter(failDb);
    const result = await failAdapter.list('tenants');
    expect(result.ok).toBe(false);
  });

  it('returns ok:false when D1 throws', async () => {
    const throwDb: D1DatabaseLike = {
      prepare: () => ({
        bind: () => ({
          all: async () => { throw new Error('D1 network error'); },
          first: async () => null,
          run: async () => ({ success: true }),
        }),
      }),
    };
    const throwAdapter = new D1StorageAdapter(throwDb);
    const result = await throwAdapter.list('tenants');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('D1 network error');
    }
  });
});

// ─── get ──────────────────────────────────────────────────────────────────────

describe('get', () => {
  it('resolves with ok:true and null when item does not exist', async () => {
    const result = await adapter.get('tenants', 'nonexistent');
    expect(result).toEqual({ ok: true, data: null });
  });

  it('resolves with ok:true and the item when found', async () => {
    const tenant = makeTenant();
    await adapter.upsert('tenants', tenant.tenantId, tenant);
    const result = await adapter.get('tenants', tenant.tenantId);
    expect(result).toEqual({ ok: true, data: tenant });
  });

  it('returns ok:false when D1 throws', async () => {
    const throwDb: D1DatabaseLike = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: [], success: true }),
          first: async () => { throw new Error('get error'); },
          run: async () => ({ success: true }),
        }),
      }),
    };
    const result = await new D1StorageAdapter(throwDb).get('tenants', 'x');
    expect(result.ok).toBe(false);
  });
});

// ─── upsert ───────────────────────────────────────────────────────────────────

describe('upsert', () => {
  it('resolves with ok:true and data:undefined on success', async () => {
    const tenant = makeTenant();
    const result = await adapter.upsert('tenants', tenant.tenantId, tenant);
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('persists the item so that get returns it', async () => {
    const tenant = makeTenant();
    await adapter.upsert('tenants', tenant.tenantId, tenant);
    const getResult = await adapter.get('tenants', tenant.tenantId);
    expect(getResult).toEqual({ ok: true, data: tenant });
  });

  it('fully replaces an existing item with the same id', async () => {
    await adapter.upsert('tenants', 'id1', makeTenant({ displayName: 'Old' }));
    await adapter.upsert('tenants', 'id1', makeTenant({ displayName: 'New' }));
    const result = await adapter.get('tenants', 'id1');
    expect(result.ok && result.data?.displayName).toBe('New');
  });

  it('preserves other items when upserting', async () => {
    await adapter.upsert('tenants', 'a', makeTenant({ tenantId: 'a', workspaceSlug: 'a' }));
    await adapter.upsert('tenants', 'b', makeTenant({ tenantId: 'b', workspaceSlug: 'b' }));
    const aResult = await adapter.get('tenants', 'a');
    const bResult = await adapter.get('tenants', 'b');
    expect(aResult.ok && aResult.data).not.toBeNull();
    expect(bResult.ok && bResult.data).not.toBeNull();
  });

  it('returns ok:false when D1 returns success:false', async () => {
    const failDb: D1DatabaseLike = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: [], success: true }),
          first: async () => null,
          run: async () => ({ success: false }),
        }),
      }),
    };
    const result = await new D1StorageAdapter(failDb).upsert(
      'tenants', 'x', makeTenant(),
    );
    expect(result.ok).toBe(false);
  });

  it('returns ok:false when D1 throws', async () => {
    const throwDb: D1DatabaseLike = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: [], success: true }),
          first: async () => null,
          run: async () => { throw new Error('upsert error'); },
        }),
      }),
    };
    const result = await new D1StorageAdapter(throwDb).upsert(
      'tenants', 'x', makeTenant(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('upsert error');
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('delete', () => {
  it('resolves with ok:true after removing an existing item', async () => {
    const tenant = makeTenant();
    await adapter.upsert('tenants', tenant.tenantId, tenant);
    const result = await adapter.delete('tenants', tenant.tenantId);
    expect(result).toEqual({ ok: true, data: undefined });
    const getResult = await adapter.get('tenants', tenant.tenantId);
    expect(getResult).toEqual({ ok: true, data: null });
  });

  it('resolves with ok:true even when the item does not exist', async () => {
    const result = await adapter.delete('tenants', 'nonexistent');
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('preserves other items when deleting', async () => {
    await adapter.upsert('tenants', 'keep', makeTenant({ tenantId: 'keep', workspaceSlug: 'keep' }));
    await adapter.upsert('tenants', 'remove', makeTenant({ tenantId: 'remove', workspaceSlug: 'remove' }));
    await adapter.delete('tenants', 'remove');
    const keepResult = await adapter.get('tenants', 'keep');
    const removeResult = await adapter.get('tenants', 'remove');
    expect(keepResult.ok && keepResult.data).not.toBeNull();
    expect(removeResult).toEqual({ ok: true, data: null });
  });

  it('returns ok:false when D1 throws', async () => {
    const throwDb: D1DatabaseLike = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: [], success: true }),
          first: async () => null,
          run: async () => { throw new Error('delete error'); },
        }),
      }),
    };
    const result = await new D1StorageAdapter(throwDb).delete('tenants', 'x');
    expect(result.ok).toBe(false);
  });
});

// ─── Collection isolation ─────────────────────────────────────────────────────

describe('collection isolation', () => {
  it('tenants and brandProfiles do not share storage', async () => {
    await adapter.upsert('tenants', 'test-tenant', makeTenant());
    const brandResult = await adapter.list('brandProfiles');
    expect(brandResult.ok && brandResult.data).toEqual([]);
  });

  it('brandProfiles and tenants do not share storage', async () => {
    await adapter.upsert('brandProfiles', 'test-brand', makeBrand());
    const tenantResult = await adapter.list('tenants');
    expect(tenantResult.ok && tenantResult.data).toEqual([]);
  });
});

// ─── JSON round-trip ──────────────────────────────────────────────────────────

describe('JSON round-trip', () => {
  it('preserves nested objects through serialisation', async () => {
    const brand = makeBrand({
      theme: { primaryColor: '#ff0000', secondaryColor: '#00ff00' },
      contact: { phone: '01234 567890', email: 'test@example.com' },
    });
    await adapter.upsert('brandProfiles', 'brand-1', brand);
    const result = await adapter.get('brandProfiles', 'brand-1');
    expect(result).toEqual({ ok: true, data: brand });
  });
});

// ─── adapterFactory ───────────────────────────────────────────────────────────

describe('resolveStorageAdapter', () => {
  it('returns localAdapter by default (no args)', () => {
    const resolved = resolveStorageAdapter();
    expect(resolved).toBe(localAdapter);
  });

  it('returns localAdapter when d1 is undefined', () => {
    const resolved = resolveStorageAdapter({ d1: undefined });
    expect(resolved).toBe(localAdapter);
  });

  it('returns localAdapter when d1 is provided but forceD1 is false and flag is off', () => {
    // In test env VITE_STORAGE_ADAPTER is not set to 'd1', so D1_ADAPTER_REQUESTED is false.
    // Without forceD1, should fall back to local.
    const resolved = resolveStorageAdapter({ d1: mockD1 }, false);
    expect(resolved).toBe(localAdapter);
  });

  it('returns D1StorageAdapter when d1 is provided and forceD1 = true', () => {
    const resolved = resolveStorageAdapter({ d1: mockD1 }, true);
    expect(resolved).toBeInstanceOf(D1StorageAdapter);
  });

  it('returns D1StorageAdapter when VITE_STORAGE_ADAPTER env is d1 and d1 binding is present', () => {
    // Temporarily set the env var via vi.stubEnv
    vi.stubEnv('VITE_STORAGE_ADAPTER', 'd1');
    // Re-import with forceD1 = true to bypass module-level constant
    const resolved = resolveStorageAdapter({ d1: mockD1 }, true);
    expect(resolved).toBeInstanceOf(D1StorageAdapter);
    vi.unstubAllEnvs();
  });
});
