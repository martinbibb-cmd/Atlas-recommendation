import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import RecentVisitsList from './RecentVisitsList';
import * as visitApi from '../../lib/visits/visitApi';
import { getVisitIdentity } from '../../visits/visitIdentityStore';
import { useWorkspaceSession } from '../../auth/profile';

vi.mock('../../lib/visits/visitApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/visits/visitApi')>();
  return {
    ...actual,
    listVisits: vi.fn(),
  };
});

vi.mock('../../visits/visitIdentityStore', () => ({
  getVisitIdentity: vi.fn(),
}));

vi.mock('../../auth/profile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../auth/profile')>();
  return {
    ...actual,
    useWorkspaceSession: vi.fn(() => ({
      status: 'workspace_active',
      authUserId: 'user-1',
      atlasUserProfile: { atlasUserId: 'atlas-user-1' },
      activeWorkspace: { workspaceId: 'ws-a', name: 'Workspace A' },
      storageTarget: 'local_only',
    })),
  };
});

describe('RecentVisitsList workspace boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWorkspaceSession).mockReturnValue({
      status: 'workspace_active',
      authUserId: 'user-1',
      atlasUserProfile: { atlasUserId: 'atlas-user-1' } as never,
      activeWorkspace: { workspaceId: 'ws-a', name: 'Workspace A' } as never,
      storageTarget: 'local_only',
    });
  });

  it('shows only visits in the active workspace', async () => {
    vi.mocked(visitApi.listVisits).mockResolvedValueOnce([
      {
        id: 'visit-owned',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        status: 'new',
        customer_name: null,
        address_line_1: null,
        postcode: null,
        current_step: null,
        visit_reference: 'Owned Visit',
        completed_at: null,
        completion_method: null,
      },
      {
        id: 'visit-other-workspace',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        status: 'new',
        customer_name: null,
        address_line_1: null,
        postcode: null,
        current_step: null,
        visit_reference: 'Other Workspace Visit',
        completed_at: null,
        completion_method: null,
      },
    ]);
    vi.mocked(getVisitIdentity).mockImplementation((visitId: string) => {
      if (visitId === 'visit-owned') {
        return {
          version: '1.0',
          visitId,
          workspaceId: 'ws-a',
          atlasUserId: 'atlas-user-1',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        };
      }
      return {
        version: '1.0',
        visitId,
        workspaceId: 'ws-b',
        atlasUserId: 'atlas-user-2',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
    });

    render(<RecentVisitsList onOpenVisit={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Owned Visit')).toBeTruthy());
    expect(screen.queryByText('Other Workspace Visit')).toBeNull();
  });

  it('flags legacy unowned visits instead of mixing them with owned visits', async () => {
    vi.mocked(visitApi.listVisits).mockResolvedValueOnce([
      {
        id: 'visit-owned',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        status: 'new',
        customer_name: null,
        address_line_1: null,
        postcode: null,
        current_step: null,
        visit_reference: 'Owned Visit',
        completed_at: null,
        completion_method: null,
      },
      {
        id: 'visit-legacy',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        status: 'new',
        customer_name: null,
        address_line_1: null,
        postcode: null,
        current_step: null,
        visit_reference: 'Legacy Visit',
        completed_at: null,
        completion_method: null,
      },
    ]);
    vi.mocked(getVisitIdentity).mockImplementation((visitId: string) => {
      if (visitId === 'visit-owned') {
        return {
          version: '1.0',
          visitId,
          workspaceId: 'ws-a',
          atlasUserId: 'atlas-user-1',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        };
      }
      return null;
    });

    render(<RecentVisitsList onOpenVisit={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Owned Visit')).toBeTruthy());
    expect(screen.queryByText('Legacy Visit')).toBeNull();
    expect(screen.getByTestId('recent-visits-legacy-warning').textContent).toMatch(/legacy unowned visits/i);
  });
});
