/**
 * resolveActiveWorkspace.ts
 *
 * Workspace resolver: given a user profile and optional route/stored hints,
 * determines which workspace should be considered "active" for the current
 * session.
 *
 * Resolution priority
 * ───────────────────
 * 1. routeWorkspaceSlug  — slug from the URL path (/w/:slug).
 *    Only wins if the user holds a membership in that workspace.
 * 2. storedWorkspaceId   — workspace ID last persisted by setCurrentWorkspace.
 *    Only wins if the user is still a member.
 * 3. defaultWorkspaceId  — workspace ID stored on the user profile itself.
 *    Only wins if the user is still a member.
 * 4. first membership    — first entry in workspaceMemberships[].
 * 5. no_workspace        — user has no workspace memberships.
 *
 * This function is pure and side-effect-free — it does not read localStorage
 * or make network calls.  Pass the values in from the calling context.
 */

import type { AtlasUserProfileV1 } from './AtlasUserProfileV1';
import type { AtlasWorkspaceV1 } from './AtlasWorkspaceV1';

// ─── Input ────────────────────────────────────────────────────────────────────

export interface ResolveActiveWorkspaceInput {
  /** The authenticated user's profile.  Must not be null. */
  readonly userProfile: AtlasUserProfileV1;

  /**
   * All workspaces the application knows about.
   * In practice this is the list loaded from local storage or a future API.
   * Only workspaces where the user holds a membership are considered.
   */
  readonly availableWorkspaces: readonly AtlasWorkspaceV1[];

  /**
   * Workspace slug extracted from the current route (e.g. /w/:slug).
   * Pass undefined when the route carries no workspace slug.
   */
  readonly routeWorkspaceSlug?: string;

  /**
   * Workspace ID previously persisted by setCurrentWorkspace().
   * Pass undefined when no workspace has been stored yet.
   */
  readonly storedWorkspaceId?: string;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export type ResolveActiveWorkspaceResult =
  | { readonly status: 'resolved'; readonly workspace: AtlasWorkspaceV1 }
  | { readonly status: 'no_workspace' };

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolves the workspace the current session should operate in.
 *
 * Returns { status: 'resolved', workspace } when a valid workspace is found,
 * or { status: 'no_workspace' } when the user has no accessible workspace.
 *
 * A "non-member" cannot resolve a route workspace — if the user is not in
 * the route workspace's members list, the resolver falls through to the next
 * priority level.
 */
export function resolveActiveWorkspace(
  input: ResolveActiveWorkspaceInput,
): ResolveActiveWorkspaceResult {
  const { userProfile, availableWorkspaces, routeWorkspaceSlug, storedWorkspaceId } = input;

  /** Helper: true when the user holds a membership in this workspace. */
  function userIsMember(workspace: AtlasWorkspaceV1): boolean {
    return userProfile.workspaceMemberships.some(
      (m) => m.workspaceId === workspace.workspaceId,
    );
  }

  // 1. Route workspace (slug match + membership check)
  if (routeWorkspaceSlug) {
    const routeWorkspace = availableWorkspaces.find(
      (w) => w.slug === routeWorkspaceSlug,
    );
    if (routeWorkspace && userIsMember(routeWorkspace)) {
      return { status: 'resolved', workspace: routeWorkspace };
    }
  }

  // 2. Stored workspace ID
  if (storedWorkspaceId) {
    const storedWorkspace = availableWorkspaces.find(
      (w) => w.workspaceId === storedWorkspaceId,
    );
    if (storedWorkspace && userIsMember(storedWorkspace)) {
      return { status: 'resolved', workspace: storedWorkspace };
    }
  }

  // 3. Default workspace from profile
  if (userProfile.defaultWorkspaceId) {
    const defaultWorkspace = availableWorkspaces.find(
      (w) => w.workspaceId === userProfile.defaultWorkspaceId,
    );
    if (defaultWorkspace && userIsMember(defaultWorkspace)) {
      return { status: 'resolved', workspace: defaultWorkspace };
    }
  }

  // 4. First membership
  const firstMembership = userProfile.workspaceMemberships[0];
  if (firstMembership) {
    const firstWorkspace = availableWorkspaces.find(
      (w) => w.workspaceId === firstMembership.workspaceId,
    );
    if (firstWorkspace) {
      return { status: 'resolved', workspace: firstWorkspace };
    }
  }

  // 5. No workspace
  return { status: 'no_workspace' };
}
