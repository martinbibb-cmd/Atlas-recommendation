/**
 * src/features/branding/BrandPreviewCard.tsx
 *
 * Live preview card for a BrandProfileV1.
 *
 * Shows:
 *   - BrandedHeader (company name, logo, contact)
 *   - Sample CTA button in the brand's primary colour
 *   - Sample customer card using current colours
 *   - BrandedFooter
 *
 * Wraps in an isolated BrandProvider so changes are visible immediately
 * without affecting the ambient brand context.
 *
 * Does not affect physics, ranking, or recommendation logic.
 */

import type { BrandProfileV1 } from './brandProfile';
import { BrandProvider } from './BrandProvider';
import { BrandedHeader } from './BrandedHeader';
import { BrandedFooter } from './BrandedFooter';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BrandPreviewCardProps {
  /** The profile to preview. */
  profile: BrandProfileV1;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * BrandPreviewCard
 *
 * Renders an isolated preview of how branded output surfaces will look
 * with the given BrandProfileV1.
 */
export function BrandPreviewCard({ profile }: BrandPreviewCardProps) {
  return (
    <BrandProvider profile={profile}>
      <div
        data-testid="brand-preview-card"
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          overflow: 'hidden',
          background: profile.theme.backgroundColor ?? '#ffffff',
          color: profile.theme.textColor ?? '#0f172a',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        {/* Branded header */}
        <BrandedHeader />

        {/* Sample customer card */}
        <div
          style={{
            padding: '1.25rem 1rem',
            background: profile.theme.surfaceColor ?? '#f8fafc',
          }}
        >
          <p
            data-testid="brand-preview-company"
            style={{
              fontWeight: 700,
              fontSize: '1rem',
              marginBottom: '0.5rem',
              color: profile.theme.primaryColor,
            }}
          >
            {profile.companyName}
          </p>
          <p style={{ fontSize: '0.875rem', marginBottom: '0.875rem', color: profile.theme.textColor ?? '#0f172a' }}>
            Sample recommendation output — your customers will see your company name,
            colours, and contact details here.
          </p>

          {/* Sample CTA */}
          <button
            data-testid="brand-preview-cta"
            style={{
              padding: '0.5rem 1.25rem',
              background: profile.theme.primaryColor,
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: 'default',
              fontSize: '0.875rem',
            }}
          >
            View your recommendation →
          </button>
        </div>

        {/* Branded footer */}
        <BrandedFooter />
      </div>
    </BrandProvider>
  );
}
