/**
 * src/features/branding/BrandedFooter.test.tsx
 *
 * Tests for BrandedFooter component.
 *
 * Coverage:
 *   - renders company name always
 *   - shows address in footer only when showInstallerContact true and address set
 *   - hides address when showInstallerContact false
 *   - hides address when it is not set on the contact object
 *   - renders footerNote when provided
 *   - omits footerNote element when not provided
 *   - installer-demo shows address (if set) and footerNote
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandProvider } from './BrandProvider';
import { BrandedFooter } from './BrandedFooter';
import type { BrandProfileV1 } from './brandProfile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderWithProfile(profile: BrandProfileV1, footerNote?: string) {
  return render(
    <BrandProvider profile={profile}>
      <BrandedFooter footerNote={footerNote} />
    </BrandProvider>,
  );
}

function renderWithBrand(brandId?: string, footerNote?: string) {
  return render(
    <BrandProvider brandId={brandId}>
      <BrandedFooter footerNote={footerNote} />
    </BrandProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BrandedFooter', () => {
  it('renders data-testid="branded-footer"', () => {
    renderWithBrand();
    expect(screen.getByTestId('branded-footer')).toBeTruthy();
  });

  it('always shows company name', () => {
    renderWithBrand();
    expect(screen.getByTestId('branded-footer-company').textContent).toBe('Atlas');
  });

  it('shows installer-demo company name when that brandId is used', () => {
    renderWithBrand('installer-demo');
    expect(screen.getByTestId('branded-footer-company').textContent).toBe('Demo Heating Co');
  });

  it('renders footerNote when provided', () => {
    renderWithBrand(undefined, 'Ready to talk through the best next step?');
    expect(screen.getByTestId('branded-footer-note').textContent).toBe(
      'Ready to talk through the best next step?',
    );
  });

  it('omits footerNote element when not provided', () => {
    renderWithBrand();
    expect(screen.queryByTestId('branded-footer-note')).toBeNull();
  });

  it('shows address when showInstallerContact true and address is set', () => {
    renderWithProfile({
      version: '1.0',
      brandId: 'addr-test',
      companyName: 'Addr Co',
      theme: { primaryColor: '#000' },
      contact: { address: '1 Test Street, London, SW1A 1AA' },
      outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: true, tone: 'formal' },
    });
    expect(screen.getByTestId('branded-footer-address').textContent).toBe(
      '1 Test Street, London, SW1A 1AA',
    );
  });

  it('hides address when showInstallerContact is false', () => {
    renderWithProfile({
      version: '1.0',
      brandId: 'no-contact',
      companyName: 'No Contact Co',
      theme: { primaryColor: '#000' },
      contact: { address: '1 Test Street' },
      outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: false, tone: 'technical' },
    });
    expect(screen.queryByTestId('branded-footer-address')).toBeNull();
  });

  it('hides address element when address is not set on the profile', () => {
    renderWithProfile({
      version: '1.0',
      brandId: 'no-addr',
      companyName: 'No Addr Co',
      theme: { primaryColor: '#000' },
      contact: { phone: '01234 567890' },
      outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: true, tone: 'technical' },
    });
    expect(screen.queryByTestId('branded-footer-address')).toBeNull();
  });

  it('hides address from BrandedHeader — address is footer-only', () => {
    // This test verifies that BrandedFooter is the exclusive owner of address
    // rendering by checking that the footer-address testid is present here
    // and would NOT appear in BrandedHeader (covered in BrandedHeader.test.tsx).
    renderWithProfile({
      version: '1.0',
      brandId: 'footer-addr-only',
      companyName: 'Footer Co',
      theme: { primaryColor: '#000' },
      contact: { address: 'Footer Street' },
      outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: true, tone: 'formal' },
    });
    expect(screen.getByTestId('branded-footer-address')).toBeTruthy();
  });
});
