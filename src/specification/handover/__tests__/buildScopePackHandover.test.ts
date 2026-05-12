import { describe, expect, it } from 'vitest';
import type { AtlasDecisionV1 } from '../../../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../../../contracts/CustomerSummaryV1';
import type { EngineInputV2_3Contract } from '../../../../contracts/EngineInputV2_3';
import type { EngineOutputV1 } from '../../../../contracts/EngineOutputV1';
import { buildSuggestedImplementationPack } from '../../buildSuggestedImplementationPack';
import { buildSpecificationLinesFromImplementationPack } from '../../specLines/buildSpecificationLinesFromImplementationPack';
import { buildInstallationScopePacks } from '../../scopePacks/buildInstallationScopePacks';
import { buildScopePackHandover } from '../buildScopePackHandover';

const FIXED_NOW = '2026-05-12T00:00:00.000Z';

function makeDecision(overrides: Partial<AtlasDecisionV1> = {}): AtlasDecisionV1 {
  return {
    recommendedScenarioId: 'system_unvented',
    headline: 'System boiler + cylinder',
    summary: 'System boiler + unvented cylinder.',
    keyReasons: ['Stored hot water required'],
    avoidedRisks: [],
    dayToDayOutcomes: [],
    requiredWorks: [],
    compatibilityWarnings: [],
    includedItems: [],
    quoteScope: [],
    futureUpgradePaths: ['Heat pump path'],
    supportingFacts: [{ label: 'fact', value: 'value', source: 'survey' }],
    lifecycle: {
      currentSystem: { type: 'regular', ageYears: 12, condition: 'worn' },
      expectedLifespan: {
        typicalRangeYears: [12, 15],
        adjustedRangeYears: [11, 14],
      },
      influencingFactors: {
        waterQuality: 'moderate',
        scaleRisk: 'low',
        usageIntensity: 'medium',
        maintenanceLevel: 'average',
      },
      riskIndicators: [],
      summary: 'Lifecycle summary',
    },
    ...overrides,
  };
}

function makeCustomerSummary(overrides: Partial<CustomerSummaryV1> = {}): CustomerSummaryV1 {
  return {
    recommendedScenarioId: 'system_unvented',
    recommendedSystemLabel: 'System boiler',
    headline: 'System boiler',
    plainEnglishDecision: 'System boiler + cylinder',
    whyThisWins: [],
    whatThisAvoids: [],
    includedNow: [],
    requiredChecks: [],
    optionalUpgrades: [],
    futureReady: [],
    confidenceNotes: [],
    hardConstraints: [],
    performancePenalties: [],
    fitNarrative: 'Fit',
    ...overrides,
  };
}

function makeEngineOutput(): EngineOutputV1 {
  return {
    eligibility: [],
    redFlags: [],
    recommendation: { primary: 'System boiler + unvented cylinder' },
    explainers: [],
  };
}

function makeSurveyInput(overrides: Partial<EngineInputV2_3Contract> = {}): EngineInputV2_3Contract {
  return {
    infrastructure: { primaryPipeSizeMm: 22 },
    property: { peakHeatLossKw: 8.5 },
    occupancy: { signature: 'steady', peakConcurrentOutlets: 2 },
    dhw: { architecture: 'stored_standard' },
    services: {
      mainsStaticPressureBar: 3.2,
      mainsDynamicPressureBar: 2.5,
      mainsDynamicFlowLpm: 18,
      coldWaterSource: 'mains_true',
    },
    currentSystem: { boiler: { type: 'regular', ageYears: 12 } },
    ...overrides,
  };
}

function buildFixturePack(
  decisionOverrides: Partial<AtlasDecisionV1> = {},
  surveyOverrides: Partial<EngineInputV2_3Contract> = {},
) {
  return buildSuggestedImplementationPack(
    {
      atlasDecision: makeDecision(decisionOverrides),
      customerSummary: makeCustomerSummary({
        recommendedScenarioId: decisionOverrides.recommendedScenarioId ?? 'system_unvented',
      }),
      engineOutput: makeEngineOutput(),
      surveyInput: makeSurveyInput(surveyOverrides),
    },
    FIXED_NOW,
  );
}

