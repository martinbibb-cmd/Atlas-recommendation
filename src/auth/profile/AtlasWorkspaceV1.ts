/**
 * AtlasWorkspaceV1.ts
 *
 * The canonical Atlas workspace boundary model.
 *
 * A workspace groups visits, workflows, and exports under a single owner and
 * a shared storage preference.  Members interact with workspace resources
 * according to their WorkspaceMembershipV1 role and permissions.
 *
 * This model lives in src/auth/profile/ because workspace identity is the
 * companion to user-profile identity — both are resolved at session start
 * before any visit or workflow is loaded.
 *
 * Non-goals (for this model):
 *   - no live database read/write
 *   - no invite-flow fields
 *   - no billing or subscription state
 */

import type { WorkspaceMembershipV1 } from './WorkspaceMembershipV1';
export type { WorkspaceBrandPolicy } from '../workspaceBrandPolicy';
import type { WorkspaceBrandPolicy } from '../workspaceBrandPolicy';

// ─── Storage preference ───────────────────────────────────────────────────────

/**
 * Where this workspace's visits and workflow exports are persisted.
 *
 * local_only   — browser localStorage / downloaded JSON packages only.
 * google_drive — future Google Drive integration (adapter stub exists).
 * disabled     — no persistence; session-only / demo mode.
 */
export type WorkspaceStoragePreference = 'local_only' | 'google_drive' | 'disabled';

// ─── Workspace model ──────────────────────────────────────────────────────────

/**
 * AtlasWorkspaceV1
 *
 * Canonical workspace identity object.  Carried in the user profile
 * (workspaceMemberships[]) and resolved by resolveActiveWorkspace().
 */
export interface AtlasWorkspaceV1 {
  /** Stable UUID-style identifier for this workspace (e.g. "ws_abc123"). */
  readonly workspaceId: string;

  /** Human-readable display name (e.g. "Smith Heating Ltd"). */
  readonly name: string;

  /**
   * URL-safe slug derived from the name at creation time.
   * Used for route-level workspace resolution (/w/:slug).
   * Example: "smith-heating-ltd"
   */
  readonly slug: string;

  /** Atlas user ID of the workspace owner. */
  readonly ownerUserId: string;

  /**
   * Membership list for all current members of this workspace.
   * Includes the owner (role: 'owner').
   * Kept in sync with user-profile workspaceMemberships[] for offline access.
   */
  readonly members: readonly WorkspaceMembershipV1[];

  /**
   * Where visits and workflow exports for this workspace are stored.
   * Defaults to 'disabled' until the owner configures a target.
   */
  readonly storagePreference: WorkspaceStoragePreference;

  /** Workspace brand used by default for visits, exports, and portals. */
  readonly defaultBrandId: string;

  /** Brand IDs this workspace permits for user/session-level brand selection. */
  readonly allowedBrandIds: readonly string[];

  /** Whether brand is fixed to workspace default or user-selectable. */
  readonly brandPolicy: WorkspaceBrandPolicy;

  /** ISO 8601 timestamp of workspace creation. */
  readonly createdAt: string;

  /** ISO 8601 timestamp of the most recent workspace update. */
  readonly updatedAt: string;
}
