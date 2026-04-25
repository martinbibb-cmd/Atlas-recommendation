/**
 * buildQuoteScope.test.ts
 *
 * PR13 — Unit tests for the canonical quote scope builder.
 *
 * Coverage:
 *   - inferCategory maps label keywords to correct categories
 *   - buildQuoteScope maps includedItems to included scope items
 *   - buildQuoteScope maps requiredWorks to included scope items with correct categories
 *   - buildQuoteScope maps compliance-pattern requiredWorks to category='compliance'
 *   - buildQuoteScope maps compatibilityWarnings with compliance patterns to compliance items
 *   - buildQuoteScope does NOT add non-compliance warnings as scope items
 *   - buildQuoteScope maps futureUpgradePaths to optional/future items
 *   - buildQuoteScope deduplicates items with identical labels across lists
 *   - scopeIncluded returns only status='included', non-future items
 *   - scopeCompliance returns only compliance/included items
 *   - scopeRecommended returns only status='recommended' items
 *   - scopeFuture returns only optional/future items
 *   - scopeFuturePaths excludes labels already in included scope
 */

import { describe, it, expect } from 'vitest';
import {
  buildQuoteScope,
  inferCategory,
  normalizeLabel,
  scopeIncluded,
  scopeCompliance,
  scopeRecommended,
  scopeFuture,
  scopeFuturePaths,
  EMPTY_SCOPE_MESSAGE,
} from '../modules/buildQuoteScope';

// ─── inferCategory ────────────────────────────────────────────────────────────

describe('inferCategory', () => {
  it('maps boiler to heat_source', () => {
    expect(inferCategory('System boiler')).toBe('heat_source');
  });

  it('maps heat pump to heat_source', () => {
    expect(inferCategory('Air source heat pump')).toBe('heat_source');
  });

  it('maps cylinder to hot_water', () => {
    expect(inferCategory('210L Mixergy cylinder')).toBe('hot_water');
  });

  it('maps DHW to hot_water', () => {
    expect(inferCategory('DHW store')).toBe('hot_water');
  });

  it('maps controls to controls', () => {
    expect(inferCategory('Smart controls')).toBe('controls');
  });

  it('maps thermostat to controls', () => {
    expect(inferCategory('Programmable thermostat')).toBe('controls');
  });

  it('maps TRVs to controls', () => {
    expect(inferCategory('Smart TRVs')).toBe('controls');
  });

  it('maps inhibitor to protection', () => {
    expect(inferCategory('System inhibitor')).toBe('protection');
  });

  it('maps filter to protection', () => {
    expect(inferCategory('Magnetic filter')).toBe('protection');
  });

  it('maps pipework to pipework', () => {
    expect(inferCategory('Primary circuit pipework')).toBe('pipework');
  });

  it('maps flush to flush', () => {
    expect(inferCategory('Power flush')).toBe('flush');
  });

  it('maps G3 to compliance', () => {
    expect(inferCategory('G3 commissioning')).toBe('compliance');
  });

  it('maps discharge to compliance', () => {
    expect(inferCategory('Confirm discharge route')).toBe('compliance');
  });

  it('maps building regs to compliance', () => {
    expect(inferCategory('Building Regs notification')).toBe('compliance');
  });

  it('maps solar to future', () => {
    expect(inferCategory('Solar thermal compatible')).toBe('future');
  });

  it('maps heat pump ready to future', () => {
    expect(inferCategory('Heat pump ready pathway')).toBe('future');
  });

  it('falls back to pipework for unrecognised labels', () => {
    expect(inferCategory('Some unknown item')).toBe('pipework');
  });
});

// ─── buildQuoteScope — includedItems ─────────────────────────────────────────

