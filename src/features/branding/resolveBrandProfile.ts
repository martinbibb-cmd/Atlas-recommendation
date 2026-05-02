/**
 * src/features/branding/resolveBrandProfile.ts
 *
 * Resolver that maps a brandId string to a BrandProfileV1.
 * Checks locally-stored overrides first, then built-in profiles.
 * Unknown or missing IDs fall back to atlas-default.
 */

import type { BrandProfileV1 } from './brandProfile';
import { BRAND_PROFILES, DEFAULT_BRAND_ID } from './brandProfiles';
import { listStoredBrandProfiles } from './brandProfileStore';

/**
 * Returns the BrandProfileV1 for the given brandId.
 *
 * Rules:
 *  - `undefined` / empty string  → atlas-default
 *  - stored profile wins over built-in when brandIds match
 *  - unknown brandId             → atlas-default
 *  - known brandId               → that profile
 */
export function resolveBrandProfile(brandId?: string): BrandProfileV1 {
  if (!brandId) {
    return BRAND_PROFILES[DEFAULT_BRAND_ID];
  }
  // Stored profiles (merged with built-ins) — stored wins by brandId.
  const merged = listStoredBrandProfiles();
  return merged[brandId] ?? BRAND_PROFILES[DEFAULT_BRAND_ID];
}
