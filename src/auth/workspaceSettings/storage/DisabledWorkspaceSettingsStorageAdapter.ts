/**
 * DisabledWorkspaceSettingsStorageAdapter.ts
 *
 * No-op adapter used when workspace-settings storage is not configured.
 *
 * applyChangeSet always refuses (workspace settings cannot be persisted in
 * this mode).  All load/export/import operations return appropriate
 * not-found or unavailable results.
 *
 * This makes "Not saved" the safe zero-configuration default.
 */

import type {
  WorkspaceSettingsStorageAdapterV1,
  WorkspaceSettingsApplyResult,
  WorkspaceSettingsLoadResult,
  WorkspaceSettingsExportResult,
  WorkspaceSettingsImportResult,
  WorkspaceSettingsApplyContextV1,
} from './WorkspaceSettingsStorageAdapterV1';
import type { WorkspaceSettingsChangeSetV1 } from '../buildWorkspaceSettingsChangeSet';

/**
 * DisabledWorkspaceSettingsStorageAdapter
 *
 * No-op. No data is ever read or written.
 * applyChangeSet returns a clear refusal reason so the UI can display it.
 */
export class DisabledWorkspaceSettingsStorageAdapter
  implements WorkspaceSettingsStorageAdapterV1
{
  readonly target = 'disabled' as const;
  readonly label = 'Not saved — workspace settings storage is disabled.';

  async applyChangeSet(
    _changeSet: WorkspaceSettingsChangeSetV1,
    _context: WorkspaceSettingsApplyContextV1,
  ): Promise<WorkspaceSettingsApplyResult> {
    return { ok: false, reason: 'Storage is disabled — workspace settings cannot be applied.' };
  }

  async loadWorkspaceSettings(_workspaceId: string): Promise<WorkspaceSettingsLoadResult> {
    return { ok: false, notFound: true };
  }

  async exportWorkspaceSettings(_workspaceId: string): Promise<WorkspaceSettingsExportResult> {
    return { ok: false, reason: 'Storage is disabled — nothing to export.' };
  }

  async importWorkspaceSettings(_json: string): Promise<WorkspaceSettingsImportResult> {
    return { ok: false, reason: 'Storage is disabled — import has no effect.' };
  }
}