describe('buildQuoteScope — includedItems', () => {
  it('maps includedItems to included status items', () => {
    const scope = buildQuoteScope({
      includedItems: ['System boiler', '210L Mixergy cylinder'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const included = scope.filter((s) => s.label === 'System boiler');
    expect(included).toHaveLength(1);
    expect(included[0].status).toBe('included');
    expect(included[0].category).toBe('heat_source');
  });

  it('assigns stable unique ids to all items', () => {
    const scope = buildQuoteScope({
      includedItems: ['Boiler A', 'Cylinder B'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const ids = scope.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── buildQuoteScope — requiredWorks ─────────────────────────────────────────

describe('buildQuoteScope — requiredWorks', () => {
  it('maps requiredWorks to included status items', () => {
    const scope = buildQuoteScope({
      includedItems: [],
      requiredWorks: ['Power flush primary circuit'],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const item = scope.find((s) => s.label === 'Power flush');
    expect(item?.status).toBe('included');
    expect(item?.category).toBe('flush');
  });

  it('maps G3 commissioning to compliance category with engineerNote', () => {
    const scope = buildQuoteScope({
      includedItems: [],
      requiredWorks: ['G3 commissioning'],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const item = scope.find((s) => s.label === 'G3 commissioning');
    expect(item?.category).toBe('compliance');
    expect(item?.engineerNote).toBeTruthy();
  });

  it('maps discharge route work to compliance category', () => {
    const scope = buildQuoteScope({
      includedItems: [],
      requiredWorks: ['Verify discharge route'],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const item = scope.find((s) => s.label === 'Verify discharge route');
    expect(item?.category).toBe('compliance');
  });
});

// ─── buildQuoteScope — compatibilityWarnings ──────────────────────────────────

describe('buildQuoteScope — compatibilityWarnings', () => {
  it('adds compliance-pattern warnings as compliance items', () => {
    const scope = buildQuoteScope({
      includedItems: [],
      requiredWorks: [],
      compatibilityWarnings: ['G3 installer required'],
      futureUpgradePaths: [],
    });
    const item = scope.find((s) => s.label === 'G3 installer required');
    expect(item).toBeDefined();
    expect(item?.category).toBe('compliance');
    expect(item?.status).toBe('included');
  });

  it('does NOT add non-compliance warnings to scope items', () => {
    const scope = buildQuoteScope({
      includedItems: [],
      requiredWorks: [],
      compatibilityWarnings: ['Hydraulic assessment recommended'],
      futureUpgradePaths: [],
    });
    expect(scope.find((s) => s.label === 'Hydraulic assessment recommended')).toBeUndefined();
  });
});

// ─── buildQuoteScope — futureUpgradePaths ─────────────────────────────────────

describe('buildQuoteScope — futureUpgradePaths', () => {
  it('maps futureUpgradePaths to optional/future items', () => {
    const scope = buildQuoteScope({
      includedItems: [],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: ['Solar thermal compatible', 'Heat pump ready pathway'],
    });
    const future = scope.filter((s) => s.status === 'optional' && s.category === 'future');
    expect(future).toHaveLength(2);
  });
});

// ─── buildQuoteScope — deduplication ──────────────────────────────────────────

describe('buildQuoteScope — deduplication', () => {
  it('deduplicates items with the same label across lists', () => {
    const scope = buildQuoteScope({
      includedItems: ['Power flush'],
      requiredWorks: ['Power flush'],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    expect(scope.filter((s) => s.label === 'Power flush')).toHaveLength(1);
  });

  it('deduplicates case-insensitively', () => {
    const scope = buildQuoteScope({
      includedItems: ['power flush'],
      requiredWorks: ['Power Flush'],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    expect(scope.filter((s) => s.label.toLowerCase() === 'power flush')).toHaveLength(1);
  });
});

// ─── scopeIncluded ────────────────────────────────────────────────────────────

describe('scopeIncluded', () => {
  it('returns only status=included non-future items', () => {
    const scope = buildQuoteScope({
      includedItems: ['System boiler'],
      requiredWorks: ['G3 commissioning'],
      compatibilityWarnings: [],
      futureUpgradePaths: ['Solar thermal'],
    });
    const included = scopeIncluded(scope);
    expect(included.every((s) => s.status === 'included')).toBe(true);
    expect(included.some((s) => s.category === 'future')).toBe(false);
  });

  it('includes compliance items in the included set', () => {
    const scope = buildQuoteScope({
      includedItems: [],
      requiredWorks: ['G3 commissioning'],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const included = scopeIncluded(scope);
    expect(included.some((s) => s.category === 'compliance')).toBe(true);
  });
});

// ─── scopeCompliance ──────────────────────────────────────────────────────────

describe('scopeCompliance', () => {
  it('returns only compliance/included items', () => {
    const scope = buildQuoteScope({
      includedItems: ['System boiler'],
      requiredWorks: ['G3 commissioning', 'Power flush'],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const compliance = scopeCompliance(scope);
    expect(compliance.every((s) => s.category === 'compliance' && s.status === 'included')).toBe(true);
    expect(compliance.some((s) => s.label === 'G3 commissioning')).toBe(true);
    expect(compliance.some((s) => s.label === 'System boiler')).toBe(false);
  });
});

// ─── scopeRecommended ─────────────────────────────────────────────────────────

describe('scopeRecommended', () => {
  it('returns empty when no recommended items exist', () => {
    const scope = buildQuoteScope({
      includedItems: ['System boiler'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    expect(scopeRecommended(scope)).toHaveLength(0);
  });
});

// ─── scopeFuture ──────────────────────────────────────────────────────────────

describe('scopeFuture', () => {
  it('returns only optional/future items', () => {
    const scope = buildQuoteScope({
      includedItems: ['System boiler'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: ['Solar thermal compatible'],
    });
    const future = scopeFuture(scope);
    expect(future).toHaveLength(1);
    expect(future[0].category).toBe('future');
    expect(future[0].status).toBe('optional');
  });
});

// ─── scopeFuturePaths ────────────────────────────────────────────────────────

describe('scopeFuturePaths', () => {
  it('returns labels of future items', () => {
    const scope = buildQuoteScope({
      includedItems: [],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: ['Heat pump ready', 'Solar thermal compatible'],
    });
    const paths = scopeFuturePaths(scope);
    expect(paths).toContain('Heat pump ready');
    expect(paths).toContain('Solar thermal compatible');
  });

  it('excludes future paths whose label matches an already-included item', () => {
    // Edge case: a future path label that duplicates an included item label
    const scope = buildQuoteScope({
      includedItems: ['Heat pump ready'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: ['Heat pump ready', 'Solar thermal compatible'],
    });
    const paths = scopeFuturePaths(scope);
    // 'Heat pump ready' is already included → should not appear as a future path
    expect(paths).not.toContain('Heat pump ready');
    expect(paths).toContain('Solar thermal compatible');
  });

  it('returns empty array when quoteScope has no future items', () => {
    const scope = buildQuoteScope({
      includedItems: ['System boiler'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    expect(scopeFuturePaths(scope)).toHaveLength(0);
  });
});

// ─── buildQuoteScope — customerBenefit ───────────────────────────────────────

describe('buildQuoteScope — customerBenefit', () => {
  it('attaches a customerBenefit to protection items', () => {
    const scope = buildQuoteScope({
      includedItems: ['Magnetic filter'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const item = scope.find((s) => s.label === 'Magnetic filter');
    expect(item?.category).toBe('protection');
    expect(item?.customerBenefit).toContain('sludge');
  });

  it('attaches a customerBenefit to flush items', () => {
    const scope = buildQuoteScope({
      includedItems: ['Power flush primary circuit'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const item = scope.find((s) => s.label === 'Power flush');
    expect(item?.category).toBe('flush');
    expect(item?.customerBenefit).toBeTruthy();
  });

  it('attaches a customerBenefit to controls items', () => {
    const scope = buildQuoteScope({
      includedItems: ['Smart thermostat'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const item = scope.find((s) => s.label === 'Smart thermostat');
    expect(item?.category).toBe('controls');
    expect(item?.customerBenefit).toContain('comfort');
  });

  it('does NOT attach a customerBenefit to compliance items', () => {
    const scope = buildQuoteScope({
      includedItems: [],
      requiredWorks: ['G3 commissioning'],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const item = scope.find((s) => s.label === 'G3 commissioning');
    expect(item?.category).toBe('compliance');
    expect(item?.customerBenefit).toBeUndefined();
  });

  it('does NOT attach a customerBenefit to future items', () => {
    const scope = buildQuoteScope({
      includedItems: [],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: ['Solar PV diverter ready'],
    });
    const item = scope.find((s) => s.label === 'Solar PV diverter ready');
    expect(item?.category).toBe('future');
    expect(item?.customerBenefit).toBeUndefined();
  });
});

// ─── normalizeLabel ───────────────────────────────────────────────────────────

describe('normalizeLabel', () => {
  it('normalizes "powerflush" to "Power flush"', () => {
    expect(normalizeLabel('powerflush')).toBe('Power flush');
  });

  it('normalizes "system flush" to "Power flush"', () => {
    expect(normalizeLabel('system flush')).toBe('Power flush');
  });

  it('normalizes "system clean" to "Power flush"', () => {
    expect(normalizeLabel('system clean')).toBe('Power flush');
  });

  it('normalizes "power clean" to "Power flush"', () => {
    expect(normalizeLabel('power clean')).toBe('Power flush');
  });

  it('normalizes "magnetic filter" to "Magnetic filter"', () => {
    expect(normalizeLabel('magnetic filter')).toBe('Magnetic filter');
  });

  it('normalizes "filter" (standalone) to "Magnetic filter"', () => {
    expect(normalizeLabel('filter')).toBe('Magnetic filter');
  });

  it('normalizes "thermostat" to "Heating controls"', () => {
    expect(normalizeLabel('thermostat')).toBe('Heating controls');
  });

  it('normalizes "programmer" to "Heating controls"', () => {
    expect(normalizeLabel('programmer')).toBe('Heating controls');
  });

  it('normalizes "weather compensation" to "Heating controls"', () => {
    expect(normalizeLabel('weather compensation')).toBe('Heating controls');
  });

  it('normalizes "TRVs" to "TRVs"', () => {
    expect(normalizeLabel('TRVs')).toBe('TRVs');
  });

  it('normalizes "thermostatic radiator valves" to "TRVs"', () => {
    expect(normalizeLabel('thermostatic radiator valves')).toBe('TRVs');
  });

  it('returns original label for unknown variants', () => {
    expect(normalizeLabel('Some bespoke item')).toBe('Some bespoke item');
  });

  it('trims whitespace from labels', () => {
    expect(normalizeLabel('  Power flush  ')).toBe('Power flush');
  });
});

// ─── whatItDoes population ────────────────────────────────────────────────────

describe('buildQuoteScope — whatItDoes population', () => {
  it('populates whatItDoes for flush items', () => {
    const scope = buildQuoteScope({
      includedItems: ['powerflush'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const item = scope.find((s) => s.category === 'flush');
    expect(item?.whatItDoes).toBeDefined();
    expect(item?.whatItDoes).toContain('sludge');
  });

  it('populates whatItDoes for protection items', () => {
    const scope = buildQuoteScope({
      includedItems: ['magnetic filter'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const item = scope.find((s) => s.category === 'protection');
    expect(item?.whatItDoes).toBeDefined();
    expect(item?.whatItDoes).toContain('magnetite');
  });

  it('does NOT populate whatItDoes for compliance items', () => {
    const scope = buildQuoteScope({
      includedItems: [],
      requiredWorks: ['G3 notification required'],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const item = scope.find((s) => s.category === 'compliance');
    expect(item?.whatItDoes).toBeUndefined();
  });

  it('does NOT populate whatItDoes for future items', () => {
    const scope = buildQuoteScope({
      includedItems: [],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: ['Solar PV ready'],
    });
    const item = scope.find((s) => s.category === 'future');
    expect(item?.whatItDoes).toBeUndefined();
  });
});

// ─── quote with powerflush/filter/controls/TRVs ───────────────────────────────

describe('buildQuoteScope — common quoted items produce included scope with benefits', () => {
  it('quote with powerflush/filter/controls/TRVs produces four included scope items with benefits', () => {
    const scope = buildQuoteScope({
      includedItems: ['powerflush', 'magnetic filter', 'smart controls', 'TRVs'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const includedWithBenefits = scope.filter(
      (s) => s.status === 'included' && s.customerBenefit != null,
    );
    expect(includedWithBenefits.length).toBeGreaterThanOrEqual(4);
  });
});

// ─── EMPTY_SCOPE_MESSAGE ──────────────────────────────────────────────────────

describe('EMPTY_SCOPE_MESSAGE', () => {
  it('is exported and contains the expected advisor-facing text', () => {
    expect(EMPTY_SCOPE_MESSAGE).toContain('Scope not fully captured yet');
    expect(EMPTY_SCOPE_MESSAGE).toContain('confirm quote inclusions');
  });
});

// ─── isVerificationItem ───────────────────────────────────────────────────────

import { isVerificationItem } from '../modules/buildQuoteScope';

describe('isVerificationItem', () => {
  it('identifies "Confirm cylinder location" as a verification item', () => {
    expect(isVerificationItem('Confirm cylinder location')).toBe(true);
  });

  it('identifies "Check loft access" as a verification item', () => {
    expect(isVerificationItem('Check loft access')).toBe(true);
  });

  it('identifies "Verify discharge route" as a verification item', () => {
    expect(isVerificationItem('Verify discharge route')).toBe(true);
  });

  it('identifies "Loft remains accessible" as a verification item', () => {
    expect(isVerificationItem('Loft remains accessible for ongoing maintenance')).toBe(true);
  });

  it('identifies "Confirm before ordering" variant as a verification item', () => {
    expect(isVerificationItem('Confirm flue position before ordering')).toBe(true);
  });

  it('identifies "requires confirmation" phrase as a verification item', () => {
    expect(isVerificationItem('Cylinder position requires confirmation')).toBe(true);
  });

  it('does NOT flag "System boiler" as a verification item', () => {
    expect(isVerificationItem('System boiler')).toBe(false);
  });

  it('does NOT flag "Mixergy cylinder" as a verification item', () => {
    expect(isVerificationItem('Mixergy cylinder')).toBe(false);
  });

  it('does NOT flag "Power flush" as a verification item', () => {
    expect(isVerificationItem('Power flush')).toBe(false);
  });
});

// ─── buildQuoteScope — verification item reclassification ────────────────────

describe('buildQuoteScope — verification items are reclassified as required/compliance', () => {
  it('reclassifies "Confirm cylinder location" from included to required/compliance', () => {
    const scope = buildQuoteScope({
      includedItems: ['Confirm cylinder location'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const item = scope.find((s) => s.label === 'Confirm cylinder location');
    expect(item).toBeDefined();
    expect(item?.status).toBe('required');
    expect(item?.category).toBe('compliance');
  });

  it('does NOT attach customerBenefit to "Confirm cylinder location"', () => {
    const scope = buildQuoteScope({
      includedItems: ['Confirm cylinder location'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const item = scope.find((s) => s.label === 'Confirm cylinder location');
    expect(item?.customerBenefit).toBeUndefined();
  });

  it('does NOT attach whatItDoes to "Confirm cylinder location"', () => {
    const scope = buildQuoteScope({
      includedItems: ['Confirm cylinder location'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const item = scope.find((s) => s.label === 'Confirm cylinder location');
    expect(item?.whatItDoes).toBeUndefined();
  });

  it('reclassifies "Loft remains accessible" from included to required/compliance', () => {
    const scope = buildQuoteScope({
      includedItems: ['Loft remains accessible for ongoing maintenance'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const item = scope.find((s) => s.label.includes('Loft remains accessible'));
    expect(item?.status).toBe('required');
    expect(item?.category).toBe('compliance');
    expect(item?.customerBenefit).toBeUndefined();
  });

  it('does not affect real work items — System boiler remains included/heat_source', () => {
    const scope = buildQuoteScope({
      includedItems: ['System boiler', 'Confirm cylinder location'],
      requiredWorks: [],
      compatibilityWarnings: [],
      futureUpgradePaths: [],
    });
    const boiler = scope.find((s) => s.label === 'System boiler');
    expect(boiler?.status).toBe('included');
    expect(boiler?.category).toBe('heat_source');
    expect(boiler?.customerBenefit).toBeTruthy();
  });
});
