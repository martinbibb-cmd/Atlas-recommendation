/**
 * defaultWorkspace.ts
 *
 * Exports the default WorkspaceProvider singleton used by Atlas Mind.
 *
 * Default: LocalWorkspaceProvider (file-based, IndexedDB-backed).
 *
 * Switching backends
 * ──────────────────
 * To switch to the remote API backend:
 *
 *   import { RemoteWorkspaceProvider } from './RemoteWorkspaceProvider';
 *   export const defaultWorkspace = new RemoteWorkspaceProvider();
 *
 * The switch requires no changes to any call-site because both providers
 * implement the same WorkspaceProvider interface.
 *
 * Singleton pattern
 * ─────────────────
 * A single shared instance is exported so the underlying Dexie database
 * is only opened once per page lifecycle, matching the singleton pattern
 * used by atlasDb.ts.
 */

import { LocalWorkspaceProvider } from './LocalWorkspaceProvider';
import type { WorkspaceProvider } from './WorkspaceProvider';

/**
 * The default workspace singleton.
 *
 * All Atlas Mind features that need to read or write visit data should
 * import this value rather than instantiating their own provider.
 *
 * @example
 * import { defaultWorkspace } from 'src/lib/workspace/defaultWorkspace';
 * const visits = await defaultWorkspace.listVisits();
 */
export const defaultWorkspace: WorkspaceProvider = new LocalWorkspaceProvider();
