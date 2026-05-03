/**
 * src/features/userProfiles/useRolePermissions.ts
 *
 * Derives boolean UI-permission flags from the active user's role.
 *
 * Design rules
 * ────────────
 * - No real security enforcement — purely controls UI visibility/availability.
 * - When no user is active, all capability flags default to true (pre-auth /
 *   unguarded default so existing behaviour is preserved for users who have not
 *   set up a profile).  Developer-mode tools are always opt-in.
 * - When an active user is set, permissions are derived from their resolved role.
 * - The role for a given tenant is resolved in priority order:
 *     1. explicit tenantId parameter (call-site knows the active tenant)
 *     2. user.defaultTenantId stored on the profile
 *     3. first entry in rolesByTenant (single-tenant common case)
 *     4. 'viewer' fallback when no roles are configured
 */

import { useContext } from 'react';
import { ActiveUserContext } from './ActiveUserProvider';
import type { UserRoleV1 } from './userProfile';

// ─── Permission flags ─────────────────────────────────────────────────────────

export interface RolePermissions {
  /** owner | admin — manage workspaces and tenant settings. */
  canManageWorkspace: boolean;
  /** owner | admin — edit workspace branding. */
  canEditBranding: boolean;
  /** owner | admin | sales — view analytics dashboard. */
  canViewAnalytics: boolean;
  /** owner | admin | engineer — create new visits. */
  canCreateVisit: boolean;
  /** owner | admin | sales — mark a job outcome (won / lost / follow-up). */
  canMarkOutcome: boolean;
  /** user.developerMode === true — access developer tools and diagnostics panels. */
  canAccessDeveloperTools: boolean;
  /** The resolved role used to compute the above flags; null when no user is active. */
  effectiveRole: UserRoleV1 | null;
}

// ─── Role resolution ──────────────────────────────────────────────────────────

/**
 * Resolves the most-appropriate role for the active user.
 *
 * Priority:
 *   1. Explicit tenantId parameter (when the call-site knows the active tenant).
 *   2. user.defaultTenantId (stored on the profile).
 *   3. First role entry in rolesByTenant (single-tenant common case).
 *   4. 'viewer' fallback when no roles are configured.
 */
function resolveEffectiveRole(
  rolesByTenant: Record<string, UserRoleV1>,
  tenantId: string | undefined,
  defaultTenantId: string | undefined,
): UserRoleV1 {
  if (tenantId !== undefined && tenantId in rolesByTenant) {
    return rolesByTenant[tenantId];
  }
  if (defaultTenantId !== undefined && defaultTenantId in rolesByTenant) {
    return rolesByTenant[defaultTenantId];
  }
  const entries = Object.values(rolesByTenant);
  return entries.length > 0 ? entries[0] : 'viewer';
}

// ─── Permission matrix ────────────────────────────────────────────────────────

function computePermissions(role: UserRoleV1 | null, developerMode: boolean): RolePermissions {
  return {
    canManageWorkspace:      role === 'owner' || role === 'admin',
    canEditBranding:         role === 'owner' || role === 'admin',
    canViewAnalytics:        role === 'owner' || role === 'admin' || role === 'sales',
    canCreateVisit:          role === 'owner' || role === 'admin' || role === 'engineer',
    canMarkOutcome:          role === 'owner' || role === 'admin' || role === 'sales',
    canAccessDeveloperTools: developerMode,
    effectiveRole:           role,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useRolePermissions
 *
 * Returns boolean permission flags derived from the active user's role.
 *
 * When no user is active (pre-auth / no profile configured), all capability
 * flags return true so existing behaviour is fully preserved.
 * Developer-mode tools always require explicit opt-in via user.developerMode.
 *
 * @param tenantId  Optional tenantId to resolve the role against.
 *                  Pass when the call-site knows which workspace is active.
 */
export function useRolePermissions(tenantId?: string): RolePermissions {
  // Use the context directly rather than useActiveUser() so this hook is safe
  // to call in component trees that are rendered outside an ActiveUserProvider
  // (e.g. in unit tests that render individual pages in isolation).
  // A null context value is treated identically to a null activeUser.
  const ctx = useContext(ActiveUserContext);
  const activeUser = ctx?.activeUser ?? null;

  // No active user → unguarded defaults (pre-auth phase, no profile set up).
  // Developer-mode tools always require explicit opt-in — they are never granted
  // by default.
  if (activeUser === null) {
    return {
      canManageWorkspace:      true,
      canEditBranding:         true,
      canViewAnalytics:        true,
      canCreateVisit:          true,
      canMarkOutcome:          true,
      canAccessDeveloperTools: false,
      effectiveRole:           null,
    };
  }

  const role = resolveEffectiveRole(
    activeUser.rolesByTenant,
    tenantId,
    activeUser.defaultTenantId,
  );

  return computePermissions(role, activeUser.developerMode === true);
}
