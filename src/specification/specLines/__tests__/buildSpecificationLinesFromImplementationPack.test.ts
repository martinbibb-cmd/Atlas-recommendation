import { describe, expect, it } from 'vitest';
import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../../contracts/CustomerSummaryV1';
import type { EngineInputV2_3Contract } from '../../../contracts/EngineInputV2_3';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import { buildSuggestedImplementationPack } from '../../buildSuggestedImplementationPack';
import { buildSpecificationLinesFromImplementationPack } from '../buildSpecificationLinesFromImplementationPack';

const FIXED_NOW = '2026-05-11T20:45:58.203Z';

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
      currentSystem: {
        type: 'regular',
        ageYears: 12,
        condition: 'worn',
      },
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

function makePack(
  decisionOverrides: Partial<AtlasDecisionV1> = {},
  surveyOverrides: Partial<EngineInputV2_3Contract> = {},
) {
  return buildSuggestedImplementationPack(
    {
      atlasDecision: makeDecision(decisionOverrides),
      customerSummary: makeCustomerSummary({ recommendedScenarioId: decisionOverrides.recommendedScenarioId ?? 'system_unvented' }),
      engineOutput: makeEngineOutput(),
      surveyInput: makeSurveyInput(surveyOverrides),
    },
    FIXED_NOW,
  );
}

describe('buildSpecificationLinesFromImplementationPack', () => {
  it('unvented fixture generates G3, tundish, and filling-loop lines', () => {
    const lines = buildSpecificationLinesFromImplementationPack(makePack());

    expect(lines.some((line) => line.label.includes('G3'))).toBe(true);
    expect(lines.some((line) => /tundish/i.test(line.label) || /tundish/i.test(line.description))).toBe(true);
    expect(lines.some((line) => /filling loop/i.test(line.label) || /filling loop/i.test(line.description))).toBe(true);
  });

  it('open-vented fixture generates loft capping/removal lines', () => {
    const pack = makePack(
      { recommendedScenarioId: 'system_unvented' },
      {
        services: {
          mainsStaticPressureBar: 3.2,
          mainsDynamicPressureBar: 2.5,
          mainsDynamicFlowLpm: 15,
          coldWaterSource: 'loft_tank',
        },
      },
    );

    const lines = buildSpecificationLinesFromImplementationPack(pack);

    expect(lines.some((line) => /loft/i.test(line.label) && /capping/i.test(line.description))).toBe(true);
    expect(lines.some((line) => /loft/i.test(line.label) && /removal/i.test(line.label))).toBe(true);
  });

  it('heat-pump fixture generates MCS and emitter-review lines', () => {
    const lines = buildSpecificationLinesFromImplementationPack(
      makePack(
        { recommendedScenarioId: 'ashp', futureUpgradePaths: [] },
        { dhw: { architecture: 'on_demand' } },
      ),
    );

    expect(lines.some((line) => /MCS/i.test(line.label))).toBe(true);
    expect(lines.some((line) => /Emitter suitability review/i.test(line.label))).toBe(true);
  });

  it('marks technical expansion-vessel sizing lines as not customer-visible', () => {
    const lines = buildSpecificationLinesFromImplementationPack(makePack());
    const expansionLine = lines.find((line) => /expansion vessel sizing/i.test(line.label));
    expect(expansionLine).toBeDefined();
    expect(expansionLine?.customerVisible).toBe(false);
  });

  it('editing line status does not mutate the source pack', () => {
    const pack = makePack();
    const snapshot = JSON.stringify(pack);

    const lines = buildSpecificationLinesFromImplementationPack(pack);
    const edited = lines.map((line) =>
      line.lineType === 'included_scope'
        ? { ...line, status: 'accepted' as const }
        : line,
    );

    expect(edited.some((line) => line.status === 'accepted')).toBe(true);
    expect(JSON.stringify(pack)).toBe(snapshot);
  });

  it('is deterministic for the same input pack', () => {
    const pack = makePack();
    const first = buildSpecificationLinesFromImplementationPack(pack);
    const second = buildSpecificationLinesFromImplementationPack(pack);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
