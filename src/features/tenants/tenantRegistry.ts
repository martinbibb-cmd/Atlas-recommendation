/**
 * src/features/tenants/tenantRegistry.ts
 *
 * Built-in tenant registry for Atlas.
 *
 * Provides deterministic, side-effect-free lookup functions for the set of
 * tenants that ship with the product.  Stored/custom tenants are handled by
 * tenantStore.ts and merged at call-site level (see activeTenant.ts).
 *
 * Design rules
 * ────────────
 * - All functions are pure: no side-effects, no I/O.
 * - The registry is immutable at runtime.
 * - Unknown lookups return undefined / null rather than throwing.
 */

import type { TenantProfileV1 } from './tenantProfile';

// ─── Built-in tenants ─────────────────────────────────────────────────────────

const ATLAS_TENANT: TenantProfileV1 = {
  version: '1.0',
  tenantId: 'atlas',
  workspaceSlug: 'atlas',
  displayName: 'Atlas',
  brandId: 'atlas-default',
  status: 'active',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const DEMO_HEATING_TENANT: TenantProfileV1 = {
  version: '1.0',
  tenantId: 'demo-heating',
  workspaceSlug: 'demo-heating',
  displayName: 'Demo Heating Co',
  brandId: 'installer-demo',
  status: 'active',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * Immutable map of built-in tenants keyed by tenantId.
 * Consumers should use the lookup functions below rather than accessing this
 * map directly so the public API remains stable.
 */
export const BUILT_IN_TENANTS: Readonly<Record<string, TenantProfileV1>> = {
  atlas: ATLAS_TENANT,
  'demo-heating': DEMO_HEATING_TENANT,
};

// ─── Lookup functions ─────────────────────────────────────────────────────────

/**
 * Returns all built-in tenants as an array.
 */
export function listTenants(): TenantProfileV1[] {
  return Object.values(BUILT_IN_TENANTS);
}

/**
 * Returns the built-in tenant matching the given tenantId, or undefined.
 */
export function getTenantById(tenantId: string): TenantProfileV1 | undefined {
  return BUILT_IN_TENANTS[tenantId];
}

/**
 * Returns the built-in tenant matching the given workspaceSlug, or undefined.
 */
export function getTenantBySlug(workspaceSlug: string): TenantProfileV1 | undefined {
  return Object.values(BUILT_IN_TENANTS).find(
    (t) => t.workspaceSlug === workspaceSlug,
  );
}

/**
 * Returns the brandId for the given tenantId, or undefined when not found.
 */
export function getBrandIdForTenant(tenantId: string): string | undefined {
  return BUILT_IN_TENANTS[tenantId]?.brandId;
}

/**
 * Returns the brandId for the given workspaceSlug, or undefined when not found.
 */
export function getBrandIdForWorkspaceSlug(workspaceSlug: string): string | undefined {
  return getTenantBySlug(workspaceSlug)?.brandId;
}
