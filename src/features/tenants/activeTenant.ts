/**
 * src/features/tenants/activeTenant.ts
 *
 * Deterministic resolver for the active tenant in the Atlas visit journey.
 *
 * Priority chain (first valid result wins):
 *   1. tenantId   — resolve by stable internal ID
 *   2. workspaceSlug — resolve by customer-facing slug
 *   3. fallback   — the 'atlas' built-in tenant
 *
 * This function is pure aside from reading the tenant store.
 * It never throws — invalid or unknown inputs fall back to the atlas tenant.
 */

import type { TenantProfileV1 } from './tenantProfile';
import { getTenantById, getTenantBySlug } from './tenantRegistry';
import { loadTenantStore } from './tenantStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResolveActiveTenantInput {
  /** Resolve by stable tenantId first (highest priority). */
  tenantId?: string | null;
  /** Resolve by workspaceSlug when tenantId is absent or unrecognised. */
  workspaceSlug?: string | null;
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

/** The tenantId that is always used as a final fallback. */
export const FALLBACK_TENANT_ID = 'atlas';

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolves the active TenantProfileV1 from a priority-ordered set of inputs.
 *
 * Lookup order per candidate:
 *   1. Check the persisted store (custom/edited tenants).
 *   2. Check the built-in registry.
 *
 * Falls back to the atlas tenant when no candidate resolves.
 *
 * @param input - Priority-ordered lookup candidates.
 * @returns A TenantProfileV1 — never undefined.
 */
export function resolveActiveTenant(
  input: ResolveActiveTenantInput,
): TenantProfileV1 {
  const stored = loadTenantStore();

  // 1. Try tenantId
  if (input.tenantId && input.tenantId.trim().length > 0) {
    const fromStore = Object.values(stored).find(
      (t) => t.tenantId === input.tenantId,
    );
    if (fromStore) return fromStore;
    const fromRegistry = getTenantById(input.tenantId);
    if (fromRegistry) return fromRegistry;
  }

  // 2. Try workspaceSlug
  if (input.workspaceSlug && input.workspaceSlug.trim().length > 0) {
    const fromStore = Object.values(stored).find(
      (t) => t.workspaceSlug === input.workspaceSlug,
    );
    if (fromStore) return fromStore;
    const fromRegistry = getTenantBySlug(input.workspaceSlug);
    if (fromRegistry) return fromRegistry;
  }

  // 3. Fallback: atlas built-in (always present)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return getTenantById(FALLBACK_TENANT_ID)!;
}
