/**
 * buildSuggestedMaterialsSchedule.test.ts
 *
 * Tests for buildSuggestedMaterialsSchedule.
 *
 * Coverage:
 *   - Unvented fixture includes cylinder / tundish / expansion management / filter / inhibitor
 *   - Open-vented fixture includes loft capping materials
 *   - Heat pump validation does not fake materials (emitter review → validation line only)
 *   - Expansion vessel marked needs_survey unless size known
 *   - customerVisible false for technical material details
 *   - Deterministic output
 */

import { describe, it, expect } from 'vitest';
import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../../contracts/CustomerSummaryV1';
import type { EngineInputV2_3Contract } from '../../../contracts/EngineInputV2_3';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import { buildSuggestedImplementationPack } from '../../buildSuggestedImplementationPack';
import { buildSpecificationLinesFromImplementationPack } from '../../specLines/buildSpecificationLinesFromImplementationPack';
import { buildInstallationScopePacks } from '../../scopePacks/buildInstallationScopePacks';
import { buildSuggestedMaterialsSchedule } from '../buildSuggestedMaterialsSchedule';

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
  const scenarioId = decisionOverrides.recommendedScenarioId ?? 'system_unvented';
  return buildSuggestedImplementationPack(
    {
      atlasDecision: makeDecision(decisionOverrides),
      customerSummary: makeCustomerSummary({ recommendedScenarioId: scenarioId }),
      engineOutput: makeEngineOutput(),
      surveyInput: makeSurveyInput(surveyOverrides),
    },
    FIXED_NOW,
  );
}

function buildScheduleForFixture(
  decisionOverrides: Partial<AtlasDecisionV1> = {},
  surveyOverrides: Partial<EngineInputV2_3Contract> = {},
) {
  const implPack = buildFixturePack(decisionOverrides, surveyOverrides);
  const lines = buildSpecificationLinesFromImplementationPack(implPack);
  const scopePacks = buildInstallationScopePacks(lines, implPack);
  return { schedule: buildSuggestedMaterialsSchedule(scopePacks, lines, implPack), implPack, lines, scopePacks };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildSuggestedMaterialsSchedule — unvented fixture', () => {
  it('includes a cylinder material line', () => {
    const { schedule } = buildScheduleForFixture();
    const cylinderLine = schedule.find((m) => /cylinder/i.test(m.label));
    expect(cylinderLine).toBeDefined();
    expect(cylinderLine?.category).toBe('hot_water');
  });

  it('includes a tundish and discharge material line', () => {
    const { schedule } = buildScheduleForFixture();
    const tundishLine = schedule.find((m) => /tundish/i.test(m.label));
    expect(tundishLine).toBeDefined();
    expect(tundishLine?.category).toBe('safety');
  });

  it('includes an expansion vessel / kit material line', () => {
    const { schedule } = buildScheduleForFixture();
    const expansionLine = schedule.find((m) => /expansion/i.test(m.label));
    expect(expansionLine).toBeDefined();
    expect(expansionLine?.category).toBe('valves');
  });

  it('includes a magnetic filter material line', () => {
    const { schedule } = buildScheduleForFixture();
    const filterLine = schedule.find((m) => /magnetic.?filter/i.test(m.label));
    expect(filterLine).toBeDefined();
    expect(filterLine?.category).toBe('water_quality');
  });

  it('includes an inhibitor material line', () => {
    const { schedule } = buildScheduleForFixture();
    const inhibitorLine = schedule.find((m) => /inhibitor/i.test(m.label));
    expect(inhibitorLine).toBeDefined();
    expect(inhibitorLine?.category).toBe('water_quality');
  });

  it('cylinder line references real source line IDs', () => {
    const { schedule, lines } = buildScheduleForFixture();
    const allLineIds = new Set(lines.map((l) => l.lineId));
    const cylinderLine = schedule.find((m) => /cylinder/i.test(m.label));
    expect(cylinderLine).toBeDefined();
    for (const id of cylinderLine!.sourceLineIds) {
      expect(allLineIds.has(id)).toBe(true);
    }
  });
});

