/**
 * DisabledWorkflowStorageAdapter.ts
 *
 * No-op adapter used when storage mode is 'disabled'.
 *
 * All write operations accept the call silently and return ok: true (for saves)
 * or ok: false / notFound (for reads) so the workflow can still function without
 * any storage being configured.
 *
 * This makes "Not saved" the correct zero-configuration default — the session
 * stays fully transient, which matches the existing dev tool behaviour.
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

/**
 * DisabledWorkflowStorageAdapter
 *
 * No-op. No data is ever read or written.
 * save returns a synthetic savedAt so callers can log it without crashing.
 */
export class DisabledWorkflowStorageAdapter implements WorkflowStorageAdapterV1 {
  readonly target = 'disabled' as const;
  readonly label = 'Not saved — workflow state is session-only.';

  async saveWorkflowState(_state: PersistedImplementationWorkflowV1): Promise<WorkflowStorageSaveResult> {
    return { ok: true, savedAt: new Date().toISOString() };
  }

  async loadWorkflowState(_visitReference: string): Promise<WorkflowStorageLoadResult> {
    return { ok: false, notFound: true };
  }

  async deleteWorkflowState(_visitReference: string): Promise<WorkflowStorageDeleteResult> {
    return { ok: true };
  }

  async listWorkflowStates(): Promise<readonly WorkflowStateListEntry[]> {
    return [];
  }

  async exportWorkflowState(_visitReference: string): Promise<WorkflowStorageExportResult> {
    return { ok: false, reason: 'Storage is disabled — nothing to export.' };
  }

  async importWorkflowState(_json: string): Promise<WorkflowStorageSaveResult> {
    return { ok: false, reason: 'Storage is disabled — import has no effect.' };
  }
}
