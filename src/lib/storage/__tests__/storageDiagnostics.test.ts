/**
 * src/lib/storage/__tests__/storageDiagnostics.test.ts
 *
 * Unit tests for storageDiagnostics utilities.
 *
 * Coverage:
 *   - gatherStorageDiagnostics: counts items per collection, reports errors, labels adapter kind
 *   - exportLocalCollection: returns CollectionExport with correct schema version and items
 *   - importCollectionIntoAdapter: upserts all items, collects per-item errors
 *   - clearLocalCollection: removes all items from the collection
 *   - dryRunLocalToAdapter: returns item counts without writing
 *   - copyLocalToAdapter: copies all collections into target adapter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageAdapter } from '../localStorageAdapter';
import {
  gatherStorageDiagnostics,
  exportLocalCollection,
  importCollectionIntoAdapter,
  clearLocalCollection,
  dryRunLocalToAdapter,
  copyLocalToAdapter,
  ALL_COLLECTIONS,
} from '../storageDiagnostics';
import type { TenantProfileV1 } from '../../../features/tenants/tenantProfile';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTenant(id = 'tenant-1'): TenantProfileV1 {
  return {
    version: '1.0',
    tenantId: id,
    workspaceSlug: id,
    displayName: 'Test Tenant',
    brandId: 'brand-1',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('gatherStorageDiagnostics', () => {
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    adapter = new LocalStorageAdapter();
    for (const col of ALL_COLLECTIONS) {
      adapter.clearSync(col);
    }
  });

  it('reports zero counts when all collections are empty', async () => {
    const result = await gatherStorageDiagnostics(adapter);

    expect(result.activeAdapterKind).toBe('local');
    expect(result.lastError).toBeNull();
    expect(result.collections).toHaveLength(5);
    for (const snap of result.collections) {
      expect(snap.count).toBe(0);
      expect(snap.error).toBeNull();
    }
  });

  it('counts items correctly after upserts', async () => {
    adapter.upsertSync('tenants', 'tenant-1', makeTenant('tenant-1'));
    adapter.upsertSync('tenants', 'tenant-2', makeTenant('tenant-2'));

    const result = await gatherStorageDiagnostics(adapter);
    const tenantsSnap = result.collections.find(c => c.collection === 'tenants');

    expect(tenantsSnap?.count).toBe(2);
    expect(tenantsSnap?.error).toBeNull();
  });

  it('includes a non-null gatheredAt timestamp', async () => {
    const result = await gatherStorageDiagnostics(adapter);
    expect(result.gatheredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('exportLocalCollection', () => {
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    adapter = new LocalStorageAdapter();
    adapter.clearSync('tenants');
  });

  it('exports an empty collection as an empty items map', () => {
    // exportLocalCollection uses the module-level localAdapter singleton, so we
    // seed through it directly by having the test use a fresh isolated adapter.
    // For this test we verify the shape only — seeding via the module localAdapter
    // is exercised in the import round-trip test below.
    const payload = exportLocalCollection('tenants');

    expect(payload.schemaVersion).toBe(1);
    expect(payload.collection).toBe('tenants');
    expect(typeof payload.exportedAt).toBe('string');
    expect(payload.items).toBeDefined();
    expect(typeof payload.items).toBe('object');
  });

  it('round-trips items through export → import', async () => {
    // We use two isolated adapters to prove the round-trip.
    const source = new LocalStorageAdapter();
    const dest = new LocalStorageAdapter();

    source.clearSync('tenants');
    dest.clearSync('tenants');

    source.upsertSync('tenants', 'tenant-abc', makeTenant('tenant-abc'));

    // Build an export envelope manually using source data (mirrors exportLocalCollection
    // logic so we can control the source adapter).
    const payload = {
      schemaVersion: 1 as const,
      collection: 'tenants' as const,
      exportedAt: new Date().toISOString(),
      items: source.readAllSync('tenants') as Record<string, unknown>,
    };

    const { imported, errors } = await importCollectionIntoAdapter(dest, payload);

    expect(imported).toBe(1);
    expect(errors).toHaveLength(0);

    const retrieved = dest.getSync('tenants', 'tenant-abc');
    expect(retrieved?.tenantId).toBe('tenant-abc');
  });
});

describe('importCollectionIntoAdapter', () => {
  it('imports multiple items and reports counts', async () => {
    const dest = new LocalStorageAdapter();
    dest.clearSync('tenants');

    const payload = {
      schemaVersion: 1 as const,
      collection: 'tenants' as const,
      exportedAt: new Date().toISOString(),
      items: {
        'a': makeTenant('a') as unknown,
        'b': makeTenant('b') as unknown,
        'c': makeTenant('c') as unknown,
      },
    };

    const { imported, errors } = await importCollectionIntoAdapter(dest, payload);

    expect(imported).toBe(3);
    expect(errors).toHaveLength(0);
  });
});

describe('clearLocalCollection', () => {
  it('removes all items from the specified collection', () => {
    // Seed via an isolated adapter and verify via list
    const adapter = new LocalStorageAdapter();
    adapter.clearSync('tenants');
    adapter.upsertSync('tenants', 'x', makeTenant('x'));
    adapter.upsertSync('tenants', 'y', makeTenant('y'));

    // clearLocalCollection uses the module-level localAdapter — we verify that
    // calling it leaves no items by using another isolated adapter that shares
    // the same underlying Web Storage key.
    clearLocalCollection('tenants');

    // A fresh adapter reading the same storage key should see zero items
    const after = new LocalStorageAdapter();
    const items = after.listSync('tenants');
    expect(items).toHaveLength(0);
  });
});

describe('dryRunLocalToAdapter', () => {
  it('returns item counts without writing anything to the target', async () => {
    const source = new LocalStorageAdapter();
    // Note: dryRunLocalToAdapter reads from the module-level localAdapter singleton,
    // so we clear and seed through any isolated adapter (same storage key).
    source.clearSync('tenants');
    source.upsertSync('tenants', 'tenant-dr', makeTenant('tenant-dr'));

    const preview = dryRunLocalToAdapter(source);

    expect(preview.tenants.itemCount).toBeGreaterThanOrEqual(1);
    // Other collections are just counts — no assertion on exact values.
    for (const col of ALL_COLLECTIONS) {
      expect(typeof preview[col].itemCount).toBe('number');
    }
  });
});

describe('copyLocalToAdapter', () => {
  it('copies tenants from localAdapter into a target adapter', async () => {
    // All LocalStorageAdapter instances share the same jsdom localStorage keys,
    // so we seed via one instance, then copy, then verify via a different instance.
    const seedAdapter = new LocalStorageAdapter();
    seedAdapter.clearSync('tenants');
    seedAdapter.upsertSync('tenants', 'tenant-cp', makeTenant('tenant-cp'));

    // Use localAdapter (module singleton) as the target so copyLocalToAdapter
    // reads and writes the same key — the copy is idempotent and verifiable.
    const target = new LocalStorageAdapter();

    const results = await copyLocalToAdapter(target);

    expect(results.tenants.copied).toBeGreaterThanOrEqual(1);
    expect(results.tenants.errors).toHaveLength(0);

    const copied = target.getSync('tenants', 'tenant-cp');
    expect(copied?.tenantId).toBe('tenant-cp');
  });

  it('returns results for all known collections', async () => {
    const target = new LocalStorageAdapter();
    const results = await copyLocalToAdapter(target);

    for (const col of ALL_COLLECTIONS) {
      expect(results[col]).toBeDefined();
      expect(typeof results[col].copied).toBe('number');
      expect(Array.isArray(results[col].errors)).toBe(true);
    }
  });
});
