/**
 * workspaceOnboarding.test.ts
 *
 * Acceptance tests for the workspace member onboarding and approval module.
 *
 * Coverage (from the problem statement):
 *   1. admin can invite
 *   2. engineer cannot invite
 *   3. admin can approve request
 *   4. viewer cannot approve
 *   5. only admin/owner can change branding
 *   6. role presets populate permissions
 *   7. custom checkbox permissions persist in draft
 *   8. owner can invite (owner inherits admin capabilities)
 */

import { describe, it, expect } from 'vitest';
import {
  canInviteWorkspaceUser,
  canApproveWorkspaceUser,
  canManageBranding,
  canEditMemberPermissions,
  applyRolePresetToDraft,
  togglePermissionInDraft,
  extractPermissionsFromDraft,
} from '../index';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../../profile/WorkspaceMembershipV1';
import type { WorkspaceMembershipV1 } from '../../profile/WorkspaceMembershipV1';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeMembership(
  overrides: Partial<WorkspaceMembershipV1> = {},
): WorkspaceMembershipV1 {
  const role = overrides.role ?? 'viewer';
  return {
    workspaceId: 'ws_001',
    userId: `user_${role}`,
    role,
    permissions: DEFAULT_PERMISSIONS_BY_ROLE[role],
    ...overrides,
  };
}

// ─── 1. Admin can invite ───────────────────────────────────────────────────────

describe('1 — admin can invite', () => {
  it('returns true for admin role', () => {
    const admin = makeMembership({ role: 'admin' });
    expect(canInviteWorkspaceUser(admin)).toBe(true);
  });
});

// ─── 2. Engineer cannot invite ────────────────────────────────────────────────

describe('2 — engineer cannot invite', () => {
  it('returns false for engineer role without manage_workspace permission', () => {
    const engineer = makeMembership({ role: 'engineer' });
    expect(canInviteWorkspaceUser(engineer)).toBe(false);
  });

  it('returns false for surveyor role', () => {
    const surveyor = makeMembership({ role: 'surveyor' });
    expect(canInviteWorkspaceUser(surveyor)).toBe(false);
  });

  it('returns false for office role (no manage_workspace in default preset)', () => {
    const office = makeMembership({ role: 'office' });
    expect(canInviteWorkspaceUser(office)).toBe(false);
  });
});

// ─── 3. Admin can approve request ────────────────────────────────────────────

describe('3 — admin can approve request', () => {
  it('returns true for admin role', () => {
    const admin = makeMembership({ role: 'admin' });
    expect(canApproveWorkspaceUser(admin)).toBe(true);
  });

  it('returns true for owner role', () => {
    const owner = makeMembership({ role: 'owner' });
    expect(canApproveWorkspaceUser(owner)).toBe(true);
  });
});

// ─── 4. Viewer cannot approve ─────────────────────────────────────────────────

describe('4 — viewer cannot approve', () => {
  it('returns false for viewer role', () => {
    const viewer = makeMembership({ role: 'viewer' });
    expect(canApproveWorkspaceUser(viewer)).toBe(false);
  });

  it('returns false for engineer role', () => {
    const engineer = makeMembership({ role: 'engineer' });
    expect(canApproveWorkspaceUser(engineer)).toBe(false);
  });
});

// ─── 5. Only admin/owner can change branding ──────────────────────────────────

describe('5 — only admin/owner can change branding', () => {
  it('returns true for owner', () => {
    expect(canManageBranding(makeMembership({ role: 'owner' }))).toBe(true);
  });

  it('returns true for admin', () => {
    expect(canManageBranding(makeMembership({ role: 'admin' }))).toBe(true);
  });

  it('returns false for engineer', () => {
    expect(canManageBranding(makeMembership({ role: 'engineer' }))).toBe(false);
  });

  it('returns false for surveyor', () => {
    expect(canManageBranding(makeMembership({ role: 'surveyor' }))).toBe(false);
  });

  it('returns false for office', () => {
    expect(canManageBranding(makeMembership({ role: 'office' }))).toBe(false);
  });

  it('returns false for viewer', () => {
    expect(canManageBranding(makeMembership({ role: 'viewer' }))).toBe(false);
  });

  it('returns true for non-admin with explicit manage_workspace permission', () => {
    const engineer = makeMembership({
      role: 'engineer',
      permissions: [...DEFAULT_PERMISSIONS_BY_ROLE.engineer, 'manage_workspace'],
    });
    expect(canManageBranding(engineer)).toBe(true);
  });
});

