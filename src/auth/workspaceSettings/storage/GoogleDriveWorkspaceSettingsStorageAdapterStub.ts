/**
 * GoogleDriveWorkspaceSettingsStorageAdapterStub.ts
 *
 * Placeholder adapter for Google Drive workspace-settings storage.
 *
 * No live Google Drive API is connected.
 * All operations return { ok: false, reason: "Google Drive connection not configured." }
 *
 * This stub exists to:
 *   1. Lock in the adapter interface for the Google Drive target.
 *   2. Allow the UI to show "Google Drive workspace" as a future option
 *      without risking silent data loss.
 *   3. Establish the integration point for when the live API is wired.
 *
 * Non-goals:
 *   - No live Google Drive API calls.
 *   - No OAuth flow.
 *   - No automatic cloud sync.
 *
 * When the live adapter is ready, replace this file with a concrete
 * implementation that satisfies WorkspaceSettingsStorageAdapterV1.
 * The UI and call-sites need no changes.
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

const UNAVAILABLE_REASON = 'Google Drive connection not configured.';

/**
 * GoogleDriveWorkspaceSettingsStorageAdapterStub
 *
 * Returns `{ ok: false, reason: "Google Drive connection not configured." }`
 * for all write/read operations.
 *
 * This stub does NOT pretend to save or load anything.
 */
export class GoogleDriveWorkspaceSettingsStorageAdapterStub
  implements WorkspaceSettingsStorageAdapterV1
{
  readonly target = 'google_drive' as const;
  readonly label = 'Google Drive workspace (not configured).';

  async applyChangeSet(
    _changeSet: WorkspaceSettingsChangeSetV1,
    _context: WorkspaceSettingsApplyContextV1,
  ): Promise<WorkspaceSettingsApplyResult> {
    return { ok: false, reason: UNAVAILABLE_REASON };
  }

  async loadWorkspaceSettings(_workspaceId: string): Promise<WorkspaceSettingsLoadResult> {
    return { ok: false, notFound: false, reason: UNAVAILABLE_REASON };
  }

  async exportWorkspaceSettings(_workspaceId: string): Promise<WorkspaceSettingsExportResult> {
    return { ok: false, reason: UNAVAILABLE_REASON };
  }

  async importWorkspaceSettings(_json: string): Promise<WorkspaceSettingsImportResult> {
    return { ok: false, reason: UNAVAILABLE_REASON };
  }
}
