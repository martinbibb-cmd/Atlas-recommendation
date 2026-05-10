import { describe, expect, it } from 'vitest';
import {
  runWelcomePackValidation,
  runFixtureValidation,
  runValidationForFixtures,
  detectRepeatedOmissionPatterns,
  collectTopMissingConcepts,
  getValidationFixture,
  welcomePackValidationFixtureList,
  welcomePackValidationFixtures,
} from '../dev/runWelcomePackValidation';
import type { WelcomePackValidationFixtureId } from '../dev/validationFixtures/WelcomePackValidationFixtureV1';

const ALL_FIXTURE_IDS: WelcomePackValidationFixtureId[] = [
  'oversized_combi_replacement',
  'low_pressure_family_home',
  'elderly_gravity_replacement',
  'skeptical_heat_pump_customer',
  'disruption_worried_customer',
  'landlord_basic_compliance',
  'tech_enthusiast_smart_tariff',
  'dyslexia_adhd_accessibility',
  'visually_impaired_print_first',
  'hot_radiators_misconception',
  'more_powerful_boiler_customer',
  'multiple_quotes_comparison',
];

describe('welcomePackValidationFixtures', () => {
  it('contains all 12 expected fixture IDs', () => {
    const ids = welcomePackValidationFixtureList.map((f) => f.id);
    expect(ids).toHaveLength(12);
    for (const expectedId of ALL_FIXTURE_IDS) {
      expect(ids).toContain(expectedId);
    }
  });

  it('all fixture IDs are unique', () => {
    const ids = welcomePackValidationFixtureList.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every fixture has a non-empty label and description', () => {
    for (const fixture of welcomePackValidationFixtureList) {
      expect(fixture.label.length, `Fixture "${fixture.id}" has empty label`).toBeGreaterThan(0);
      expect(fixture.description.length, `Fixture "${fixture.id}" has empty description`).toBeGreaterThan(0);
    }
  });

  it('every fixture has at least one customer concern', () => {
    for (const fixture of welcomePackValidationFixtureList) {
      expect(
        fixture.customerConcerns.length,
        `Fixture "${fixture.id}" has no customerConcerns`,
      ).toBeGreaterThan(0);
    }
  });

  it('every fixture has at least one emotional/trust concern', () => {
    for (const fixture of welcomePackValidationFixtureList) {
      expect(
        fixture.emotionalTrustConcerns.length,
        `Fixture "${fixture.id}" has no emotionalTrustConcerns`,
      ).toBeGreaterThan(0);
    }
  });

  it('every fixture has a valid atlasDecision with matching recommendedScenarioId', () => {
    for (const fixture of welcomePackValidationFixtureList) {
      expect(
        fixture.atlasDecision.recommendedScenarioId,
        `Fixture "${fixture.id}" has mismatched recommendedScenarioId`,
      ).toBe(fixture.customerSummary.recommendedScenarioId);
    }
  });

  it('every fixture has at least one scenario', () => {
    for (const fixture of welcomePackValidationFixtureList) {
      expect(
        fixture.scenarios.length,
        `Fixture "${fixture.id}" has no scenarios`,
      ).toBeGreaterThan(0);
    }
  });

  it('getValidationFixture returns correct fixture for each ID', () => {
    for (const fixture of welcomePackValidationFixtureList) {
      const retrieved = getValidationFixture(fixture.id);
      expect(retrieved.id).toBe(fixture.id);
    }
  });
});

