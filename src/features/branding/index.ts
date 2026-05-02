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

// ─── Active brand resolver ────────────────────────────────────────────────────

export { resolveActiveBrandId } from './activeBrand';
export type { ResolveActiveBrandIdInput } from './activeBrand';

// ─── React ────────────────────────────────────────────────────────────────────

export { BrandProvider } from './BrandProvider';
export { useBrandProfile, useOptionalBrandProfile } from './useBrandProfile';

// ─── Output components ────────────────────────────────────────────────────────

export { BrandLogo } from './BrandLogo';
export { BrandedHeader } from './BrandedHeader';
export { BrandedFooter } from './BrandedFooter';
export { ActiveBrandBanner } from './ActiveBrandBanner';

// ─── Output copy ──────────────────────────────────────────────────────────────

export { getBrandCtaCopy } from './brandOutputCopy';
export type { BrandCtaCopy } from './brandOutputCopy';

// ─── Brand profile store ──────────────────────────────────────────────────────

export {
  BRAND_PROFILE_STORE_KEY,
  loadStoredBrandProfiles,
  saveStoredBrandProfiles,
  upsertStoredBrandProfile,
  deleteStoredBrandProfile,
  listStoredBrandProfiles,
} from './brandProfileStore';

// ─── Brand editor ─────────────────────────────────────────────────────────────

export { BrandEditorPanel } from './BrandEditorPanel';
export type { BrandEditorPanelProps } from './BrandEditorPanel';

// ─── Brand preview ────────────────────────────────────────────────────────────

export { BrandPreviewCard } from './BrandPreviewCard';
export type { BrandPreviewCardProps } from './BrandPreviewCard';
