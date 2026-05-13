/**
 * WorkspaceInviteV1.ts
 *
 * An invitation sent by an admin/owner to a prospective workspace member.
 * The invite carries a pre-assigned role and permission set so the recipient
 * is immediately provisioned upon acceptance.
 *
 * Non-goals:
 *   - no email sending
 *   - no real backend persistence
 *   - no production invite token flow
 */

import type {
  WorkspaceMemberRole,
  WorkspaceMemberPermission,
} from '../profile/WorkspaceMembershipV1';

// ─── Status ───────────────────────────────────────────────────────────────────

/**
 * Lifecycle status of a workspace invite.
 *
 * pending  — sent, awaiting recipient action.
 * accepted — recipient joined; a WorkspaceMembershipV1 was created.
 * revoked  — cancelled by an admin/owner before acceptance.
 * expired  — not accepted before expiresAt elapsed.
 */
export type WorkspaceInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

// ─── Model ────────────────────────────────────────────────────────────────────

/**
 * WorkspaceInviteV1
 *
 * Represents a single outbound invite from a workspace admin or owner.
 * On acceptance the invited user receives the specified role and permissions.
 */
export interface WorkspaceInviteV1 {
  /** Stable identifier for this invite (e.g. "inv_abc123"). */
  readonly inviteId: string;

  /** Workspace this invite grants access to. */
  readonly workspaceId: string;

  /** Email address the invite was sent to. */
  readonly email: string;

  /** Role that will be assigned to the user upon acceptance. */
  readonly role: WorkspaceMemberRole;

  /**
   * Explicit permission set to grant on acceptance.
   * Typically pre-filled from DEFAULT_PERMISSIONS_BY_ROLE[role] but may be
   * customised by the admin before sending.
   */
  readonly permissions: readonly WorkspaceMemberPermission[];

  /** Atlas userId of the admin/owner who sent the invite. */
  readonly invitedByUserId: string;

  /** ISO 8601 timestamp of when the invite was created. */
  readonly invitedAt: string;

  /**
   * ISO 8601 timestamp after which the invite should be treated as expired.
   * Enforcement is at read/display time; no automated background expiry job.
   */
  readonly expiresAt: string;

  /** Current lifecycle status. */
  readonly status: WorkspaceInviteStatus;
}
