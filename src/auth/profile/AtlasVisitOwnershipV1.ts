/**
 * AtlasVisitOwnershipV1.ts
 *
 * Binds a visit to its workspace and asserts which roles can access it.
 *
 * Atlas cannot safely answer "who owns this visit?", "where should it be
 * stored?", or "who can export it?" without this contract.  Every visit
 * created or imported in a workspace context should carry an ownership record.
 *
 * Visits without an ownership record are "unowned" — they exist in session
 * memory only and cannot be safely persisted, exported, or assigned.
 *
 * Non-goals:
 *   - no live ACL enforcement (server-side)
 *   - no encryption or audit log yet
 */

import type { WorkspaceMemberRole } from './WorkspaceMembershipV1';

// ─── Storage target ───────────────────────────────────────────────────────────

/**
 * Where this visit's workflow artefacts should be written.
 * Mirrors WorkspaceStoragePreference but scoped to the individual visit so
 * future overrides per-visit are possible.
 */
export type VisitStorageTarget = 'local_only' | 'google_drive' | 'disabled';

// ─── Visit ownership ──────────────────────────────────────────────────────────

/**
 * AtlasVisitOwnershipV1
 *
 * Ownership and access-control metadata for a single visit.
 * Embedded in PersistedImplementationWorkflowV1 and
 * WorkflowExportPackageManifestV1 so the workspace context travels with
 * every saved or exported artefact.
 */
export interface AtlasVisitOwnershipV1 {
  /**
   * Opaque visit reference this ownership record applies to.
   * Matches PersistedImplementationWorkflowV1.visitReference.
   */
  readonly visitReference: string;

  /**
   * Workspace this visit belongs to.
   * Empty string denotes an unowned / session-only visit.
   */
  readonly workspaceId: string;

  /** Atlas user ID of the user who created this visit. */
  readonly createdByUserId: string;

  /**
   * Atlas user ID of the surveyor assigned to conduct or review this visit.
   * Optional — may be assigned later or automatically from the creating user.
   */
  readonly assignedSurveyorUserId?: string;

  /**
   * Roles that can see this visit in lists and open it for reading.
   * Defaults to all roles when not specified.
   */
  readonly visibleToRoles: readonly WorkspaceMemberRole[];

  /**
   * Storage target resolved at visit creation from the workspace preference.
   * Determines which adapter is used for PersistedImplementationWorkflowV1.
   */
  readonly storageTarget: VisitStorageTarget;
}

// ─── Sentinel for unowned visits ──────────────────────────────────────────────

/**
 * Returns true when the given ownership record represents a visit that is
 * not bound to any workspace (session-only / demo mode).
 *
 * A visit is considered unowned when:
 *   - ownership is undefined/null, OR
 *   - workspaceId is empty, OR
 *   - createdByUserId is empty.
 */
export function isUnownedVisit(
  ownership: AtlasVisitOwnershipV1 | null | undefined,
): boolean {
  if (!ownership) return true;
  return ownership.workspaceId.trim() === '' || ownership.createdByUserId.trim() === '';
}
