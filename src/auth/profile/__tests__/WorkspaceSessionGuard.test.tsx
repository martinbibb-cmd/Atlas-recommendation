import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkspaceSessionGuard } from '../WorkspaceSessionGuard';
import { useWorkspaceSession } from '../WorkspaceSessionProvider';

vi.mock('../WorkspaceSessionProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../WorkspaceSessionProvider')>();
  return {
    ...actual,
    useWorkspaceSession: vi.fn(),
  };
});

describe('WorkspaceSessionGuard', () => {
  it('shows demo/session mode for unauthenticated sessions', () => {
    vi.mocked(useWorkspaceSession).mockReturnValue({
      status: 'unauthenticated_demo',
      authUserId: null,
      atlasUserProfile: null,
      activeWorkspace: null,
      storageTarget: 'disabled',
    });
    render(<WorkspaceSessionGuard />);
    expect(screen.getByText(/Demo\/session mode/i)).toBeTruthy();
  });

  it('shows no-workspace creation guard for signed-in users without a workspace', () => {
    vi.mocked(useWorkspaceSession).mockReturnValue({
      status: 'authenticated_no_workspace',
      authUserId: 'user-1',
      atlasUserProfile: { atlasUserId: 'atlas-user-1' } as never,
      activeWorkspace: null,
      storageTarget: 'disabled',
    });
    render(<WorkspaceSessionGuard />);
    expect(screen.getByText(/Create or join workspace before creating customer visits/i)).toBeTruthy();
  });

  it('shows workspace name and storage preference when active', () => {
    vi.mocked(useWorkspaceSession).mockReturnValue({
      status: 'workspace_active',
      authUserId: 'user-1',
      atlasUserProfile: { atlasUserId: 'atlas-user-1' } as never,
      activeWorkspace: { workspaceId: 'ws-a', name: 'Workspace A' } as never,
      storageTarget: 'local_only',
    });
    render(<WorkspaceSessionGuard showWorkspaceActiveState />);
    expect(screen.getByText(/Workspace active:/i)).toBeTruthy();
    expect(screen.getByText(/Workspace A/i)).toBeTruthy();
    expect(screen.getByText(/local_only/i)).toBeTruthy();
  });
});
