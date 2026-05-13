/**
 * WorkspaceSettingsStorageAdapterV1.ts
 *
 * Contract for pluggable workspace-settings storage.
 *
 * The adapter boundary means Atlas never owns long-term persistence of workspace
 * settings — concrete implementations decide where the data lives.
 *
 * Concrete implementations:
 *   - LocalWorkspaceSettingsStorageAdapter  — browser localStorage, scoped by workspaceId
 *   - GoogleDriveWorkspaceSettingsStorageAdapterStub — placeholder, never applies
 *   - DisabledWorkspaceSettingsStorageAdapter — no-op default
 *
 * Disabled mode:
 *   When target is 'disabled', the adapter refuses all apply/write operations.
 */

import type { WorkspaceJoinRequestV1 } from '../../workspaceOnboarding';
import type { AtlasWorkspaceV1 } from '../../profile';
import type { WorkspaceSettingsChangeSetV1 } from '../buildWorkspaceSettingsChangeSet';
import type { WorkspaceSettingsDraftV1 } from '../WorkspaceSettingsDraftV1';
import type { PersistedWorkspaceSettingsV1 } from './PersistedWorkspaceSettingsV1';

// ─── Storage targets ──────────────────────────────────────────────────────────

/**
 * Identifies which storage back-end is in use.
 *
 *   local_only    — browser localStorage, local to this device
 *   google_drive  — workspace Google Drive (requires connection, stub only)
 *   disabled      — no persistence; apply is refused
 */
export type WorkspaceSettingsStorageTarget = 'local_only' | 'google_drive' | 'disabled';

// ─── Apply context ────────────────────────────────────────────────────────────

/**
 * Context required by applyChangeSet to reconstruct the post-apply workspace
 * state.  The changeSet is used as the commit gate (canCommit); the draft and
 * current state supply the concrete values to persist.
 */
export interface WorkspaceSettingsApplyContextV1 {
  /** The draft containing the desired new values for workspace, brand, members,
   *  invites, and join-request decisions. */
  readonly draft: WorkspaceSettingsDraftV1;
  /** The workspace record as it currently stands (before this apply). */
  readonly currentWorkspace: AtlasWorkspaceV1;
  /** Pending join requests against which decisions in the draft are resolved. */
  readonly currentJoinRequests: readonly WorkspaceJoinRequestV1[];
}

// ─── Result types ─────────────────────────────────────────────────────────────

export type WorkspaceSettingsApplyResult =
  | { readonly ok: true; readonly savedAt: string; readonly snapshot: PersistedWorkspaceSettingsV1 }
  | { readonly ok: false; readonly reason: string };

export type WorkspaceSettingsLoadResult =
  | { readonly ok: true; readonly snapshot: PersistedWorkspaceSettingsV1 }
  | { readonly ok: false; readonly notFound: true }
  | { readonly ok: false; readonly notFound: false; readonly reason: string };

export type WorkspaceSettingsExportResult =
  | { readonly ok: true; readonly json: string }
  | { readonly ok: false; readonly reason: string };

export type WorkspaceSettingsImportResult =
  | { readonly ok: true; readonly snapshot: PersistedWorkspaceSettingsV1 }
  | { readonly ok: false; readonly reason: string };

// ─── Adapter contract ─────────────────────────────────────────────────────────

/**
 * WorkspaceSettingsStorageAdapterV1
 *
 * All methods are async to allow adapters that need network or IPC access
 * without changing the call-site interface.
 *
 * Implementors must:
 *   1. Set `target` to the correct WorkspaceSettingsStorageTarget literal.
 *   2. Set `label` to a short human-readable description shown in the UI.
 *   3. Never throw — all errors are returned in the result types above.
 */
export interface WorkspaceSettingsStorageAdapterV1 {
  /** Which storage back-end this adapter targets. */
  readonly target: WorkspaceSettingsStorageTarget;

  /**
   * Short human-readable description shown in the UI.
   */
  readonly label: string;

  /**
   * Apply a validated change-set to the stored workspace settings.
   *
   * Will refuse (return `{ ok: false }`) when:
   *   - `changeSet.canCommit === false`
   *   - The adapter is disabled or unavailable
   *
   * On success, the resulting snapshot is written to storage and returned.
   */
  applyChangeSet(
    changeSet: WorkspaceSettingsChangeSetV1,
    context: WorkspaceSettingsApplyContextV1,
  ): Promise<WorkspaceSettingsApplyResult>;

  /**
   * Load the most recently persisted workspace settings snapshot.
   *
   * Returns `{ ok: false, notFound: true }` when no record exists.
   * Returns `{ ok: false, notFound: false, reason }` on a read/parse error.
   */
  loadWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettingsLoadResult>;

  /**
   * Serialise the stored workspace settings snapshot to a portable JSON string.
   *
   * Returns `{ ok: false }` if no record exists or serialisation fails.
   */
  exportWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettingsExportResult>;

  /**
   * Parse and store a workspace settings snapshot from a portable JSON string.
   *
   * Validates the schema version before writing.
   * Returns `{ ok: false }` if the JSON is invalid or schema version mismatches.
   */
  importWorkspaceSettings(json: string): Promise<WorkspaceSettingsImportResult>;
}
