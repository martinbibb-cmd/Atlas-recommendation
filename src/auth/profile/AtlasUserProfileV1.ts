/**
 * AtlasUserProfileV1.ts
 *
 * The canonical Atlas user identity model.
 *
 * Bound to an authenticated user at session start via
 * buildAtlasUserProfileFromAuthUser().  Links the authenticated provider
 * identity (auth UID, email) to Atlas-level workspace memberships and
 * storage defaults.
 *
 * Design rules
 * ────────────
 * - No anonymous global profile.  A profile only exists for authenticated
 *   sessions; unauthenticated usage is session-only / demo mode.
 * - userId is derived from the auth provider UID, not generated independently.
 * - workspaceMemberships is the source of truth for which workspaces the user
 *   can access; it is kept in sync with each workspace's members[] list.
 *
 * Non-goals:
 *   - no billing or subscription state
 *   - no role or permission logic (see WorkspaceMembershipV1)
 */

import type { WorkspaceMembershipV1 } from './WorkspaceMembershipV1';

// ─── User profile ─────────────────────────────────────────────────────────────

/**
 * AtlasUserProfileV1
 *
 * Lightweight identity record created when an authenticated user first
 * arrives (or returns) in Atlas.  Persisted to localStorage and hydrated on
 * every session start.
 */
export interface AtlasUserProfileV1 {
  /**
   * Stable Atlas-level user identifier.
   * Derived from the auth provider UID: `atlas_${authProviderId}`.
   * Never changes after first creation for a given provider account.
   */
  readonly userId: string;

  /**
   * UID issued by the auth provider (e.g. Firebase UID).
   * Used to correlate the Atlas profile with the live auth session.
   */
  readonly authProviderId: string;

  /** Email address from the auth provider, if available. */
  readonly email?: string;

  /** Display name from the auth provider or user-supplied override. */
  readonly displayName?: string;

  /**
   * The workspace this user will be taken to by default on login.
   * Falls back to the first workspace in workspaceMemberships[] if absent.
   */
  readonly defaultWorkspaceId?: string;

  /**
   * All workspace memberships held by this user.
   * Populated from each workspace's members[] list at profile hydration.
   * An empty array means the user has no workspace — they should be
   * prompted to create or join one.
   */
  readonly workspaceMemberships: readonly WorkspaceMembershipV1[];

  /** ISO 8601 timestamp of profile creation. */
  readonly createdAt: string;

  /** ISO 8601 timestamp of the most recent profile update. */
  readonly updatedAt: string;
}
