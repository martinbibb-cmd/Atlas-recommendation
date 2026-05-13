import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AtlasAuthContext } from '../../auth/AtlasAuthContext';
import type { AtlasAuthContextValue, AtlasWorkspaceV1 as AuthAtlasWorkspaceV1 } from '../../auth/authTypes';
import {
  DEFAULT_PERMISSIONS_BY_ROLE,
  WorkspaceBrandSessionProvider,
  WorkspaceSessionProvider,
  useWorkspaceBrandSession,
  useWorkspaceSession,
  type AtlasWorkspaceV1,
  type WorkspaceMembershipV1,
} from '../../auth/profile';
import {
  LocalWorkspaceSettingsStorageAdapter,
  loadAppliedWorkspaceSettings,
} from '../../auth/workspaceSettings';
import { ActiveUserContext } from '../../features/userProfiles/ActiveUserProvider';
import WorkspaceSettingsPage from './WorkspaceSettingsPage';

const BRAND_PREFS_STORE_KEY = 'atlas:brand-session:preferences:v1';

function makeMembership(overrides: Partial<WorkspaceMembershipV1> = {}): WorkspaceMembershipV1 {
  const role = overrides.role ?? 'admin';
  return {
    workspaceId: 'ws_demo',
    userId: 'user_admin',
    role,
    permissions: overrides.permissions ?? DEFAULT_PERMISSIONS_BY_ROLE[role],
    ...overrides,
  };
}

