/**
 * src/features/branding/BrandedHeader.tsx
 *
 * Branded header component for customer-facing output surfaces.
 *
 * Shows:
 *   - Brand logo (when logoUrl is set)
 *   - Company name (always)
 *   - Installer contact details (when outputSettings.showInstallerContact === true)
 *     - phone, email, website (never address — address is footer-only)
 *
 * Requires a <BrandProvider> ancestor.
 * Does not affect physics, ranking, or recommendation logic.
 */

import { useBrandProfile } from './useBrandProfile';
import { BrandLogo } from './BrandLogo';
import './brandTheme.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BrandedHeaderProps {
  /** Optional extra CSS class for the header element. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * BrandedHeader
 *
 * Customer-facing header bar for deck, portal, and print/PDF surfaces.
 * All content is driven by the active BrandProfileV1 — no hard-coded copy.
 *
 * Contact details are shown only when
 * `brand.outputSettings.showInstallerContact === true`.
 */
export function BrandedHeader({ className }: BrandedHeaderProps) {
  const brand = useBrandProfile();
  const { showInstallerContact } = brand.outputSettings;

  return (
    <header
      className={`branded-header${className ? ` ${className}` : ''}`}
      data-testid="branded-header"
    >
      <div className="branded-header__identity">
        <BrandLogo />
        <span className="brand-company-name" data-testid="branded-header-company">
          {brand.companyName}
        </span>
      </div>

      {showInstallerContact && (
        <div className="branded-header__contact" data-testid="branded-header-contact">
          {brand.contact.phone && (
            <a
              href={`tel:${brand.contact.phone}`}
              className="branded-header__contact-item"
              data-testid="branded-header-phone"
            >
              {brand.contact.phone}
            </a>
          )}
          {brand.contact.email && (
            <a
              href={`mailto:${brand.contact.email}`}
              className="branded-header__contact-item"
              data-testid="branded-header-email"
            >
              {brand.contact.email}
            </a>
          )}
          {brand.contact.website && (
            <a
              href={brand.contact.website}
              target="_blank"
              rel="noopener noreferrer"
              className="branded-header__contact-item"
              data-testid="branded-header-website"
            >
              {brand.contact.website}
            </a>
          )}
        </div>
      )}
    </header>
  );
}
