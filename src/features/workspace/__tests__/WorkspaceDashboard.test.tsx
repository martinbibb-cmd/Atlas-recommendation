/**
 * WorkspaceDashboard.test.tsx
 *
 * Regression tests for the workspace dashboard access guard.
 *
 * Acceptance criteria:
 *   1. Guest (authorisedAccess=false) does NOT render "Analytics snapshot".
 *   2. Guest (authorisedAccess=false) does NOT render "Branding".
 *   3. Guest (authorisedAccess=false) does NOT render "Workspace tools".
 *   4. Guest (authorisedAccess=false) DOES render "Start New Visit".
 *   5. Admin/dev (authorisedAccess=true) CAN render the full dashboard.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import WorkspaceDashboard from '../WorkspaceDashboard';
import type { WorkspaceDashboardProps } from '../WorkspaceDashboard';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../userProfiles/useActiveUser', () => ({
  useActiveUser: () => ({ activeUser: null }),
}));

vi.mock('../../userProfiles/useRolePermissions', () => ({
  useRolePermissions: () => ({
    effectiveRole: 'owner',
    canCreateVisit: true,
    canViewAnalytics: true,
    canEditBranding: true,
    canManageWorkspace: true,
    canMarkOutcome: true,
    canAccessDeveloperTools: false,
  }),
}));

vi.mock('../../../lib/visits/visitApi', () => ({
  listVisits: () => Promise.resolve([]),
  visitDisplayLabel: () => 'Visit',
  visitStatusLabel: () => 'New',
  matchesFilter: () => false,
}));

vi.mock('../../analytics/analyticsStore', () => ({
  aggregateByTenant: () => [],
}));

vi.mock('../tenants/activeTenant', () => ({
  resolveActiveTenant: () => ({
    tenantId: 'atlas',
    displayName: 'Atlas',
    workspaceSlug: 'atlas',
    status: 'active',
    brandId: null,
  }),
}));

vi.mock('../branding/brandProfileStore', () => ({
  listStoredBrandProfiles: () => ({}),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const noop = () => {};

function baseProps(overrides: Partial<WorkspaceDashboardProps> = {}): WorkspaceDashboardProps {
  return {
    onStartNewVisit: noop,
    onOpenVisit: noop,
    onOpenAllVisits: noop,
    onOpenAnalytics: noop,
    onOpenBranding: noop,
    onOpenWorkspaceSettings: noop,
    onOpenUserProfile: noop,
    onOpenAllTools: noop,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorkspaceDashboard access guard — guest (authorisedAccess=false)', () => {
  beforeEach(() => {
    render(<WorkspaceDashboard {...baseProps({ authorisedAccess: false })} />);
  });

  it('does not render "Analytics snapshot"', () => {
    expect(screen.queryByText('Analytics snapshot')).toBeNull();
  });

  it('does not render "Branding"', () => {
    expect(screen.queryByText('Branding')).toBeNull();
  });

  it('does not render "Workspace tools"', () => {
    expect(screen.queryByText(/workspace tools/i)).toBeNull();
  });

  it('renders "Start New Visit" for the guest', () => {
    expect(screen.getByTestId('guest-start-new-visit')).toBeTruthy();
    expect(screen.getByText(/Start New Visit/i)).toBeTruthy();
  });

  it('renders "Open Existing Visit" for the guest', () => {
    expect(screen.getByTestId('guest-open-existing-visit')).toBeTruthy();
  });
});

describe('WorkspaceDashboard access guard — authorised (authorisedAccess=true)', () => {
  it('renders the full dashboard including analytics, branding, and workspace tools sections', () => {
    render(<WorkspaceDashboard {...baseProps({ authorisedAccess: true })} />);

    // Full dashboard renders — not the guest fallback
    expect(screen.queryByTestId('workspace-dashboard-guest-fallback')).toBeNull();

    // Analytics snapshot is present (canViewAnalytics=true from mock)
    expect(screen.getByText('Analytics snapshot')).toBeTruthy();

    // Branding section is present (canEditBranding=true from mock)
    expect(screen.getByText('Branding')).toBeTruthy();

    // Workspace tools chip is present (showWorkspaceTools=true from mock)
    expect(screen.getByText(/Workspace tools/i)).toBeTruthy();
  });

  it('defaults to authorised when authorisedAccess prop is omitted', () => {
    render(<WorkspaceDashboard {...baseProps()} />);
    expect(screen.queryByTestId('workspace-dashboard-guest-fallback')).toBeNull();
  });
});
