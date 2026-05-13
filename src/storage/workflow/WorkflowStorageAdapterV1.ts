/**
 * WorkflowStorageAdapterV1.ts
 *
 * Contract for pluggable implementation-workflow storage.
 *
 * Atlas = composer + renderer + workflow brain.
 * Storage = user's device or connected workspace storage.
 *
 * The adapter boundary means Atlas never owns long-term storage.
 * Concrete implementations:
 *   - LocalWorkflowStorageAdapter  — localStorage / IndexedDB (browser-local)
 *   - GoogleDriveWorkflowStorageAdapterStub — placeholder, not yet live
 *
 * Disabled mode:
 *   When target is 'disabled', the adapter accepts all calls but never reads
 *   or writes anything.  Workflow state is effectively transient for that session.
 */

import type { PersistedImplementationWorkflowV1 } from './PersistedImplementationWorkflowV1';

// ─── Storage targets ──────────────────────────────────────────────────────────

/**
 * Identifies which storage back-end is in use.
 *
 *   local_only    — browser localStorage / IndexedDB, local to this device
 *   google_drive  — user's Google Drive (requires connection, stub only for now)
 *   disabled      — no persistence; workflow state is session-only
 */
export type WorkflowStorageTarget = 'local_only' | 'google_drive' | 'disabled';

// ─── Result types ─────────────────────────────────────────────────────────────

export type WorkflowStorageSaveResult =
  | { readonly ok: true; readonly savedAt: string }
  | { readonly ok: false; readonly reason: string };

export type WorkflowStorageLoadResult =
  | { readonly ok: true; readonly state: PersistedImplementationWorkflowV1 }
  | { readonly ok: false; readonly notFound: true }
  | { readonly ok: false; readonly notFound: false; readonly reason: string };

export type WorkflowStorageDeleteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export type WorkflowStorageExportResult =
  | { readonly ok: true; readonly json: string }
  | { readonly ok: false; readonly reason: string };

export interface WorkflowStateListEntry {
  /** Opaque visit reference. */
  readonly visitReference: string;
  /** ISO 8601 timestamp of the most recent save. */
  readonly updatedAt: string;
  /** Human-readable label derived from the pack snapshot, if available. */
  readonly label: string;
}

// ─── Adapter contract ─────────────────────────────────────────────────────────

/**
 * WorkflowStorageAdapterV1
 *
 * All methods are async to allow adapters that need network or IPC access
 * (e.g. Google Drive) without changing the call-site interface.
 *
 * Implementors must:
 *   1. Set `target` to the correct WorkflowStorageTarget literal.
 *   2. Set `label` to a short human-readable description shown in the dev UI.
 *   3. Never throw — all errors are returned in the result types above.
 */
export interface WorkflowStorageAdapterV1 {
  /** Which storage back-end this adapter targets. */
  readonly target: WorkflowStorageTarget;

  /**
   * Short human-readable description shown in the UI, e.g.
   * "Local to this browser/device." or "Google Drive workspace (not configured)."
   */
  readonly label: string;

  /**
   * Persist a workflow state record.
   *
   * If a record for `state.visitReference` already exists it is overwritten.
   * Returns `{ ok: false }` if the write fails (e.g. storage quota exceeded).
   */
  saveWorkflowState(state: PersistedImplementationWorkflowV1): Promise<WorkflowStorageSaveResult>;

  /**
   * Load a previously saved workflow state by visit reference.
   *
   * Returns `{ ok: false, notFound: true }` when no record exists.
   * Returns `{ ok: false, notFound: false, reason }` on a read/parse error.
   */
  loadWorkflowState(visitReference: string): Promise<WorkflowStorageLoadResult>;

  /**
   * Delete a workflow state record by visit reference.
   *
   * Safe to call when no record exists — returns `{ ok: true }`.
   */
  deleteWorkflowState(visitReference: string): Promise<WorkflowStorageDeleteResult>;

  /**
   * List all workflow state records managed by this adapter.
   *
   * Returns an empty array when no records exist or the adapter is disabled.
   */
  listWorkflowStates(): Promise<readonly WorkflowStateListEntry[]>;

  /**
   * Serialise a workflow state record to a portable JSON string.
   *
   * Returns `{ ok: false }` if the record cannot be found or serialised.
   * The exported JSON can be imported via `importWorkflowState`.
   */
  exportWorkflowState(visitReference: string): Promise<WorkflowStorageExportResult>;

  /**
   * Parse and store a workflow state from a portable JSON string.
   *
   * Validates the schema version before writing.
   * Returns `{ ok: false }` if the JSON is invalid or the schema version is
   * incompatible.
   */
  importWorkflowState(json: string): Promise<WorkflowStorageSaveResult>;
}
