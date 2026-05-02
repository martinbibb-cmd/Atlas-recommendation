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
 * - Primary:  localStorage (survives page reload and tab close).
 * - Fallback: sessionStorage (when localStorage is unavailable).
 * - Reads are defensive: malformed or missing data returns an empty store.
 *
 * Storage key:  atlas:brand-profiles:v1
 *
 * Store shape:
 *   {
 *     schemaVersion: 1,
 *     profilesById: Record<string, BrandProfileV1>
 *   }
 *
 * Design rules
 * ────────────
 * - No React dependencies — pure storage functions usable anywhere.
 * - Each write replaces only the entry for that brandId (other entries
 *   are preserved).
 */

import type { BrandProfileV1 } from './brandProfile';
import { BRAND_PROFILES } from './brandProfiles';

// ─── Constants ────────────────────────────────────────────────────────────────

export const BRAND_PROFILE_STORE_KEY = 'atlas:brand-profiles:v1';

const SCHEMA_VERSION = 1 as const;

// ─── Store shape ──────────────────────────────────────────────────────────────

interface BrandProfileStoreShape {
  schemaVersion: typeof SCHEMA_VERSION;
  profilesById: Record<string, BrandProfileV1>;
}

// ─── Storage access helpers ───────────────────────────────────────────────────

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // localStorage may throw in some environments.
  }
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    // sessionStorage also unavailable.
  }
  return null;
}

// ─── Store read / write helpers ───────────────────────────────────────────────

function readStore(): BrandProfileStoreShape {
  const storage = getStorage();
  if (!storage) {
    return { schemaVersion: SCHEMA_VERSION, profilesById: {} };
  }
  try {
    const raw = storage.getItem(BRAND_PROFILE_STORE_KEY);
    if (!raw) return { schemaVersion: SCHEMA_VERSION, profilesById: {} };
    const parsed = JSON.parse(raw) as Partial<BrandProfileStoreShape>;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      parsed.schemaVersion !== SCHEMA_VERSION ||
      typeof parsed.profilesById !== 'object' ||
      parsed.profilesById === null
    ) {
      return { schemaVersion: SCHEMA_VERSION, profilesById: {} };
    }
    return parsed as BrandProfileStoreShape;
  } catch {
    return { schemaVersion: SCHEMA_VERSION, profilesById: {} };
  }
}

function writeStore(store: BrandProfileStoreShape): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(BRAND_PROFILE_STORE_KEY, JSON.stringify(store));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the raw persisted store (stored profiles only, no built-ins merged).
 */
export function loadStoredBrandProfiles(): Record<string, BrandProfileV1> {
  return { ...readStore().profilesById };
}

/**
 * Replaces the entire persisted store with the provided record.
 * Overwrites any existing stored profiles.
 */
export function saveStoredBrandProfiles(profiles: Record<string, BrandProfileV1>): void {
  writeStore({ schemaVersion: SCHEMA_VERSION, profilesById: profiles });
}

/**
 * Inserts or updates a brand profile in the persisted store.
 * Keyed by brandId — if a record with the same brandId already exists it is
 * fully replaced.
 */
export function upsertStoredBrandProfile(profile: BrandProfileV1): void {
  const store = readStore();
  store.profilesById[profile.brandId] = profile;
  writeStore(store);
}

/**
 * Removes the stored brand profile with the given brandId.
 * Silently no-ops when no record exists for that brandId.
 */
export function deleteStoredBrandProfile(brandId: string): void {
  try {
    const store = readStore();
    delete store.profilesById[brandId];
    writeStore(store);
  } catch {
    // Best effort.
  }
}

/**
 * Returns all stored profiles merged with built-in BRAND_PROFILES.
 * Stored profile wins when both have the same brandId.
 */
export function listStoredBrandProfiles(): Record<string, BrandProfileV1> {
  const stored = readStore().profilesById;
  return {
    ...BRAND_PROFILES,
    ...stored,
  };
}