// ─── 6. Role presets populate permissions ─────────────────────────────────────

describe('6 — role presets populate permissions', () => {
  it('admin preset enables manage_workspace', () => {
    const draft = applyRolePresetToDraft('u1', 'ws_001', 'admin');
    expect(draft.permissionCheckboxes.manage_workspace).toBe(true);
    expect(draft.canManageWorkspace).toBe(true);
    expect(draft.canEditBranding).toBe(true);
    expect(draft.canApproveUsers).toBe(true);
  });

  it('viewer preset disables all management flags', () => {
    const draft = applyRolePresetToDraft('u2', 'ws_001', 'viewer');
    expect(draft.permissionCheckboxes.manage_workspace).toBe(false);
    expect(draft.canManageWorkspace).toBe(false);
    expect(draft.permissionCheckboxes.edit_visits).toBe(false);
    expect(draft.permissionCheckboxes.view_visits).toBe(true);
  });

  it('engineer preset includes view_visits and export_workflows', () => {
    const draft = applyRolePresetToDraft('u3', 'ws_001', 'engineer');
    expect(draft.permissionCheckboxes.view_visits).toBe(true);
    expect(draft.permissionCheckboxes.export_workflows).toBe(true);
    expect(draft.permissionCheckboxes.manage_workspace).toBe(false);
  });

  it('surveyor preset includes view_visits, edit_visits, use_scan_handoff', () => {
    const draft = applyRolePresetToDraft('u4', 'ws_001', 'surveyor');
    expect(draft.permissionCheckboxes.view_visits).toBe(true);
    expect(draft.permissionCheckboxes.edit_visits).toBe(true);
    expect(draft.permissionCheckboxes.use_scan_handoff).toBe(true);
    expect(draft.permissionCheckboxes.manage_workspace).toBe(false);
  });
});

// ─── 7. Custom checkbox permissions persist in draft ─────────────────────────

describe('7 — custom checkbox permissions persist in draft', () => {
  it('toggling a permission flips its checkbox value', () => {
    const draft = applyRolePresetToDraft('u5', 'ws_001', 'engineer');
    expect(draft.permissionCheckboxes.edit_visits).toBe(false);

    const updated = togglePermissionInDraft(draft, 'edit_visits');
    expect(updated.permissionCheckboxes.edit_visits).toBe(true);
    // Other permissions unchanged
    expect(updated.permissionCheckboxes.view_visits).toBe(true);
    expect(updated.permissionCheckboxes.manage_workspace).toBe(false);
  });

  it('toggling manage_workspace updates canManageWorkspace convenience flag', () => {
    const draft = applyRolePresetToDraft('u6', 'ws_001', 'engineer');
    expect(draft.canManageWorkspace).toBe(false);

    const updated = togglePermissionInDraft(draft, 'manage_workspace');
    expect(updated.canManageWorkspace).toBe(true);
    expect(updated.canEditBranding).toBe(true);
    expect(updated.canApproveUsers).toBe(true);
  });

  it('extractPermissionsFromDraft returns only enabled permissions', () => {
    const draft = applyRolePresetToDraft('u7', 'ws_001', 'engineer');
    const permissions = extractPermissionsFromDraft(draft);
    expect(permissions).toContain('view_visits');
    expect(permissions).toContain('export_workflows');
    expect(permissions).not.toContain('manage_workspace');
    expect(permissions).not.toContain('edit_visits');
  });

  it('custom permissions survive multiple toggle operations', () => {
    let draft = applyRolePresetToDraft('u8', 'ws_001', 'viewer');
    draft = togglePermissionInDraft(draft, 'edit_visits');  // on
    draft = togglePermissionInDraft(draft, 'export_workflows');  // on
    draft = togglePermissionInDraft(draft, 'edit_visits');  // off again

    expect(draft.permissionCheckboxes.edit_visits).toBe(false);
    expect(draft.permissionCheckboxes.export_workflows).toBe(true);
    expect(draft.permissionCheckboxes.view_visits).toBe(true);  // viewer always has view_visits
  });
});

// ─── 8. Owner can invite (inherits admin capabilities) ────────────────────────

describe('8 — owner can invite', () => {
  it('owner role passes canInviteWorkspaceUser', () => {
    const owner = makeMembership({ role: 'owner' });
    expect(canInviteWorkspaceUser(owner)).toBe(true);
  });

  it('owner role passes canEditMemberPermissions', () => {
    const owner = makeMembership({ role: 'owner' });
    expect(canEditMemberPermissions(owner)).toBe(true);
  });
});
