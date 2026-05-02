/**
 * src/features/branding/index.ts
 *
 * Public barrel for the branding module.
 *
 * Consumers should import from this file rather than from individual modules
 * to keep the public API stable as internals evolve.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type {
  BrandToneV1,
  BrandThemeTokensV1,
  BrandContactV1,
  BrandOutputSettingsV1,
  BrandProfileV1,
} from './brandProfile';

// ─── Profiles ─────────────────────────────────────────────────────────────────

export { BRAND_PROFILES, DEFAULT_BRAND_ID } from './brandProfiles';

// ─── Resolver ─────────────────────────────────────────────────────────────────

export { resolveBrandProfile } from './resolveBrandProfile';

// ─── React ────────────────────────────────────────────────────────────────────

export { BrandProvider } from './BrandProvider';
export { useBrandProfile, useOptionalBrandProfile } from './useBrandProfile';

// ─── Output components ────────────────────────────────────────────────────────

export { BrandLogo } from './BrandLogo';
export { BrandedHeader } from './BrandedHeader';
export { BrandedFooter } from './BrandedFooter';

// ─── Output copy ──────────────────────────────────────────────────────────────

export { getBrandCtaCopy } from './brandOutputCopy';
export type { BrandCtaCopy } from './brandOutputCopy';
