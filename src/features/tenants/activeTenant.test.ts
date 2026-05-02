/**
 * src/features/tenants/activeTenant.test.ts
 *
 * Tests for the active tenant resolver.
 *
 * Coverage:
 *   - tenantId wins over workspaceSlug
 *   - workspaceSlug resolves when no tenantId is given
 *   - fallback is the atlas tenant when both inputs are absent/unrecognised
 *   - stored tenant is found when tenantId matches a custom tenant
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resolveActiveTenant, FALLBACK_TENANT_ID } from './activeTenant';
import { upsertTenant, TENANT_STORE_KEY } from './tenantStore';
import type { TenantProfileV1 } from './tenantProfile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearStore(): void {
  try {
    localStorage.removeItem(TENANT_STORE_KEY);
  } catch {
    // unavailable
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearStore();
});

describe('resolveActiveTenant', () => {
  it('falls back to the atlas tenant when both inputs are absent', () => {
    const tenant = resolveActiveTenant({});
    expect(tenant.tenantId).toBe(FALLBACK_TENANT_ID);
    expect(tenant.tenantId).toBe('atlas');
  });

  it('falls back to the atlas tenant when both inputs are null', () => {
    const tenant = resolveActiveTenant({ tenantId: null, workspaceSlug: null });
    expect(tenant.tenantId).toBe('atlas');
  });

  it('falls back to the atlas tenant when tenantId is unrecognised and no slug', () => {
    const tenant = resolveActiveTenant({ tenantId: 'no-such-tenant' });
    expect(tenant.tenantId).toBe('atlas');
  });

  it('resolves by tenantId for atlas', () => {
    const tenant = resolveActiveTenant({ tenantId: 'atlas' });
    expect(tenant.tenantId).toBe('atlas');
    expect(tenant.brandId).toBe('atlas-default');
  });

  it('resolves by tenantId for demo-heating', () => {
    const tenant = resolveActiveTenant({ tenantId: 'demo-heating' });
    expect(tenant.tenantId).toBe('demo-heating');
    expect(tenant.brandId).toBe('installer-demo');
  });

  it('resolves by workspaceSlug when tenantId is absent', () => {
    const tenant = resolveActiveTenant({ workspaceSlug: 'demo-heating' });
    expect(tenant.tenantId).toBe('demo-heating');
    expect(tenant.brandId).toBe('installer-demo');
  });

  it('tenantId wins over workspaceSlug when both are provided', () => {
    // tenantId = 'atlas', workspaceSlug = 'demo-heating' → should resolve atlas
    const tenant = resolveActiveTenant({ tenantId: 'atlas', workspaceSlug: 'demo-heating' });
    expect(tenant.tenantId).toBe('atlas');
    expect(tenant.brandId).toBe('atlas-default');
  });

  it('resolves a custom stored tenant by tenantId', () => {
    const custom: TenantProfileV1 = {
      version: '1.0',
      tenantId: 'custom-co',
      workspaceSlug: 'custom-co',
      displayName: 'Custom Co',
      brandId: 'custom-brand',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    upsertTenant(custom);
    const tenant = resolveActiveTenant({ tenantId: 'custom-co' });
    expect(tenant.tenantId).toBe('custom-co');
    expect(tenant.brandId).toBe('custom-brand');
  });

  it('resolves a custom stored tenant by workspaceSlug', () => {
    const custom: TenantProfileV1 = {
      version: '1.0',
      tenantId: 'custom-slug-co',
      workspaceSlug: 'my-company',
      displayName: 'My Company',
      brandId: 'my-brand',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    upsertTenant(custom);
    const tenant = resolveActiveTenant({ workspaceSlug: 'my-company' });
    expect(tenant.tenantId).toBe('custom-slug-co');
    expect(tenant.brandId).toBe('my-brand');
  });

  it('fallback atlas tenant is the active is atlas', () => {
    const tenant = resolveActiveTenant({});
    expect(tenant.brandId).toBe('atlas-default');
  });
});
