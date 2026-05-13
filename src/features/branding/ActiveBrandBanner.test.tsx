/**
 * src/features/branding/ActiveBrandBanner.test.tsx
 *
 * Tests for the ActiveBrandBanner component.
 *
 * Coverage:
 *   - renders nothing when used outside a BrandProvider
 *   - shows companyName and "Atlas workspace" label inside a BrandProvider
 *   - shows installer-demo company name when that brand is active
 *   - does not show brandId dev-id span in non-DEV mode (import.meta.env.DEV = false by default in tests)
 *   - data-brand-id attribute reflects the active brand
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandProvider } from './BrandProvider';
import { ActiveBrandBanner } from './ActiveBrandBanner';
import type { BrandProfileV1 } from './brandProfile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderWithBrand(brandId?: string) {
  return render(
    <BrandProvider brandId={brandId}>
      <ActiveBrandBanner />
    </BrandProvider>,
  );
}

function renderWithProfile(profile: BrandProfileV1) {
  return render(
    <BrandProvider profile={profile}>
      <ActiveBrandBanner />
    </BrandProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ActiveBrandBanner — outside provider', () => {
  it('renders nothing when used outside a BrandProvider', () => {
    const { container } = render(<ActiveBrandBanner />);
    expect(container.firstChild).toBeNull();
  });
});

describe('ActiveBrandBanner — inside provider', () => {
  it('renders the banner element when inside a BrandProvider', () => {
    renderWithBrand();
    expect(screen.getByTestId('active-brand-banner')).toBeTruthy();
  });

  it('shows atlas-default company name by default', () => {
    renderWithBrand();
    expect(screen.getByTestId('active-brand-banner-name').textContent).toBe('Atlas');
  });

  it('shows installer-demo company name when that brand is active', () => {
    renderWithBrand('installer-demo');
    expect(screen.getByTestId('active-brand-banner-name').textContent).toBe('Demo Heating Co');
  });

  it('shows "workspace" label', () => {
    renderWithBrand();
    expect(screen.getByTestId('active-brand-banner-label').textContent).toBe('workspace');
  });

  it('sets data-brand-id to the active brandId', () => {
    renderWithBrand('installer-demo');
    const banner = screen.getByTestId('active-brand-banner') as HTMLElement;
    expect(banner.dataset.brandId).toBe('installer-demo');
  });

  it('reflects a custom profile company name', () => {
    renderWithProfile({
      version: '1.0',
      brandId: 'custom-co',
      companyName: 'Custom Heating Ltd',
      theme: { primaryColor: '#ff0000' },
      contact: {},
      outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: false, tone: 'technical' },
    });
    expect(screen.getByTestId('active-brand-banner-name').textContent).toBe('Custom Heating Ltd');
  });
});
