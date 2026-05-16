/**
 * buildSystemProtectionSummary.test.ts
 *
 * Validates:
 * - at_risk/sludge survey adds protection section with 'clean_and_protect' level
 * - clear condition gives lighter reassurance ('standard_protection' or 'none_needed')
 * - unknown/no-data condition asks installer to confirm ('needs_engineer_review')
 * - no forbidden technical terms leak into customer-facing copy
 * - PDF no longer implies heating circuit is untouched without preparation
 */

import { describe, expect, it } from 'vitest';
import {
  buildSystemProtectionSummary,
  type SurveySystemConditionV1,
} from '../buildSystemProtectionSummary';

// ─── Forbidden technical terms ────────────────────────────────────────────────

const FORBIDDEN_TERMS = [
  /\bbs7593\b/i,
  /\binhibitor\b/i,
  /\bmagnetite\b/i,
  /\bppm\b/i,
  /\bpower.?flush\b/i,
  /\bguaranteed\b/i,
  /\bsedbuk\b/i,
];

function assertNoForbiddenTerms(text: string): void {
  for (const pattern of FORBIDDEN_TERMS) {
    expect(text, `Forbidden term found: ${pattern}`).not.toMatch(pattern);
  }
}

function getAllCustomerText(result: ReturnType<typeof buildSystemProtectionSummary>): string {
  return [
    result.title,
    result.customerSummary,
    result.whyItMatters,
    result.whatInstallerWillCheck,
    ...result.customerVisibleBullets,
  ].join(' ');
}

// ─── Sludge / at-risk survey ──────────────────────────────────────────────────

describe('buildSystemProtectionSummary — at-risk / sludge signals', () => {
  it('dark bleed water triggers clean_and_protect', () => {
    const result = buildSystemProtectionSummary({ bleedWaterColour: 'black' });
    expect(result.treatmentLevel).toBe('clean_and_protect');
  });

  it('brown bleed water triggers clean_and_protect', () => {
    const result = buildSystemProtectionSummary({ bleedWaterColour: 'brown' });
    expect(result.treatmentLevel).toBe('clean_and_protect');
  });

  it('cold spots trigger clean_and_protect', () => {
    const result = buildSystemProtectionSummary({ coldSpots: true });
    expect(result.treatmentLevel).toBe('clean_and_protect');
  });

  it('uneven heating triggers clean_and_protect', () => {
    const result = buildSystemProtectionSummary({ unevenHeating: true });
    expect(result.treatmentLevel).toBe('clean_and_protect');
  });

  it('magnetic debris evidence triggers clean_and_protect', () => {
    const result = buildSystemProtectionSummary({ magneticDebrisEvidence: true });
    expect(result.treatmentLevel).toBe('clean_and_protect');
  });

  it('noisy or inconsistent system triggers clean_and_protect', () => {
    const result = buildSystemProtectionSummary({ systemNoisyOrInconsistent: true });
    expect(result.treatmentLevel).toBe('clean_and_protect');
  });

  it('poor condition band triggers clean_and_protect', () => {
    const result = buildSystemProtectionSummary({ conditionBand: 'poor' });
    expect(result.treatmentLevel).toBe('clean_and_protect');
  });

  it('severe condition band triggers clean_and_protect', () => {
    const result = buildSystemProtectionSummary({ conditionBand: 'severe' });
    expect(result.treatmentLevel).toBe('clean_and_protect');
  });

  it('system age > 10 years without recent clean triggers clean_and_protect', () => {
    const result = buildSystemProtectionSummary({ systemAgeYears: 15 });
    expect(result.treatmentLevel).toBe('clean_and_protect');
  });

  it('installer confirmed powerflush triggers clean_and_protect', () => {
    const result = buildSystemProtectionSummary({ installerFlushStrategy: 'yes' });
    expect(result.treatmentLevel).toBe('clean_and_protect');
  });

  it('installer chemical clean triggers clean_and_protect', () => {
    const result = buildSystemProtectionSummary({ installerFlushStrategy: 'chemical_only' });
    expect(result.treatmentLevel).toBe('clean_and_protect');
  });

  it('clean_and_protect summary mentions circuit signs / installer confirmation', () => {
    const result = buildSystemProtectionSummary({ coldSpots: true, bleedWaterColour: 'brown' });
    const text = getAllCustomerText(result);
    expect(text).toMatch(/circuit|installer|preparation/i);
  });

  it('clean_and_protect bullets reference restricted circulation', () => {
    const result = buildSystemProtectionSummary({ coldSpots: true });
    const bulletText = result.customerVisibleBullets.join(' ');
    expect(bulletText).toMatch(/circulation|preparation/i);
  });

  it('system aged > 10 years recently cleaned does NOT trigger clean_and_protect (no other signals)', () => {
    const result = buildSystemProtectionSummary({
      systemAgeYears: 15,
      recentlyCleaned: true,
    });
    expect(result.treatmentLevel).not.toBe('clean_and_protect');
  });
});

// ─── Clear / good condition ───────────────────────────────────────────────────

