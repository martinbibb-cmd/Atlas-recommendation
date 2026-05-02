/**
 * src/features/userProfiles/userProfileStore.ts
 *
 * Local persistence for UserProfileV1 records.
 *
 * Storage strategy
 * ────────────────
 * All reads and writes are delegated to localAdapter (LocalStorageAdapter),
 * which targets localStorage with a sessionStorage fallback.
 *
 * Storage key:  atlas:user-profiles:v1
 *
 * Design rules
 * ────────────
 * - No React dependencies — pure storage functions usable anywhere.
 * - Each write replaces only the entry for that userId.
 * - email and other PII fields must never be forwarded to analyticsStore.
 */

import type { UserProfileV1 } from './userProfile';
import { localAdapter } from '../../lib/storage/localStorageAdapter';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Storage key used by the underlying adapter for the userProfiles collection. */
export const USER_PROFILE_STORE_KEY = 'atlas:user-profiles:v1';

// ─── Collection constant ──────────────────────────────────────────────────────

const COLLECTION = 'userProfiles' as const;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns all stored user profiles as an id-keyed record.
 * Returns an empty record when no profiles have been saved.
 */
export function loadUserProfileStore(): Record<string, UserProfileV1> {
  return localAdapter.readAllSync(COLLECTION);
}

/**
 * Replaces the entire persisted store with the provided record.
 */
export function saveUserProfileStore(store: Record<string, UserProfileV1>): void {
  localAdapter.replaceAllSync(COLLECTION, store);
}

/**
 * Inserts or updates a user profile in the persisted store.
 * Keyed by userId — if a record with the same userId already exists it is
 * fully replaced.  Sets `updatedAt` to the current ISO-8601 timestamp.
 */
export function upsertUserProfile(profile: UserProfileV1): void {
  const updated: UserProfileV1 = {
    ...profile,
    updatedAt: new Date().toISOString(),
  };
  localAdapter.upsertSync(COLLECTION, profile.userId, updated);
}

/**
 * Returns a single UserProfileV1 by userId, or null when not found.
 */
export function getUserProfile(userId: string): UserProfileV1 | null {
  return localAdapter.getSync(COLLECTION, userId);
}

/**
 * Removes the stored profile with the given userId.
 * Silently no-ops when no record exists for that userId.
 */
export function deleteUserProfile(userId: string): void {
  localAdapter.deleteSync(COLLECTION, userId);
}

/**
 * Returns all stored user profiles as an array.
 */
export function listUserProfiles(): UserProfileV1[] {
  return localAdapter.listSync(COLLECTION);
}
