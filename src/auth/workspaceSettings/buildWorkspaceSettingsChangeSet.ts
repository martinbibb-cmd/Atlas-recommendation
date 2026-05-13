import type {
  AtlasWorkspaceV1,
  WorkspaceMembershipV1,
  WorkspaceMemberPermission,
} from '../profile';
import type { WorkspaceJoinRequestV1 } from '../workspaceOnboarding';
import type { WorkspaceSettingsDraftV1 } from './WorkspaceSettingsDraftV1';

export type WorkspaceSettingsChangeType =
  | 'workspace_updated'
  | 'brand_policy_updated'
  | 'storage_preference_updated'
  | 'member_permissions_updated'
  | 'invite_created'
  | 'join_request_approved'
  | 'join_request_rejected';

export interface WorkspaceSettingsChangeV1 {
  readonly type: WorkspaceSettingsChangeType;
  readonly summary: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface WorkspaceSettingsChangeSetV1 {
  readonly changes: readonly WorkspaceSettingsChangeV1[];
  readonly warnings: readonly string[];
  readonly blockingReasons: readonly string[];
  readonly canCommit: boolean;
}

export interface BuildWorkspaceSettingsChangeSetCurrentV1 {
  readonly workspace: AtlasWorkspaceV1;
  readonly joinRequests: readonly WorkspaceJoinRequestV1[];
  readonly googleDriveConnectorAvailable: boolean;
}

function normalizeStringArray(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function normalizePermissions(
  permissions: readonly WorkspaceMemberPermission[],
): readonly WorkspaceMemberPermission[] {
  return normalizeStringArray(permissions) as readonly WorkspaceMemberPermission[];
}

function permissionsEqual(
  left: readonly WorkspaceMemberPermission[],
  right: readonly WorkspaceMemberPermission[],
): boolean {
  const leftNormalised = normalizePermissions(left);
  const rightNormalised = normalizePermissions(right);
  if (leftNormalised.length !== rightNormalised.length) return false;
  return leftNormalised.every((value, index) => value === rightNormalised[index]);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function canManageWorkspace(member: WorkspaceMembershipV1): boolean {
  return member.permissions.includes('manage_workspace');
}

export function buildWorkspaceSettingsChangeSet(
  draft: WorkspaceSettingsDraftV1,
  current: BuildWorkspaceSettingsChangeSetCurrentV1,
): WorkspaceSettingsChangeSetV1 {
  const changes: WorkspaceSettingsChangeV1[] = [];
  const warnings: string[] = [];
  const blockingReasons: string[] = [];

  if (
    draft.workspace.name.trim() !== current.workspace.name ||
    draft.workspace.slug.trim() !== current.workspace.slug
  ) {
    changes.push({
      type: 'workspace_updated',
      summary: 'Workspace name or slug will be updated.',
      details: {
        fromName: current.workspace.name,
        toName: draft.workspace.name.trim(),
        fromSlug: current.workspace.slug,
        toSlug: draft.workspace.slug.trim(),
      },
    });
  }

  const currentAllowed = normalizeStringArray(current.workspace.allowedBrandIds);
  const draftAllowed = normalizeStringArray(draft.brand.allowedBrandIds);
  const brandChanged =
    draft.brand.policy !== current.workspace.brandPolicy ||
    draft.brand.defaultBrandId.trim() !== current.workspace.defaultBrandId ||
    currentAllowed.length !== draftAllowed.length ||
    currentAllowed.some((value, index) => value !== draftAllowed[index]);

  if (brandChanged) {
    changes.push({
      type: 'brand_policy_updated',
      summary: 'Workspace brand policy will be updated.',
      details: {
        fromPolicy: current.workspace.brandPolicy,
        toPolicy: draft.brand.policy,
        fromDefaultBrandId: current.workspace.defaultBrandId,
        toDefaultBrandId: draft.brand.defaultBrandId.trim(),
        fromAllowedBrandIds: currentAllowed,
        toAllowedBrandIds: draftAllowed,
      },
    });
  }

  if (draft.storagePreference !== current.workspace.storagePreference) {
    changes.push({
      type: 'storage_preference_updated',
      summary: 'Workspace storage preference will be updated.',
      details: {
        from: current.workspace.storagePreference,
        to: draft.storagePreference,
      },
    });
  }

  const editsByUserId = new Map(
    draft.memberPermissionEdits.map((edit) => [edit.userId, edit]),
  );
  current.workspace.members.forEach((member) => {
    const edit = editsByUserId.get(member.userId);
    if (!edit) return;
    if (edit.role === member.role && permissionsEqual(edit.permissions, member.permissions)) return;
    changes.push({
      type: 'member_permissions_updated',
      summary: `Member permissions updated for ${member.userId}.`,
      details: {
        userId: member.userId,
        fromRole: member.role,
        toRole: edit.role,
        fromPermissions: normalizePermissions(member.permissions),
        toPermissions: normalizePermissions(edit.permissions),
      },
    });
  });

  draft.inviteDrafts.forEach((invite) => {
    changes.push({
      type: 'invite_created',
      summary: `Invite will be created for ${invite.email.trim()}.`,
      details: {
        email: invite.email.trim(),
        role: invite.role,
        permissions: normalizePermissions(invite.permissions),
      },
    });
  });

  draft.joinRequestDecisions.forEach((decision) => {
    changes.push({
      type: decision.decision === 'approved' ? 'join_request_approved' : 'join_request_rejected',
      summary:
        decision.decision === 'approved'
          ? `Join request ${decision.requestId} will be approved.`
          : `Join request ${decision.requestId} will be rejected.`,
      details: {
        requestId: decision.requestId,
        role: decision.role,
      },
    });
  });

  if (draft.brand.policy === 'locked' && !draft.brand.defaultBrandId.trim()) {
    blockingReasons.push('Locked brand policy requires a default brand.');
  }

  if (!draftAllowed.includes(draft.brand.defaultBrandId.trim())) {
    blockingReasons.push('Default brand must be included in allowed brands.');
  }

  const effectiveMembers: WorkspaceMembershipV1[] = current.workspace.members.map((member) => {
    const edit = editsByUserId.get(member.userId);
    if (!edit) return member;
    return {
      ...member,
      role: edit.role,
      permissions: normalizePermissions(edit.permissions),
    };
  });

  const managerCount = effectiveMembers.filter(canManageWorkspace).length;
  if (managerCount === 0) {
    blockingReasons.push('At least one owner/admin must retain manage workspace permission.');
  }

  draft.joinRequestDecisions.forEach((decision) => {
    if (decision.decision === 'approved' && !decision.role) {
      blockingReasons.push(`Cannot approve join request ${decision.requestId} without assigning a role.`);
    }
  });

  draft.inviteDrafts.forEach((invite) => {
    if (!isValidEmail(invite.email)) {
      blockingReasons.push(`Invite email is invalid: ${invite.email}`);
    }
  });

  if (draft.storagePreference === 'google_drive' && !current.googleDriveConnectorAvailable) {
    warnings.push('Google Drive connector is unavailable. Changes can be reviewed but not committed yet.');
  }

  return {
    changes,
    warnings,
    blockingReasons,
    canCommit: blockingReasons.length === 0,
  };
}
