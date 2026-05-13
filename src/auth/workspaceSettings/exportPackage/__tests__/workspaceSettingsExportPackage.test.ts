import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PERMISSIONS_BY_ROLE, type AtlasWorkspaceV1 } from '../../../profile';
import { WORKSPACE_SETTINGS_SCHEMA_VERSION } from '../../storage';
import { LocalWorkspaceSettingsStorageAdapter } from '../../storage/LocalWorkspaceSettingsStorageAdapter';
import {
  WORKSPACE_SETTINGS_EXPORT_REQUIRED_FILES,
  buildWorkspaceSettingsExportPackage,
  importWorkspaceSettingsPackageFromJsonBlob,
  validateWorkspaceSettingsExportPackage,
} from '..';

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

function makeWorkspace(overrides: Partial<AtlasWorkspaceV1> = {}): AtlasWorkspaceV1 {
  return {
    workspaceId: 'ws_test',
    name: 'Workspace Export Test',
    slug: 'workspace-export-test',
    ownerUserId: 'owner_1',
    members: [
      {
        workspaceId: 'ws_test',
        userId: 'owner_1',
        role: 'owner',
        permissions: DEFAULT_PERMISSIONS_BY_ROLE.owner,
      },
      {
        workspaceId: 'ws_test',
        userId: 'admin_1',
        role: 'admin',
        permissions: DEFAULT_PERMISSIONS_BY_ROLE.admin,
      },
    ],
    storagePreference: 'local_only',
    defaultBrandId: 'atlas-default',
    allowedBrandIds: ['atlas-default', 'installer-demo'],
    brandPolicy: 'workspace_default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function makePersistedSettings(workspaceOverrides: Partial<AtlasWorkspaceV1> = {}) {
  return {
    schemaVersion: WORKSPACE_SETTINGS_SCHEMA_VERSION,
    workspaceId: 'ws_test',
    savedAt: '2026-05-13T10:00:00.000Z',
    workspace: makeWorkspace(workspaceOverrides),
    invites: [
      {
        inviteId: 'inv_001',
        workspaceId: 'ws_test',
        email: 'invite@example.com',
        role: 'viewer',
        permissions: DEFAULT_PERMISSIONS_BY_ROLE.viewer,
        createdAt: '2026-05-13T10:00:00.000Z',
      },
    ],
    joinRequestDecisions: [
      {
        requestId: 'req_001',
        decision: 'approved' as const,
        role: 'engineer' as const,
        decidedAt: '2026-05-13T10:00:00.000Z',
      },
    ],
  };
}

describe('workspace settings export package', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  it('package contains all required files', () => {
    const pkg = buildWorkspaceSettingsExportPackage({
      persistedSettings: makePersistedSettings(),
      exportedAt: '2026-05-13T10:00:00.000Z',
    });

    expect(Object.keys(pkg.files).sort()).toEqual([...WORKSPACE_SETTINGS_EXPORT_REQUIRED_FILES].sort());
  });

  it('import validates schema', async () => {
    const pkg = buildWorkspaceSettingsExportPackage({
      persistedSettings: makePersistedSettings(),
      exportedAt: '2026-05-13T10:00:00.000Z',
    });
    const badBlob = new Blob([JSON.stringify({ ...pkg, schema: 'wrong.schema' })], {
      type: 'application/json',
    });

    const result = await importWorkspaceSettingsPackageFromJsonBlob(badBlob);
    expect(result.ok).toBe(false);
  });

  it('mismatched workspaceId blocks by default', () => {
    const pkg = buildWorkspaceSettingsExportPackage({
      persistedSettings: makePersistedSettings(),
    });

    const result = validateWorkspaceSettingsExportPackage(pkg, {
      currentWorkspaceId: 'ws_other',
      allowWorkspaceReplacement: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.preview.blockingReasons.some((reason) => reason.includes('Workspace ID mismatch')),
    ).toBe(true);
  });

  it('invalid brand policy blocks', () => {
    const pkg = buildWorkspaceSettingsExportPackage({
      persistedSettings: makePersistedSettings(),
    });

    const invalidPkg = {
      ...pkg,
      files: {
        ...pkg.files,
        'brand-policy.json': {
          ...pkg.files['brand-policy.json'],
          defaultBrandId: 'unknown-brand',
          allowedBrandIds: ['atlas-default'],
        },
      },
    };

    const result = validateWorkspaceSettingsExportPackage(invalidPkg);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.blockingReasons.some((reason) => reason.includes('Invalid brand policy'))).toBe(
      true,
    );
  });

  it('imported package applies locally', async () => {
    const adapter = new LocalWorkspaceSettingsStorageAdapter();
    const pkg = buildWorkspaceSettingsExportPackage({
      persistedSettings: makePersistedSettings({ name: 'Imported Workspace Name' }),
    });

    const validated = validateWorkspaceSettingsExportPackage(pkg, {
      currentWorkspaceId: 'ws_test',
      googleDriveConnectorAvailable: false,
    });

    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.preview.blockingReasons).toEqual([]);

    const importResult = await adapter.importWorkspaceSettings(
      JSON.stringify(validated.preview.persistedSettings),
    );
    expect(importResult.ok).toBe(true);

    const loaded = await adapter.loadWorkspaceSettings('ws_test');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    expect(loaded.snapshot.workspace.name).toBe('Imported Workspace Name');
  });
});