function makeAuthWorkspace(
  overrides: Partial<AuthAtlasWorkspaceV1> = {},
): AuthAtlasWorkspaceV1 {
  return {
    version: '1.0',
    workspaceId: 'ws_demo',
    name: 'Atlas Demo Workspace',
    ownerAtlasUserId: 'owner_1',
    storagePreference: 'local_only',
    defaultBrandId: 'atlas-default',
    allowedBrandIds: ['atlas-default', 'installer-demo'],
    brandPolicy: 'workspace_default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeProfileWorkspace(
  overrides: Partial<AtlasWorkspaceV1> = {},
): AtlasWorkspaceV1 {
  return {
    workspaceId: 'ws_demo',
    name: 'Atlas Demo Workspace',
    slug: 'atlas-demo-workspace',
    ownerUserId: 'owner_1',
    members: [
      {
        workspaceId: 'ws_demo',
        userId: 'owner_1',
        role: 'owner',
        permissions: DEFAULT_PERMISSIONS_BY_ROLE.owner,
      },
      makeMembership(),
    ],
    storagePreference: 'local_only',
    defaultBrandId: 'atlas-default',
    allowedBrandIds: ['atlas-default', 'installer-demo'],
    brandPolicy: 'workspace_default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAuthContextValue(
  workspace: AuthAtlasWorkspaceV1,
): AtlasAuthContextValue {
  return {
    status: 'authenticated',
    isAuthenticated: true,
    isDevMockAuthEnabled: true,
    userProfile: {
      version: '1.0',
      atlasUserId: 'user_admin',
      firebaseUid: 'firebase_admin',
      displayName: 'Admin User',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    workspaces: [workspace],
    currentWorkspace: workspace,
    continueWithGoogle: async () => {},
    signOut: async () => {},
    setCurrentWorkspace: () => {},
  };
}

function WorkspaceSettingsHarness() {
  const workspaceSession = useWorkspaceSession();
  const workspaceBrandSession = useWorkspaceBrandSession();
  const fallbackMembership = makeMembership({
    workspaceId: workspaceSession.activeWorkspace?.workspaceId ?? 'ws_demo',
  });

  const workspace =
    workspaceSession.activeWorkspace === null
      ? null
      : workspaceSession.workspaceSource === 'local_applied' ||
          workspaceSession.activeWorkspace.members.some(
            (member) => member.userId === fallbackMembership.userId,
          )
        ? workspaceSession.activeWorkspace
        : {
            ...workspaceSession.activeWorkspace,
            members: [...workspaceSession.activeWorkspace.members, fallbackMembership],
          };

  const actingMembership =
    workspaceSession.workspaceSource === 'local_applied'
      ? (workspaceSession.activeMembership ?? fallbackMembership)
      : fallbackMembership;

  return (
    <>
      <div data-testid="workspace-session-storage-target">{workspaceSession.storageTarget}</div>
      <div data-testid="workspace-session-source">{workspaceSession.workspaceSource}</div>
      <div data-testid="workspace-brand-warning">
        {workspaceBrandSession.warnings.join(' | ')}
      </div>
      <WorkspaceSettingsPage
        workspace={workspace}
        actingMembership={actingMembership}
        activeBrandSummary={{
          activeBrandId: workspaceBrandSession.activeBrandId,
          companyName: workspaceBrandSession.activeBrandProfile.companyName,
          resolutionSource: workspaceBrandSession.resolutionSource,
        }}
        sessionStatus={workspaceSession.status}
        onLocalApplySuccess={workspaceSession.refreshActiveWorkspace}
      />
    </>
  );
}

function renderHarness(workspace: AuthAtlasWorkspaceV1 = makeAuthWorkspace()) {
  render(
    <AtlasAuthContext.Provider value={makeAuthContextValue(workspace)}>
      <ActiveUserContext.Provider
        value={{
          activeUser: { userId: 'user_admin' } as never,
          setActiveUser: vi.fn(),
          clearActiveUser: vi.fn(),
        }}
      >
        <WorkspaceSessionProvider>
          <WorkspaceBrandSessionProvider>
            <WorkspaceSettingsHarness />
          </WorkspaceBrandSessionProvider>
        </WorkspaceSessionProvider>
      </ActiveUserContext.Provider>
    </AtlasAuthContext.Provider>,
  );
}

describe('workspace settings session hydration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('applying a workspace name change updates the active workspace summary', async () => {
    renderHarness();

    expect(screen.getByTestId('workspace-settings-active-workspace-name')).toHaveTextContent(
      'Atlas Demo Workspace',
    );

    fireEvent.change(screen.getByTestId('workspace-settings-name-input'), {
      target: { value: 'Hydrated Workspace' },
    });

    expect(screen.getByTestId('workspace-settings-active-workspace-name')).toHaveTextContent(
      'Atlas Demo Workspace',
    );

    fireEvent.click(screen.getByTestId('workspace-settings-apply-changes'));

    await screen.findByText('Local workspace settings applied');
    await waitFor(() =>
      expect(screen.getByTestId('workspace-settings-active-workspace-name')).toHaveTextContent(
        'Hydrated Workspace',
      ),
    );
  });

  it('applying a brand policy change updates the active brand resolution', async () => {
    renderHarness();

    fireEvent.change(screen.getByTestId('workspace-settings-default-brand-select'), {
      target: { value: 'installer-demo' },
    });
    fireEvent.click(screen.getByTestId('workspace-settings-apply-changes'));

    await waitFor(() =>
      expect(screen.getByTestId('workspace-settings-active-brand-id')).toHaveTextContent(
        'installer-demo',
      ),
    );
    expect(screen.getByTestId('workspace-settings-active-brand-name')).toHaveTextContent(
      'Demo Heating Co',
    );
  });

  it('falls back with a warning when the saved preferred brand is no longer allowed', async () => {
    localStorage.setItem(
      BRAND_PREFS_STORE_KEY,
      JSON.stringify({ ws_demo: 'installer-demo' }),
    );

    renderHarness(makeAuthWorkspace({ brandPolicy: 'user_selectable' }));

    await waitFor(() =>
      expect(screen.getByTestId('workspace-settings-active-brand-id')).toHaveTextContent(
        'installer-demo',
      ),
    );

    fireEvent.click(screen.getByTestId('workspace-settings-allowed-brand-installer-demo'));
    fireEvent.click(screen.getByTestId('workspace-settings-apply-changes'));

    await waitFor(() =>
      expect(screen.getByTestId('workspace-settings-active-brand-id')).toHaveTextContent(
        'atlas-default',
      ),
    );
    expect(screen.getByTestId('workspace-brand-warning')).toHaveTextContent(
      'User preference "installer-demo" is not in allowedBrandIds',
    );
  });

  it('applying a storage preference change updates the session storage target', async () => {
    renderHarness();

    expect(screen.getByTestId('workspace-session-storage-target')).toHaveTextContent('local_only');

    fireEvent.change(screen.getByTestId('workspace-settings-storage-select'), {
      target: { value: 'disabled' },
    });
    fireEvent.click(screen.getByTestId('workspace-settings-apply-changes'));

    await waitFor(() =>
      expect(screen.getByTestId('workspace-session-storage-target')).toHaveTextContent(
        'disabled',
      ),
    );
  });

  it('uses the fallback workspace when no saved snapshot exists', async () => {
    const fallbackWorkspace = makeProfileWorkspace();

    const result = await loadAppliedWorkspaceSettings({
      workspaceId: fallbackWorkspace.workspaceId,
      adapter: new LocalWorkspaceSettingsStorageAdapter(),
      fallbackWorkspace,
    });

    expect(result.source).toBe('fallback');
    expect(result.workspace).toEqual(fallbackWorkspace);
    expect(result.invites).toEqual([]);
    expect(result.joinRequestDecisions).toEqual([]);
  });
});
