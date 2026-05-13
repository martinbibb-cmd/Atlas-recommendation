/**
 * buildAtlasUserProfileFromAuthUser.ts
 *
 * Auth bridge: converts a Firebase User (or any auth provider user shape)
 * into an AtlasUserProfileV1 for use throughout Atlas.
 *
 * Rules
 * ─────
 * - Profile ID (`userId`) is always derived from the auth provider UID to
 *   ensure stability across sessions.
 * - Email and displayName are sourced from the auth provider; never invented.
 * - An existing persisted profile for the same provider UID retains its
 *   original createdAt and workspaceMemberships.
 * - Missing auth means the caller should use session-only / demo mode instead
 *   of calling this function.
 * - No anonymous global profile is created; this bridge must not be called
 *   without a real authenticated user.
 */

import type { AtlasUserProfileV1 } from './AtlasUserProfileV1';

// ─── Minimal auth user shape ──────────────────────────────────────────────────

/**
 * The minimum auth-user fields this bridge depends on.
 * Compatible with Firebase's User type — pass the Firebase User directly.
 */
export interface AtlasAuthUser {
  /** UID issued by the auth provider (e.g. Firebase UID). */
  readonly uid: string;

  /** Email from the auth provider, or null if not available. */
  readonly email: string | null;

  /** Display name from the auth provider, or null if not set. */
  readonly displayName: string | null;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Builds (or refreshes) an AtlasUserProfileV1 from an authenticated user.
 *
 * @param authUser   - Authenticated user from the auth provider.
 * @param existing   - Previously persisted profile for this user, if any.
 *                     When provided and authProviderId matches, createdAt and
 *                     workspaceMemberships are preserved.
 * @param now        - ISO 8601 timestamp to use as updatedAt (defaults to
 *                     new Date().toISOString() — injectable for testing).
 * @returns          A fresh AtlasUserProfileV1 ready for storage and context.
 */
export function buildAtlasUserProfileFromAuthUser(
  authUser: AtlasAuthUser,
  existing: AtlasUserProfileV1 | null | undefined,
  now: string = new Date().toISOString(),
): AtlasUserProfileV1 {
  const isExistingForSameProvider =
    existing != null && existing.authProviderId === authUser.uid;

  const userId = isExistingForSameProvider
    ? existing.userId
    : `atlas_${authUser.uid}`;

  return {
    userId,
    authProviderId: authUser.uid,
    email: authUser.email ?? undefined,
    displayName:
      authUser.displayName?.trim() ||
      authUser.email?.trim() ||
      undefined,
    defaultWorkspaceId: isExistingForSameProvider
      ? existing.defaultWorkspaceId
      : undefined,
    workspaceMemberships: isExistingForSameProvider
      ? existing.workspaceMemberships
      : [],
    preferredBrandIdByWorkspace: isExistingForSameProvider
      ? existing.preferredBrandIdByWorkspace
      : undefined,
    createdAt: isExistingForSameProvider ? existing.createdAt : now,
    updatedAt: now,
  };
}
