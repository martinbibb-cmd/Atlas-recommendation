/**
 * src/features/branding/BrandedFooter.tsx
 *
 * Branded footer component for customer-facing output surfaces.
 *
 * Shows:
 *   - Company name (always)
 *   - Address (when outputSettings.showInstallerContact === true and address is set)
 *   - Optional footerNote string (e.g. CTA copy from getBrandCtaCopy)
 *
 * Requires a <BrandProvider> ancestor.
 * Does not affect physics, ranking, or recommendation logic.
 */

import { useBrandProfile } from './useBrandProfile';
import './brandTheme.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BrandedFooterProps {
  /** Optional extra CSS class for the footer element. */
  className?: string;
  /**
   * Optional note rendered below the company name / address.
   * Typically supplied from getBrandCtaCopy(brand).printFooterNote.
   */
  footerNote?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * BrandedFooter
 *
 * Customer-facing footer bar for deck, portal, and print/PDF surfaces.
 * All content is driven by the active BrandProfileV1 — no hard-coded copy.
 *
 * Address is shown only in the footer (never in BrandedHeader) and only when
 * `brand.outputSettings.showInstallerContact === true`.
 */
export function BrandedFooter({ className, footerNote }: BrandedFooterProps) {
  const brand = useBrandProfile();
  const { showInstallerContact } = brand.outputSettings;

  return (
    <footer
      className={`branded-footer${className ? ` ${className}` : ''}`}
      data-testid="branded-footer"
    >
      <span className="brand-company-name" data-testid="branded-footer-company">
        {brand.companyName}
      </span>

      {showInstallerContact && brand.contact.address && (
        <span className="branded-footer__address" data-testid="branded-footer-address">
          {brand.contact.address}
        </span>
      )}

      {footerNote && (
        <span className="branded-footer__note" data-testid="branded-footer-note">
          {footerNote}
        </span>
      )}
    </footer>
  );
}
