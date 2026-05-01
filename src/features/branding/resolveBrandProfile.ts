/**
 * src/features/branding/resolveBrandProfile.ts
 *
 * Deterministic, side-effect-free resolver that maps a brandId string to a
 * BrandProfileV1.  Unknown or missing IDs fall back to atlas-default.
 */

import type { BrandProfileV1 } from './brandProfile';
import { BRAND_PROFILES, DEFAULT_BRAND_ID } from './brandProfiles';

/**
 * Returns the BrandProfileV1 for the given brandId.
 *
 * Rules:
 *  - `undefined` / empty string  → atlas-default
 *  - unknown brandId             → atlas-default
 *  - known brandId               → that profile
 */
export function resolveBrandProfile(brandId?: string): BrandProfileV1 {
  if (!brandId) {
    return BRAND_PROFILES[DEFAULT_BRAND_ID];
  }
  return BRAND_PROFILES[brandId] ?? BRAND_PROFILES[DEFAULT_BRAND_ID];
}
