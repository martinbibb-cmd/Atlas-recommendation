/**
 * WorkspaceMembershipV1.ts
 *
 * Describes a user's role and permission set within a single Atlas workspace.
 * A user may hold memberships in multiple workspaces; each is independent.
 *
 * Roles drive default permission bundles; individual permissions can be
 * further restricted or expanded by workspace admins in future tooling.
 */

// ─── Role ─────────────────────────────────────────────────────────────────────

/**
 * Coarse-grained role that captures a member's primary function within a
 * workspace.  Drives UI visibility, default exports, and assignment flows.
 *
 * owner     — full control; cannot be removed without transferring ownership.
 * admin     — all permissions except transferring ownership.
 * surveyor  — conducts site surveys and captures evidence.
 * engineer  — receives job packs and confirms installation tasks.
 * office    — reviews specifications, exports, and manages scheduling.
 * viewer    — read-only access to visits and workflow outputs.
 */
export type WorkspaceMemberRole =
  | 'owner'
  | 'admin'
  | 'surveyor'
  | 'engineer'
  | 'office'
  | 'viewer';

// ─── Permissions ──────────────────────────────────────────────────────────────

/**
 * Fine-grained capability flags that can be combined independently of role.
 *
 * view_visits            — list and open visits in the workspace.
 * edit_visits            — create, update, or delete visits.
 * export_workflows       — download implementation workflow packages.
 * review_specification   — approve/reject specification lines and scope packs.
 * manage_workspace       — rename workspace, add/remove members, change storage.
 * use_scan_handoff       — send and receive Atlas scan handoff packages.
 */
export type WorkspaceMemberPermission =
  | 'view_visits'
  | 'edit_visits'
  | 'export_workflows'
  | 'review_specification'
  | 'manage_workspace'
  | 'use_scan_handoff';

// ─── Membership ───────────────────────────────────────────────────────────────

/**
 * WorkspaceMembershipV1
 *
 * Binds a single user to a single workspace with a role and a set of
 * explicit permissions.  Stored inside both the user profile
 * (workspaceMemberships[]) and the workspace (members[]) so reads can
 * be satisfied from either side without a join.
 */
export interface WorkspaceMembershipV1 {
  /** Workspace this membership belongs to. */
  readonly workspaceId: string;

  /** Atlas user ID of the member. */
  readonly userId: string;

  /** Coarse role label used for display, assignment, and default filtering. */
  readonly role: WorkspaceMemberRole;

  /**
   * Explicit permission set granted to this member.
   * Prefer deriving from role via DEFAULT_PERMISSIONS_BY_ROLE for consistency,
   * but allow explicit overrides where needed.
   */
  readonly permissions: readonly WorkspaceMemberPermission[];
}

// ─── Default permissions by role ──────────────────────────────────────────────

/**
 * Canonical default permission bundles for each role.
 * These drive the auth bridge and resolver when no explicit permissions are
 * stored.  They can be overridden per-member when persisted.
 */
export const DEFAULT_PERMISSIONS_BY_ROLE: Readonly<
  Record<WorkspaceMemberRole, readonly WorkspaceMemberPermission[]>
> = {
  owner: [
    'view_visits',
    'edit_visits',
    'export_workflows',
    'review_specification',
    'manage_workspace',
    'use_scan_handoff',
  ],
  admin: [
    'view_visits',
    'edit_visits',
    'export_workflows',
    'review_specification',
    'manage_workspace',
    'use_scan_handoff',
  ],
  surveyor: ['view_visits', 'edit_visits', 'use_scan_handoff'],
  engineer: ['view_visits', 'export_workflows'],
  office: [
    'view_visits',
    'edit_visits',
    'export_workflows',
    'review_specification',
  ],
  viewer: ['view_visits'],
};