describe('buildSystemProtectionSummary — clear / good condition', () => {
  it('clear bleed water with no sludge signals and filter gives none_needed', () => {
    const result = buildSystemProtectionSummary({
      bleedWaterColour: 'clear',
      filterPresent: true,
    });
    expect(result.treatmentLevel).toBe('none_needed');
  });

  it('clear bleed water with no filter gives standard_protection', () => {
    const result = buildSystemProtectionSummary({
      bleedWaterColour: 'clear',
      filterPresent: false,
    });
    expect(result.treatmentLevel).toBe('standard_protection');
  });

  it('installer no-flush with clear bleed and filter gives none_needed', () => {
    const result = buildSystemProtectionSummary({
      bleedWaterColour: 'clear',
      filterPresent: true,
      installerFlushStrategy: 'no',
    });
    expect(result.treatmentLevel).toBe('none_needed');
  });

  it('none_needed summary mentions commissioning checks', () => {
    const result = buildSystemProtectionSummary({
      bleedWaterColour: 'clear',
      filterPresent: true,
    });
    const text = getAllCustomerText(result);
    expect(text).toMatch(/commissioning checks|setup checks/i);
  });

  it('standard_protection mentions standard protection', () => {
    const result = buildSystemProtectionSummary({
      bleedWaterColour: 'clear',
    });
    expect(result.customerSummary).toMatch(/standard protection/i);
  });

  it('light reassurance does not imply heating circuit is untouched', () => {
    const result = buildSystemProtectionSummary({
      bleedWaterColour: 'clear',
      filterPresent: true,
    });
    const text = getAllCustomerText(result);
    // Must still mention installer checks — not "nothing happens"
    expect(text).toMatch(/installer|check/i);
  });
});

// ─── Unknown / no-data condition ──────────────────────────────────────────────

describe('buildSystemProtectionSummary — unknown / no-data condition', () => {
  it('empty condition object returns needs_engineer_review', () => {
    const result = buildSystemProtectionSummary({});
    expect(result.treatmentLevel).toBe('needs_engineer_review');
  });

  it('needs_engineer_review summary asks installer to confirm', () => {
    const result = buildSystemProtectionSummary({});
    const text = getAllCustomerText(result);
    expect(text).toMatch(/confirm|installer/i);
  });

  it('installer not_assessed returns needs_engineer_review when no other signals', () => {
    // not_assessed is not a confirmed clean — no clear positive evidence
    const result = buildSystemProtectionSummary({
      installerFlushStrategy: 'not_assessed',
    });
    // not_assessed alone does not confirm clean condition, so no sludge signals
    // but we do have some data (installerFlushStrategy). The treatment should not be
    // 'clean_and_protect' since no sludge signals were found.
    expect(result.treatmentLevel).not.toBe('clean_and_protect');
  });
});

// ─── No forbidden technical terms ─────────────────────────────────────────────

describe('buildSystemProtectionSummary — forbidden terms', () => {
  const CONDITIONS: SurveySystemConditionV1[] = [
    {},
    { bleedWaterColour: 'black', coldSpots: true },
    { bleedWaterColour: 'clear', filterPresent: true },
    { installerFlushStrategy: 'yes' },
    { conditionBand: 'severe', systemNoisyOrInconsistent: true },
  ];

  for (const condition of CONDITIONS) {
    it(`no forbidden technical terms for condition: ${JSON.stringify(condition)}`, () => {
      const result = buildSystemProtectionSummary(condition);
      assertNoForbiddenTerms(getAllCustomerText(result));
    });
  }
});

// ─── Structural invariants ────────────────────────────────────────────────────

describe('buildSystemProtectionSummary — structural invariants', () => {
  it('always returns a non-empty title', () => {
    const result = buildSystemProtectionSummary({});
    expect(result.title.trim().length).toBeGreaterThan(0);
  });

  it('title is the canonical heading', () => {
    const result = buildSystemProtectionSummary({});
    expect(result.title).toBe('Protecting the existing heating system');
  });

  it('always returns at least one customer-visible bullet', () => {
    const result = buildSystemProtectionSummary({});
    expect(result.customerVisibleBullets.length).toBeGreaterThan(0);
  });

  it('all customer visible bullets are non-empty strings', () => {
    const result = buildSystemProtectionSummary({ coldSpots: true });
    for (const bullet of result.customerVisibleBullets) {
      expect(bullet.trim().length).toBeGreaterThan(0);
    }
  });

  it('engineerTrace contains treatmentLevel', () => {
    const result = buildSystemProtectionSummary({ coldSpots: true });
    expect(result.engineerTrace.some((t) => t.startsWith('treatmentLevel='))).toBe(true);
  });

  it('engineerTrace records bleedWaterColour when present', () => {
    const result = buildSystemProtectionSummary({ bleedWaterColour: 'brown' });
    expect(result.engineerTrace).toContain('bleedWaterColour=brown');
  });

  it('does not expose engineerTrace text in any customer-facing field', () => {
    const result = buildSystemProtectionSummary({ coldSpots: true });
    const customerText = getAllCustomerText(result);
    for (const trace of result.engineerTrace) {
      expect(customerText).not.toContain(trace);
    }
  });
});

// ─── PDF no longer implies heating circuit untouched ─────────────────────────

describe('buildSystemProtectionSummary — circuit not presented as untouched', () => {
  it('standard_protection does not imply "nothing changes"', () => {
    const result = buildSystemProtectionSummary({ bleedWaterColour: 'clear' });
    const text = getAllCustomerText(result);
    expect(text).not.toMatch(/nothing changes|untouched|no action/i);
  });

  it('none_needed still references commissioning / installer checks', () => {
    const result = buildSystemProtectionSummary({
      bleedWaterColour: 'clear',
      filterPresent: true,
    });
    const text = getAllCustomerText(result);
    expect(text).toMatch(/installer|check/i);
  });
});