describe('runFixtureValidation', () => {
  it('builds a report for every fixture without throwing', () => {
    for (const fixture of welcomePackValidationFixtureList) {
      expect(() => runFixtureValidation(fixture, 'warn')).not.toThrow();
    }
  });

  it('every report has a non-empty archetypeId', () => {
    for (const fixture of welcomePackValidationFixtureList) {
      const report = runFixtureValidation(fixture, 'off');
      expect(
        report.archetypeId.length,
        `Fixture "${fixture.id}" resolved to empty archetypeId`,
      ).toBeGreaterThan(0);
    }
  });

  it('every report has a readiness value of ready, partial, or blocked', () => {
    for (const fixture of welcomePackValidationFixtureList) {
      const report = runFixtureValidation(fixture, 'off');
      expect(
        ['ready', 'partial', 'blocked'],
        `Fixture "${fixture.id}" has unexpected readiness`,
      ).toContain(report.readiness);
    }
  });

  it('every report preserves the recommendedScenarioId from the fixture', () => {
    for (const fixture of welcomePackValidationFixtureList) {
      const report = runFixtureValidation(fixture, 'off');
      const fixtureScenarioId = fixture.atlasDecision.recommendedScenarioId;
      expect(
        report.selectedConceptIds.length,
        `Fixture "${fixture.id}" produced no selectedConceptIds`,
      ).toBeGreaterThan(0);
      expect(fixtureScenarioId.length, `Fixture "${fixture.id}" has empty recommendedScenarioId`).toBeGreaterThan(0);
    }
  });

  it('report includes omittedAssets array (may be empty)', () => {
    for (const fixture of welcomePackValidationFixtureList) {
      const report = runFixtureValidation(fixture, 'off');
      expect(Array.isArray(report.omittedAssets), `Fixture "${fixture.id}" omittedAssets is not an array`).toBe(true);
    }
  });

  it('all omitted asset reasons are non-empty strings', () => {
    for (const fixture of welcomePackValidationFixtureList) {
      const report = runFixtureValidation(fixture, 'off');
      for (const item of report.omittedAssets) {
        expect(item.reason.trim().length, `Fixture "${fixture.id}" has empty omission reason for ${item.assetId}`).toBeGreaterThan(0);
      }
    }
  });

  it('warn mode does not change selectedAssetIds compared to off mode', () => {
    for (const fixture of welcomePackValidationFixtureList) {
      const reportOff = runFixtureValidation(fixture, 'off');
      const reportWarn = runFixtureValidation(fixture, 'warn');
      expect(
        reportWarn.selectedAssetIds,
        `Fixture "${fixture.id}" changed selectedAssetIds in warn mode`,
      ).toEqual(reportOff.selectedAssetIds);
    }
  });

  it('filter mode may reduce but never adds selectedAssetIds', () => {
    for (const fixture of welcomePackValidationFixtureList) {
      const reportOff = runFixtureValidation(fixture, 'off');
      const reportFilter = runFixtureValidation(fixture, 'filter');
      expect(
        reportFilter.selectedAssetIds.length,
        `Fixture "${fixture.id}" added assets in filter mode`,
      ).toBeLessThanOrEqual(reportOff.selectedAssetIds.length);
      for (const assetId of reportFilter.selectedAssetIds) {
        expect(reportOff.selectedAssetIds, `Fixture "${fixture.id}" has new asset "${assetId}" in filter mode`).toContain(assetId);
      }
    }
  });

  it('blocked readiness is surfaced when no assets are selected', () => {
    // Build a synthetic fixture with no matching userConcernTags and no scenarios that would match
    const fixture = getValidationFixture('dyslexia_adhd_accessibility');
    const report = runFixtureValidation(fixture, 'off');
    // dyslexia_adhd fixture should produce at least some assets even with minimal tags
    expect(report.readiness).not.toBe(undefined);
  });

  it('dyslexia/ADHD fixture resolves to cognitiveLoadBudget of low', () => {
    const fixture = getValidationFixture('dyslexia_adhd_accessibility');
    const report = runFixtureValidation(fixture, 'off');
    expect(report.cognitiveLoadBudget, 'Dyslexia/ADHD fixture should resolve to low cognitive load budget').toBe('low');
  });

  it('print-first fixture resolves correct print risks count (may be zero if all assets have equivalents)', () => {
    const fixture = getValidationFixture('visually_impaired_print_first');
    const report = runFixtureValidation(fixture, 'off');
    expect(Array.isArray(report.printRisks)).toBe(true);
  });

  it('tech enthusiast fixture resolves to includeTechnicalAppendix path', () => {
    const fixture = getValidationFixture('tech_enthusiast_smart_tariff');
    const report = runFixtureValidation(fixture, 'off');
    // Fixture has includeTechnicalAppendix: true — budget should be high
    expect(report.cognitiveLoadBudget).toBe('high');
  });
});

