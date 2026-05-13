import type { AtlasWorkspaceV1 } from '../profile';
import type { WorkspaceJoinRequestV1, WorkspaceInviteV1 } from '../workspaceOnboarding';
import type {
  PersistedJoinRequestDecisionV1,
  WorkspaceSettingsStorageAdapterV1,
} from './storage';

export interface LoadAppliedWorkspaceSettingsInput {
  readonly workspaceId: string;
  readonly adapter: WorkspaceSettingsStorageAdapterV1;
  readonly fallbackWorkspace: AtlasWorkspaceV1;
  readonly fallbackJoinRequests?: readonly WorkspaceJoinRequestV1[];
}

export interface LoadAppliedWorkspaceSettingsResult {
  readonly workspace: AtlasWorkspaceV1;
  readonly invites: readonly WorkspaceInviteV1[];
  readonly joinRequestDecisions: readonly PersistedJoinRequestDecisionV1[];
  readonly source: 'local_applied' | 'fallback';
}

function toWorkspaceInvite(
  workspace: AtlasWorkspaceV1,
  invite: {
    readonly inviteId: string;
    readonly workspaceId: string;
    readonly email: string;
    readonly role: WorkspaceInviteV1['role'];
    readonly permissions: WorkspaceInviteV1['permissions'];
    readonly createdAt: string;
  },
): WorkspaceInviteV1 {
  return {
    inviteId: invite.inviteId,
    workspaceId: invite.workspaceId,
    email: invite.email,
    role: invite.role,
    permissions: invite.permissions,
    invitedByUserId: workspace.ownerUserId,
    invitedAt: invite.createdAt,
    expiresAt: invite.createdAt,
    status: 'pending',
  };
}

export async function loadAppliedWorkspaceSettings({
  workspaceId,
  adapter,
  fallbackWorkspace,
  fallbackJoinRequests,
}: LoadAppliedWorkspaceSettingsInput): Promise<LoadAppliedWorkspaceSettingsResult> {
  void fallbackJoinRequests;

  const result = await adapter.loadWorkspaceSettings(workspaceId);
  if (!result.ok) {
    return {
      workspace: fallbackWorkspace,
      invites: [],
      joinRequestDecisions: [],
      source: 'fallback',
    };
  }

  return {
    workspace: result.snapshot.workspace,
    invites: result.snapshot.invites.map((invite) => toWorkspaceInvite(result.snapshot.workspace, invite)),
    joinRequestDecisions: result.snapshot.joinRequestDecisions,
    source: 'local_applied',
  };
}
