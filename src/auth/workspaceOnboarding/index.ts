/**
 * src/auth/workspaceOnboarding/index.ts
 *
 * Public API for the workspace member onboarding and approval module.
 */

// ─── Models ───────────────────────────────────────────────────────────────────

export type {
  WorkspaceJoinRequestStatus,
  WorkspaceJoinRequestV1,
} from './WorkspaceJoinRequestV1';

export type {
  WorkspaceInviteStatus,
  WorkspaceInviteV1,
} from './WorkspaceInviteV1';

export type { WorkspaceMemberPermissionDraftV1 } from './WorkspaceMemberPermissionDraftV1';
export {
  applyRolePresetToDraft,
  togglePermissionInDraft,
  extractPermissionsFromDraft,
} from './WorkspaceMemberPermissionDraftV1';

// ─── Guards ───────────────────────────────────────────────────────────────────

export {
  canManageWorkspace,
  canManageBranding,
  canApproveWorkspaceUser,
  canEditMemberPermissions,
  canInviteWorkspaceUser,
} from './workspaceOnboardingGuards';
