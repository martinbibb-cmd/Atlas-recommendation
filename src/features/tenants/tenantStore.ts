/**
 * src/features/tenants/tenantStore.ts
 *
 * Local persistence for created/edited tenant records.
 *
 * Stored tenants are merged with built-in tenants at read time, with the
 * stored version winning when both share the same tenantId.
 *
 * Storage strategy
 * ────────────────
 * All reads and writes are delegated to localAdapter (LocalStorageAdapter),
 * which targets localStorage with a sessionStorage fallback.
 *
 * Storage key:  atlas:tenants:v1
 *
 * Design rules
 * ────────────
 * - No React dependencies — pure storage functions usable anywhere.
 * - Each write replaces only the entry for that tenantId (other entries
 *   are preserved).
 */

import type { TenantProfileV1 } from './tenantProfile';
import { BUILT_IN_TENANTS } from './tenantRegistry';
import { localAdapter } from '../../lib/storage/localStorageAdapter';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Storage key used by the underlying adapter for the tenants collection. */
export const TENANT_STORE_KEY = 'atlas:tenants:v1';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the raw persisted store (stored tenants only, no built-ins merged).
 */
export function loadTenantStore(): Record<string, TenantProfileV1> {
  return localAdapter.readAllSync('tenants');
}

/**
 * Replaces the entire persisted store with the provided record.
 * Overwrites any existing stored tenants.
 */
export function saveTenantStore(store: Record<string, TenantProfileV1>): void {
  localAdapter.replaceAllSync('tenants', store);
}

/**
 * Inserts or updates a tenant in the persisted store.
 * Keyed by tenantId — if a record with the same tenantId already exists it is
 * fully replaced.
 */
export function upsertTenant(tenant: TenantProfileV1): void {
  localAdapter.upsertSync('tenants', tenant.tenantId, tenant);
}

/**
 * Removes the stored tenant with the given tenantId.
 * Silently no-ops when no record exists for that tenantId.
 */
export function deleteTenant(tenantId: string): void {
  localAdapter.deleteSync('tenants', tenantId);
}

/**
 * Returns all stored tenants merged with built-in tenants.
 * Stored tenant wins when both have the same tenantId.
 */
export function listStoredTenants(): TenantProfileV1[] {
  const stored = localAdapter.readAllSync('tenants');
  const merged: Record<string, TenantProfileV1> = {
    ...BUILT_IN_TENANTS,
    ...stored,
  };
  return Object.values(merged);
}
