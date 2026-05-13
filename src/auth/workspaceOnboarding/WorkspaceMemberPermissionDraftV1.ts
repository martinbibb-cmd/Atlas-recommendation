/**
 * WorkspaceMemberPermissionDraftV1.ts
 *
 * A transient editing model used in the admin UI when an admin is
 * assigning or adjusting a workspace member's role and permissions.
 *
 * The draft is NOT persisted directly; the admin commits it to produce a
 * WorkspaceMembershipV1 update.  Role presets populate the checkboxes by
 * default and the admin can then customise individual flags.
 *
 * Non-goals:
 *   - no real backend persistence
 *   - no optimistic-lock / conflict resolution
 */

import type {
  WorkspaceMemberRole,
  WorkspaceMemberPermission,
} from '../profile/WorkspaceMembershipV1';

// ─── Model ────────────────────────────────────────────────────────────────────

/**
 * WorkspaceMemberPermissionDraftV1
 *
 * Holds the transient UI state while an admin edits a member's role and
 * permissions.  Initialised by applyRolePresetToDraft() and then mutated
 * by individual checkbox toggles before being committed.
 */
export interface WorkspaceMemberPermissionDraftV1 {
  /** Atlas userId of the member being edited. */
  readonly userId: string;

  /** Workspace this draft applies to. */
  readonly workspaceId: string;

  /**
   * Currently selected role.  Changing the role resets the permission
   * checkboxes via applyRolePresetToDraft().
   */
  readonly role: WorkspaceMemberRole;

  /**
   * Full set of permission flags as displayed by the checkbox grid.
   * Mirrors WorkspaceMemberPermission but stored as a mutable record so the
   * UI can toggle individual entries without replacing the whole array.
   */
  readonly permissionCheckboxes: Readonly<Record<WorkspaceMemberPermission, boolean>>;

  // ─── Derived convenience flags ────────────────────────────────────────────
  // These map 1-to-1 to specific WorkspaceMemberPermission flags but are
  // surfaced as named booleans so the admin panel template can bind to them
  // directly without spreading permissionCheckboxes in every render.

  /** Whether the member can rename the workspace and change storage. */
  readonly canManageWorkspace: boolean;

  /** Whether the member can update workspace branding settings. */
  readonly canEditBranding: boolean;

  /** Whether the member can approve or reject join requests and invites. */
  readonly canApproveUsers: boolean;
}

// ─── Preset applicator ────────────────────────────────────────────────────────

import { DEFAULT_PERMISSIONS_BY_ROLE } from '../profile/WorkspaceMembershipV1';

/**
 * Returns a fresh WorkspaceMemberPermissionDraftV1 with all checkboxes set
 * from the canonical role preset in DEFAULT_PERMISSIONS_BY_ROLE.
 *
 * Use this when the admin changes the role selector; individual checkboxes
 * can be toggled afterwards.
 */
export function applyRolePresetToDraft(
  userId: string,
  workspaceId: string,
  role: WorkspaceMemberRole,
): WorkspaceMemberPermissionDraftV1 {
  const granted = new Set<WorkspaceMemberPermission>(DEFAULT_PERMISSIONS_BY_ROLE[role]);

  const permissionCheckboxes: Record<WorkspaceMemberPermission, boolean> = {
    view_visits: granted.has('view_visits'),
    edit_visits: granted.has('edit_visits'),
    export_workflows: granted.has('export_workflows'),
    review_specification: granted.has('review_specification'),
    manage_workspace: granted.has('manage_workspace'),
    use_scan_handoff: granted.has('use_scan_handoff'),
  };

  return {
    userId,
    workspaceId,
    role,
    permissionCheckboxes,
    canManageWorkspace: permissionCheckboxes.manage_workspace,
    canEditBranding: permissionCheckboxes.manage_workspace,
    canApproveUsers: permissionCheckboxes.manage_workspace,
  };
}

/**
 * Returns a new draft with a single permission flag toggled.
 * Also recalculates the derived convenience flags.
 */
export function togglePermissionInDraft(
  draft: WorkspaceMemberPermissionDraftV1,
  permission: WorkspaceMemberPermission,
): WorkspaceMemberPermissionDraftV1 {
  const updated: Record<WorkspaceMemberPermission, boolean> = {
    ...draft.permissionCheckboxes,
    [permission]: !draft.permissionCheckboxes[permission],
  };

  return {
    ...draft,
    permissionCheckboxes: updated,
    canManageWorkspace: updated.manage_workspace,
    canEditBranding: updated.manage_workspace,
    canApproveUsers: updated.manage_workspace,
  };
}

/**
 * Extracts the active permission array from a draft for committing to
 * a WorkspaceMembershipV1.
 */
export function extractPermissionsFromDraft(
  draft: WorkspaceMemberPermissionDraftV1,
): readonly WorkspaceMemberPermission[] {
  return (Object.entries(draft.permissionCheckboxes) as [WorkspaceMemberPermission, boolean][])
    .filter(([, enabled]) => enabled)
    .map(([perm]) => perm);
}
