/**
 * workspaceSettingsStorage.test.ts
 *
 * Tests for the workspace-settings storage adapter boundary.
 *
 * Coverage:
 *   1. DisabledWorkspaceSettingsStorageAdapter — refuses apply
 *   2. LocalWorkspaceSettingsStorageAdapter — applies workspace name/slug change
 *   3. LocalWorkspaceSettingsStorageAdapter — applies brand policy change
 *   4. LocalWorkspaceSettingsStorageAdapter — applies member permission change
 *   5. LocalWorkspaceSettingsStorageAdapter — stores invite/join decisions
 *   6. GoogleDriveWorkspaceSettingsStorageAdapterStub — never applies
 *   7. Invalid change-set (canCommit === false) cannot apply
 *   8. export/import round-trip preserves snapshot
 *   9. loadWorkspaceSettings returns notFound before any apply
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AtlasWorkspaceV1, WorkspaceMembershipV1 } from '../../../profile';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../../../profile';
import type { WorkspaceSettingsDraftV1 } from '../../WorkspaceSettingsDraftV1';
import { buildWorkspaceSettingsChangeSet } from '../../buildWorkspaceSettingsChangeSet';
import { DisabledWorkspaceSettingsStorageAdapter } from '../DisabledWorkspaceSettingsStorageAdapter';
import { LocalWorkspaceSettingsStorageAdapter } from '../LocalWorkspaceSettingsStorageAdapter';
import { GoogleDriveWorkspaceSettingsStorageAdapterStub } from '../GoogleDriveWorkspaceSettingsStorageAdapterStub';
import { WORKSPACE_SETTINGS_SCHEMA_VERSION } from '../PersistedWorkspaceSettingsV1';

// ─── localStorage mock ────────────────────────────────────────────────────────

function makeLocalStorageMock(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeOwnerMembership(workspaceId: string): WorkspaceMembershipV1 {
  return {
    workspaceId,
    userId: 'owner_1',
    role: 'owner',
    permissions: DEFAULT_PERMISSIONS_BY_ROLE.owner,
  };
}

function makeWorkspace(overrides: Partial<AtlasWorkspaceV1> = {}): AtlasWorkspaceV1 {
  return {
    workspaceId: 'ws_test',
    name: 'Test Workspace',
    slug: 'test-workspace',
    ownerUserId: 'owner_1',
    members: [
      makeOwnerMembership('ws_test'),
      {
        workspaceId: 'ws_test',
        userId: 'admin_1',
        role: 'admin',
        permissions: DEFAULT_PERMISSIONS_BY_ROLE.admin,
      },
    ],
    storagePreference: 'local_only',
    defaultBrandId: 'atlas-default',
    allowedBrandIds: ['atlas-default'],
    brandPolicy: 'workspace_default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeDraft(overrides: Partial<WorkspaceSettingsDraftV1> = {}): WorkspaceSettingsDraftV1 {
  return {
    workspaceId: 'ws_test',
    workspace: { name: 'Test Workspace', slug: 'test-workspace' },
    brand: {
      policy: 'workspace_default',
      defaultBrandId: 'atlas-default',
      allowedBrandIds: ['atlas-default'],
    },
    storagePreference: 'local_only',
    memberPermissionEdits: [],
    inviteDrafts: [],
    joinRequestDecisions: [],
    ...overrides,
  };
}

function makeValidChangeSet(draft: WorkspaceSettingsDraftV1, workspace: AtlasWorkspaceV1) {
  return buildWorkspaceSettingsChangeSet(draft, {
    workspace,
    joinRequests: [],
    googleDriveConnectorAvailable: false,
  });
}

// ─── Disabled adapter ─────────────────────────────────────────────────────────

describe('DisabledWorkspaceSettingsStorageAdapter', () => {
  it('refuses applyChangeSet with a clear reason', async () => {
    const adapter = new DisabledWorkspaceSettingsStorageAdapter();
    const workspace = makeWorkspace();
    const draft = makeDraft({ workspace: { name: 'New Name', slug: 'new-name' } });
    const changeSet = makeValidChangeSet(draft, workspace);

    const result = await adapter.applyChangeSet(changeSet, {
      draft,
      currentWorkspace: workspace,
      currentJoinRequests: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('disabled');
    }
  });

  it('loadWorkspaceSettings returns notFound', async () => {
    const adapter = new DisabledWorkspaceSettingsStorageAdapter();
    const result = await adapter.loadWorkspaceSettings('ws_test');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.notFound).toBe(true);
    }
  });

  it('exportWorkspaceSettings returns error', async () => {
    const adapter = new DisabledWorkspaceSettingsStorageAdapter();
    const result = await adapter.exportWorkspaceSettings('ws_test');
    expect(result.ok).toBe(false);
  });

  it('importWorkspaceSettings returns error', async () => {
    const adapter = new DisabledWorkspaceSettingsStorageAdapter();
    const result = await adapter.importWorkspaceSettings('{}');
    expect(result.ok).toBe(false);
  });
});

// ─── Google Drive stub ────────────────────────────────────────────────────────

describe('GoogleDriveWorkspaceSettingsStorageAdapterStub', () => {
  it('never applies — returns unavailable reason', async () => {
    const adapter = new GoogleDriveWorkspaceSettingsStorageAdapterStub();
    const workspace = makeWorkspace();
    const draft = makeDraft({ workspace: { name: 'New Name', slug: 'new-name' } });
    const changeSet = makeValidChangeSet(draft, workspace);

    const result = await adapter.applyChangeSet(changeSet, {
      draft,
      currentWorkspace: workspace,
      currentJoinRequests: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('Google Drive');
    }
  });

  it('loadWorkspaceSettings returns error (not notFound)', async () => {
    const adapter = new GoogleDriveWorkspaceSettingsStorageAdapterStub();
    const result = await adapter.loadWorkspaceSettings('ws_test');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.notFound).toBe(false);
    }
  });
});

// ─── Local adapter ────────────────────────────────────────────────────────────

describe('LocalWorkspaceSettingsStorageAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  it('loadWorkspaceSettings returns notFound before any apply', async () => {
    const adapter = new LocalWorkspaceSettingsStorageAdapter();
    const result = await adapter.loadWorkspaceSettings('ws_test');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.notFound).toBe(true);
    }
  });

  it('applies workspace name and slug change', async () => {
    const adapter = new LocalWorkspaceSettingsStorageAdapter();
    const workspace = makeWorkspace();
    const draft = makeDraft({
      workspace: { name: 'Renamed Workspace', slug: 'renamed-workspace' },
    });
    const changeSet = makeValidChangeSet(draft, workspace);

    expect(changeSet.canCommit).toBe(true);

    const result = await adapter.applyChangeSet(changeSet, {
      draft,
      currentWorkspace: workspace,
      currentJoinRequests: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.workspace.name).toBe('Renamed Workspace');
      expect(result.snapshot.workspace.slug).toBe('renamed-workspace');
      expect(result.snapshot.workspaceId).toBe('ws_test');
      expect(result.snapshot.schemaVersion).toBe(WORKSPACE_SETTINGS_SCHEMA_VERSION);
    }
  });

  it('applies brand policy change', async () => {
    const adapter = new LocalWorkspaceSettingsStorageAdapter();
    const workspace = makeWorkspace();
    const draft = makeDraft({
      brand: {
        policy: 'locked',
        defaultBrandId: 'atlas-default',
        allowedBrandIds: ['atlas-default'],
      },
    });
    const changeSet = makeValidChangeSet(draft, workspace);

    expect(changeSet.canCommit).toBe(true);

    const result = await adapter.applyChangeSet(changeSet, {
      draft,
      currentWorkspace: workspace,
      currentJoinRequests: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.workspace.brandPolicy).toBe('locked');
    }
  });

  it('applies member permission change', async () => {
    const adapter = new LocalWorkspaceSettingsStorageAdapter();
    const workspace = makeWorkspace();
    const draft = makeDraft({
      memberPermissionEdits: [
        {
          userId: 'admin_1',
          role: 'surveyor',
          permissions: DEFAULT_PERMISSIONS_BY_ROLE.surveyor,
        },
      ],
    });
    const changeSet = makeValidChangeSet(draft, workspace);

    expect(changeSet.canCommit).toBe(true);

    const result = await adapter.applyChangeSet(changeSet, {
      draft,
      currentWorkspace: workspace,
      currentJoinRequests: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const updatedMember = result.snapshot.workspace.members.find(
        (m) => m.userId === 'admin_1',
      );
      expect(updatedMember?.role).toBe('surveyor');
      expect(updatedMember?.permissions).toEqual(DEFAULT_PERMISSIONS_BY_ROLE.surveyor);
    }
  });

  it('stores invite records', async () => {
    const adapter = new LocalWorkspaceSettingsStorageAdapter();
    const workspace = makeWorkspace();
    const draft = makeDraft({
      inviteDrafts: [
        {
          email: 'new.user@example.com',
          role: 'viewer',
          permissions: DEFAULT_PERMISSIONS_BY_ROLE.viewer,
        },
      ],
    });
    const changeSet = makeValidChangeSet(draft, workspace);

    expect(changeSet.canCommit).toBe(true);

    const result = await adapter.applyChangeSet(changeSet, {
      draft,
      currentWorkspace: workspace,
      currentJoinRequests: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.invites).toHaveLength(1);
      expect(result.snapshot.invites[0].email).toBe('new.user@example.com');
      expect(result.snapshot.invites[0].role).toBe('viewer');
    }
  });

  it('stores join request decisions', async () => {
    const adapter = new LocalWorkspaceSettingsStorageAdapter();
    const workspace = makeWorkspace();
    const draft = makeDraft({
      joinRequestDecisions: [
        {
          requestId: 'req_001',
          decision: 'approved',
          role: 'surveyor',
        },
      ],
    });
    const changeSet = makeValidChangeSet(draft, workspace);

    expect(changeSet.canCommit).toBe(true);

    const result = await adapter.applyChangeSet(changeSet, {
      draft,
      currentWorkspace: workspace,
      currentJoinRequests: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.joinRequestDecisions).toHaveLength(1);
      const decision = result.snapshot.joinRequestDecisions[0];
      expect(decision.requestId).toBe('req_001');
      expect(decision.decision).toBe('approved');
      expect(decision.role).toBe('surveyor');
    }
  });

  it('load round-trip returns the saved snapshot', async () => {
    const adapter = new LocalWorkspaceSettingsStorageAdapter();
    const workspace = makeWorkspace();
    const draft = makeDraft({
      workspace: { name: 'Persisted Workspace', slug: 'persisted-workspace' },
    });
    const changeSet = makeValidChangeSet(draft, workspace);

    await adapter.applyChangeSet(changeSet, {
      draft,
      currentWorkspace: workspace,
      currentJoinRequests: [],
    });

    const loadResult = await adapter.loadWorkspaceSettings('ws_test');
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.snapshot.workspace.name).toBe('Persisted Workspace');
    }
  });

  it('export/import round-trip preserves the snapshot', async () => {
    const adapter = new LocalWorkspaceSettingsStorageAdapter();
    const workspace = makeWorkspace();
    const draft = makeDraft({
      workspace: { name: 'Export Workspace', slug: 'export-workspace' },
    });
    const changeSet = makeValidChangeSet(draft, workspace);

    await adapter.applyChangeSet(changeSet, {
      draft,
      currentWorkspace: workspace,
      currentJoinRequests: [],
    });

    const exportResult = await adapter.exportWorkspaceSettings('ws_test');
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    // Import into a fresh adapter (different localStorage mock state)
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    const freshAdapter = new LocalWorkspaceSettingsStorageAdapter();

    const importResult = await freshAdapter.importWorkspaceSettings(exportResult.json);
    expect(importResult.ok).toBe(true);
    if (importResult.ok) {
      expect(importResult.snapshot.workspace.name).toBe('Export Workspace');
    }
  });
});

// ─── Invalid change set ───────────────────────────────────────────────────────

describe('invalid change-set cannot apply', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  it('local adapter refuses a change-set where canCommit is false', async () => {
    const adapter = new LocalWorkspaceSettingsStorageAdapter();
    const workspace = makeWorkspace({
      members: [
        {
          workspaceId: 'ws_test',
          userId: 'owner_1',
          role: 'owner',
          // Missing manage_workspace — last admin protection will block
          permissions: ['view_visits'],
        },
      ],
    });
    const draft = makeDraft({
      memberPermissionEdits: [
        {
          userId: 'owner_1',
          role: 'owner',
          permissions: ['view_visits'],
        },
      ],
    });
    const changeSet = makeValidChangeSet(draft, workspace);

    expect(changeSet.canCommit).toBe(false);

    const result = await adapter.applyChangeSet(changeSet, {
      draft,
      currentWorkspace: workspace,
      currentJoinRequests: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('blocking reasons');
    }
  });

  it('local adapter refuses import of invalid JSON', async () => {
    const adapter = new LocalWorkspaceSettingsStorageAdapter();
    const result = await adapter.importWorkspaceSettings('not-json{{{');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('invalid JSON');
    }
  });

  it('local adapter refuses import with wrong schema version', async () => {
    const adapter = new LocalWorkspaceSettingsStorageAdapter();
    const badJson = JSON.stringify({
      schemaVersion: '9.9',
      workspaceId: 'ws_test',
      savedAt: new Date().toISOString(),
      workspace: { workspaceId: 'ws_test' },
      invites: [],
      joinRequestDecisions: [],
    });
    const result = await adapter.importWorkspaceSettings(badJson);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('schema version');
    }
  });
});
