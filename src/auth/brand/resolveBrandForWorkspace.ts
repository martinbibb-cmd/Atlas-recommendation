/**
 * src/auth/brand/resolveBrandForWorkspace.ts
 *
 * Pure resolver: derives the single authoritative active brand for a workspace
 * session from workspace policy, user preferences, and optional route context.
 *
 * Resolution priority (first rule that fires wins):
 *   1. No workspace            → atlas_default
 *   2. locked policy           → workspace default only; all overrides are ignored
 *   3. route_override          → routeBrandId is valid and in allowedBrandIds
 *                                (allowed for workspace_default and user_selectable)
 *   4. user_preference         → storedBrandId is valid and in allowedBrandIds
 *                                (only for user_selectable policy)
 *   5. workspace_default       → workspace's own defaultBrandId
 *
 * Design rules
 * ────────────
 * - Pure function — no side effects, no storage reads, no React dependencies.
 * - `brandRegistry` must be pre-loaded by the caller (e.g. listStoredBrandProfiles()).
 * - `storedBrandId` is the caller's responsibility to extract from userProfile
 *   or a separate preference store before calling this function.
 * - warnings[] collects non-fatal issues (invalid override, schema inconsistency)
 *   so the caller can surface them in dev/UI without blocking resolution.
 */

import type { BrandProfileV1 } from '../../features/branding/brandProfile';
import { DEFAULT_BRAND_ID } from '../../features/branding/brandProfiles';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * How the active brand was selected.
 *
 * workspace_default  — workspace's own defaultBrandId (or locked policy).
 * user_preference    — stored user preference within allowedBrandIds.
 * route_override     — brand injected via URL / route parameter.
 * atlas_default      — no workspace present; global Atlas fallback.
 */
export type BrandResolutionSource =
  | 'workspace_default'
  | 'user_preference'
  | 'route_override'
  | 'atlas_default';

/**
 * Minimal workspace shape the resolver requires.
 * Compatible with both authTypes.AtlasWorkspaceV1 and
 * auth/profile/AtlasWorkspaceV1 — only the brand-relevant fields are used.
 */
export interface ResolvableWorkspace {
  readonly workspaceId: string;
  readonly name: string;
  readonly defaultBrandId: string;
  readonly allowedBrandIds: readonly string[];
  readonly brandPolicy: 'workspace_default' | 'user_selectable' | 'locked';
}

/**
 * Minimal user profile shape the resolver requires.
 * Compatible with both AtlasUserProfileV1 variants.
 */
export interface ResolvableUserProfile {
  readonly preferredBrandIdByWorkspace?: Readonly<Record<string, string>>;
}

export interface ResolveBrandForWorkspaceInput {
  /**
   * The currently active workspace, or null when no workspace exists for the
   * session (unauthenticated / workspace-less user).
   */
  readonly workspace: ResolvableWorkspace | null;

  /**
   * The authenticated user's profile.  Used to derive storedBrandId when it
   * is not supplied directly via the storedBrandId field.  May be null.
   */
  readonly userProfile?: ResolvableUserProfile | null;

  /**
   * Brand identifier from the current URL / route context (e.g. host-resolved
   * brand from a branded subdomain).  Ignored when workspace policy is locked.
   */
  readonly routeBrandId?: string | null;

  /**
   * Explicit stored brand preference for this workspace.
   * When absent, derived from userProfile.preferredBrandIdByWorkspace.
   * Only respected when workspace policy is user_selectable.
   */
  readonly storedBrandId?: string | null;

  /**
   * Full brand registry available to the session.
   * Should be the merged built-in + stored profiles (e.g. listStoredBrandProfiles()).
   * The resolver uses this to resolve activeBrandProfile for the winning brandId.
   */
  readonly brandRegistry: Readonly<Record<string, BrandProfileV1>>;
}

export interface ResolveBrandForWorkspaceResult {
  /** The resolved brand identifier that should be applied to the session. */
  readonly activeBrandId: string;

  /**
   * The resolved BrandProfileV1 for activeBrandId.
   * Falls back to atlas-default profile when the brandId is not in the registry.
   */
  readonly activeBrandProfile: BrandProfileV1;

  /** Explains how activeBrandId was selected. */
  readonly resolutionSource: BrandResolutionSource;

