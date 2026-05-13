import { describe, expect, it } from 'vitest';
import { DEFAULT_PERMISSIONS_BY_ROLE, type AtlasWorkspaceV1 } from '../../profile';
import type { WorkspaceSettingsDraftV1 } from '../WorkspaceSettingsDraftV1';
import { buildWorkspaceSettingsChangeSet } from '../buildWorkspaceSettingsChangeSet';

function makeWorkspace(overrides: Partial<AtlasWorkspaceV1> = {}): AtlasWorkspaceV1 {
  return {
    workspaceId: 'ws_1',
    name: 'Atlas Workspace',
    slug: 'atlas-workspace',
    ownerUserId: 'owner_1',
    members: [
      {
        workspaceId: 'ws_1',
        userId: 'owner_1',
        role: 'owner',
        permissions: DEFAULT_PERMISSIONS_BY_ROLE.owner,
      },
      {
        workspaceId: 'ws_1',
        userId: 'admin_1',
        role: 'admin',
        permissions: DEFAULT_PERMISSIONS_BY_ROLE.admin,
      },
    ],
    storagePreference: 'local_only',
    defaultBrandId: 'atlas-default',
    allowedBrandIds: ['atlas-default', 'installer'],
    brandPolicy: 'workspace_default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeDraft(overrides: Partial<WorkspaceSettingsDraftV1> = {}): WorkspaceSettingsDraftV1 {
  return {
    workspaceId: 'ws_1',
    workspace: { name: 'Atlas Workspace', slug: 'atlas-workspace' },
    brand: {
      policy: 'workspace_default',
      defaultBrandId: 'atlas-default',
      allowedBrandIds: ['atlas-default', 'installer'],
    },
    storagePreference: 'local_only',
    memberPermissionEdits: [],
    inviteDrafts: [],
    joinRequestDecisions: [],
    ...overrides,
  };
}

describe('buildWorkspaceSettingsChangeSet', () => {
  it('brand policy changes produce a change set', () => {
    const result = buildWorkspaceSettingsChangeSet(
      makeDraft({
        brand: {
          policy: 'locked',
          defaultBrandId: 'atlas-default',
          allowedBrandIds: ['atlas-default'],
        },
      }),
      {
        workspace: makeWorkspace(),
        joinRequests: [],
        googleDriveConnectorAvailable: true,
      },
    );

    expect(result.changes.some((change) => change.type === 'brand_policy_updated')).toBe(true);
    expect(result.canCommit).toBe(true);
  });

  it('invalid default brand blocks', () => {
    const result = buildWorkspaceSettingsChangeSet(
      makeDraft({
        brand: {
          policy: 'locked',
          defaultBrandId: 'not-allowed-brand',
          allowedBrandIds: ['atlas-default'],
        },
      }),
      {
        workspace: makeWorkspace(),
        joinRequests: [],
        googleDriveConnectorAvailable: true,
      },
    );

    expect(result.canCommit).toBe(false);
    expect(
      result.blockingReasons.some((reason) => reason.includes('Default brand must be included')),
    ).toBe(true);
  });

  it('last admin protection blocks', () => {
    const workspace = makeWorkspace({
      members: [
        {
          workspaceId: 'ws_1',
          userId: 'owner_1',
          role: 'owner',
          permissions: ['view_visits'],
        },
      ],
    });
    const result = buildWorkspaceSettingsChangeSet(
      makeDraft({
        memberPermissionEdits: [
          {
            userId: 'owner_1',
            role: 'owner',
            permissions: ['view_visits'],
          },
        ],
      }),
      {
        workspace,
        joinRequests: [],
        googleDriveConnectorAvailable: true,
      },
    );

    expect(result.canCommit).toBe(false);
    expect(
      result.blockingReasons.some((reason) =>
        reason.includes('At least one owner/admin must retain manage workspace permission.'),
      ),
    ).toBe(true);
  });

  it('invalid invite email blocks', () => {
    const result = buildWorkspaceSettingsChangeSet(
      makeDraft({
        inviteDrafts: [
          {
            email: 'invalid-email',
            role: 'viewer',
            permissions: DEFAULT_PERMISSIONS_BY_ROLE.viewer,
          },
        ],
      }),
      {
        workspace: makeWorkspace(),
        joinRequests: [],
        googleDriveConnectorAvailable: true,
      },
    );

    expect(result.canCommit).toBe(false);
    expect(result.blockingReasons.some((reason) => reason.includes('Invite email is invalid'))).toBe(
      true,
    );
  });

  it('approved join request without role blocks', () => {
    const result = buildWorkspaceSettingsChangeSet(
      makeDraft({
        joinRequestDecisions: [
          {
            requestId: 'req_1',
            decision: 'approved',
          },
        ],
      }),
      {
        workspace: makeWorkspace(),
        joinRequests: [],
        googleDriveConnectorAvailable: true,
      },
    );

    expect(result.canCommit).toBe(false);
    expect(
      result.blockingReasons.some((reason) =>
        reason.includes('Cannot approve join request req_1 without assigning a role.'),
      ),
    ).toBe(true);
  });

  it('Google Drive warns when connector is unavailable', () => {
    const result = buildWorkspaceSettingsChangeSet(
      makeDraft({
        storagePreference: 'google_drive',
      }),
      {
        workspace: makeWorkspace(),
        joinRequests: [],
        googleDriveConnectorAvailable: false,
      },
    );

    expect(result.warnings.some((warning) => warning.includes('Google Drive connector is unavailable'))).toBe(true);
    expect(result.changes.some((change) => change.type === 'storage_preference_updated')).toBe(true);
  });
});
