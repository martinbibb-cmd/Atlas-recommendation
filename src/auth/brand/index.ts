/**
 * src/auth/brand/index.ts
 *
 * Public API for the workspace brand resolution session module.
 *
 * Consumers should import from this barrel rather than from individual files
 * to keep the public API stable as internals evolve.
 */

// ─── Pure resolver ────────────────────────────────────────────────────────────

export { resolveBrandForWorkspace } from './resolveBrandForWorkspace';
export type {
  BrandResolutionSource,
  ResolvableWorkspace,
  ResolvableUserProfile,
  ResolveBrandForWorkspaceInput,
  ResolveBrandForWorkspaceResult,
} from './resolveBrandForWorkspace';

// ─── React provider and hooks ─────────────────────────────────────────────────

export {
  WorkspaceBrandSessionProvider,
  useWorkspaceBrandSession,
  useOptionalWorkspaceBrandSession,
} from './WorkspaceBrandSessionProvider';
export type { WorkspaceBrandSessionValue } from './WorkspaceBrandSessionProvider';
