import type { AtlasWorkspaceV1, WorkspaceBrandPolicy, WorkspaceStoragePreference } from '../../profile';
import type {
  PersistedJoinRequestDecisionV1,
  PersistedWorkspaceInviteV1,
  PersistedWorkspaceSettingsV1,
} from '../storage';

export const WORKSPACE_SETTINGS_EXPORT_PACKAGE_SCHEMA =
  'atlas.workspace-settings-export-package' as const;
export const WORKSPACE_SETTINGS_EXPORT_PACKAGE_VERSION = '1.0' as const;

export const WORKSPACE_SETTINGS_EXPORT_REQUIRED_FILES = [
  'manifest.json',
  'workspace.json',
  'members.json',
  'brand-policy.json',
  'storage-preference.json',
  'invites.json',
  'join-decisions.json',
  'README.md',
] as const;

export type WorkspaceSettingsExportRequiredFileName =
  (typeof WORKSPACE_SETTINGS_EXPORT_REQUIRED_FILES)[number];

export interface WorkspaceSettingsExportPackageManifestV1 {
  readonly schema: typeof WORKSPACE_SETTINGS_EXPORT_PACKAGE_SCHEMA;
  readonly version: typeof WORKSPACE_SETTINGS_EXPORT_PACKAGE_VERSION;
  readonly exportedAt: string;
  readonly folderName: string;
  readonly workspaceId: string;
  readonly source: {
    readonly target: 'local_only' | 'unknown';
    readonly surface: string;
  };
}

export interface WorkspaceSettingsExportWorkspaceRecordV1 {
  readonly workspaceId: string;
  readonly name: string;
  readonly slug: string;
  readonly ownerUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkspaceSettingsExportBrandPolicyRecordV1 {
  readonly policy: WorkspaceBrandPolicy;
  readonly defaultBrandId: string;
  readonly allowedBrandIds: readonly string[];
}

export interface WorkspaceSettingsExportStoragePreferenceRecordV1 {
  readonly storagePreference: WorkspaceStoragePreference;
}

export interface WorkspaceSettingsExportPackageFilesV1 {
  readonly 'manifest.json': WorkspaceSettingsExportPackageManifestV1;
  readonly 'workspace.json': WorkspaceSettingsExportWorkspaceRecordV1;
  readonly 'members.json': AtlasWorkspaceV1['members'];
  readonly 'brand-policy.json': WorkspaceSettingsExportBrandPolicyRecordV1;
  readonly 'storage-preference.json': WorkspaceSettingsExportStoragePreferenceRecordV1;
  readonly 'invites.json': readonly PersistedWorkspaceInviteV1[];
  readonly 'join-decisions.json': readonly PersistedJoinRequestDecisionV1[];
  readonly 'README.md': string;
}

export interface WorkspaceSettingsExportPackageV1 {
  readonly schema: typeof WORKSPACE_SETTINGS_EXPORT_PACKAGE_SCHEMA;
  readonly version: typeof WORKSPACE_SETTINGS_EXPORT_PACKAGE_VERSION;
  readonly folderName: string;
  readonly files: WorkspaceSettingsExportPackageFilesV1;
}

export interface WorkspaceSettingsImportPreviewV1 {
  readonly persistedSettings: PersistedWorkspaceSettingsV1;
  readonly blockingReasons: readonly string[];
  readonly warnings: readonly string[];
  readonly requiresWorkspaceReplacementConfirmation: boolean;
}
