/**
 * src/features/branding/BrandLogo.tsx
 *
 * Renders the active brand logo when a logoUrl is present.
 * Renders nothing when no logo is configured.
 *
 * Requires a <BrandProvider> ancestor.
 */

import { useBrandProfile } from './useBrandProfile';

/**
 * BrandLogo
 *
 * Shows the brand's logo image when logoUrl is set on the active profile.
 * Uses the `.brand-logo` CSS class from brandTheme.css for sizing.
 */
export function BrandLogo() {
  const brand = useBrandProfile();
  if (!brand.logoUrl) return null;
  return (
    <img
      className="brand-logo"
      src={brand.logoUrl}
      alt={brand.companyName}
      data-testid="brand-logo"
    />
  );
}
