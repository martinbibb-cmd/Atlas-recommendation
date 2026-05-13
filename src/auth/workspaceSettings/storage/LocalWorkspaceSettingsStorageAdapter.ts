/**
 * LocalWorkspaceSettingsStorageAdapter.ts
 *
 * Workspace-settings storage backed by browser localStorage.
 *
 * Clearly labelled: "Local to this browser/device."
 * Data does NOT leave the device unless the user explicitly exports it.
 *
 * Storage key pattern:
 *   atlas:workspace-settings:v1:{workspaceId}
 *
 * On each applyChangeSet the full resolved snapshot is written, including:
 *   - workspace record (name, slug, brand policy, storage preference, members)
 *   - invite records (appended per apply)
 *   - join request decisions (appended per apply)
 *
 * Future upgrade path:
 *   Replace the `getStorage()` helper with an IndexedDB wrapper if payloads
 *   grow beyond localStorage limits.  The adapter interface stays the same.
 */

import type { AtlasWorkspaceV1, WorkspaceMembershipV1 } from '../../profile';
import type { WorkspaceSettingsChangeSetV1 } from '../buildWorkspaceSettingsChangeSet';
import {
  WORKSPACE_SETTINGS_SCHEMA_VERSION,
  type PersistedWorkspaceSettingsV1,
  type PersistedWorkspaceInviteV1,
  type PersistedJoinRequestDecisionV1,
} from './PersistedWorkspaceSettingsV1';
import type {
  WorkspaceSettingsStorageAdapterV1,
  WorkspaceSettingsApplyResult,
  WorkspaceSettingsLoadResult,
  WorkspaceSettingsExportResult,
  WorkspaceSettingsImportResult,
  WorkspaceSettingsApplyContextV1,
} from './WorkspaceSettingsStorageAdapterV1';

// ─── Storage key helpers ──────────────────────────────────────────────────────

const RECORD_KEY_PREFIX = 'atlas:workspace-settings:v1:';

function recordKey(workspaceId: string): string {
  return `${RECORD_KEY_PREFIX}${workspaceId}`;
}

// ─── localStorage access ──────────────────────────────────────────────────────

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // localStorage unavailable (e.g. private browsing with cookies blocked).
  }
  return null;
}

// ─── Schema validation ────────────────────────────────────────────────────────

function isValidSchema(parsed: unknown): parsed is PersistedWorkspaceSettingsV1 {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;
  return (
    obj['schemaVersion'] === WORKSPACE_SETTINGS_SCHEMA_VERSION &&
    typeof obj['workspaceId'] === 'string' &&
    typeof obj['savedAt'] === 'string' &&
    typeof obj['workspace'] === 'object' &&
    obj['workspace'] !== null
  );
}

// ─── ID generation ────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${ts}${rand}`;
}

// ─── Apply helpers ────────────────────────────────────────────────────────────

