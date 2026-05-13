/**
 * GoogleDriveWorkflowStorageAdapterStub.ts
 *
 * Placeholder adapter for Google Drive workspace storage.
 *
 * No live Google Drive API is connected.
 * All operations return { ok: false, reason: "Google Drive connection not configured." }
 *
 * This stub exists to:
 *   1. Lock in the adapter interface for the Google Drive target.
 *   2. Allow the UI storage mode selector to show "Google Drive workspace" as an
 *      option without risking silent data loss — the user sees a clear error.
 *   3. Establish the integration point for when the live API is wired.
 *
 * Non-goals:
 *   - No live Google Drive API calls.
 *   - No OAuth flow.
 *   - No automatic cloud sync.
 *
 * When the live adapter is ready, replace this file with a concrete implementation
 * that satisfies WorkflowStorageAdapterV1.  The UI and call-sites need no changes.
 */

import type {
  WorkflowStorageAdapterV1,
  WorkflowStorageDeleteResult,
  WorkflowStorageExportResult,
  WorkflowStorageLoadResult,
  WorkflowStorageSaveResult,
  WorkflowStateListEntry,
} from './WorkflowStorageAdapterV1';
import type { PersistedImplementationWorkflowV1 } from './PersistedImplementationWorkflowV1';

const UNAVAILABLE_REASON = 'Google Drive connection not configured.';

/**
 * GoogleDriveWorkflowStorageAdapterStub
 *
 * Returns `{ ok: false, reason: "Google Drive connection not configured." }` for
 * all write/read operations.  listWorkflowStates returns an empty array.
 *
 * This stub does NOT pretend to save or load anything.
 */
export class GoogleDriveWorkflowStorageAdapterStub implements WorkflowStorageAdapterV1 {
  readonly target = 'google_drive' as const;
  readonly label = 'Google Drive workspace (not configured).';

  async saveWorkflowState(_state: PersistedImplementationWorkflowV1): Promise<WorkflowStorageSaveResult> {
    return { ok: false, reason: UNAVAILABLE_REASON };
  }

  async loadWorkflowState(_visitReference: string): Promise<WorkflowStorageLoadResult> {
    return { ok: false, notFound: false, reason: UNAVAILABLE_REASON };
  }

  async deleteWorkflowState(_visitReference: string): Promise<WorkflowStorageDeleteResult> {
    return { ok: false, reason: UNAVAILABLE_REASON };
  }

  async listWorkflowStates(): Promise<readonly WorkflowStateListEntry[]> {
    return [];
  }

  async exportWorkflowState(_visitReference: string): Promise<WorkflowStorageExportResult> {
    return { ok: false, reason: UNAVAILABLE_REASON };
  }

  async importWorkflowState(_json: string): Promise<WorkflowStorageSaveResult> {
    return { ok: false, reason: UNAVAILABLE_REASON };
  }
}
