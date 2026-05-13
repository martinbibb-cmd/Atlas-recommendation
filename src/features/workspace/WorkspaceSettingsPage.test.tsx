import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  AtlasWorkspaceV1,
  WorkspaceMembershipV1,
  WorkspaceSessionStatus,
} from '../../auth/profile';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../../auth/profile';
import WorkspaceSettingsPage from './WorkspaceSettingsPage';

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

function makeWorkspace(overrides: Partial<AtlasWorkspaceV1> = {}): AtlasWorkspaceV1 {
  const members = overrides.members ?? [
    makeMembership({ userId: 'owner_1', role: 'owner' }),
    makeMembership({ userId: 'user_admin', role: 'admin' }),
    makeMembership({ userId: 'viewer_1', role: 'viewer' }),
  ];

  return {
    workspaceId: 'ws_demo',
    name: 'Atlas Demo Workspace',
    slug: 'atlas-demo',
    ownerUserId: 'owner_1',
    members,
    storagePreference: 'local_only',
    defaultBrandId: 'atlas-default',
    allowedBrandIds: ['atlas-default', 'installer-demo'],
    brandPolicy: 'workspace_default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage({
  membership = makeMembership(),
  workspace = makeWorkspace(),
  sessionStatus = 'workspace_active',
}: {
  membership?: WorkspaceMembershipV1 | null;
  workspace?: AtlasWorkspaceV1 | null;
  sessionStatus?: WorkspaceSessionStatus;
} = {}) {
  render(
    <WorkspaceSettingsPage
      workspace={workspace}
      actingMembership={membership}
      sessionStatus={sessionStatus}
      activeBrandSummary={{
        activeBrandId: 'atlas-default',
        companyName: 'Atlas',
        resolutionSource: 'workspace_default',
      }}
    />,
  );
}

describe('WorkspaceSettingsPage', () => {
  it('admin sees invite and approve controls', () => {
    renderPage();

    expect(screen.getByTestId('send-invite-btn')).toBeTruthy();
    expect(screen.getByTestId('approve-request-req_001')).toBeTruthy();
  });

  it('engineer does not see invite or approve controls', () => {
    renderPage({
      membership: makeMembership({ role: 'engineer', userId: 'user_engineer' }),
    });

    expect(screen.queryByTestId('send-invite-btn')).toBeNull();
    expect(screen.queryByTestId('approve-request-req_001')).toBeNull();
  });

  it('viewer stays read-only', () => {
    renderPage({
      membership: makeMembership({ role: 'viewer', userId: 'user_viewer' }),
    });

    expect(screen.queryByTestId('send-invite-btn')).toBeNull();
    expect(screen.getByTestId('workspace-settings-storage-select')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('workspace-settings-brand-policy-user_selectable')).toHaveProperty('disabled', true);
  });

  it('admin can edit brand policy draft', () => {
    renderPage();

    fireEvent.click(screen.getByTestId('workspace-settings-brand-policy-user_selectable'));
    fireEvent.click(screen.getByTestId('workspace-settings-allowed-brand-installer-demo'));
    fireEvent.change(screen.getByTestId('workspace-settings-default-brand-select'), {
      target: { value: 'atlas-default' },
    });

    expect(screen.getByTestId('workspace-settings-brand-policy-user_selectable')).toHaveProperty('checked', true);
    expect(screen.getByTestId('workspace-settings-allowed-brand-installer-demo')).toHaveProperty('checked', false);
  });

  it('non-admin cannot edit brand policy', () => {
    renderPage({
      membership: makeMembership({ role: 'engineer', userId: 'user_engineer' }),
    });

    expect(screen.getByTestId('workspace-settings-brand-policy-locked')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('workspace-settings-default-brand-select')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('workspace-settings-allowed-brand-atlas-default')).toHaveProperty('disabled', true);
  });

  it('storage preference draft renders', () => {
    renderPage();

    expect(screen.getByTestId('workspace-settings-storage-select')).toHaveValue('local_only');
    expect(screen.getByText('Google Drive workspace placeholder')).toBeTruthy();
  });

  it('active workspace and brand are shown', () => {
    renderPage();

    expect(screen.getByTestId('workspace-settings-active-workspace-name').textContent).toBe('Atlas Demo Workspace');
    expect(screen.getByTestId('workspace-settings-active-brand-name').textContent).toBe('Atlas');
  });

  it('manage workspace permission can edit without admin role', () => {
    renderPage({
      membership: makeMembership({
        role: 'engineer',
        userId: 'user_manager',
        permissions: [...DEFAULT_PERMISSIONS_BY_ROLE.engineer, 'manage_workspace'],
      }),
    });

    expect(screen.getByTestId('workspace-settings-storage-select')).toHaveProperty('disabled', false);
    expect(screen.getByTestId('workspace-settings-brand-policy-locked')).toHaveProperty('disabled', false);
    expect(screen.getByTestId('send-invite-btn')).toBeTruthy();
  });
});
