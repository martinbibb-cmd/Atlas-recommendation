/**
 * src/features/branding/BrandProvider.test.tsx
 *
 * Integration tests for BrandProvider and useBrandProfile.
 *
 * Coverage:
 *   - useBrandProfile exposes the active brand profile
 *   - missing brandId renders atlas-default
 *   - installer-demo resolves correctly through the provider
 *   - provider applies CSS variables to the wrapper element
 *   - hook throws a useful error when used outside BrandProvider
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandProvider } from './BrandProvider';
import { useBrandProfile } from './useBrandProfile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Renders the active brand's companyName so tests can assert on it. */
function BrandDisplay() {
  const brand = useBrandProfile();
  return <span data-testid="company-name">{brand.companyName}</span>;
}

/** Renders the active brand's brandId in a data attribute. */
function BrandIdDisplay() {
  const brand = useBrandProfile();
  return <span data-testid="brand-id">{brand.brandId}</span>;
}

/** Renders all CSS-variable-relevant theme tokens as text so tests can inspect them. */
function ThemeTokenDisplay() {
  const brand = useBrandProfile();
  return (
    <span data-testid="primary-color">{brand.theme.primaryColor}</span>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BrandProvider', () => {
  it('exposes atlas-default when no brandId is provided', () => {
    render(
      <BrandProvider>
        <BrandDisplay />
      </BrandProvider>,
    );
    expect(screen.getByTestId('company-name').textContent).toBe('Atlas');
  });

  it('exposes atlas-default for an unknown brandId', () => {
    render(
      <BrandProvider brandId="no-such-brand">
        <BrandDisplay />
      </BrandProvider>,
    );
    expect(screen.getByTestId('company-name').textContent).toBe('Atlas');
  });

  it('resolves installer-demo correctly', () => {
    render(
      <BrandProvider brandId="installer-demo">
        <BrandDisplay />
      </BrandProvider>,
    );
    expect(screen.getByTestId('company-name').textContent).toBe('Demo Heating Co');
  });

  it('sets data-brand-id on the wrapper element', () => {
    const { container } = render(
      <BrandProvider brandId="installer-demo">
        <BrandIdDisplay />
      </BrandProvider>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.dataset.brandId).toBe('installer-demo');
  });

  it('applies --atlas-brand-primary as an inline CSS variable on the wrapper', () => {
    const { container } = render(
      <BrandProvider brandId="atlas-default">
        <ThemeTokenDisplay />
      </BrandProvider>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    const primary = wrapper.style.getPropertyValue('--atlas-brand-primary');
    // jsdom lowercases hex; compare case-insensitively
    expect(primary.toLowerCase()).toBe('#2563eb');
  });

  it('applies --atlas-brand-primary for installer-demo', () => {
    const { container } = render(
      <BrandProvider brandId="installer-demo">
        <ThemeTokenDisplay />
      </BrandProvider>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    const primary = wrapper.style.getPropertyValue('--atlas-brand-primary');
    expect(primary.toLowerCase()).toBe('#16a34a');
  });

  it('wraps children with the brand-theme-root class', () => {
    const { container } = render(
      <BrandProvider>
        <span>child</span>
      </BrandProvider>,
    );
    expect(container.firstElementChild?.classList.contains('brand-theme-root')).toBe(true);
  });
});

// ─── useBrandProfile outside provider ────────────────────────────────────────

describe('useBrandProfile', () => {
  it('throws a useful error when used outside BrandProvider', () => {
    // Suppress the React error boundary console output for this test
    const consoleError = console.error;
    console.error = () => {};

    expect(() => {
      render(<BrandDisplay />);
    }).toThrow(/useBrandProfile must be used inside a <BrandProvider>/);

    console.error = consoleError;
  });
});
