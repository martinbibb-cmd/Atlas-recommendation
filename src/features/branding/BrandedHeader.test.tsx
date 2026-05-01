/**
 * src/features/branding/BrandedHeader.test.tsx
 *
 * Tests for BrandedHeader component.
 *
 * Coverage:
 *   - renders company name always
 *   - renders logo when logoUrl is present
 *   - hides logo when logoUrl is absent
 *   - shows contact section when showInstallerContact === true
 *   - hides contact section when showInstallerContact === false
 *   - shows phone, email, website when all are set and showInstallerContact true
 *   - omits phone/email/website when the respective field is absent
 *   - installer-demo profile shows expected contact details
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandProvider } from './BrandProvider';
import { BrandedHeader } from './BrandedHeader';
import type { BrandProfileV1 } from './brandProfile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Renders BrandedHeader inside a BrandProvider whose profile is overridden via brandId. */
function renderWithBrand(brandId?: string) {
  return render(
    <BrandProvider brandId={brandId}>
      <BrandedHeader />
    </BrandProvider>,
  );
}

/** Registers an ad-hoc brand profile then renders BrandedHeader inside that brand. */
function renderWithProfile(profile: BrandProfileV1) {
  // BrandProvider accepts a raw profile via the `profile` prop (test backdoor)
  return render(
    <BrandProvider profile={profile}>
      <BrandedHeader />
    </BrandProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BrandedHeader', () => {
  it('renders data-testid="branded-header"', () => {
    renderWithBrand();
    expect(screen.getByTestId('branded-header')).toBeTruthy();
  });

  it('shows atlas-default company name when no brandId provided', () => {
    renderWithBrand();
    expect(screen.getByTestId('branded-header-company').textContent).toBe('Atlas');
  });

  it('shows installer-demo company name when that brandId is provided', () => {
    renderWithBrand('installer-demo');
    expect(screen.getByTestId('branded-header-company').textContent).toBe('Demo Heating Co');
  });

  it('does NOT show contact section when showInstallerContact is false', () => {
    renderWithBrand('atlas-default');
    expect(screen.queryByTestId('branded-header-contact')).toBeNull();
  });

  it('shows contact section when showInstallerContact is true', () => {
    renderWithBrand('installer-demo');
    expect(screen.getByTestId('branded-header-contact')).toBeTruthy();
  });

  it('shows phone when present and showInstallerContact true', () => {
    renderWithProfile({
      version: '1.0',
      brandId: 't',
      companyName: 'Test',
      theme: { primaryColor: '#000' },
      contact: { phone: '01234 567890', email: '', website: '' },
      outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: true, tone: 'technical' },
    });
    expect(screen.getByTestId('branded-header-phone').textContent).toBe('01234 567890');
  });

  it('shows email when present and showInstallerContact true', () => {
    renderWithProfile({
      version: '1.0',
      brandId: 't',
      companyName: 'Test',
      theme: { primaryColor: '#000' },
      contact: { phone: '', email: 'test@example.com', website: '' },
      outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: true, tone: 'technical' },
    });
    expect(screen.getByTestId('branded-header-email').textContent).toBe('test@example.com');
  });

  it('shows website when present and showInstallerContact true', () => {
    renderWithProfile({
      version: '1.0',
      brandId: 't',
      companyName: 'Test',
      theme: { primaryColor: '#000' },
      contact: { phone: '', email: '', website: 'https://example.com' },
      outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: true, tone: 'technical' },
    });
    expect(screen.getByTestId('branded-header-website').textContent).toBe('https://example.com');
  });

  it('omits phone element when phone is absent', () => {
    renderWithProfile({
      version: '1.0',
      brandId: 't',
      companyName: 'Test',
      theme: { primaryColor: '#000' },
      contact: { phone: undefined, email: 'a@b.com' },
      outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: true, tone: 'technical' },
    });
    expect(screen.queryByTestId('branded-header-phone')).toBeNull();
    expect(screen.getByTestId('branded-header-email')).toBeTruthy();
  });

  it('does NOT render logo when logoUrl is absent', () => {
    renderWithBrand();
    expect(screen.queryByTestId('brand-logo')).toBeNull();
  });

  it('renders logo when logoUrl is set on the profile', () => {
    renderWithProfile({
      version: '1.0',
      brandId: 'logo-test',
      companyName: 'Logo Co',
      logoUrl: 'https://example.com/logo.png',
      theme: { primaryColor: '#abc' },
      contact: {},
      outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: false, tone: 'friendly' },
    });
    const img = screen.getByTestId('brand-logo') as HTMLImageElement;
    expect(img.src).toContain('example.com/logo.png');
    expect(img.alt).toBe('Logo Co');
  });
});
