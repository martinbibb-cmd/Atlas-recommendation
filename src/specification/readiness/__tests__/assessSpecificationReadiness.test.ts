import { describe, expect, it } from 'vitest';
import type { AtlasDecisionV1 } from '../../../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../../../contracts/CustomerSummaryV1';
import type { EngineInputV2_3Contract } from '../../../../contracts/EngineInputV2_3';
import type { EngineOutputV1 } from '../../../../contracts/EngineOutputV1';
import { buildSuggestedImplementationPack } from '../../buildSuggestedImplementationPack';
import { buildScopePackHandover, buildEngineerJobPack } from '../../handover';
import { buildSuggestedMaterialsSchedule } from '../../materials';
import { buildInstallationScopePacks } from '../../scopePacks';
import { buildSpecificationLinesFromImplementationPack } from '../../specLines';
import { assessSpecificationReadiness } from '../assessSpecificationReadiness';

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

function buildReadinessFixture(
  decisionOverrides: Partial<AtlasDecisionV1> = {},
  surveyOverrides: Partial<EngineInputV2_3Contract> = {},
) {
  const implementationPack = buildSuggestedImplementationPack(
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

  const specificationLines = buildSpecificationLinesFromImplementationPack(implementationPack);
  const scopePacks = buildInstallationScopePacks(specificationLines, implementationPack);
  const handover = buildScopePackHandover(scopePacks, specificationLines, implementationPack);
  const engineerJobPack = buildEngineerJobPack(
    handover,
    implementationPack,
    specificationLines,
    makeSurveyInput(surveyOverrides),
    undefined,
  );
  const materialsSchedule = buildSuggestedMaterialsSchedule(scopePacks, specificationLines, implementationPack);

  return {
    implementationPack,
    specificationLines,
    scopePacks,
    handover,
    engineerJobPack,
    materialsSchedule,
  };
}

describe('assessSpecificationReadiness', () => {
  it('expansion vessel needs_survey blocks materials ordering', () => {
    const fixture = buildReadinessFixture();
    const readiness = assessSpecificationReadiness(fixture);
    expect(readiness.readyForMaterialsOrdering).toBe(false);
    expect(
      readiness.blockingReasons.some((reason) => /expansion/i.test(reason) && /material/i.test(reason)),
    ).toBe(true);
  });

  it('unresolved tundish/discharge validation blocks installer handover', () => {
    const fixture = buildReadinessFixture();
    const specificationLines = fixture.specificationLines.map((line) =>
      line.label === 'Validate tundish and discharge route'
        ? { ...line, status: 'needs_check' as const }
        : line,
    );
    const handover = buildScopePackHandover(fixture.scopePacks, specificationLines, fixture.implementationPack);
    const engineerJobPack = buildEngineerJobPack(
      handover,
      fixture.implementationPack,
      specificationLines,
      makeSurveyInput(),
      undefined,
    );
    const readiness = assessSpecificationReadiness({
      ...fixture,
      specificationLines,
      handover,
      engineerJobPack,
    });

    expect(readiness.readyForInstallerHandover).toBe(false);
    expect(readiness.blockingReasons.some((reason) => /tundish|discharge/i.test(reason))).toBe(true);
  });

  it('rejected required unvented pack blocks office review', () => {
    const fixture = buildReadinessFixture();
    const scopePacks = fixture.scopePacks.map((pack) =>
      pack.packId === 'standard_unvented_cylinder_install'
        ? { ...pack, reviewStatus: 'rejected' as const }
        : pack,
    );
    const handover = buildScopePackHandover(scopePacks, fixture.specificationLines, fixture.implementationPack);
    const engineerJobPack = buildEngineerJobPack(
      handover,
      fixture.implementationPack,
      fixture.specificationLines,
      makeSurveyInput(),
      undefined,
    );
    const readiness = assessSpecificationReadiness({
      ...fixture,
      scopePacks,
      handover,
      engineerJobPack,
    });

    expect(readiness.readyForOfficeReview).toBe(false);
    expect(readiness.blockingReasons.some((reason) => /required pack rejected/i.test(reason))).toBe(true);
  });

  it('customer-visible technical-only items block office review', () => {
    const fixture = buildReadinessFixture();
    const specificationLines = fixture.specificationLines.map((line) =>
      line.lineType === 'required_validation'
        ? { ...line, customerVisible: true }
        : line,
    );
    const readiness = assessSpecificationReadiness({
      ...fixture,
      specificationLines,
    });

    expect(readiness.readyForOfficeReview).toBe(false);
    expect(readiness.blockingReasons.some((reason) => /customer-visible/i.test(reason))).toBe(true);
  });

  it('heat-pump emitter unresolved blocks installer handover', () => {
    const fixture = buildReadinessFixture(
      { recommendedScenarioId: 'ashp', futureUpgradePaths: [] },
      { dhw: { architecture: 'on_demand' } },
    );
    const specificationLines = fixture.specificationLines.map((line) =>
      /emitter/i.test(line.label) ? { ...line, status: 'needs_check' as const } : line,
    );
    const handover = buildScopePackHandover(fixture.scopePacks, specificationLines, fixture.implementationPack);
    const engineerJobPack = buildEngineerJobPack(
      handover,
      fixture.implementationPack,
      specificationLines,
      makeSurveyInput({ dhw: { architecture: 'on_demand' } }),
      undefined,
    );
    const readiness = assessSpecificationReadiness({
      ...fixture,
      specificationLines,
      handover,
      engineerJobPack,
    });

    expect(readiness.readyForInstallerHandover).toBe(false);
    expect(readiness.blockingReasons.some((reason) => /emitter/i.test(reason))).toBe(true);
  });

  it('is deterministic for identical inputs', () => {
    const fixture = buildReadinessFixture();
    const first = assessSpecificationReadiness(fixture);
    const second = assessSpecificationReadiness(fixture);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
