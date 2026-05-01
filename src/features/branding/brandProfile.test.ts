/**
 * src/features/branding/brandProfile.test.ts
 *
 * Unit tests for the branding resolver and profile registry.
 *
 * Coverage:
 *   - missing brandId resolves to atlas-default
 *   - unknown brandId resolves to atlas-default
 *   - installer-demo resolves correctly
 *   - resolved profiles satisfy the BrandProfileV1 shape
 */

import { describe, it, expect } from 'vitest';
import { resolveBrandProfile } from './resolveBrandProfile';
import { BRAND_PROFILES, DEFAULT_BRAND_ID } from './brandProfiles';

// ─── Resolver ─────────────────────────────────────────────────────────────────

describe('resolveBrandProfile', () => {
  it('returns atlas-default when brandId is undefined', () => {
    const profile = resolveBrandProfile(undefined);
    expect(profile.brandId).toBe('atlas-default');
    expect(profile.companyName).toBe('Atlas');
  });

  it('returns atlas-default when brandId is an empty string', () => {
    const profile = resolveBrandProfile('');
    expect(profile.brandId).toBe('atlas-default');
  });

  it('returns atlas-default for an unknown brandId', () => {
    const profile = resolveBrandProfile('completely-unknown-brand');
    expect(profile.brandId).toBe('atlas-default');
  });

  it('returns installer-demo when that brandId is requested', () => {
    const profile = resolveBrandProfile('installer-demo');
    expect(profile.brandId).toBe('installer-demo');
    expect(profile.companyName).toBe('Demo Heating Co');
  });

  it('is deterministic — repeated calls return the same object reference', () => {
    const a = resolveBrandProfile('installer-demo');
    const b = resolveBrandProfile('installer-demo');
    expect(a).toBe(b);
  });
});

// ─── Profile shapes ───────────────────────────────────────────────────────────

describe('atlas-default profile', () => {
  const profile = BRAND_PROFILES[DEFAULT_BRAND_ID];

  it('has version "1.0"', () => {
    expect(profile.version).toBe('1.0');
  });

  it('has a primary theme colour', () => {
    expect(typeof profile.theme.primaryColor).toBe('string');
    expect(profile.theme.primaryColor.length).toBeGreaterThan(0);
  });

  it('shows pricing and carbon by default', () => {
    expect(profile.outputSettings.showPricing).toBe(true);
    expect(profile.outputSettings.showCarbon).toBe(true);
  });

  it('does not show installer contact by default', () => {
    expect(profile.outputSettings.showInstallerContact).toBe(false);
  });

  it('uses technical tone', () => {
    expect(profile.outputSettings.tone).toBe('technical');
  });
});

describe('installer-demo profile', () => {
  const profile = BRAND_PROFILES['installer-demo'];

  it('has version "1.0"', () => {
    expect(profile.version).toBe('1.0');
  });

  it('shows installer contact', () => {
    expect(profile.outputSettings.showInstallerContact).toBe(true);
  });

  it('uses friendly tone', () => {
    expect(profile.outputSettings.tone).toBe('friendly');
  });

  it('has contact details', () => {
    expect(profile.contact.email).toBeTruthy();
  });
});
