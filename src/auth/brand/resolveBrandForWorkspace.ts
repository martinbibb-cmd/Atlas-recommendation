/**
 * src/auth/brand/resolveBrandForWorkspace.ts
 *
 * Pure resolver: given a workspace, user profile, and optional route/stored
 * brand hints, resolves a single authoritative active brand for the session.
 *
 * Resolution priority
 * ───────────────────
 * locked          → workspace default only; any user/route override → warning
 * user_selectable → route_override first, then user_preference, then workspace_default
 * workspace_default → route_override first, then user_preference, then workspace_default
 * no workspace    → atlas_default
 *
 * This function is pure and side-effect-free.
 * It does not read from storage or context — callers supply all inputs.
 */

import type { AtlasWorkspaceV1 } from '../authTypes';
import type { AtlasUserProfileV1 } from '../authTypes';
import type { BrandProfileV1 } from '../../features/branding/brandProfile';
import { DEFAULT_BRAND_ID } from '../../features/branding/brandProfiles';

// ─── Resolution source ────────────────────────────────────────────────────────

export type BrandResolutionSource =
  | 'workspace_default'
  | 'user_preference'
  | 'route_override'
  | 'atlas_default';

// ─── Input ────────────────────────────────────────────────────────────────────

export interface ResolveBrandForWorkspaceInput {
  /**
   * Active workspace for this session.
   * Pass null when there is no active workspace (unauthenticated / demo mode).
   */
  readonly workspace: AtlasWorkspaceV1 | null;

  /**
   * Authenticated user profile.
   * Used to read per-workspace brand preference when the workspace policy allows
   * user selection.  Pass null in unauthenticated / demo mode.
   */
  readonly userProfile: AtlasUserProfileV1 | null;

  /**
   * Brand ID injected via the current URL / route.
   * Considered only when the workspace brand policy is not 'locked'.
   */
  readonly routeBrandId?: string | null;

  /**
   * Brand ID previously stored by the user for this workspace
   * (e.g. from localStorage via setPreferredBrandForWorkspace).
   * Considered only when the workspace brand policy is not 'locked'.
   * Takes lower priority than routeBrandId.
   */
  readonly storedBrandId?: string | null;

