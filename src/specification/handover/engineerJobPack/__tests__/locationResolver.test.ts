import { describe, expect, it } from 'vitest';
import type { AtlasDecisionV1 } from '../../../../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../../../../contracts/CustomerSummaryV1';
import type { EngineInputV2_3Contract } from '../../../../../contracts/EngineInputV2_3';
import type { EngineOutputV1 } from '../../../../../contracts/EngineOutputV1';
import { buildSuggestedImplementationPack } from '../../../buildSuggestedImplementationPack';
import { buildSpecificationLinesFromImplementationPack } from '../../../specLines/buildSpecificationLinesFromImplementationPack';
import { resolveEngineerJobLocation } from '../locationResolver';

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

function buildFixture(overrides: { recommendedScenarioId?: string } = {}) {
  const surveyData = makeSurveyInput();
  const implementationPack = buildSuggestedImplementationPack(
    {
      atlasDecision: makeDecision(overrides.recommendedScenarioId ? { recommendedScenarioId: overrides.recommendedScenarioId } : {}),
      customerSummary: makeCustomerSummary(overrides.recommendedScenarioId ? { recommendedScenarioId: overrides.recommendedScenarioId } : {}),
      engineOutput: makeEngineOutput(),
      surveyInput: surveyData,
    },
    FIXED_NOW,
  );
  const specificationLines = buildSpecificationLinesFromImplementationPack(implementationPack);
  return { implementationPack, specificationLines, surveyData };
}

describe('resolveEngineerJobLocation', () => {
  it('maps loft tank removal to loft', () => {
    const { implementationPack, specificationLines, surveyData } = buildFixture();
    const result = resolveEngineerJobLocation({
      text: 'Loft tank removal scope — remove/cap legacy loft tank feeds',
      implementationPack,
      specificationLines,
      surveyData,
    });
    expect(result.type).toBe('loft');
  });

  it('maps filling loop to boiler location', () => {
    const { implementationPack, specificationLines, surveyData } = buildFixture();
    const result = resolveEngineerJobLocation({
      text: 'Install filling loop assembly and isolate near boiler',
      implementationPack,
      specificationLines,
      surveyData,
    });
    expect(result.type).toBe('boiler_location');
  });

  it('maps tundish to cylinder/discharge route', () => {
    const { implementationPack, specificationLines, surveyData } = buildFixture();
    const result = resolveEngineerJobLocation({
      text: 'Validate tundish and discharge route before final fix',
      implementationPack,
      specificationLines,
      surveyData,
    });
    expect(['cylinder_location', 'discharge_route']).toContain(result.type);
  });

  it('maps heat-pump emitter review to radiator/room when scan data exists', () => {
    const { implementationPack, specificationLines, surveyData } = buildFixture({ recommendedScenarioId: 'ashp' });
    const result = resolveEngineerJobLocation({
      text: 'Carry out radiator sizing review for emitter suitability',
      implementationPack,
      specificationLines,
      surveyData,
      scanData: { pipeworkInspected: true, engineerNotes: 'Emitter walkthrough done.' },
    });
    expect(['radiator', 'room']).toContain(result.type);
  });

  it('unknown location creates needs_survey marker', () => {
    const { implementationPack, specificationLines, surveyData } = buildFixture();
    const result = resolveEngineerJobLocation({
      text: 'Confirm final access route with customer-provided reference',
      implementationPack,
      specificationLines,
      surveyData,
    });
    expect(result.type).toBe('unknown');
    expect(result.confidence).toBe('needs_survey');
  });

  it('is deterministic for the same inputs', () => {
    const { implementationPack, specificationLines, surveyData } = buildFixture();
    const input = {
      text: 'Validate tundish and discharge route before final fix',
      implementationPack,
      specificationLines,
      surveyData,
    } as const;
    const first = resolveEngineerJobLocation(input);
    const second = resolveEngineerJobLocation(input);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
