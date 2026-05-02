/**
 * src/features/branding/brandProfileStore.ts
 *
 * Local persistence for created/edited brand profiles.
 *
 * Stored profiles are merged with built-in BRAND_PROFILES at read time, with
 * the stored version winning when both share the same brandId.
 *
 * Storage strategy
 * ────────────────
 * All reads and writes are delegated to localAdapter (LocalStorageAdapter),
 * which targets localStorage with a sessionStorage fallback.
 *
 * Storage key:  atlas:brand-profiles:v1
 *
 * Design rules
 * ────────────
 * - No React dependencies — pure storage functions usable anywhere.
 * - Each write replaces only the entry for that brandId (other entries
 *   are preserved).
 */

import type { BrandProfileV1 } from './brandProfile';
import { BRAND_PROFILES } from './brandProfiles';
import { localAdapter } from '../../lib/storage/localStorageAdapter';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Storage key used by the underlying adapter for the brandProfiles collection. */
export const BRAND_PROFILE_STORE_KEY = 'atlas:brand-profiles:v1';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the raw persisted store (stored profiles only, no built-ins merged).
 */
export function loadStoredBrandProfiles(): Record<string, BrandProfileV1> {
  return localAdapter.readAllSync('brandProfiles');
}

/**
 * Replaces the entire persisted store with the provided record.
 * Overwrites any existing stored profiles.
 */
export function saveStoredBrandProfiles(profiles: Record<string, BrandProfileV1>): void {
  localAdapter.replaceAllSync('brandProfiles', profiles);
}

/**
 * Inserts or updates a brand profile in the persisted store.
 * Keyed by brandId — if a record with the same brandId already exists it is
 * fully replaced.
 */
export function upsertStoredBrandProfile(profile: BrandProfileV1): void {
  localAdapter.upsertSync('brandProfiles', profile.brandId, profile);
}

/**
 * Removes the stored brand profile with the given brandId.
 * Silently no-ops when no record exists for that brandId.
 */
export function deleteStoredBrandProfile(brandId: string): void {
  localAdapter.deleteSync('brandProfiles', brandId);
}

/**
 * Returns all stored profiles merged with built-in BRAND_PROFILES.
 * Stored profile wins when both have the same brandId.
 */
export function listStoredBrandProfiles(): Record<string, BrandProfileV1> {
  const stored = localAdapter.readAllSync('brandProfiles');
  return {
    ...BRAND_PROFILES,
    ...stored,
  };
}
