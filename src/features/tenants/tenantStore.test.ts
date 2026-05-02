/**
 * src/features/tenants/tenantStore.test.ts
 *
 * Tests for the tenant localStorage store.
 *
 * Coverage:
 *   - loadTenantStore returns empty record when nothing is stored
 *   - upsertTenant persists a tenant
 *   - deleteTenant removes a tenant
 *   - listStoredTenants merges built-ins with stored tenants
 *   - stored tenant overrides built-in by tenantId
 *   - saveTenantStore replaces the store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadTenantStore,
  saveTenantStore,
  upsertTenant,
  deleteTenant,
  listStoredTenants,
  TENANT_STORE_KEY,
} from './tenantStore';
import type { TenantProfileV1 } from './tenantProfile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearStore(): void {
  try {
    localStorage.removeItem(TENANT_STORE_KEY);
  } catch {
    // unavailable
  }
}

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

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearStore();
});

describe('loadTenantStore', () => {
  it('returns an empty record when nothing is stored', () => {
    const store = loadTenantStore();
    expect(store).toEqual({});
  });

  it('returns only stored tenants (not built-ins)', () => {
    const tenant = makeTenant();
    upsertTenant(tenant);
    const store = loadTenantStore();
    expect(Object.keys(store)).toEqual(['test-tenant']);
  });
});

describe('saveTenantStore', () => {
  it('replaces the entire store', () => {
    upsertTenant(makeTenant({ tenantId: 'old-tenant', workspaceSlug: 'old-tenant' }));
    const replacement = { 'new-tenant': makeTenant({ tenantId: 'new-tenant', workspaceSlug: 'new-tenant' }) };
    saveTenantStore(replacement);
    const store = loadTenantStore();
    expect(Object.keys(store)).toEqual(['new-tenant']);
    expect(store['old-tenant']).toBeUndefined();
  });
});

describe('upsertTenant', () => {
  it('persists a new tenant', () => {
    const tenant = makeTenant();
    upsertTenant(tenant);
    const store = loadTenantStore();
    expect(store['test-tenant']).toEqual(tenant);
  });

  it('overwrites an existing tenant with the same tenantId', () => {
    upsertTenant(makeTenant({ displayName: 'Old Name' }));
    upsertTenant(makeTenant({ displayName: 'New Name' }));
    const store = loadTenantStore();
    expect(store['test-tenant'].displayName).toBe('New Name');
  });

  it('preserves other tenants when upserting', () => {
    upsertTenant(makeTenant({ tenantId: 'tenant-a', workspaceSlug: 'tenant-a' }));
    upsertTenant(makeTenant({ tenantId: 'tenant-b', workspaceSlug: 'tenant-b' }));
    const store = loadTenantStore();
    expect(store['tenant-a']).toBeDefined();
    expect(store['tenant-b']).toBeDefined();
  });
});

describe('deleteTenant', () => {
  it('removes a stored tenant', () => {
    upsertTenant(makeTenant());
    deleteTenant('test-tenant');
    const store = loadTenantStore();
    expect(store['test-tenant']).toBeUndefined();
  });

  it('silently no-ops when tenant does not exist', () => {
    expect(() => deleteTenant('nonexistent')).not.toThrow();
  });

  it('preserves other tenants when deleting', () => {
    upsertTenant(makeTenant({ tenantId: 'keep-me', workspaceSlug: 'keep-me' }));
    upsertTenant(makeTenant({ tenantId: 'delete-me', workspaceSlug: 'delete-me' }));
    deleteTenant('delete-me');
    const store = loadTenantStore();
    expect(store['keep-me']).toBeDefined();
    expect(store['delete-me']).toBeUndefined();
  });
});

describe('listStoredTenants', () => {
  it('includes built-in atlas tenant', () => {
    const tenants = listStoredTenants();
    expect(tenants.some((t) => t.tenantId === 'atlas')).toBe(true);
  });

  it('includes built-in demo-heating tenant', () => {
    const tenants = listStoredTenants();
    expect(tenants.some((t) => t.tenantId === 'demo-heating')).toBe(true);
  });

  it('includes custom stored tenants', () => {
    upsertTenant(makeTenant());
    const tenants = listStoredTenants();
    expect(tenants.some((t) => t.tenantId === 'test-tenant')).toBe(true);
  });

  it('stored tenant overrides built-in by tenantId', () => {
    const overriddenAtlas: TenantProfileV1 = {
      version: '1.0',
      tenantId: 'atlas',
      workspaceSlug: 'atlas',
      displayName: 'Atlas Custom',
      brandId: 'custom-brand',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    upsertTenant(overriddenAtlas);
    const tenants = listStoredTenants();
    const atlas = tenants.find((t) => t.tenantId === 'atlas');
    expect(atlas?.displayName).toBe('Atlas Custom');
    expect(atlas?.brandId).toBe('custom-brand');
  });
});
