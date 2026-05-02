/**
 * src/lib/storage/__tests__/localStorageAdapter.test.ts
 *
 * Unit tests for LocalStorageAdapter.
 *
 * Coverage:
 *   - listSync returns an empty array when the collection is empty
 *   - upsertSync persists an item; listSync returns it
 *   - getSync returns the item by id, or null when absent
 *   - deleteSync removes an item; silently no-ops when absent
 *   - readAllSync returns the full id-keyed record
 *   - replaceAllSync atomically replaces the entire collection
 *   - clearSync removes the entire collection
 *   - async list / get / upsert / delete wrap the sync helpers correctly
 *   - StorageResult shape: ok:true carries data; ok:false carries error
 *   - Separate collections do not bleed data into one another
 *   - Corrupt / missing storage data returns empty results without throwing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageAdapter } from '../localStorageAdapter';
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

// ─── Setup ────────────────────────────────────────────────────────────────────

// Use a fresh adapter instance per test suite to avoid shared singleton state.
let adapter: LocalStorageAdapter;

beforeEach(() => {
  adapter = new LocalStorageAdapter();
  // Clear relevant storage keys to avoid inter-test pollution.
  try {
    localStorage.removeItem('atlas:tenants:v1');
    localStorage.removeItem('atlas:brand-profiles:v1');
    localStorage.removeItem('atlas:scan-handoffs:v1');
    sessionStorage.removeItem('atlas:visits:v1');
  } catch {
    // Storage unavailable in this environment.
  }
});

// ─── listSync ─────────────────────────────────────────────────────────────────

describe('listSync', () => {
  it('returns an empty array when the collection is empty', () => {
    expect(adapter.listSync('tenants')).toEqual([]);
  });

  it('returns all upserted items as an array', () => {
    const t1 = makeTenant({ tenantId: 't1', workspaceSlug: 't1' });
    const t2 = makeTenant({ tenantId: 't2', workspaceSlug: 't2' });
    adapter.upsertSync('tenants', 't1', t1);
    adapter.upsertSync('tenants', 't2', t2);
    const result = adapter.listSync('tenants');
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([t1, t2]));
  });
});

// ─── getSync ──────────────────────────────────────────────────────────────────

describe('getSync', () => {
  it('returns null when the item does not exist', () => {
    expect(adapter.getSync('tenants', 'nonexistent')).toBeNull();
  });

  it('returns the item when it exists', () => {
    const tenant = makeTenant();
    adapter.upsertSync('tenants', tenant.tenantId, tenant);
    expect(adapter.getSync('tenants', tenant.tenantId)).toEqual(tenant);
  });
});

// ─── upsertSync ───────────────────────────────────────────────────────────────

describe('upsertSync', () => {
  it('inserts a new item', () => {
    const tenant = makeTenant();
    adapter.upsertSync('tenants', tenant.tenantId, tenant);
    expect(adapter.getSync('tenants', tenant.tenantId)).toEqual(tenant);
  });

  it('fully replaces an existing item with the same id', () => {
    adapter.upsertSync('tenants', 'test-tenant', makeTenant({ displayName: 'Old' }));
    adapter.upsertSync('tenants', 'test-tenant', makeTenant({ displayName: 'New' }));
    expect(adapter.getSync('tenants', 'test-tenant')?.displayName).toBe('New');
  });

  it('preserves other items when upserting', () => {
    adapter.upsertSync('tenants', 'a', makeTenant({ tenantId: 'a', workspaceSlug: 'a' }));
    adapter.upsertSync('tenants', 'b', makeTenant({ tenantId: 'b', workspaceSlug: 'b' }));
    expect(adapter.getSync('tenants', 'a')).not.toBeNull();
    expect(adapter.getSync('tenants', 'b')).not.toBeNull();
  });
});

// ─── deleteSync ───────────────────────────────────────────────────────────────

describe('deleteSync', () => {
  it('removes an existing item', () => {
    const tenant = makeTenant();
    adapter.upsertSync('tenants', tenant.tenantId, tenant);
    adapter.deleteSync('tenants', tenant.tenantId);
    expect(adapter.getSync('tenants', tenant.tenantId)).toBeNull();
  });

  it('silently no-ops when the item does not exist', () => {
    expect(() => adapter.deleteSync('tenants', 'nonexistent')).not.toThrow();
  });

  it('preserves other items when deleting', () => {
    adapter.upsertSync('tenants', 'keep', makeTenant({ tenantId: 'keep', workspaceSlug: 'keep' }));
    adapter.upsertSync('tenants', 'remove', makeTenant({ tenantId: 'remove', workspaceSlug: 'remove' }));
    adapter.deleteSync('tenants', 'remove');
    expect(adapter.getSync('tenants', 'keep')).not.toBeNull();
    expect(adapter.getSync('tenants', 'remove')).toBeNull();
  });
});

// ─── readAllSync ──────────────────────────────────────────────────────────────

describe('readAllSync', () => {
  it('returns an empty record when the collection is empty', () => {
    expect(adapter.readAllSync('tenants')).toEqual({});
  });

  it('returns all items keyed by their id', () => {
    const t1 = makeTenant({ tenantId: 'a', workspaceSlug: 'a' });
    const t2 = makeTenant({ tenantId: 'b', workspaceSlug: 'b' });
    adapter.upsertSync('tenants', 'a', t1);
    adapter.upsertSync('tenants', 'b', t2);
    const all = adapter.readAllSync('tenants');
    expect(all['a']).toEqual(t1);
    expect(all['b']).toEqual(t2);
  });
});

// ─── replaceAllSync ───────────────────────────────────────────────────────────

describe('replaceAllSync', () => {
  it('atomically replaces the entire collection', () => {
    adapter.upsertSync('tenants', 'old', makeTenant({ tenantId: 'old', workspaceSlug: 'old' }));
    const replacement = {
      new: makeTenant({ tenantId: 'new', workspaceSlug: 'new' }),
    };
    adapter.replaceAllSync('tenants', replacement);
    expect(adapter.getSync('tenants', 'old')).toBeNull();
    expect(adapter.getSync('tenants', 'new')).toEqual(replacement['new']);
  });

  it('replaces with an empty record clears the collection', () => {
    adapter.upsertSync('tenants', 'a', makeTenant());
    adapter.replaceAllSync('tenants', {});
    expect(adapter.listSync('tenants')).toEqual([]);
  });
});

// ─── clearSync ────────────────────────────────────────────────────────────────

describe('clearSync', () => {
  it('removes all items from the collection', () => {
    adapter.upsertSync('tenants', 'a', makeTenant({ tenantId: 'a', workspaceSlug: 'a' }));
    adapter.upsertSync('tenants', 'b', makeTenant({ tenantId: 'b', workspaceSlug: 'b' }));
    adapter.clearSync('tenants');
    expect(adapter.listSync('tenants')).toEqual([]);
  });

  it('silently no-ops when the collection is already empty', () => {
    expect(() => adapter.clearSync('tenants')).not.toThrow();
  });
});

// ─── Collection isolation ─────────────────────────────────────────────────────

describe('collection isolation', () => {
  it('tenants and brandProfiles do not share storage', () => {
    adapter.upsertSync('tenants', 'test-tenant', makeTenant());
    expect(adapter.listSync('brandProfiles')).toEqual([]);
  });

  it('brandProfiles and tenants do not share storage', () => {
    adapter.upsertSync('brandProfiles', 'test-brand', makeBrand());
    expect(adapter.listSync('tenants')).toEqual([]);
  });
});

// ─── Async interface ──────────────────────────────────────────────────────────

describe('async list', () => {
  it('resolves with ok:true and an array', async () => {
    adapter.upsertSync('tenants', 'a', makeTenant());
    const result = await adapter.list('tenants');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
    }
  });

  it('resolves with ok:true and an empty array when collection is empty', async () => {
    const result = await adapter.list('tenants');
    expect(result).toEqual({ ok: true, data: [] });
  });
});

describe('async get', () => {
  it('resolves with ok:true and the item when found', async () => {
    const tenant = makeTenant();
    adapter.upsertSync('tenants', tenant.tenantId, tenant);
    const result = await adapter.get('tenants', tenant.tenantId);
    expect(result).toEqual({ ok: true, data: tenant });
  });

  it('resolves with ok:true and null when not found', async () => {
    const result = await adapter.get('tenants', 'missing');
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe('async upsert', () => {
  it('resolves with ok:true and data:undefined on success', async () => {
    const tenant = makeTenant();
    const result = await adapter.upsert('tenants', tenant.tenantId, tenant);
    expect(result).toEqual({ ok: true, data: undefined });
    expect(adapter.getSync('tenants', tenant.tenantId)).toEqual(tenant);
  });
});

describe('async delete', () => {
  it('resolves with ok:true after removing the item', async () => {
    const tenant = makeTenant();
    adapter.upsertSync('tenants', tenant.tenantId, tenant);
    const result = await adapter.delete('tenants', tenant.tenantId);
    expect(result).toEqual({ ok: true, data: undefined });
    expect(adapter.getSync('tenants', tenant.tenantId)).toBeNull();
  });

  it('resolves with ok:true even when the item does not exist', async () => {
    const result = await adapter.delete('tenants', 'nonexistent');
    expect(result).toEqual({ ok: true, data: undefined });
  });
});

// ─── Resilience ───────────────────────────────────────────────────────────────

describe('resilience', () => {
  it('returns an empty array when the stored JSON is malformed', () => {
    localStorage.setItem('atlas:tenants:v1', 'not-valid-json{{{');
    expect(adapter.listSync('tenants')).toEqual([]);
  });

  it('returns an empty array when the stored schema version is wrong', () => {
    localStorage.setItem(
      'atlas:tenants:v1',
      JSON.stringify({ schemaVersion: 99, tenantsById: { a: makeTenant() } }),
    );
    expect(adapter.listSync('tenants')).toEqual([]);
  });

  it('returns an empty array when the items field is missing', () => {
    localStorage.setItem(
      'atlas:tenants:v1',
      JSON.stringify({ schemaVersion: 1 }),
    );
    expect(adapter.listSync('tenants')).toEqual([]);
  });
});

// ─── visits use sessionStorage ────────────────────────────────────────────────

describe('visits collection', () => {
  it('stores and retrieves a visit via sessionStorage', () => {
    const visit = { visitId: 'v1', brandId: 'b1', createdAt: '2026-01-01T00:00:00Z' };
    adapter.upsertSync('visits', 'active', visit);
    expect(adapter.getSync('visits', 'active')).toEqual(visit);
  });

  it('visit data is not visible in localStorage', () => {
    const visit = { visitId: 'v2', brandId: 'b2', createdAt: '2026-01-01T00:00:00Z' };
    adapter.upsertSync('visits', 'active', visit);
    // The visits key should NOT appear in localStorage
    expect(localStorage.getItem('atlas:visits:v1')).toBeNull();
  });
});
