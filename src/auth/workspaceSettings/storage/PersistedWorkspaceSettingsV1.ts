/**
 * PersistedWorkspaceSettingsV1.ts
 *
 * Snapshot model written to localStorage when a workspace settings change-set
 * is applied locally.
 *
 * Contains the full resolved workspace record (name, slug, brand policy,
 * member permissions), plus lists of in-flight invites and processed join
 * request decisions.  These lists are additive — each apply call appends new
 * entries rather than replacing the previous set.
 *
 * Storage key:
 *   atlas:workspace-settings:v1:{workspaceId}
 */

import type { AtlasWorkspaceV1 } from '../../profile';
import type {
  WorkspaceMemberRole,
  WorkspaceMemberPermission,
} from '../../profile';

// ─── Schema version ───────────────────────────────────────────────────────────

export const WORKSPACE_SETTINGS_SCHEMA_VERSION = '1.0' as const;
export type WorkspaceSettingsSchemaVersion = typeof WORKSPACE_SETTINGS_SCHEMA_VERSION;

// ─── Sub-records ──────────────────────────────────────────────────────────────

/**
 * A simplified invite record written when an invite_created change is applied.
 * Not a full WorkspaceInviteV1 — the inviteId is generated locally and there
 * is no live email send.
 */
export interface PersistedWorkspaceInviteV1 {
  readonly inviteId: string;
  readonly workspaceId: string;
  readonly email: string;
  readonly role: WorkspaceMemberRole;
  readonly permissions: readonly WorkspaceMemberPermission[];
  /** ISO 8601 timestamp when this invite was written by the local apply. */
  readonly createdAt: string;
}

/**
 * A record of an admin decision on a join request.
 * Written when a join_request_approved or join_request_rejected change is applied.
 */
export interface PersistedJoinRequestDecisionV1 {
  readonly requestId: string;
  readonly decision: 'approved' | 'rejected';
  readonly role?: WorkspaceMemberRole;
  /** ISO 8601 timestamp when this decision was recorded. */
  readonly decidedAt: string;
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

/**
 * PersistedWorkspaceSettingsV1
 *
 * The full workspace settings snapshot persisted by the local adapter after a
 * successful applyChangeSet call.
 *
 * `workspace` carries the resolved identity, brand policy, storage preference,
 * and member permissions.  `invites` and `joinRequestDecisions` are appended on
 * each apply so history is preserved within the local snapshot.
 */
export interface PersistedWorkspaceSettingsV1 {
  readonly schemaVersion: WorkspaceSettingsSchemaVersion;
  readonly workspaceId: string;
  /** ISO 8601 timestamp of the most recent apply. */
  readonly savedAt: string;
  readonly workspace: AtlasWorkspaceV1;
  readonly invites: readonly PersistedWorkspaceInviteV1[];
  readonly joinRequestDecisions: readonly PersistedJoinRequestDecisionV1[];
}
