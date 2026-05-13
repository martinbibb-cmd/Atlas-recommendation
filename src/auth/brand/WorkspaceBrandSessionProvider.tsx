/* eslint-disable react-refresh/only-export-components */
/**
 * src/auth/brand/WorkspaceBrandSessionProvider.tsx
 *
 * Resolves the single authoritative active brand for the current workspace
 * session and exposes it via React context.
 *
 * Resolution chain (delegated to resolveBrandForWorkspace):
 *   locked policy           → workspace default only
 *   route_override          → routeBrandId when in allowedBrandIds
 *   user_preference         → stored user preference when in allowedBrandIds
 *   workspace_default       → workspace's own defaultBrandId
 *   no workspace            → atlas-default
 *
 * Exposed via context:
 *   activeBrandId           — the resolved brand identifier
 *   activeBrandProfile      — full BrandProfileV1 for the active brand
 *   resolutionSource        — how the brand was selected
 *   warnings                — non-fatal resolution warnings (empty in happy path)
 *   activeWorkspace         — the current workspace (null when not authenticated)
 *   setPreferredBrandForWorkspace(workspaceId, brandId) — persist a user pref
 *
 * Design rules
 * ────────────
 * - Brand preferences are stored under BRAND_PREFS_STORE_KEY in localStorage.
 * - Re-reads the brand registry on each render via listStoredBrandProfiles() so
 *   newly stored custom profiles are always picked up without a page reload.
 * - No circular dependency with BrandProvider — consumers import separately.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { BrandProfileV1 } from '../../features/branding/brandProfile';
import { listStoredBrandProfiles } from '../../features/branding/brandProfileStore';
import {
  resolveBrandForWorkspace,
  type BrandResolutionSource,
  type ResolvableWorkspace,
} from './resolveBrandForWorkspace';
import { useWorkspaceSession } from '../profile/WorkspaceSessionProvider';

// ─── Storage key for user brand preferences ───────────────────────────────────

const BRAND_PREFS_STORE_KEY = 'atlas:brand-session:preferences:v1';

function readPreferences(): Record<string, string> {
  // Prefer localStorage (primary persistence); fall through to sessionStorage
  // only in environments where localStorage is unavailable or empty.
  // Note: writePreferences always targets localStorage first, so sessionStorage
  // will only contain data when localStorage was previously unavailable.
  try {
    const raw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(BRAND_PREFS_STORE_KEY) : null;
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    // localStorage unavailable or parse error — fall through
  }
  try {
    const raw =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(BRAND_PREFS_STORE_KEY)
        : null;
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    // sessionStorage unavailable or parse error
  }
  return {};
}

function writePreferences(prefs: Record<string, string>): void {
  const value = JSON.stringify(prefs);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BRAND_PREFS_STORE_KEY, value);
      return;
    }
  } catch {
    // fall through
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(BRAND_PREFS_STORE_KEY, value);
    }
  } catch {
    // best effort
  }
}

// ─── Context value ────────────────────────────────────────────────────────────

export interface WorkspaceBrandSessionValue {
  /** The resolved brand identifier for the current session. */
  readonly activeBrandId: string;

  /** The full BrandProfileV1 for the active brand. */
  readonly activeBrandProfile: BrandProfileV1;

  /** How activeBrandId was selected. */
  readonly resolutionSource: BrandResolutionSource;

  /**
   * Non-fatal warnings collected during resolution.
   * Typically empty; populated when overrides are rejected or schema issues found.
   */
  readonly warnings: readonly string[];

  /**
   * The currently active workspace.
   * Null when the user is unauthenticated or has no workspace.
   */
  readonly activeWorkspace: ResolvableWorkspace | null;

  /**
   * Store a brand preference for the given workspace.
   * Only takes effect when the workspace policy is user_selectable.
   * Persists to localStorage so it survives page reloads.
   */
  setPreferredBrandForWorkspace: (workspaceId: string, brandId: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WorkspaceBrandSessionContext = createContext<WorkspaceBrandSessionValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface WorkspaceBrandSessionProviderProps {
  readonly children: ReactNode;
  /**
   * Brand identifier from the current route or host resolution.
   * Passed through to resolveBrandForWorkspace as routeBrandId.
   * When present and valid, wins over user preferences (but not locked policy).
   */
  readonly routeBrandId?: string | null;
}

export function WorkspaceBrandSessionProvider({
  children,
  routeBrandId,
}: WorkspaceBrandSessionProviderProps) {
  const { activeWorkspace, atlasUserProfile } = useWorkspaceSession();

  // ── Persisted user preferences ────────────────────────────────────────────

  const [preferences, setPreferences] = useState<Record<string, string>>(() =>
    readPreferences(),
  );

  const setPreferredBrandForWorkspace = useCallback(
    (workspaceId: string, brandId: string) => {
      setPreferences((prev) => {
        const next = { ...prev, [workspaceId]: brandId };
        writePreferences(next);
        return next;
      });
    },
    [],
  );

  // ── Resolution ────────────────────────────────────────────────────────────

  const value = useMemo<WorkspaceBrandSessionValue>(() => {
    const workspace = activeWorkspace
      ? ({
          workspaceId: activeWorkspace.workspaceId,
          name: activeWorkspace.name,
          defaultBrandId: activeWorkspace.defaultBrandId,
          allowedBrandIds: activeWorkspace.allowedBrandIds,
          brandPolicy: activeWorkspace.brandPolicy,
        } satisfies ResolvableWorkspace)
      : null;

    const storedBrandId =
      workspace ? (preferences[workspace.workspaceId] ?? null) : null;

    const brandRegistry = listStoredBrandProfiles();

    const resolved = resolveBrandForWorkspace({
      workspace,
      userProfile: atlasUserProfile ?? null,
      routeBrandId: routeBrandId ?? null,
      storedBrandId,
      brandRegistry,
    });

    return {
      ...resolved,
      activeWorkspace: workspace,
      setPreferredBrandForWorkspace,
    };
  }, [
    activeWorkspace,
    atlasUserProfile,
    preferences,
    routeBrandId,
    setPreferredBrandForWorkspace,
  ]);

  return (
    <WorkspaceBrandSessionContext.Provider value={value}>
      {children}
    </WorkspaceBrandSessionContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Returns the current WorkspaceBrandSessionValue.
 *
 * @throws Error when called outside a <WorkspaceBrandSessionProvider>.
 */
export function useWorkspaceBrandSession(): WorkspaceBrandSessionValue {
  const ctx = useContext(WorkspaceBrandSessionContext);
  if (ctx === null) {
    throw new Error(
      'useWorkspaceBrandSession must be called inside a <WorkspaceBrandSessionProvider>. ' +
        'Wrap the component tree (or its ancestor) with <WorkspaceBrandSessionProvider>.',
    );
  }
  return ctx;
}

/**
 * Returns the current WorkspaceBrandSessionValue, or null when used outside a
 * <WorkspaceBrandSessionProvider>.
 *
 * Safe to call in components that may render in both branded and unbranded contexts.
 */
export function useOptionalWorkspaceBrandSession(): WorkspaceBrandSessionValue | null {
  return useContext(WorkspaceBrandSessionContext);
}
