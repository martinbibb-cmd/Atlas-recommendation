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
 *   - stored brand overrides built-in profile
 *   - unknown brand falls back to atlas-default even when stored profiles exist
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resolveBrandProfile } from './resolveBrandProfile';
import { BRAND_PROFILES, DEFAULT_BRAND_ID } from './brandProfiles';
import {
  upsertStoredBrandProfile,
  deleteStoredBrandProfile,
  BRAND_PROFILE_STORE_KEY,
} from './brandProfileStore';
import type { BrandProfileV1 } from './brandProfile';

function clearStore(): void {
  try { localStorage.removeItem(BRAND_PROFILE_STORE_KEY); } catch { /* unavailable */ }
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

describe('resolveBrandProfile', () => {
  beforeEach(() => {
    clearStore();
  });

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

  it('returns consistent brandId and companyName on repeated calls (no stored overrides)', () => {
    const a = resolveBrandProfile('installer-demo');
    const b = resolveBrandProfile('installer-demo');
    expect(a.brandId).toBe(b.brandId);
    expect(a.companyName).toBe(b.companyName);
  });

  it('stored profile wins over built-in when brandIds match', () => {
    const custom: BrandProfileV1 = {
      version: '1.0',
      brandId: 'installer-demo',
      companyName: 'My Custom Heating Co',
      theme: { primaryColor: '#ff0000' },
      contact: {},
      outputSettings: { showPricing: false, showCarbon: false, showInstallerContact: true, tone: 'technical' },
    };
    upsertStoredBrandProfile(custom);
    const profile = resolveBrandProfile('installer-demo');
    expect(profile.companyName).toBe('My Custom Heating Co');
    expect(profile.theme.primaryColor).toBe('#ff0000');
    deleteStoredBrandProfile('installer-demo');
  });

  it('falls back to atlas-default after stored override is deleted', () => {
    const custom: BrandProfileV1 = {
      version: '1.0',
      brandId: 'installer-demo',
      companyName: 'My Custom Heating Co',
      theme: { primaryColor: '#ff0000' },
      contact: {},
      outputSettings: { showPricing: false, showCarbon: false, showInstallerContact: true, tone: 'technical' },
    };
    upsertStoredBrandProfile(custom);
    deleteStoredBrandProfile('installer-demo');
    const profile = resolveBrandProfile('installer-demo');
    expect(profile.companyName).toBe('Demo Heating Co');
  });

  it('unknown brand falls back to atlas-default even when stored profiles exist', () => {
    const custom: BrandProfileV1 = {
      version: '1.0',
      brandId: 'my-custom-brand',
      companyName: 'Custom',
      theme: { primaryColor: '#abc' },
      contact: {},
      outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: false, tone: 'formal' },
    };
    upsertStoredBrandProfile(custom);
    const profile = resolveBrandProfile('completely-unknown-brand');
    expect(profile.brandId).toBe('atlas-default');
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
