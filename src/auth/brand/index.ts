/**
 * src/auth/brand/index.ts
 *
 * Public API for the workspace brand resolution session.
 */

// ─── Resolver ─────────────────────────────────────────────────────────────────

export { resolveBrandForWorkspace } from './resolveBrandForWorkspace';
export type {
  BrandResolutionSource,
  ResolveBrandForWorkspaceInput,
  ResolveBrandForWorkspaceResult,
} from './resolveBrandForWorkspace';

// ─── Provider + hook ──────────────────────────────────────────────────────────

export {
  WorkspaceBrandSessionProvider,
  WorkspaceBrandSessionContext,
  useWorkspaceBrandSession,
  useOptionalWorkspaceBrandSession,
} from './WorkspaceBrandSessionProvider';
export type { WorkspaceBrandSessionValue } from './WorkspaceBrandSessionProvider';
