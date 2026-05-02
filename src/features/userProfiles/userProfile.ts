/**
 * src/features/userProfiles/userProfile.ts
 *
 * UserProfileV1 — the individual-user data model for Atlas.
 *
 * A user profile represents an engineer, admin, or other person who uses Atlas
 * on behalf of a tenant.  Profiles are intentionally lightweight: no passwords,
 * no tokens, no full auth.  They exist to record who did what (visit creator,
 * scan operator, job outcome marker) and to carry per-user preferences.
 *
 * This file contains type definitions only.  It has no runtime side-effects.
 */

// ─── Role ─────────────────────────────────────────────────────────────────────

/**
 * Role a user holds within a specific tenant.
 *
 *   owner    — full control over tenant settings and billing (typically one per tenant)
 *   admin    — manage users, workspaces, and brand profiles
 *   engineer — conduct surveys, run scans, produce recommendations
 *   sales    — view and action job outcomes (won/lost); read-only on survey data
 *   viewer   — read-only access across all tenant data
 */
export type UserRoleV1 =
  | 'owner'
  | 'admin'
  | 'engineer'
  | 'sales'
  | 'viewer';

// ─── Profile ──────────────────────────────────────────────────────────────────

/**
 * Lightweight user profile stored locally.
 *
 * Designed for the pre-auth phase: no password fields, no tokens.
 * Sufficient to record authorship on visits, scans, and job outcomes, and to
 * carry per-user UI preferences.
 */
export interface UserProfileV1 {
  /** Schema version — always '1.0'. */
  version: '1.0';

  /** Stable identifier for this user (e.g. "user_abc123" or a UUID). */
  userId: string;

  /** Human-readable name shown in visit attribution and the profile switcher. */
  displayName: string;

  /**
   * Optional email address for display purposes only.
   * Never forwarded to analytics; treated as PII.
   */
  email?: string;

  /**
   * Default tenantId to pre-select when this user opens Atlas.
   * Resolved against the tenant registry at runtime.
   */
  defaultTenantId?: string;

  /**
   * Default workspace slug to pre-select when this user opens Atlas.
   * Takes lower priority than defaultTenantId when both are set.
   */
  defaultWorkspaceSlug?: string;

  /**
   * Role this user holds per tenant, keyed by tenantId.
   * A user absent from this map for a given tenant is treated as a viewer.
   */
  rolesByTenant: Record<string, UserRoleV1>;

  /**
   * When true, developer-mode UI (dev menus, diagnostics panels) is enabled
   * for this user regardless of the global dev flag.
   */
  developerMode?: boolean;

  /** ISO-8601 timestamp when the profile was first created. */
  createdAt: string;

  /** ISO-8601 timestamp when the profile was last modified. */
  updatedAt: string;
}

// ─── Membership ───────────────────────────────────────────────────────────────

/**
 * Explicit membership record linking a user to a workspace within a tenant.
 *
 * In the local-only phase this is derived from UserProfileV1.rolesByTenant.
 * Modelled as a first-class type so it can be persisted independently once
 * multi-device sync is introduced.
 */
export interface UserWorkspaceMembershipV1 {
  /** Schema version — always '1.0'. */
  version: '1.0';

  /** Stable user identifier. */
  userId: string;

  /** Tenant this membership belongs to. */
  tenantId: string;

  /**
   * Workspace slug within the tenant, or null when the membership is
   * tenant-wide (applies to all workspaces).
   */
  workspaceSlug: string | null;

  /** Role granted by this membership record. */
  role: UserRoleV1;

  /** ISO-8601 timestamp when the membership was granted. */
  grantedAt: string;
}
