/**
 * src/auth/profile/index.ts
 *
 * Public API for the Atlas auth profile and workspace boundary module.
 */

export type { AtlasUserProfileV1 } from './AtlasUserProfileV1';
export type {
  AtlasWorkspaceV1,
  WorkspaceStoragePreference,
} from './AtlasWorkspaceV1';
export type { WorkspaceBrandPolicy } from '../workspaceBrandPolicy';
export type {
  WorkspaceMembershipV1,
  WorkspaceMemberRole,
  WorkspaceMemberPermission,
} from './WorkspaceMembershipV1';
export { DEFAULT_PERMISSIONS_BY_ROLE } from './WorkspaceMembershipV1';
export type {
  AtlasVisitOwnershipV1,
  VisitStorageTarget,
} from './AtlasVisitOwnershipV1';
export { isUnownedVisit } from './AtlasVisitOwnershipV1';
export type { AtlasAuthUser } from './buildAtlasUserProfileFromAuthUser';
export { buildAtlasUserProfileFromAuthUser } from './buildAtlasUserProfileFromAuthUser';
export type {
  ResolveActiveWorkspaceInput,
  ResolveActiveWorkspaceResult,
} from './resolveActiveWorkspace';
export { resolveActiveWorkspace } from './resolveActiveWorkspace';
export { WorkspaceSessionGuard } from './WorkspaceSessionGuard';
export type { WorkspaceSessionStatus, WorkspaceSessionValue } from './WorkspaceSessionProvider';
export { WorkspaceSessionProvider, useWorkspaceSession } from './WorkspaceSessionProvider';
