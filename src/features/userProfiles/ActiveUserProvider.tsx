/**
 * src/features/userProfiles/ActiveUserProvider.tsx
 *
 * React context for the currently active user profile.
 *
 * Provides the resolved UserProfileV1 (or null) to the component tree and
 * exposes helpers to switch or clear the active user.  All persistence is
 * delegated to the pure storage functions in userProfileStore /
 * activeUserStore — this file owns only the React integration layer.
 *
 * Design rules
 * ────────────
 * - No PII (email, displayName) is forwarded to analytics from this context.
 * - The provider reads once on mount; subsequent changes go through setActiveUser.
 * - Wrap the whole app so every consumer can read the active user without
 *   threading props.
 */

import { createContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { UserProfileV1 } from './userProfile';
import {
  getActiveUserId,
  setActiveUserId,
  clearActiveUserId,
} from './activeUserStore';
import {
  getUserProfile,
  upsertUserProfile,
} from './userProfileStore';

// ─── Context value type ───────────────────────────────────────────────────────

export interface ActiveUserContextValue {
  /** The resolved UserProfileV1 for the current active userId, or null. */
  activeUser: UserProfileV1 | null;
  /**
   * Sets a profile as the active user.
   * Persists both the profile (via upsertUserProfile) and the active userId.
   */
  setActiveUser: (profile: UserProfileV1) => void;
  /** Clears the active userId from storage. The profile record is kept. */
  clearActiveUser: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const ActiveUserContext = createContext<ActiveUserContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ActiveUserProviderProps {
  children: ReactNode;
}

/**
 * ActiveUserProvider
 *
 * Wraps the application root.  On mount it reads the persisted active userId
 * and resolves the full UserProfileV1 from the user profile store.
 *
 * Exposes:
 *   activeUser      — resolved profile or null
 *   setActiveUser   — persist profile + mark as active
 *   clearActiveUser — remove the active userId marker
 */
export function ActiveUserProvider({ children }: ActiveUserProviderProps) {
  const [activeUser, setActiveUserState] = useState<UserProfileV1 | null>(() => {
    const userId = getActiveUserId();
    if (!userId) return null;
    return getUserProfile(userId);
  });

  function setActiveUser(profile: UserProfileV1): void {
    upsertUserProfile(profile);
    setActiveUserId(profile.userId);
    setActiveUserState(profile);
  }

  function clearActiveUser(): void {
    clearActiveUserId();
    setActiveUserState(null);
  }

  return (
    <ActiveUserContext.Provider value={{ activeUser, setActiveUser, clearActiveUser }}>
      {children}
    </ActiveUserContext.Provider>
  );
}
