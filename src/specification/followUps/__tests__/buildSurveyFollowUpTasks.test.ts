import { describe, expect, it } from 'vitest';
import type { AtlasDecisionV1 } from '../../../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../../../contracts/CustomerSummaryV1';
import type { EngineInputV2_3Contract } from '../../../../contracts/EngineInputV2_3';
import type { EngineOutputV1 } from '../../../../contracts/EngineOutputV1';
import { buildSuggestedImplementationPack } from '../../buildSuggestedImplementationPack';
import { buildSurveyFollowUpTasks } from '../buildSurveyFollowUpTasks';
import { buildScopePackHandover, buildEngineerJobPack } from '../../handover';
import { buildSuggestedMaterialsSchedule } from '../../materials';
import { assessSpecificationReadiness } from '../../readiness';
import { buildInstallationScopePacks } from '../../scopePacks';
import { buildSpecificationLinesFromImplementationPack } from '../../specLines';

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

function buildFixture() {
  const implementationPack = buildSuggestedImplementationPack(
    {
      atlasDecision: makeDecision(),
      customerSummary: makeCustomerSummary(),
      engineOutput: makeEngineOutput(),
      surveyInput: makeSurveyInput(),
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
    makeSurveyInput(),
    undefined,
  );
  const materialsSchedule = buildSuggestedMaterialsSchedule(scopePacks, specificationLines, implementationPack);
  const readiness = assessSpecificationReadiness({
    implementationPack,
    specificationLines,
    scopePacks,
    handover,
    engineerJobPack,
    materialsSchedule,
  });

  return {
    implementationPack,
    specificationLines,
    scopePacks,
    handover,
    engineerJobPack,
    materialsSchedule,
    readiness,
  };
}

describe('buildSurveyFollowUpTasks', () => {
  it('creates at least one follow-up task for each readiness blocker', () => {
    const fixture = buildFixture();
    const tasks = buildSurveyFollowUpTasks(
      fixture.readiness,
      fixture.specificationLines,
      fixture.materialsSchedule,
      fixture.engineerJobPack,
    );

    expect(tasks.length).toBeGreaterThanOrEqual(fixture.readiness.blockingReasons.length);
  });

  it('does not create duplicate task titles', () => {
    const fixture = buildFixture();
    const tasks = buildSurveyFollowUpTasks(
      fixture.readiness,
      fixture.specificationLines,
      fixture.materialsSchedule,
      fixture.engineerJobPack,
    );

    const titles = tasks.map((task) => task.title.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('creates expansion vessel sizing task when expansion material needs survey', () => {
    const fixture = buildFixture();
    const tasks = buildSurveyFollowUpTasks(
      fixture.readiness,
      fixture.specificationLines,
      fixture.materialsSchedule,
      fixture.engineerJobPack,
    );

    expect(tasks.some((task) => /expansion vessel sizing basis/i.test(task.title))).toBe(true);
  });

  it('creates unknown location task with scan evidence', () => {
    const fixture = buildFixture();
    const engineeredWithUnknown = {
      ...fixture.engineerJobPack,
      locationsAndRoutes: [
        ...fixture.engineerJobPack.locationsAndRoutes,
        {
          text: 'Confirm unknown plant/cylinder location before first fix routing.',
          confidence: 'needs_survey' as const,
          location: {
            locationId: 'unknown:plant_cylinder',
            label: 'Needs survey',
            type: 'unknown' as const,
            confidence: 'needs_survey' as const,
            evidenceRefs: [],
          },
          mustConfirmOnSite: true,
        },
      ],
    };

    const tasks = buildSurveyFollowUpTasks(
      fixture.readiness,
      fixture.specificationLines,
      fixture.materialsSchedule,
      engineeredWithUnknown,
    );

    const unknownTask = tasks.find((task) => /unknown plant\/cylinder location/i.test(task.title));
    expect(unknownTask).toBeDefined();
    expect(unknownTask?.suggestedEvidenceType).toBe('scan_pin');
  });

  it('creates qualification task when G3 qualification is missing', () => {
    const fixture = buildFixture();
    const readinessWithMissingQualification = {
      ...fixture.readiness,
      blockingReasons: [
        ...fixture.readiness.blockingReasons,
        'Missing required qualification: G3 Unvented Hot Water Installer.',
      ],
    };

    const tasks = buildSurveyFollowUpTasks(
      readinessWithMissingQualification,
      fixture.specificationLines,
      fixture.materialsSchedule,
      fixture.engineerJobPack,
    );

    const qualificationTask = tasks.find((task) => /g3-qualified installer availability/i.test(task.title));
    expect(qualificationTask).toBeDefined();
    expect(qualificationTask?.source).toBe('missing_qualification');
    expect(qualificationTask?.suggestedEvidenceType).toBe('qualification_check');
  });

  it('is deterministic for the same inputs', () => {
    const fixture = buildFixture();
    const first = buildSurveyFollowUpTasks(
      fixture.readiness,
      fixture.specificationLines,
      fixture.materialsSchedule,
      fixture.engineerJobPack,
    );
    const second = buildSurveyFollowUpTasks(
      fixture.readiness,
      fixture.specificationLines,
      fixture.materialsSchedule,
      fixture.engineerJobPack,
    );

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
