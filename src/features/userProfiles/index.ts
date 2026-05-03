/**
 * src/features/userProfiles/index.ts
 *
 * Public barrel for the userProfiles module.
 *
 * Consumers should import from this file rather than from individual modules
 * to keep the public API stable as internals evolve.
 *
 * Note: contract types (UserProfileV1, UserRoleV1, UserWorkspaceMembershipV1)
 * are not re-exported here to avoid shadow type surfaces — consumers should
 * import them directly from userProfile.ts.
 */

// ─── Store ────────────────────────────────────────────────────────────────────

export {
  USER_PROFILE_STORE_KEY,
  loadUserProfileStore,
  saveUserProfileStore,
  upsertUserProfile,
  getUserProfile,
  deleteUserProfile,
  listUserProfiles,
} from './userProfileStore';

// ─── Active user ──────────────────────────────────────────────────────────────

export {
  ACTIVE_USER_STORE_KEY,
  getActiveUserId,
  setActiveUserId,
  clearActiveUserId,
} from './activeUserStore';

// ─── React context ────────────────────────────────────────────────────────────

export { ActiveUserProvider, ActiveUserContext } from './ActiveUserProvider';
export type { ActiveUserContextValue } from './ActiveUserProvider';
export { useActiveUser } from './useActiveUser';

// ─── Permissions ──────────────────────────────────────────────────────────────

export { useRolePermissions } from './useRolePermissions';
export type { RolePermissions } from './useRolePermissions';

// ─── UI ───────────────────────────────────────────────────────────────────────

export { UserProfilePanel } from './UserProfilePanel';

