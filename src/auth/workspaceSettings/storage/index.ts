/**
 * src/auth/workspaceSettings/storage/index.ts
 *
 * Public API for the workspace-settings storage adapter boundary.
 */

export { WORKSPACE_SETTINGS_SCHEMA_VERSION } from './PersistedWorkspaceSettingsV1';
export type {
  WorkspaceSettingsSchemaVersion,
  PersistedWorkspaceInviteV1,
  PersistedJoinRequestDecisionV1,
  PersistedWorkspaceSettingsV1,
} from './PersistedWorkspaceSettingsV1';

export type {
  WorkspaceSettingsStorageTarget,
  WorkspaceSettingsApplyContextV1,
  WorkspaceSettingsApplyResult,
  WorkspaceSettingsLoadResult,
  WorkspaceSettingsExportResult,
  WorkspaceSettingsImportResult,
  WorkspaceSettingsStorageAdapterV1,
} from './WorkspaceSettingsStorageAdapterV1';

export { DisabledWorkspaceSettingsStorageAdapter } from './DisabledWorkspaceSettingsStorageAdapter';
export { LocalWorkspaceSettingsStorageAdapter } from './LocalWorkspaceSettingsStorageAdapter';
export { GoogleDriveWorkspaceSettingsStorageAdapterStub } from './GoogleDriveWorkspaceSettingsStorageAdapterStub';
