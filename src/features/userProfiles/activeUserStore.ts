/**
 * src/features/userProfiles/activeUserStore.ts
 *
 * Persistence for the currently active user profile in Atlas.
 *
 * Stores the active userId in localStorage so that it survives page reloads
 * and is shared across tabs.  The active profile is resolved via
 * getUserProfile() from userProfileStore when a full UserProfileV1 is needed.
 *
 * Design rules
 * ────────────
 * - No React dependencies — pure storage functions usable anywhere.
 * - Stores only the userId string (not the full profile) to minimise the
 *   surface area for stale data.
 * - Returns null when no active user has been selected (pre-auth / dev default).
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** localStorage key for the active userId. */
export const ACTIVE_USER_STORE_KEY = 'atlas:active-user:v1';

// ─── Storage helpers ──────────────────────────────────────────────────────────

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // localStorage may throw in restricted environments.
  }
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    // sessionStorage also unavailable.
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the currently active userId, or null when none is set.
 */
export function getActiveUserId(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(ACTIVE_USER_STORE_KEY) ?? null;
  } catch {
    return null;
  }
}

/**
 * Persists the active userId.
 * Call this when the user selects a profile (e.g. in the dev profile switcher).
 */
export function setActiveUserId(userId: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(ACTIVE_USER_STORE_KEY, userId);
  } catch {
    // Best effort — storage quota or unavailability.
  }
}

/**
 * Clears the active userId.
 * Call this on sign-out or when resetting the dev environment.
 */
export function clearActiveUserId(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(ACTIVE_USER_STORE_KEY);
  } catch {
    // Best effort.
  }
}
