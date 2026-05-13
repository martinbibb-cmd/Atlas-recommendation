import type { PersistedWorkspaceSettingsV1 } from '../storage';
import {
  WORKSPACE_SETTINGS_EXPORT_PACKAGE_SCHEMA,
  WORKSPACE_SETTINGS_EXPORT_PACKAGE_VERSION,
  type WorkspaceSettingsExportPackageManifestV1,
  type WorkspaceSettingsExportPackageV1,
  type WorkspaceSettingsExportWorkspaceRecordV1,
} from './WorkspaceSettingsExportPackageV1';

interface BuildWorkspaceSettingsExportPackageInput {
  readonly persistedSettings: PersistedWorkspaceSettingsV1;
  readonly exportedAt?: string;
  readonly folderName?: string;
}

function dateStamp(iso: string): string {
  return iso.slice(0, 10);
}

function sanitizeWorkspaceId(value: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-');
  return cleaned.length > 0 ? cleaned : 'workspace';
}

function buildWorkspaceSettingsExportFolderName(workspaceId: string, exportedAt: string): string {
  return `Atlas-WorkspaceSettings-${sanitizeWorkspaceId(workspaceId)}-${dateStamp(exportedAt)}`;
}

function buildReadme(folderName: string): string {
  return [
    '# Atlas workspace settings export package',
    '',
    `Folder: ${folderName}`,
    '',
    'Portable package of locally applied workspace settings.',
    'Use this package to move settings between devices or import later into cloud storage flows.',
    '',
    'Contents:',
    '- manifest.json',
    '- workspace.json',
    '- members.json',
    '- brand-policy.json',
    '- storage-preference.json',
    '- invites.json',
    '- join-decisions.json',
  ].join('\n');
}

export function buildWorkspaceSettingsExportPackage({
  persistedSettings,
  exportedAt = new Date().toISOString(),
  folderName = buildWorkspaceSettingsExportFolderName(persistedSettings.workspaceId, exportedAt),
}: BuildWorkspaceSettingsExportPackageInput): WorkspaceSettingsExportPackageV1 {
  const workspaceRecord: WorkspaceSettingsExportWorkspaceRecordV1 = {
    workspaceId: persistedSettings.workspace.workspaceId,
    name: persistedSettings.workspace.name,
    slug: persistedSettings.workspace.slug,
    ownerUserId: persistedSettings.workspace.ownerUserId,
    createdAt: persistedSettings.workspace.createdAt,
    updatedAt: persistedSettings.workspace.updatedAt,
  };

  const manifest: WorkspaceSettingsExportPackageManifestV1 = {
    schema: WORKSPACE_SETTINGS_EXPORT_PACKAGE_SCHEMA,
    version: WORKSPACE_SETTINGS_EXPORT_PACKAGE_VERSION,
    exportedAt,
    folderName,
    workspaceId: persistedSettings.workspaceId,
    source: {
      target: 'local_only',
      surface: 'atlas_workspace_settings',
    },
  };

  return {
    schema: WORKSPACE_SETTINGS_EXPORT_PACKAGE_SCHEMA,
    version: WORKSPACE_SETTINGS_EXPORT_PACKAGE_VERSION,
    folderName,
    files: {
      'manifest.json': manifest,
      'workspace.json': workspaceRecord,
      'members.json': persistedSettings.workspace.members,
      'brand-policy.json': {
        policy: persistedSettings.workspace.brandPolicy,
        defaultBrandId: persistedSettings.workspace.defaultBrandId,
        allowedBrandIds: persistedSettings.workspace.allowedBrandIds,
      },
      'storage-preference.json': {
        storagePreference: persistedSettings.workspace.storagePreference,
      },
      'invites.json': persistedSettings.invites,
      'join-decisions.json': persistedSettings.joinRequestDecisions,
      'README.md': buildReadme(folderName),
    },
  };
}