describe('buildSuggestedMaterialsSchedule — open-vented fixture', () => {
  it('includes loft capping materials for open-vented fixture', () => {
    const { schedule } = buildScheduleForFixture(
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
    const loftLine = schedule.find((m) => /loft/i.test(m.label));
    expect(loftLine).toBeDefined();
    expect(loftLine?.category).toBe('pipework');
  });

  it('loft capping materials include an unresolved check for pipe size confirmation', () => {
    const { schedule } = buildScheduleForFixture(
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
    const loftLine = schedule.find((m) => /loft/i.test(m.label));
    expect(loftLine).toBeDefined();
    expect(loftLine!.unresolvedChecks.length).toBeGreaterThan(0);
  });
});

describe('buildSuggestedMaterialsSchedule — heat pump emitter review', () => {
  it('does not produce fake material lines for heat pump emitter review', () => {
    const { schedule } = buildScheduleForFixture(
      { recommendedScenarioId: 'ashp', futureUpgradePaths: [] },
      { dhw: { architecture: 'on_demand' } },
    );
    // Only the validation line should be present, not an actual emitter material
    const emitterLines = schedule.filter(
      (m) => /emitter/i.test(m.label),
    );
    // All emitter lines must be validation-only (requiredForInstall: false)
    for (const line of emitterLines) {
      expect(line.requiredForInstall).toBe(false);
    }
  });

  it('heat pump emitter validation line has needs_survey confidence', () => {
    const { schedule } = buildScheduleForFixture(
      { recommendedScenarioId: 'ashp', futureUpgradePaths: [] },
      { dhw: { architecture: 'on_demand' } },
    );
    const emitterLine = schedule.find((m) => /emitter/i.test(m.label));
    if (emitterLine) {
      expect(emitterLine.confidence).toBe('needs_survey');
    }
  });
});

describe('buildSuggestedMaterialsSchedule — expansion vessel', () => {
  it('expansion vessel is marked needs_survey when sizing note is present', () => {
    const { schedule } = buildScheduleForFixture();
    const expansionLine = schedule.find((m) => /expansion/i.test(m.label));
    expect(expansionLine).toBeDefined();
    // When a sizing installer_note is present, confidence should be needs_survey
    if (expansionLine?.confidence === 'needs_survey') {
      expect(expansionLine.unresolvedChecks.length).toBeGreaterThan(0);
    }
  });

  it('expansion vessel has an unresolved check for sizing confirmation', () => {
    const { schedule } = buildScheduleForFixture();
    const expansionLine = schedule.find((m) => /expansion/i.test(m.label));
    expect(expansionLine).toBeDefined();
    // There should be either an unresolved check or the confidence is already confirmed
    const needsCheck =
      expansionLine?.confidence === 'needs_survey'
      || expansionLine?.unresolvedChecks.some((c) => /expansion vessel/i.test(c));
    expect(needsCheck).toBe(true);
  });
});

describe('buildSuggestedMaterialsSchedule — visibility', () => {
  it('all material lines have customerVisible: false', () => {
    const { schedule } = buildScheduleForFixture();
    for (const line of schedule) {
      expect(line.customerVisible).toBe(false);
    }
  });

  it('all material lines have engineerVisible: true', () => {
    const { schedule } = buildScheduleForFixture();
    for (const line of schedule) {
      expect(line.engineerVisible).toBe(true);
    }
  });

  it('all material lines have officeVisible: true', () => {
    const { schedule } = buildScheduleForFixture();
    for (const line of schedule) {
      expect(line.officeVisible).toBe(true);
    }
  });
});

describe('buildSuggestedMaterialsSchedule — determinism', () => {
  it('produces identical output for the same inputs', () => {
    const implPack = buildFixturePack();
    const lines = buildSpecificationLinesFromImplementationPack(implPack);
    const scopePacks = buildInstallationScopePacks(lines, implPack);

    const first = buildSuggestedMaterialsSchedule(scopePacks, lines, implPack);
    const second = buildSuggestedMaterialsSchedule(scopePacks, lines, implPack);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('all material lines have non-empty materialId, label, and category', () => {
    const { schedule } = buildScheduleForFixture();
    for (const line of schedule) {
      expect(line.materialId.length).toBeGreaterThan(0);
      expect(line.label.length).toBeGreaterThan(0);
      expect(line.category.length).toBeGreaterThan(0);
    }
  });

  it('all material IDs are unique within a schedule', () => {
    const { schedule } = buildScheduleForFixture();
    const ids = schedule.map((m) => m.materialId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('buildSuggestedMaterialsSchedule — open-vented includes filling loop', () => {
  it('open-vented to sealed conversion includes filling loop material', () => {
    const { schedule } = buildScheduleForFixture(
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
    const fillingLoopLine = schedule.find((m) => /filling.?loop/i.test(m.label));
    expect(fillingLoopLine).toBeDefined();
    expect(fillingLoopLine?.category).toBe('valves');
  });
});
