import { describe, expect, it } from 'vitest';
import { buildAppHomeNewVisitEntryState } from '../appHomeVisitEntry';

describe('buildAppHomeNewVisitEntryState', () => {
  it('enables new visit tile when profile can create visit even without workspace', () => {
    const state = buildAppHomeNewVisitEntryState({
      canCreateVisit: true,
      workspaceStatus: 'authenticated_no_workspace',
    });
    expect(state.disabled).toBe(false);
    expect(state.blockerReason).toMatch(/Workspace required/i);
  });

  it('disables new visit tile when profile cannot create visit', () => {
    const state = buildAppHomeNewVisitEntryState({
      canCreateVisit: false,
      workspaceStatus: 'workspace_active',
    });
    expect(state.disabled).toBe(true);
    expect(state.blockerReason).toBeUndefined();
  });

  it('enables new visit tile with no blocker when workspace is active', () => {
    const state = buildAppHomeNewVisitEntryState({
      canCreateVisit: true,
      workspaceStatus: 'workspace_active',
    });
    expect(state.disabled).toBe(false);
    expect(state.blockerReason).toBeUndefined();
  });
});