  /**
   * Non-fatal warnings accumulated during resolution.
   * Includes: ignored overrides, disallowed brands, schema inconsistencies.
   * Empty in the happy path.
   */
  readonly warnings: readonly string[];
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolves the single authoritative active brand for a workspace session.
 *
 * @param input  All brand-resolution inputs for the current session.
 * @returns      Resolved brand ID, profile, source, and any warnings.
 */
export function resolveBrandForWorkspace(
  input: ResolveBrandForWorkspaceInput,
): ResolveBrandForWorkspaceResult {
  const { workspace, userProfile, routeBrandId, brandRegistry } = input;
  const warnings: string[] = [];

  // ── Helper: resolve a brandId → profile (falls back to atlas-default) ─────

  function toProfile(brandId: string): BrandProfileV1 {
    return (
      brandRegistry[brandId] ??
      brandRegistry[DEFAULT_BRAND_ID] ??
      (Object.values(brandRegistry)[0] as BrandProfileV1)
    );
  }

  function makeResult(
    brandId: string,
    source: BrandResolutionSource,
  ): ResolveBrandForWorkspaceResult {
    return {
      activeBrandId: brandId,
      activeBrandProfile: toProfile(brandId),
      resolutionSource: source,
      warnings,
    };
  }

  // ── 1. No workspace → atlas default ───────────────────────────────────────

  if (!workspace) {
    return makeResult(DEFAULT_BRAND_ID, 'atlas_default');
  }

  const { workspaceId, defaultBrandId, allowedBrandIds, brandPolicy } = workspace;

  // ── Schema consistency check ───────────────────────────────────────────────

  if (!allowedBrandIds.includes(defaultBrandId)) {
    warnings.push(
      `Workspace defaultBrandId "${defaultBrandId}" is not listed in allowedBrandIds — ` +
        'this is a schema inconsistency; defaultBrandId should always be allowed.',
    );
  }

  // ── Helper: non-empty string check ────────────────────────────────────────

  function isNonEmpty(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  // ── Helper: valid + allowed brand check ───────────────────────────────────

  function isAllowedBrand(brandId: string | null | undefined): brandId is string {
    if (!isNonEmpty(brandId)) return false;
    return allowedBrandIds.includes(brandId);
  }

  // ── 2. locked: workspace default only ─────────────────────────────────────

  if (brandPolicy === 'locked') {
    if (isNonEmpty(routeBrandId) && routeBrandId !== defaultBrandId) {
      warnings.push(
        `Route override "${routeBrandId}" ignored: workspace brand policy is locked.`,
      );
    }
    const derivedStored =
      isNonEmpty(input.storedBrandId)
        ? input.storedBrandId
        : userProfile?.preferredBrandIdByWorkspace?.[workspaceId];
    if (isNonEmpty(derivedStored) && derivedStored !== defaultBrandId) {
      warnings.push(
        `User preference "${derivedStored}" ignored: workspace brand policy is locked.`,
      );
    }
    return makeResult(defaultBrandId, 'workspace_default');
  }

  // ── 3. route_override (workspace_default and user_selectable) ─────────────

  if (isNonEmpty(routeBrandId)) {
    if (isAllowedBrand(routeBrandId)) {
      return makeResult(routeBrandId, 'route_override');
    } else {
      warnings.push(
        `Route brand "${routeBrandId}" is not in allowedBrandIds ` +
          `[${allowedBrandIds.join(', ')}]; falling back to workspace default.`,
      );
    }
  }

  // ── 4. user_preference (user_selectable only) ─────────────────────────────

  if (brandPolicy === 'user_selectable') {
    // Prefer explicit storedBrandId; fall back to profile-derived preference.
    const preferenceId =
      isNonEmpty(input.storedBrandId)
        ? input.storedBrandId
        : userProfile?.preferredBrandIdByWorkspace?.[workspaceId];

    if (isNonEmpty(preferenceId)) {
      if (isAllowedBrand(preferenceId)) {
        return makeResult(preferenceId, 'user_preference');
      } else {
        warnings.push(
          `User preference "${preferenceId}" is not in allowedBrandIds ` +
            `[${allowedBrandIds.join(', ')}]; falling back to workspace default.`,
        );
      }
    }
  }

  // ── 5. workspace_default ──────────────────────────────────────────────────

  return makeResult(defaultBrandId, 'workspace_default');
}
