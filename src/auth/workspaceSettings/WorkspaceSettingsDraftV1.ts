import type {
  WorkspaceBrandPolicy,
  WorkspaceMemberPermission,
  WorkspaceMemberRole,
  WorkspaceStoragePreference,
} from '../profile';

export interface WorkspaceIdentityDraftV1 {
  readonly name: string;
  readonly slug: string;
}

export interface WorkspaceBrandPolicyDraftV1 {
  readonly policy: WorkspaceBrandPolicy;
  readonly defaultBrandId: string;
  readonly allowedBrandIds: readonly string[];
}

export interface WorkspaceMemberPermissionEditDraftV1 {
  readonly userId: string;
  readonly role: WorkspaceMemberRole;
  readonly permissions: readonly WorkspaceMemberPermission[];
}

export interface WorkspaceInviteDraftV1 {
  readonly email: string;
  readonly role: WorkspaceMemberRole;
  readonly permissions: readonly WorkspaceMemberPermission[];
}

export interface WorkspaceJoinRequestDecisionDraftV1 {
  readonly requestId: string;
  readonly decision: 'approved' | 'rejected';
  readonly role?: WorkspaceMemberRole;
}

export interface WorkspaceSettingsDraftV1 {
  readonly workspaceId: string;
  readonly workspace: WorkspaceIdentityDraftV1;
  readonly brand: WorkspaceBrandPolicyDraftV1;
  readonly storagePreference: WorkspaceStoragePreference;
  readonly memberPermissionEdits: readonly WorkspaceMemberPermissionEditDraftV1[];
  readonly inviteDrafts: readonly WorkspaceInviteDraftV1[];
  readonly joinRequestDecisions: readonly WorkspaceJoinRequestDecisionDraftV1[];
}
