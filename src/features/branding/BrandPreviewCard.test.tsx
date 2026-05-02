/**
 * src/features/branding/BrandPreviewCard.test.tsx
 *
 * Tests for the BrandPreviewCard component.
 *
 * Coverage:
 *   - renders data-testid="brand-preview-card"
 *   - renders the company name from the profile
 *   - renders BrandedHeader (branded-header)
 *   - renders BrandedFooter (branded-footer)
 *   - renders the CTA button
 *   - preview updates when profile prop changes
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandPreviewCard } from './BrandPreviewCard';
import type { BrandProfileV1 } from './brandProfile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProfile(overrides?: Partial<BrandProfileV1>): BrandProfileV1 {
  return {
    version: '1.0',
    brandId: 'test-preview',
    companyName: 'Preview Heating Co',
    theme: {
      primaryColor: '#16A34A',
      backgroundColor: '#ffffff',
      surfaceColor: '#f0fdf4',
      textColor: '#052e16',
    },
    contact: {},
    outputSettings: {
      showPricing: true,
      showCarbon: true,
      showInstallerContact: false,
      tone: 'friendly',
    },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BrandPreviewCard', () => {
  it('renders data-testid="brand-preview-card"', () => {
    render(<BrandPreviewCard profile={makeProfile()} />);
    expect(screen.getByTestId('brand-preview-card')).toBeTruthy();
  });

  it('renders the company name from the profile', () => {
    render(<BrandPreviewCard profile={makeProfile({ companyName: 'My Heating Ltd' })} />);
    expect(screen.getByTestId('brand-preview-company').textContent).toBe('My Heating Ltd');
  });

  it('renders BrandedHeader', () => {
    render(<BrandPreviewCard profile={makeProfile()} />);
    expect(screen.getByTestId('branded-header')).toBeTruthy();
  });

  it('renders BrandedFooter', () => {
    render(<BrandPreviewCard profile={makeProfile()} />);
    expect(screen.getByTestId('branded-footer')).toBeTruthy();
  });

  it('renders the CTA button', () => {
    render(<BrandPreviewCard profile={makeProfile()} />);
    expect(screen.getByTestId('brand-preview-cta')).toBeTruthy();
  });

  it('shows header company name matching the profile', () => {
    render(<BrandPreviewCard profile={makeProfile({ companyName: 'Acme Boilers' })} />);
    expect(screen.getByTestId('branded-header-company').textContent).toBe('Acme Boilers');
  });

  it('shows footer company name matching the profile', () => {
    render(<BrandPreviewCard profile={makeProfile({ companyName: 'Footer Co' })} />);
    expect(screen.getByTestId('branded-footer-company').textContent).toBe('Footer Co');
  });

  it('preview reflects a changed company name when profile changes', () => {
    const { rerender } = render(<BrandPreviewCard profile={makeProfile({ companyName: 'Before' })} />);
    expect(screen.getByTestId('brand-preview-company').textContent).toBe('Before');
    rerender(<BrandPreviewCard profile={makeProfile({ companyName: 'After' })} />);
    expect(screen.getByTestId('brand-preview-company').textContent).toBe('After');
  });
});