function buildUpdatedSnapshot(
  context: WorkspaceSettingsApplyContextV1,
  previous: PersistedWorkspaceSettingsV1 | null,
  savedAt: string,
): PersistedWorkspaceSettingsV1 {
  const { draft, currentWorkspace } = context;

  // ── Apply member permission edits ────────────────────────────────────────
  const editsByUserId = new Map(draft.memberPermissionEdits.map((e) => [e.userId, e]));
  const updatedMembers: readonly WorkspaceMembershipV1[] = currentWorkspace.members.map(
    (member) => {
      const edit = editsByUserId.get(member.userId);
      if (!edit) return member;
      return { ...member, role: edit.role, permissions: edit.permissions };
    },
  );

  // ── Build updated workspace record ───────────────────────────────────────
  // Spread currentWorkspace to preserve identity fields (workspaceId, ownerUserId,
  // createdAt) that are not part of the draft, then override the settable fields.
  const updatedWorkspace: AtlasWorkspaceV1 = {
    ...currentWorkspace,
    name: draft.workspace.name.trim(),
    slug: draft.workspace.slug.trim(),
    brandPolicy: draft.brand.policy,
    defaultBrandId: draft.brand.defaultBrandId.trim(),
    allowedBrandIds: draft.brand.allowedBrandIds,
    storagePreference: draft.storagePreference,
    members: updatedMembers,
    updatedAt: savedAt,
  };

  // ── Build invite records from draft ─────────────────────────────────────
  const newInvites: PersistedWorkspaceInviteV1[] = draft.inviteDrafts.map((invite) => ({
    inviteId: generateId('inv'),
    workspaceId: draft.workspaceId,
    email: invite.email.trim(),
    role: invite.role,
    permissions: invite.permissions,
    createdAt: savedAt,
  }));

  const previousInvites = previous?.invites ?? [];

  // ── Build join request decision records ─────────────────────────────────
  const newDecisions: PersistedJoinRequestDecisionV1[] = draft.joinRequestDecisions.map(
    (decision) => ({
      requestId: decision.requestId,
      decision: decision.decision,
      role: decision.role,
      decidedAt: savedAt,
    }),
  );

  const previousDecisions = previous?.joinRequestDecisions ?? [];
  // Replace any existing decision for the same requestId, then append new ones
  const existingRequestIds = new Set(newDecisions.map((d) => d.requestId));
  const retainedDecisions = previousDecisions.filter(
    (d) => !existingRequestIds.has(d.requestId),
  );

  return {
    schemaVersion: WORKSPACE_SETTINGS_SCHEMA_VERSION,
    workspaceId: draft.workspaceId,
    savedAt,
    workspace: updatedWorkspace,
    invites: [...previousInvites, ...newInvites],
    joinRequestDecisions: [...retainedDecisions, ...newDecisions],
  };
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * LocalWorkspaceSettingsStorageAdapter
 *
 * Stores workspace settings snapshots in browser localStorage.
 * Clearly labelled: "Local to this browser/device."
 *
 * Construct one instance and share it for the lifetime of the session.
 * All methods are async for interface consistency (no actual async I/O needed).
 */
export class LocalWorkspaceSettingsStorageAdapter
  implements WorkspaceSettingsStorageAdapterV1
{
  readonly target = 'local_only' as const;
  readonly label = 'Local to this browser/device.';

  async applyChangeSet(
    changeSet: WorkspaceSettingsChangeSetV1,
    context: WorkspaceSettingsApplyContextV1,
  ): Promise<WorkspaceSettingsApplyResult> {
    if (!changeSet.canCommit) {
      return {
        ok: false,
        reason: 'Cannot apply: the change-set has blocking reasons that must be resolved first.',
      };
    }

    const storage = getStorage();
    if (!storage) {
      return { ok: false, reason: 'localStorage is not available in this browser context.' };
    }

    const savedAt = new Date().toISOString();

    // Load previous snapshot so we can append invites/decisions to history
    let previous: PersistedWorkspaceSettingsV1 | null = null;
    try {
      const raw = storage.getItem(recordKey(context.draft.workspaceId));
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (isValidSchema(parsed)) {
          previous = parsed;
        }
      }
    } catch {
      // Ignore parse errors on the previous snapshot — start fresh
    }

    const snapshot = buildUpdatedSnapshot(context, previous, savedAt);

    try {
      storage.setItem(recordKey(context.draft.workspaceId), JSON.stringify(snapshot));
      return { ok: true, savedAt, snapshot };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `Write failed: ${message}` };
    }
  }

  async loadWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettingsLoadResult> {
    const storage = getStorage();
    if (!storage) {
      return {
        ok: false,
        notFound: false,
        reason: 'localStorage is not available in this browser context.',
      };
    }
    try {
      const raw = storage.getItem(recordKey(workspaceId));
      if (raw === null) {
        return { ok: false, notFound: true };
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isValidSchema(parsed)) {
        return {
          ok: false,
          notFound: false,
          reason: `Schema version mismatch or invalid record. Expected schemaVersion "${WORKSPACE_SETTINGS_SCHEMA_VERSION}".`,
        };
      }
      return { ok: true, snapshot: parsed };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, notFound: false, reason: `Read failed: ${message}` };
    }
  }

  async exportWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettingsExportResult> {
    const result = await this.loadWorkspaceSettings(workspaceId);
    if (!result.ok) {
      if (result.notFound) {
        return {
          ok: false,
          reason: `No saved workspace settings found for workspace "${workspaceId}".`,
        };
      }
      return { ok: false, reason: result.reason };
    }
    try {
      const json = JSON.stringify(result.snapshot, null, 2);
      return { ok: true, json };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `Serialization failed: ${message}` };
    }
  }

  async importWorkspaceSettings(json: string): Promise<WorkspaceSettingsImportResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ok: false, reason: 'Import failed: invalid JSON.' };
    }
    if (!isValidSchema(parsed)) {
      return {
        ok: false,
        reason: `Import failed: schema version mismatch or missing required fields. Expected schemaVersion "${WORKSPACE_SETTINGS_SCHEMA_VERSION}".`,
      };
    }
    const storage = getStorage();
    if (!storage) {
      return { ok: false, reason: 'localStorage is not available in this browser context.' };
    }
    try {
      storage.setItem(recordKey(parsed.workspaceId), JSON.stringify(parsed));
      return { ok: true, snapshot: parsed };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `Write failed: ${message}` };
    }
  }
}
