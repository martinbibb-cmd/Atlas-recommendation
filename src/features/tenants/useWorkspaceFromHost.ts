/**
 * src/features/tenants/useWorkspaceFromHost.ts
 *
 * React hook that resolves the active workspace from the browser host string.
 *
 * Resolves once at component initialisation by reading window.location.host.
 * Returns the atlas fallback in SSR / test environments where window is
 * unavailable.
 *
 * Usage
 * ─────
 *   const resolution = useWorkspaceFromHost();
 *   // resolution.brandId      — use as fallback brandId before a visit is active
 *   // resolution.workspaceSlug — display workspace identity indicator
 *   // resolution.source        — 'host' | 'fallback'
 */

import { useState } from 'react';
import { resolveWorkspaceFromHost } from './workspaceHost';
import type { WorkspaceHostResolutionV1 } from './workspaceHost';

// ─── SSR / test fallback ──────────────────────────────────────────────────────

const SSR_FALLBACK: WorkspaceHostResolutionV1 = {
  host: 'fallback',
  brandId: 'atlas-default',
  source: 'fallback',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useWorkspaceFromHost
 *
 * Returns a WorkspaceHostResolutionV1 derived from window.location.host.
 * The resolution is computed once at component initialisation and does not
 * react to subsequent host changes (the host does not change mid-session).
 */
export function useWorkspaceFromHost(): WorkspaceHostResolutionV1 {
  // Compute once via useState initialiser — host never changes mid-session.
  const [resolution] = useState<WorkspaceHostResolutionV1>(() => {
    if (typeof window === 'undefined') return SSR_FALLBACK;
    return resolveWorkspaceFromHost(window.location.host);
  });
  return resolution;
}
