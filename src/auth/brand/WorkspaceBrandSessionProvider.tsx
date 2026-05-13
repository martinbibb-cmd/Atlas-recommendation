/* eslint-disable react-refresh/only-export-components */
/**
 * src/auth/brand/WorkspaceBrandSessionProvider.tsx
 *
 * Provides the resolved active brand for the current workspace session.
 *
 * Reads the active workspace and user profile from AtlasAuthContext, resolves
 * the authoritative brand via resolveBrandForWorkspace(), and exposes the
 * result through WorkspaceBrandSessionContext.
 *
 * Also manages per-workspace brand preferences in localStorage so that
 * setPreferredBrandForWorkspace() is immediately reactive.
 *
 * Storage key:  atlas:brand-session:preferred-brands:v1
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAtlasAuth } from '../useAtlasAuth';
import { listStoredBrandProfiles } from '../../features/branding/brandProfileStore';
import { resolveBrandForWorkspace } from './resolveBrandForWorkspace';
import type {
  BrandResolutionSource,
  ResolveBrandForWorkspaceResult,
} from './resolveBrandForWorkspace';
import type { BrandProfileV1 } from '../../features/branding/brandProfile';
import type { AtlasWorkspaceV1 } from '../authTypes';
import { DEFAULT_BRAND_ID } from '../../features/branding/brandProfiles';

// ─── Storage ─────────────────────────────────────────────────────────────────

const PREFERRED_BRANDS_KEY = 'atlas:brand-session:preferred-brands:v1';

function readPreferredBrands(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PREFERRED_BRANDS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writePreferredBrands(map: Record<string, string>): void {
  try {
    localStorage.setItem(PREFERRED_BRANDS_KEY, JSON.stringify(map));
  } catch {
    // best effort
  }
}

// ─── Context value ────────────────────────────────────────────────────────────

export interface WorkspaceBrandSessionValue {
  /** The workspace currently active in the auth session, or null. */
  readonly activeWorkspace: AtlasWorkspaceV1 | null;

  /** The resolved active brand profile for this session. */
  readonly activeBrand: BrandProfileV1;

  /** The resolved active brand ID for this session. */
  readonly activeBrandId: string;

  /** How the active brand was resolved. */
  readonly resolutionSource: BrandResolutionSource;

  /**
   * Non-fatal warnings from the resolution pass.
   * E.g. a locked workspace ignored a route override.
   */
  readonly warnings: readonly string[];

  /**
   * Persist a brand preference for the given workspace.
   * Immediately updates the resolved brand if the preference is allowed.
   *
   * @param workspaceId  The workspace to set the preference for.
   * @param brandId      The preferred brand ID.
   */
  setPreferredBrandForWorkspace(workspaceId: string, brandId: string): void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_BRAND_PROFILE: BrandProfileV1 = listStoredBrandProfiles()[DEFAULT_BRAND_ID] ?? {
  version: '1.0',
  brandId: DEFAULT_BRAND_ID,
  companyName: 'Atlas',
  theme: { primaryColor: '#2563EB' },
  contact: {},
  outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: false, tone: 'technical' },
};

const DEFAULT_SESSION_VALUE: WorkspaceBrandSessionValue = {
  activeWorkspace: null,
  activeBrand: DEFAULT_BRAND_PROFILE,
  activeBrandId: DEFAULT_BRAND_ID,
  resolutionSource: 'atlas_default',
  warnings: [],
  setPreferredBrandForWorkspace: () => undefined,
};

// ─── Context ──────────────────────────────────────────────────────────────────

export const WorkspaceBrandSessionContext =
  createContext<WorkspaceBrandSessionValue>(DEFAULT_SESSION_VALUE);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface WorkspaceBrandSessionProviderProps {
  children: ReactNode;
  /**
   * Optional route-level brand override (e.g. from URL params).
   * Respected when the workspace brand policy is not 'locked'.
   */
  routeBrandId?: string | null;
}

export function WorkspaceBrandSessionProvider({
  children,
  routeBrandId,
}: WorkspaceBrandSessionProviderProps) {
  const { userProfile, currentWorkspace } = useAtlasAuth();

  // Per-workspace preferred brand IDs, keyed by workspaceId.
  // Initialised from localStorage and kept in sync via setPreferredBrandForWorkspace.
  const [preferredBrandsMap, setPreferredBrandsMap] = useState<Record<string, string>>(
    readPreferredBrands,
  );

  const setPreferredBrandForWorkspace = useCallback(
    (workspaceId: string, brandId: string) => {
      setPreferredBrandsMap((prev) => {
        const next = { ...prev, [workspaceId]: brandId };
        writePreferredBrands(next);
        return next;
      });
    },
    [],
  );

  const resolved = useMemo<ResolveBrandForWorkspaceResult>(() => {
    const storedBrandId = currentWorkspace
      ? (preferredBrandsMap[currentWorkspace.workspaceId] ?? null)
      : null;
    return resolveBrandForWorkspace({
      workspace: currentWorkspace,
      userProfile,
      routeBrandId: routeBrandId ?? null,
      storedBrandId,
      brandRegistry: listStoredBrandProfiles(),
    });
  }, [currentWorkspace, userProfile, routeBrandId, preferredBrandsMap]);

  const value = useMemo<WorkspaceBrandSessionValue>(
    () => ({
      activeWorkspace: currentWorkspace,
      activeBrand: resolved.activeBrandProfile,
      activeBrandId: resolved.activeBrandId,
      resolutionSource: resolved.resolutionSource,
      warnings: resolved.warnings,
      setPreferredBrandForWorkspace,
    }),
    [currentWorkspace, resolved, setPreferredBrandForWorkspace],
  );

  return (
    <WorkspaceBrandSessionContext.Provider value={value}>
      {children}
    </WorkspaceBrandSessionContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the current workspace brand session value.
 * Must be used inside a <WorkspaceBrandSessionProvider>.
 */
export function useWorkspaceBrandSession(): WorkspaceBrandSessionValue {
  return useContext(WorkspaceBrandSessionContext);
}

/**
 * Returns the workspace brand session value, or null when used outside a
 * <WorkspaceBrandSessionProvider>.  Never throws.
 */
export function useOptionalWorkspaceBrandSession(): WorkspaceBrandSessionValue | null {
  const value = useContext(WorkspaceBrandSessionContext);
  // Distinguish from default by checking if setPreferredBrandForWorkspace is
  // the no-op from DEFAULT_SESSION_VALUE — safe because it's a stable reference.
  if (value === DEFAULT_SESSION_VALUE) return null;
  return value;
}
