/**
 * src/features/tenants/tenantRegistry.test.ts
 *
 * Tests for the built-in tenant registry.
 *
 * Coverage:
 *   - built-in tenants resolve correctly
 *   - demo-heating maps to installer-demo brand
 *   - atlas maps to atlas-default brand
 *   - unknown lookups return undefined
 *   - listTenants returns all built-ins
 */

import { describe, it, expect } from 'vitest';
import {
  listTenants,
  getTenantById,
  getTenantBySlug,
  getBrandIdForTenant,
  getBrandIdForWorkspaceSlug,
  BUILT_IN_TENANTS,
} from './tenantRegistry';

// ─── listTenants ──────────────────────────────────────────────────────────────

describe('listTenants', () => {
  it('returns an array containing the atlas tenant', () => {
    const tenants = listTenants();
    expect(tenants.some((t) => t.tenantId === 'atlas')).toBe(true);
  });

  it('returns an array containing the demo-heating tenant', () => {
    const tenants = listTenants();
    expect(tenants.some((t) => t.tenantId === 'demo-heating')).toBe(true);
  });

  it('returns at least 2 tenants', () => {
    expect(listTenants().length).toBeGreaterThanOrEqual(2);
  });
});

// ─── getTenantById ────────────────────────────────────────────────────────────

describe('getTenantById', () => {
  it('returns the atlas tenant by ID', () => {
    const tenant = getTenantById('atlas');
    expect(tenant).toBeDefined();
    expect(tenant?.tenantId).toBe('atlas');
    expect(tenant?.workspaceSlug).toBe('atlas');
    expect(tenant?.displayName).toBe('Atlas');
    expect(tenant?.brandId).toBe('atlas-default');
  });

  it('returns the demo-heating tenant by ID', () => {
    const tenant = getTenantById('demo-heating');
    expect(tenant).toBeDefined();
    expect(tenant?.tenantId).toBe('demo-heating');
    expect(tenant?.workspaceSlug).toBe('demo-heating');
    expect(tenant?.displayName).toBe('Demo Heating Co');
    expect(tenant?.brandId).toBe('installer-demo');
  });

  it('returns undefined for an unknown tenantId', () => {
    expect(getTenantById('nonexistent-tenant')).toBeUndefined();
  });
});

// ─── getTenantBySlug ──────────────────────────────────────────────────────────

describe('getTenantBySlug', () => {
  it('returns the atlas tenant by workspaceSlug', () => {
    const tenant = getTenantBySlug('atlas');
    expect(tenant?.tenantId).toBe('atlas');
  });

  it('returns the demo-heating tenant by workspaceSlug', () => {
    const tenant = getTenantBySlug('demo-heating');
    expect(tenant?.tenantId).toBe('demo-heating');
  });

  it('returns undefined for an unknown slug', () => {
    expect(getTenantBySlug('unknown-slug')).toBeUndefined();
  });
});

// ─── getBrandIdForTenant ──────────────────────────────────────────────────────

describe('getBrandIdForTenant', () => {
  it('returns atlas-default for the atlas tenant', () => {
    expect(getBrandIdForTenant('atlas')).toBe('atlas-default');
  });

  it('returns installer-demo for the demo-heating tenant', () => {
    expect(getBrandIdForTenant('demo-heating')).toBe('installer-demo');
  });

  it('returns undefined for an unknown tenantId', () => {
    expect(getBrandIdForTenant('no-such-tenant')).toBeUndefined();
  });
});

// ─── getBrandIdForWorkspaceSlug ───────────────────────────────────────────────

describe('getBrandIdForWorkspaceSlug', () => {
  it('returns atlas-default for the atlas workspace slug', () => {
    expect(getBrandIdForWorkspaceSlug('atlas')).toBe('atlas-default');
  });

  it('returns installer-demo for the demo-heating workspace slug', () => {
    expect(getBrandIdForWorkspaceSlug('demo-heating')).toBe('installer-demo');
  });

  it('returns undefined for an unknown slug', () => {
    expect(getBrandIdForWorkspaceSlug('unknown')).toBeUndefined();
  });
});

// ─── BUILT_IN_TENANTS ─────────────────────────────────────────────────────────

describe('BUILT_IN_TENANTS', () => {
  it('is keyed by tenantId', () => {
    expect(BUILT_IN_TENANTS['atlas']).toBeDefined();
    expect(BUILT_IN_TENANTS['demo-heating']).toBeDefined();
  });

  it('each tenant has version 1.0', () => {
    for (const tenant of Object.values(BUILT_IN_TENANTS)) {
      expect(tenant.version).toBe('1.0');
    }
  });

  it('each tenant has active status', () => {
    for (const tenant of Object.values(BUILT_IN_TENANTS)) {
      expect(tenant.status).toBe('active');
    }
  });
});