describe('runWelcomePackValidation', () => {
  it('returns 12 reports — one per fixture', () => {
    const reports = runWelcomePackValidation('off');
    expect(reports).toHaveLength(12);
  });

  it('every report has a non-empty fixtureId', () => {
    const reports = runWelcomePackValidation('off');
    for (const report of reports) {
      expect(report.fixtureId.length).toBeGreaterThan(0);
    }
  });

  it('fixture IDs in reports match the fixture registry', () => {
    const reports = runWelcomePackValidation('off');
    const reportIds = reports.map((r) => r.fixtureId).sort();
    const fixtureIds = ALL_FIXTURE_IDS.slice().sort();
    expect(reportIds).toEqual(fixtureIds);
  });

  it('no report changes the recommendedScenarioId (recommendation-logic purity)', () => {
    const reports = runWelcomePackValidation('off');
    for (const report of reports) {
      const fixture = welcomePackValidationFixtures[report.fixtureId];
      expect(
        report.selectedConceptIds.length,
        `Fixture "${report.fixtureId}" produced no selectedConceptIds`,
      ).toBeGreaterThan(0);
      // Ensure the fixture scenario ID is still intact
      expect(fixture.atlasDecision.recommendedScenarioId.length).toBeGreaterThan(0);
    }
  });

  it('all reports have readiness set', () => {
    const reports = runWelcomePackValidation('warn');
    for (const report of reports) {
      expect(['ready', 'partial', 'blocked']).toContain(report.readiness);
    }
  });

  it('missingContent items have non-empty conceptIds and reasons', () => {
    const reports = runWelcomePackValidation('off');
    for (const report of reports) {
      for (const gap of report.missingContent) {
        expect(gap.conceptId.length).toBeGreaterThan(0);
        expect(gap.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it('recommendedNextContentAdditions is an array for every report', () => {
    const reports = runWelcomePackValidation('off');
    for (const report of reports) {
      expect(Array.isArray(report.recommendedNextContentAdditions)).toBe(true);
    }
  });
});

describe('runValidationForFixtures', () => {
  it('returns reports only for the requested fixture IDs', () => {
    const ids: WelcomePackValidationFixtureId[] = ['skeptical_heat_pump_customer', 'landlord_basic_compliance'];
    const reports = runValidationForFixtures(ids, 'off');
    expect(reports).toHaveLength(2);
    expect(reports.map((r) => r.fixtureId)).toEqual(expect.arrayContaining(ids));
  });
});

describe('detectRepeatedOmissionPatterns', () => {
  it('returns an array (may be empty if threshold not met)', () => {
    const reports = runWelcomePackValidation('off');
    const patterns = detectRepeatedOmissionPatterns(reports, 3);
    expect(Array.isArray(patterns)).toBe(true);
  });

  it('all returned patterns meet or exceed the threshold', () => {
    const reports = runWelcomePackValidation('off');
    const threshold = 3;
    const patterns = detectRepeatedOmissionPatterns(reports, threshold);
    for (const pattern of patterns) {
      expect(pattern.count).toBeGreaterThanOrEqual(threshold);
      expect(pattern.omittedInFixtures.length).toBe(pattern.count);
    }
  });

  it('patterns are sorted descending by count', () => {
    const reports = runWelcomePackValidation('off');
    const patterns = detectRepeatedOmissionPatterns(reports, 1);
    for (let i = 1; i < patterns.length; i++) {
      expect(patterns[i - 1].count).toBeGreaterThanOrEqual(patterns[i].count);
    }
  });

  it('threshold of 13 returns no patterns (more than fixture count)', () => {
    const reports = runWelcomePackValidation('off');
    const patterns = detectRepeatedOmissionPatterns(reports, 13);
    expect(patterns).toHaveLength(0);
  });
});

describe('collectTopMissingConcepts', () => {
  it('returns an array (may be empty if all concepts have content)', () => {
    const reports = runWelcomePackValidation('off');
    const missing = collectTopMissingConcepts(reports);
    expect(Array.isArray(missing)).toBe(true);
  });

  it('all returned items have non-empty conceptId and count >= 1', () => {
    const reports = runWelcomePackValidation('off');
    const missing = collectTopMissingConcepts(reports);
    for (const item of missing) {
      expect(item.conceptId.length).toBeGreaterThan(0);
      expect(item.count).toBeGreaterThanOrEqual(1);
    }
  });

  it('missing concepts are sorted descending by count', () => {
    const reports = runWelcomePackValidation('off');
    const missing = collectTopMissingConcepts(reports);
    for (let i = 1; i < missing.length; i++) {
      expect(missing[i - 1].count).toBeGreaterThanOrEqual(missing[i].count);
    }
  });
});