  /**
   * Map of all known brand profiles.
   * Use listStoredBrandProfiles() to get a merged built-in + stored registry.
   */
  readonly brandRegistry: Readonly<Record<string, BrandProfileV1>>;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface ResolveBrandForWorkspaceResult {
  /** The resolved brand ID for this session. */
  readonly activeBrandId: string;

  /** The resolved brand profile for this session. */
  readonly activeBrandProfile: BrandProfileV1;

  /** How the brand was resolved. */
  readonly resolutionSource: BrandResolutionSource;

  /**
   * Non-fatal warnings raised during resolution.
   * Examples: requested brand not in allowedBrandIds, locked workspace ignoring override.
   */
  readonly warnings: readonly string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function lookupProfile(
  brandId: string,
  registry: Readonly<Record<string, BrandProfileV1>>,
): BrandProfileV1 | undefined {
  return registry[brandId];
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolves the single authoritative active brand for a workspace session.
 *
 * @param input  All context needed for resolution — pure, no side-effects.
 * @returns      Resolved brand with profile, source, and any warnings.
 */
export function resolveBrandForWorkspace(
  input: ResolveBrandForWorkspaceInput,
): ResolveBrandForWorkspaceResult {
  const { workspace, userProfile, routeBrandId, storedBrandId, brandRegistry } = input;
  const warnings: string[] = [];

  // ── Atlas default fallback ────────────────────────────────────────────────
  const atlasFallback =
    lookupProfile(DEFAULT_BRAND_ID, brandRegistry) ?? Object.values(brandRegistry)[0];

  if (!atlasFallback) {
    return {
      activeBrandId: DEFAULT_BRAND_ID,
      activeBrandProfile: {
        version: '1.0',
        brandId: DEFAULT_BRAND_ID,
        companyName: 'Atlas',
        theme: { primaryColor: '#2563EB' },
        contact: {},
        outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: false, tone: 'technical' },
      },
      resolutionSource: 'atlas_default',
      warnings,
    };
  }

  // ── No workspace → atlas_default ─────────────────────────────────────────
  if (!workspace) {
    return {
      activeBrandId: DEFAULT_BRAND_ID,
      activeBrandProfile: atlasFallback,
      resolutionSource: 'atlas_default',
      warnings,
    };
  }

  const { defaultBrandId, allowedBrandIds, brandPolicy } = workspace;

  // Ensure defaultBrandId is always treated as allowed (defensive normalisation).
  const effectiveAllowed = new Set([...allowedBrandIds, defaultBrandId]);

  const workspaceDefaultProfile =
    lookupProfile(defaultBrandId, brandRegistry) ?? atlasFallback;

  // ── Locked workspace — workspace default only ─────────────────────────────
  if (brandPolicy === 'locked') {
    if (isNonEmpty(routeBrandId)) {
      warnings.push(
        `Brand policy is 'locked'; route override '${routeBrandId}' ignored.`,
      );
    }
    if (isNonEmpty(storedBrandId)) {
      warnings.push(
        `Brand policy is 'locked'; stored preference '${storedBrandId}' ignored.`,
      );
    }
    // Also check profile preference for locked workspaces
    const profilePreference = userProfile?.preferredBrandIdByWorkspace?.[workspace.workspaceId];
    if (isNonEmpty(profilePreference)) {
      warnings.push(
        `Brand policy is 'locked'; profile preference '${profilePreference}' ignored.`,
      );
    }
    return {
      activeBrandId: defaultBrandId,
      activeBrandProfile: workspaceDefaultProfile,
      resolutionSource: 'workspace_default',
      warnings,
    };
  }

  // ── Non-locked: try route_override first ──────────────────────────────────
  if (isNonEmpty(routeBrandId)) {
    if (effectiveAllowed.has(routeBrandId)) {
      const profile = lookupProfile(routeBrandId, brandRegistry);
      if (profile) {
        return {
          activeBrandId: routeBrandId,
          activeBrandProfile: profile,
          resolutionSource: 'route_override',
          warnings,
        };
      }
    } else {
      warnings.push(
        `Route brand '${routeBrandId}' is not in allowedBrandIds for workspace '${workspace.workspaceId}'; falling back.`,
      );
    }
  }

  // ── Try user_preference: storedBrandId wins over profile preference ───────
  // Resolve the effective user brand preference:
  //   1. storedBrandId (from WorkspaceBrandSessionProvider's local state)
  //   2. userProfile.preferredBrandIdByWorkspace[workspaceId]
  const profilePreference = userProfile?.preferredBrandIdByWorkspace?.[workspace.workspaceId];
  const effectiveUserPreference = isNonEmpty(storedBrandId)
    ? storedBrandId
    : isNonEmpty(profilePreference)
      ? profilePreference
      : null;

  if (isNonEmpty(effectiveUserPreference)) {
    if (effectiveAllowed.has(effectiveUserPreference)) {
      const profile = lookupProfile(effectiveUserPreference, brandRegistry);
      if (profile) {
        return {
          activeBrandId: effectiveUserPreference,
          activeBrandProfile: profile,
          resolutionSource: 'user_preference',
          warnings,
        };
      }
    } else {
      warnings.push(
        `User brand preference '${effectiveUserPreference}' is not in allowedBrandIds for workspace '${workspace.workspaceId}'; falling back to workspace default.`,
      );
    }
  }

  // ── Workspace default ─────────────────────────────────────────────────────
  return {
    activeBrandId: defaultBrandId,
    activeBrandProfile: workspaceDefaultProfile,
    resolutionSource: 'workspace_default',
    warnings,
  };
}