function buildFixtureHandover(
  decisionOverrides: Partial<AtlasDecisionV1> = {},
  surveyOverrides: Partial<EngineInputV2_3Contract> = {},
) {
  const implementationPack = buildFixturePack(decisionOverrides, surveyOverrides);
  const specificationLines = buildSpecificationLinesFromImplementationPack(implementationPack);
  const scopePacks = buildInstallationScopePacks(specificationLines, implementationPack);

  return {
    implementationPack,
    specificationLines,
    scopePacks,
  };
}

describe('buildScopePackHandover', () => {
  it('customer handover excludes expansion vessel sizing/detail', () => {
    const { implementationPack, specificationLines, scopePacks } = buildFixtureHandover();
    const handover = buildScopePackHandover(scopePacks, specificationLines, implementationPack);

    const customerText = JSON.stringify(handover.customerScopeSummary);
    expect(customerText).not.toMatch(/expansion vessel/i);
    expect(customerText).not.toMatch(/PRV/i);
    expect(customerText).not.toMatch(/ERV/i);
  });

  it('engineer handover includes tundish and discharge validation', () => {
    const { implementationPack, specificationLines, scopePacks } = buildFixtureHandover();
    const handover = buildScopePackHandover(scopePacks, specificationLines, implementationPack);

    const engineerText = JSON.stringify(handover.engineerInstallNotes);
    expect(engineerText).toMatch(/tundish/i);
    expect(engineerText).toMatch(/discharge/i);
  });

  it('office review includes G3 and MCS qualifications when relevant', () => {
    const unventedFixture = buildFixtureHandover();
    const unventedHandover = buildScopePackHandover(
      unventedFixture.scopePacks,
      unventedFixture.specificationLines,
      unventedFixture.implementationPack,
    );
    expect(unventedHandover.officeReviewSummary.qualifications.map((item) => item.label)).toContain(
      'G3 Unvented Hot Water Installer',
    );

    const heatPumpFixture = buildFixtureHandover(
      { recommendedScenarioId: 'ashp', futureUpgradePaths: [] },
      { dhw: { architecture: 'on_demand' } },
    );
    const heatPumpHandover = buildScopePackHandover(
      heatPumpFixture.scopePacks,
      heatPumpFixture.specificationLines,
      heatPumpFixture.implementationPack,
    );
    expect(heatPumpHandover.officeReviewSummary.qualifications.map((item) => item.label)).toContain(
      'MCS-Certified Heat Pump Installer',
    );
  });

  it('rejected packs are excluded from audience handover packs', () => {
    const { implementationPack, specificationLines, scopePacks } = buildFixtureHandover();
    const rejectedScopePacks = scopePacks.map((pack) =>
      pack.packId === 'standard_unvented_cylinder_install'
        ? { ...pack, reviewStatus: 'rejected' as const }
        : pack,
    );

    const handover = buildScopePackHandover(rejectedScopePacks, specificationLines, implementationPack);

    expect(handover.customerScopeSummary.packs.map((pack) => pack.packId)).not.toContain(
      'standard_unvented_cylinder_install',
    );
    expect(handover.engineerInstallNotes.packs.map((pack) => pack.packId)).not.toContain(
      'standard_unvented_cylinder_install',
    );
    expect(handover.officeReviewSummary.packs.map((pack) => pack.packId)).not.toContain(
      'standard_unvented_cylinder_install',
    );
  });

  it('needs_check lines surface as unresolved checks', () => {
    const { implementationPack, specificationLines, scopePacks } = buildFixtureHandover();
    const linesWithNeedsCheck = specificationLines.map((line) =>
      line.label === 'Primary circuit flush strategy'
        ? { ...line, status: 'needs_check' as const }
        : line,
    );

    const handover = buildScopePackHandover(scopePacks, linesWithNeedsCheck, implementationPack);
    expect(handover.engineerInstallNotes.unresolvedChecks.map((check) => check.label)).toContain(
      'Primary circuit flush strategy',
    );
    expect(handover.officeReviewSummary.unresolvedChecks.map((check) => check.label)).toContain(
      'Primary circuit flush strategy',
    );
  });

  it('is deterministic for the same inputs', () => {
    const { implementationPack, specificationLines, scopePacks } = buildFixtureHandover();

    const first = buildScopePackHandover(scopePacks, specificationLines, implementationPack);
    const second = buildScopePackHandover(scopePacks, specificationLines, implementationPack);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
