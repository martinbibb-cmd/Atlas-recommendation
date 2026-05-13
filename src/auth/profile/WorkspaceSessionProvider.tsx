/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAtlasAuth } from '../useAtlasAuth';
import { useActiveUser } from '../../features/userProfiles/useActiveUser';
import type { AtlasUserProfileV1, AtlasWorkspaceV1 as AuthAtlasWorkspaceV1 } from '../authTypes';
import type { VisitStorageTarget } from './AtlasVisitOwnershipV1';
import type { AtlasWorkspaceV1 } from './AtlasWorkspaceV1';
import type { WorkspaceMembershipV1 } from './WorkspaceMembershipV1';
import { DEFAULT_PERMISSIONS_BY_ROLE } from './WorkspaceMembershipV1';
import {
  LocalWorkspaceSettingsStorageAdapter,
  loadAppliedWorkspaceSettings,
} from '../workspaceSettings';

export type WorkspaceSessionStatus =
  | 'unauthenticated_demo'
  | 'authenticated_no_workspace'
  | 'workspace_active';

export interface WorkspaceSessionValue {
  readonly status: WorkspaceSessionStatus;
  readonly authUserId: string | null;
  readonly atlasUserProfile: AtlasUserProfileV1 | null;
  readonly activeWorkspace: AtlasWorkspaceV1 | null;
  readonly activeMembership: WorkspaceMembershipV1 | null;
  readonly storageTarget: VisitStorageTarget;
  readonly workspaceSource: 'local_applied' | 'fallback' | 'none';
  readonly refreshActiveWorkspace: () => Promise<void>;
}

const DEFAULT_WORKSPACE_SESSION: WorkspaceSessionValue = {
  status: 'unauthenticated_demo',
  authUserId: null,
  atlasUserProfile: null,
  activeWorkspace: null,
  activeMembership: null,
  storageTarget: 'disabled',
  workspaceSource: 'none',
  refreshActiveWorkspace: async () => {},
};

const WorkspaceSessionContext = createContext<WorkspaceSessionValue>(DEFAULT_WORKSPACE_SESSION);

function resolveWorkspaceStorageTarget(
  status: WorkspaceSessionStatus,
  activeWorkspace: AtlasWorkspaceV1 | null,
): VisitStorageTarget {
  if (status !== 'workspace_active' || activeWorkspace === null) {
    return 'disabled';
  }
  return activeWorkspace.storagePreference ?? 'local_only';
}

function slugifyWorkspaceName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'workspace'
  );
}

function buildFallbackWorkspace(
  currentWorkspace: AuthAtlasWorkspaceV1,
): AtlasWorkspaceV1 {
  const ownerMembership: WorkspaceMembershipV1 = {
    workspaceId: currentWorkspace.workspaceId,
    userId: currentWorkspace.ownerAtlasUserId,
    role: 'owner',
    permissions: DEFAULT_PERMISSIONS_BY_ROLE.owner,
  };

  return {
    workspaceId: currentWorkspace.workspaceId,
    name: currentWorkspace.name,
    slug: slugifyWorkspaceName(currentWorkspace.name),
    ownerUserId: currentWorkspace.ownerAtlasUserId,
    members: [ownerMembership],
    storagePreference: currentWorkspace.storagePreference ?? 'disabled',
    defaultBrandId: currentWorkspace.defaultBrandId,
    allowedBrandIds: currentWorkspace.allowedBrandIds,
    brandPolicy: currentWorkspace.brandPolicy,
    createdAt: currentWorkspace.createdAt,
    updatedAt: currentWorkspace.updatedAt,
  };
}

function resolveActiveMembership(
  activeWorkspace: AtlasWorkspaceV1 | null,
  authUserId: string | null,
): WorkspaceMembershipV1 | null {
  if (activeWorkspace === null || authUserId === null) {
    return null;
  }

  return activeWorkspace.members.find((member) => member.userId === authUserId) ?? null;
}

interface WorkspaceSessionProviderProps {
  readonly children: ReactNode;
}

export function WorkspaceSessionProvider({ children }: WorkspaceSessionProviderProps) {
  const { isAuthenticated, userProfile, currentWorkspace } = useAtlasAuth();
  const { activeUser } = useActiveUser();
  const authUserId = activeUser?.userId ?? userProfile?.atlasUserId ?? null;

  const fallbackWorkspace = useMemo(
    () => (currentWorkspace === null ? null : buildFallbackWorkspace(currentWorkspace)),
    [currentWorkspace],
  );

  const [workspaceState, setWorkspaceState] = useState<{
    workspaceId: string | null;
    workspace: AtlasWorkspaceV1 | null;
    source: 'local_applied' | 'fallback' | 'none';
  }>({ workspaceId: null, workspace: null, source: 'none' });

  const refreshActiveWorkspace = useCallback(async () => {
    if (fallbackWorkspace === null) {
      setWorkspaceState({ workspaceId: null, workspace: null, source: 'none' });
      return;
    }

    const loaded = await loadAppliedWorkspaceSettings({
      workspaceId: fallbackWorkspace.workspaceId,
      adapter: new LocalWorkspaceSettingsStorageAdapter(),
      fallbackWorkspace,
    });

    setWorkspaceState({
      workspaceId: fallbackWorkspace.workspaceId,
      workspace: loaded.workspace,
      source: loaded.source,
    });
  }, [fallbackWorkspace]);

  useEffect(() => {
    (async () => {
      await refreshActiveWorkspace();
    })();
  }, [refreshActiveWorkspace]);

  const resolvedWorkspace =
    fallbackWorkspace === null
      ? null
      : workspaceState.workspaceId === fallbackWorkspace.workspaceId
        ? workspaceState.workspace
        : fallbackWorkspace;

  const resolvedSource =
    fallbackWorkspace === null
      ? 'none'
      : workspaceState.workspaceId === fallbackWorkspace.workspaceId
        ? workspaceState.source
        : 'fallback';

  const value = useMemo<WorkspaceSessionValue>(() => {
    const status: WorkspaceSessionStatus =
      !isAuthenticated || userProfile === null
        ? 'unauthenticated_demo'
        : resolvedWorkspace === null
          ? 'authenticated_no_workspace'
          : 'workspace_active';

    return {
      status,
      authUserId,
      atlasUserProfile: userProfile,
      activeWorkspace: resolvedWorkspace,
      activeMembership: resolveActiveMembership(resolvedWorkspace, authUserId),
      storageTarget: resolveWorkspaceStorageTarget(status, resolvedWorkspace),
      workspaceSource: resolvedSource,
      refreshActiveWorkspace,
    };
  }, [
    authUserId,
    isAuthenticated,
    refreshActiveWorkspace,
    resolvedSource,
    resolvedWorkspace,
    userProfile,
  ]);

  return (
    <WorkspaceSessionContext.Provider value={value}>
      {children}
    </WorkspaceSessionContext.Provider>
  );
}

export function useWorkspaceSession(): WorkspaceSessionValue {
  return useContext(WorkspaceSessionContext);
}
