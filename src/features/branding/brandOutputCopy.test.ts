/**
 * src/features/branding/brandOutputCopy.test.ts
 *
 * Tests for getBrandCtaCopy() — deterministic CTA copy resolver.
 *
 * Coverage:
 *   - formal tone returns correct strings
 *   - friendly tone returns correct strings
 *   - technical tone returns correct strings
 *   - each tone's three fields are non-empty strings
 *   - function is pure: same input → same output reference
 */

import { describe, it, expect } from 'vitest';
import { getBrandCtaCopy } from './brandOutputCopy';
import type { BrandProfileV1 } from './brandProfile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProfile(tone: BrandProfileV1['outputSettings']['tone']): BrandProfileV1 {
  return {
    version: '1.0',
    brandId: `test-${tone}`,
    companyName: 'Test Co',
    theme: { primaryColor: '#000' },
    contact: {},
    outputSettings: {
      showPricing: true,
      showCarbon: true,
      showInstallerContact: false,
      tone,
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getBrandCtaCopy', () => {
  it('returns formal copy for formal tone', () => {
    const copy = getBrandCtaCopy(makeProfile('formal'));
    expect(copy.portalCta).toBe('Please contact us to discuss the next step.');
    expect(copy.contactCta).toBe('Please contact us to discuss the next step.');
    expect(copy.printFooterNote).toBe('Please contact us to discuss the next step.');
  });

  it('returns friendly copy for friendly tone', () => {
    const copy = getBrandCtaCopy(makeProfile('friendly'));
    expect(copy.portalCta).toBe('Ready to talk through the best next step?');
    expect(copy.contactCta).toBe('Ready to talk through the best next step?');
    expect(copy.printFooterNote).toBe('Ready to talk through the best next step?');
  });

  it('returns technical copy for technical tone', () => {
    const copy = getBrandCtaCopy(makeProfile('technical'));
    expect(copy.portalCta).toBe(
      'Review the recommendation and supporting evidence before proceeding.',
    );
    expect(copy.contactCta).toBe(
      'Review the recommendation and supporting evidence before proceeding.',
    );
    expect(copy.printFooterNote).toBe(
      'Review the recommendation and supporting evidence before proceeding.',
    );
  });

  it('all fields are non-empty strings for every tone', () => {
    for (const tone of ['formal', 'friendly', 'technical'] as const) {
      const copy = getBrandCtaCopy(makeProfile(tone));
      expect(typeof copy.portalCta).toBe('string');
      expect(copy.portalCta.length).toBeGreaterThan(0);
      expect(typeof copy.contactCta).toBe('string');
      expect(copy.contactCta.length).toBeGreaterThan(0);
      expect(typeof copy.printFooterNote).toBe('string');
      expect(copy.printFooterNote.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic — same profile returns same result', () => {
    const profile = makeProfile('friendly');
    const a = getBrandCtaCopy(profile);
    const b = getBrandCtaCopy(profile);
    expect(a).toBe(b); // same object reference from the lookup table
  });

  it('different tones return different portalCta strings', () => {
    const formal = getBrandCtaCopy(makeProfile('formal')).portalCta;
    const friendly = getBrandCtaCopy(makeProfile('friendly')).portalCta;
    const technical = getBrandCtaCopy(makeProfile('technical')).portalCta;
    expect(formal).not.toBe(friendly);
    expect(formal).not.toBe(technical);
    expect(friendly).not.toBe(technical);
  });
});
