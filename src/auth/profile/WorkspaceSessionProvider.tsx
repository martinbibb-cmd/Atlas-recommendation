/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useAtlasAuth } from '../useAtlasAuth';
import { useActiveUser } from '../../features/userProfiles/useActiveUser';
import type { AtlasUserProfileV1, AtlasWorkspaceV1 } from '../authTypes';
import type { VisitStorageTarget } from './AtlasVisitOwnershipV1';

export type WorkspaceSessionStatus =
  | 'unauthenticated_demo'
  | 'authenticated_no_workspace'
  | 'workspace_active';

export interface WorkspaceSessionValue {
  readonly status: WorkspaceSessionStatus;
  readonly authUserId: string | null;
  readonly atlasUserProfile: AtlasUserProfileV1 | null;
  readonly activeWorkspace: AtlasWorkspaceV1 | null;
  readonly storageTarget: VisitStorageTarget;
}

const DEFAULT_WORKSPACE_SESSION: WorkspaceSessionValue = {
  status: 'unauthenticated_demo',
  authUserId: null,
  atlasUserProfile: null,
  activeWorkspace: null,
  storageTarget: 'disabled',
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

interface WorkspaceSessionProviderProps {
  readonly children: ReactNode;
}

export function WorkspaceSessionProvider({ children }: WorkspaceSessionProviderProps) {
  const { isAuthenticated, userProfile, currentWorkspace } = useAtlasAuth();
  const { activeUser } = useActiveUser();

  const value = useMemo<WorkspaceSessionValue>(() => {
    const status: WorkspaceSessionStatus =
      !isAuthenticated || userProfile === null
        ? 'unauthenticated_demo'
        : currentWorkspace === null
          ? 'authenticated_no_workspace'
          : 'workspace_active';

    return {
      status,
      authUserId: activeUser?.userId ?? null,
      atlasUserProfile: userProfile,
      activeWorkspace: currentWorkspace,
      storageTarget: resolveWorkspaceStorageTarget(status, currentWorkspace),
    };
  }, [activeUser?.userId, currentWorkspace, isAuthenticated, userProfile]);

  return (
    <WorkspaceSessionContext.Provider value={value}>
      {children}
    </WorkspaceSessionContext.Provider>
  );
}

export function useWorkspaceSession(): WorkspaceSessionValue {
  return useContext(WorkspaceSessionContext);
}
