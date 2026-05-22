export interface AppHomeNewVisitEntryState {
  readonly disabled: boolean;
  readonly blockerReason?: string;
}

export function buildAppHomeNewVisitEntryState(input: {
  readonly canCreateVisit: boolean;
  readonly workspaceStatus: string;
}): AppHomeNewVisitEntryState {
  if (!input.canCreateVisit) {
    return {
      disabled: true,
    };
  }
  if (input.workspaceStatus === 'authenticated_no_workspace') {
    return {
      disabled: false,
      blockerReason: 'Workspace required: create or join a workspace in the start dialog before creating a visit.',
    };
  }
  return {
    disabled: false,
  };
}
