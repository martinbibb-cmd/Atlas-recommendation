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
 * - Primary:  localStorage (survives page reload and tab close).
 * - Fallback: sessionStorage (when localStorage is unavailable).
 * - Reads are defensive: malformed or missing data returns an empty store.
 *
 * Storage key:  atlas:tenants:v1
 *
 * Store shape:
 *   {
 *     schemaVersion: 1,
 *     tenantsById: Record<string, TenantProfileV1>
 *   }
 *
 * Design rules
 * ────────────
 * - No React dependencies — pure storage functions usable anywhere.
 * - Each write replaces only the entry for that tenantId (other entries
 *   are preserved).
 */

import type { TenantProfileV1 } from './tenantProfile';
import { BUILT_IN_TENANTS } from './tenantRegistry';

// ─── Constants ────────────────────────────────────────────────────────────────

export const TENANT_STORE_KEY = 'atlas:tenants:v1';

const SCHEMA_VERSION = 1 as const;

// ─── Store shape ──────────────────────────────────────────────────────────────

interface TenantStoreShape {
  schemaVersion: typeof SCHEMA_VERSION;
  tenantsById: Record<string, TenantProfileV1>;
}

// ─── Storage access helpers ───────────────────────────────────────────────────

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // localStorage may throw in some environments.
  }
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    // sessionStorage also unavailable.
  }
  return null;
}

// ─── Store read / write helpers ───────────────────────────────────────────────

function readStore(): TenantStoreShape {
  const storage = getStorage();
  if (!storage) {
    return { schemaVersion: SCHEMA_VERSION, tenantsById: {} };
  }
  try {
    const raw = storage.getItem(TENANT_STORE_KEY);
    if (!raw) return { schemaVersion: SCHEMA_VERSION, tenantsById: {} };
    const parsed = JSON.parse(raw) as Partial<TenantStoreShape>;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      parsed.schemaVersion !== SCHEMA_VERSION ||
      typeof parsed.tenantsById !== 'object' ||
      parsed.tenantsById === null
    ) {
      return { schemaVersion: SCHEMA_VERSION, tenantsById: {} };
    }
    return parsed as TenantStoreShape;
  } catch {
    return { schemaVersion: SCHEMA_VERSION, tenantsById: {} };
  }
}

function writeStore(store: TenantStoreShape): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(TENANT_STORE_KEY, JSON.stringify(store));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the raw persisted store (stored tenants only, no built-ins merged).
 */
export function loadTenantStore(): Record<string, TenantProfileV1> {
  return { ...readStore().tenantsById };
}

/**
 * Replaces the entire persisted store with the provided record.
 * Overwrites any existing stored tenants.
 */
export function saveTenantStore(store: Record<string, TenantProfileV1>): void {
  writeStore({ schemaVersion: SCHEMA_VERSION, tenantsById: store });
}

/**
 * Inserts or updates a tenant in the persisted store.
 * Keyed by tenantId — if a record with the same tenantId already exists it is
 * fully replaced.
 */
export function upsertTenant(tenant: TenantProfileV1): void {
  const store = readStore();
  store.tenantsById[tenant.tenantId] = tenant;
  writeStore(store);
}

/**
 * Removes the stored tenant with the given tenantId.
 * Silently no-ops when no record exists for that tenantId.
 */
export function deleteTenant(tenantId: string): void {
  try {
    const store = readStore();
    delete store.tenantsById[tenantId];
    writeStore(store);
  } catch {
    // Best effort.
  }
}

/**
 * Returns all stored tenants merged with built-in tenants.
 * Stored tenant wins when both have the same tenantId.
 */
export function listStoredTenants(): TenantProfileV1[] {
  const stored = readStore().tenantsById;
  const merged: Record<string, TenantProfileV1> = {
    ...BUILT_IN_TENANTS,
    ...stored,
  };
  return Object.values(merged);
}
