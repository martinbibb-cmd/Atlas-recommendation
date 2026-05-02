/**
 * src/features/branding/ActiveBrandBanner.tsx
 *
 * A compact confidence marker showing the active brand for the current visit.
 *
 * Renders:
 *   - Brand logo (when logoUrl is present on the profile)
 *   - Company name
 *   - "Atlas workspace" sub-label
 *   - brandId (developer mode only — import.meta.env.DEV)
 *
 * Uses useOptionalBrandProfile() so it renders nothing when placed outside a
 * BrandProvider.  This makes it safe to add to pages that may run in either
 * branded or unbranded contexts.
 *
 * Design rules
 * ────────────
 * - Small by default — this is a confidence marker, not the primary UI.
 * - Does not affect physics, ranking, or recommendation output.
 * - Does not throw when used outside a BrandProvider.
 */

import { useOptionalBrandProfile } from './useBrandProfile';
import { BrandLogo } from './BrandLogo';
import './brandTheme.css';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ActiveBrandBanner
 *
 * Place on visit-hub, active-visit route, receive-scan success, and engineer
 * pages to confirm which brand/installer the visit is running under.
 *
 * Silently renders nothing when there is no active BrandProvider.
 */
export function ActiveBrandBanner() {
  const profile = useOptionalBrandProfile();

  if (profile === null) {
    return null;
  }

  return (
    <div
      className="active-brand-banner"
      data-testid="active-brand-banner"
      data-brand-id={profile.brandId}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.375rem 0.75rem',
        background: 'var(--atlas-brand-surface, #f8fafc)',
        borderBottom: '1px solid var(--atlas-brand-primary, #2563eb)',
        fontSize: '0.8125rem',
      }}
    >
      <BrandLogo />
      <span
        className="active-brand-banner__name"
        data-testid="active-brand-banner-name"
        style={{ fontWeight: 600, color: 'var(--atlas-brand-primary, #2563eb)' }}
      >
        {profile.companyName}
      </span>
      <span
        className="active-brand-banner__label"
        data-testid="active-brand-banner-label"
        style={{ color: '#64748b', marginLeft: '0.25rem' }}
      >
        Atlas workspace
      </span>
      {import.meta.env.DEV && (
        <span
          className="active-brand-banner__dev-id"
          data-testid="active-brand-banner-dev-id"
          style={{
            marginLeft: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.6875rem',
            color: '#94a3b8',
            background: '#f1f5f9',
            padding: '1px 6px',
            borderRadius: 4,
          }}
        >
          {profile.brandId}
        </span>
      )}
    </div>
  );
}
