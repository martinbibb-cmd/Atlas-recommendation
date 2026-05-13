/**
 * WorkspaceJoinRequestV1.ts
 *
 * A request made by an unapproved user to join a workspace.
 * Admins and owners can approve or reject requests.
 * Requests expire after a configurable duration (enforced at review time).
 *
 * Non-goals:
 *   - no email sending
 *   - no real backend persistence
 *   - no production token flow
 */

import type { WorkspaceMemberRole } from '../profile/WorkspaceMembershipV1';

// ─── Status ───────────────────────────────────────────────────────────────────

/**
 * Lifecycle status of a workspace join request.
 *
 * pending  — submitted, awaiting admin review.
 * approved — accepted by an admin/owner; user is now a member.
 * rejected — declined by an admin/owner.
 * expired  — not reviewed before the expiry window elapsed.
 */
export type WorkspaceJoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// ─── Model ────────────────────────────────────────────────────────────────────

/**
 * WorkspaceJoinRequestV1
 *
 * Represents a single request for a user to join a workspace.
 * The requesting user may already have an Atlas userId (logged-in user
 * requesting access), or the request may be email-only (prospective user).
 */
export interface WorkspaceJoinRequestV1 {
  /** Stable identifier for this request (e.g. "req_abc123"). */
  readonly requestId: string;

  /** Workspace the user is requesting to join. */
  readonly workspaceId: string;

  /** Email address of the requesting party. */
  readonly email: string;

  /**
   * Atlas userId of the requester, if they already have an account.
   * Absent for email-only pre-registration requests.
   */
  readonly userId?: string;

  /**
   * Role the requester is asking for, if they specified a preference.
   * Defaults to 'viewer' when an admin approves without overriding.
   */
  readonly requestedRole?: WorkspaceMemberRole;

  /** ISO 8601 timestamp of when the request was submitted. */
  readonly requestedAt: string;

  /** Current lifecycle status. */
  readonly status: WorkspaceJoinRequestStatus;

  /** Atlas userId of the admin/owner who reviewed the request. */
  readonly reviewedByUserId?: string;

  /** ISO 8601 timestamp of the review decision. */
  readonly reviewedAt?: string;

  /** Optional notes left by the reviewer (visible to admin only). */
  readonly notes?: string;
}
