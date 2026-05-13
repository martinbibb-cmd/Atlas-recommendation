/**
 * workspaceOnboardingGuards.ts
 *
 * Pure guard helpers that answer workspace-level capability questions for
 * the onboarding / admin flow.
 *
 * Each function takes the acting user's membership and the workspace context
 * and returns a boolean.  They are intentionally stateless so they can be
 * used in both UI gate checks and unit tests without any React context.
 *
 * Rules enforced here:
 *   - only owner/admin can invite users
 *   - only owner/admin can approve join requests
 *   - only owner/admin can change branding/workspace settings
 *   - engineers/surveyors/office can have granular permissions (checked via
 *     explicit permission flags, not just role)
 *   - viewer is read-only (no management actions)
 */

import type { WorkspaceMembershipV1 } from '../profile/WorkspaceMembershipV1';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function isOwnerOrAdmin(membership: WorkspaceMembershipV1): boolean {
  return membership.role === 'owner' || membership.role === 'admin';
}

function hasPermission(
  membership: WorkspaceMembershipV1,
  permission: WorkspaceMembershipV1['permissions'][number],
): boolean {
  return (membership.permissions as readonly string[]).includes(permission);
}

// ─── Guards ───────────────────────────────────────────────────────────────────

/**
 * Returns true when the acting user can manage workspace settings
 * (rename, storage preference, member list).
 *
 * Requires: role owner/admin  OR  explicit manage_workspace permission.
 */
export function canManageWorkspace(membership: WorkspaceMembershipV1): boolean {
  return isOwnerOrAdmin(membership) || hasPermission(membership, 'manage_workspace');
}

/**
 * Returns true when the acting user can update workspace branding settings.
 *
 * Branding is treated as part of manage_workspace; only owner/admin or a
 * member with an explicit manage_workspace flag may change it.
 */
export function canManageBranding(membership: WorkspaceMembershipV1): boolean {
  return isOwnerOrAdmin(membership) || hasPermission(membership, 'manage_workspace');
}

/**
 * Returns true when the acting user can approve or reject workspace join
 * requests and can revoke invites.
 *
 * Requires: role owner/admin  OR  explicit manage_workspace permission.
 */
export function canApproveWorkspaceUser(membership: WorkspaceMembershipV1): boolean {
  return isOwnerOrAdmin(membership) || hasPermission(membership, 'manage_workspace');
}

/**
 * Returns true when the acting user can edit another member's role and
 * permission checkboxes in the admin panel.
 *
 * Requires: role owner/admin  OR  explicit manage_workspace permission.
 */
export function canEditMemberPermissions(membership: WorkspaceMembershipV1): boolean {
  return isOwnerOrAdmin(membership) || hasPermission(membership, 'manage_workspace');
}

/**
 * Returns true when the acting user can send new workspace invites.
 *
 * Requires: role owner/admin  OR  explicit manage_workspace permission.
 */
export function canInviteWorkspaceUser(membership: WorkspaceMembershipV1): boolean {
  return isOwnerOrAdmin(membership) || hasPermission(membership, 'manage_workspace');
}
