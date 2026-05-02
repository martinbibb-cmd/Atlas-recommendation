/**
 * src/lib/storage/adapterFactory.ts
 *
 * Centralised adapter selection for Atlas storage.
 *
 * The local (browser localStorage / sessionStorage) adapter is the default
 * and remains unchanged for all existing browser behaviour.  A Cloudflare D1
 * adapter can be activated by passing a D1DatabaseLike binding.
 *
 * Usage
 * ─────
 * Browser / local mode (default — no change needed):
 *
 *   import { localAdapter } from './localStorageAdapter';
 *   // stores continue to use localAdapter directly
 *
 * Server / Cloudflare Workers context (opt-in):
 *
 *   import { resolveStorageAdapter } from './adapterFactory';
 *   const adapter = resolveStorageAdapter({ d1: env.ATLAS_REPORTS_D1 });
 *
 * When a D1 binding is supplied the factory returns a D1StorageAdapter.
 * When no binding is supplied (or when VITE_STORAGE_ADAPTER !== 'd1') it
 * falls back to the localAdapter singleton.
 *
 * Feature flag
 * ────────────
 * Set VITE_STORAGE_ADAPTER=d1 in your .dev.vars / environment to signal that
 * the D1 adapter should be preferred when a binding is available.  Omitting
 * the variable (or setting it to 'local') keeps the default local behaviour.
 *
 * Design rules
 * ────────────
 * - No React dependencies.
 * - No auth, billing, or engine logic.
 * - Adapter selection is the only concern of this module.
 */

import type { StorageAdapter } from './storageAdapter';
import { localAdapter } from './localStorageAdapter';
import { D1StorageAdapter } from './d1Adapter';
import type { D1DatabaseLike } from './d1Adapter';

// ─── Re-export for convenience ────────────────────────────────────────────────

export type { D1DatabaseLike };

// ─── Feature flag ─────────────────────────────────────────────────────────────

/**
 * True when the D1 adapter is requested via the VITE_STORAGE_ADAPTER env var.
 *
 * This flag is evaluated at module-load time and is intended for server-side
 * (Workers) builds where Vite env vars are inlined.  In browser builds the
 * flag is always false unless explicitly overridden in the build environment.
 */
export const D1_ADAPTER_REQUESTED: boolean =
  typeof import.meta !== 'undefined' &&
  typeof import.meta.env !== 'undefined' &&
  import.meta.env['VITE_STORAGE_ADAPTER'] === 'd1';

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Options accepted by resolveStorageAdapter.
 */
export interface ResolveStorageAdapterOptions {
  /**
   * A Cloudflare D1 binding (e.g. env.ATLAS_REPORTS_D1).
   * When present and the D1 adapter is enabled, a D1StorageAdapter is returned.
   * Omit to always use the local adapter.
   */
  d1?: D1DatabaseLike;
}

/**
 * Returns the appropriate StorageAdapter for the current runtime context.
 *
 * Decision matrix:
 *   d1 binding present AND (VITE_STORAGE_ADAPTER === 'd1' OR forceD1 = true)
 *     → D1StorageAdapter
 *   otherwise
 *     → localAdapter (browser localStorage/sessionStorage, default)
 *
 * @param options  Optional binding injection.
 * @param forceD1  Bypass the env flag check — useful in Workers handlers that
 *                 always want D1 when a binding is available.
 */
export function resolveStorageAdapter(
  options?: ResolveStorageAdapterOptions,
  forceD1 = false,
): StorageAdapter {
  if (options?.d1 != null && (D1_ADAPTER_REQUESTED || forceD1)) {
    return new D1StorageAdapter(options.d1);
  }
  return localAdapter;
}
