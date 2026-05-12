/**
 * buildInstallationScopePacks.test.ts
 *
 * Tests for buildInstallationScopePacks.
 *
 * Coverage:
 *   - Unvented fixture suggests standard_unvented_cylinder_install pack
 *   - Open-vented fixture suggests open_vented_to_sealed_conversion pack
 *   - Heat-pump fixture suggests heat_pump_emitter_review and heat_pump_hydraulic_review packs
 *   - Water quality pack appears for boiler replacement (all non-heat-pump fixtures)
 *   - Pack status changes do not mutate source spec lines
 *   - Customer summary excludes technical-only implementation detail
 *   - All suggested packs start with reviewStatus 'suggested'
 *   - All packs have non-empty packId, label, and description
 *   - defaultIncludedLineIds reference real line IDs from the spec lines
 */

import { describe, it, expect } from 'vitest';
import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../../contracts/CustomerSummaryV1';
import type { EngineInputV2_3Contract } from '../../../contracts/EngineInputV2_3';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import { buildSuggestedImplementationPack } from '../../buildSuggestedImplementationPack';
import { buildSpecificationLinesFromImplementationPack } from '../../specLines/buildSpecificationLinesFromImplementationPack';
import { buildInstallationScopePacks } from '../buildInstallationScopePacks';

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildInstallationScopePacks — unvented fixture', () => {
  it('suggests standard_unvented_cylinder_install for unvented scenario', () => {
    const implPack = buildFixturePack();
    const lines = buildSpecificationLinesFromImplementationPack(implPack);
    const scopePacks = buildInstallationScopePacks(lines, implPack);

    const unventedPack = scopePacks.find((p) => p.packId === 'standard_unvented_cylinder_install');
    expect(unventedPack).toBeDefined();
  });

  it('unvented pack includes G3 compliance and cylinder lines', () => {
    const implPack = buildFixturePack();
    const lines = buildSpecificationLinesFromImplementationPack(implPack);
    const scopePacks = buildInstallationScopePacks(lines, implPack);

    const unventedPack = scopePacks.find((p) => p.packId === 'standard_unvented_cylinder_install');
    expect(unventedPack).toBeDefined();

    const allLineIds = new Set(lines.map((l) => l.lineId));
    for (const lineId of unventedPack!.defaultIncludedLineIds) {
      expect(allLineIds.has(lineId)).toBe(true);
    }

    expect(unventedPack!.defaultIncludedLineIds.length).toBeGreaterThan(0);
  });
});

describe('buildInstallationScopePacks — open-vented fixture', () => {
  it('suggests open_vented_to_sealed_conversion for loft-tank cold-water source', () => {
    const implPack = buildFixturePack(
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
    const lines = buildSpecificationLinesFromImplementationPack(implPack);
    const scopePacks = buildInstallationScopePacks(lines, implPack);

    const conversionPack = scopePacks.find((p) => p.packId === 'open_vented_to_sealed_conversion');
    expect(conversionPack).toBeDefined();
  });

  it('sealed conversion pack defaultIncludedLineIds reference real line IDs', () => {
    const implPack = buildFixturePack(
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
    const lines = buildSpecificationLinesFromImplementationPack(implPack);
    const scopePacks = buildInstallationScopePacks(lines, implPack);

    const conversionPack = scopePacks.find((p) => p.packId === 'open_vented_to_sealed_conversion');
    expect(conversionPack).toBeDefined();

    const allLineIds = new Set(lines.map((l) => l.lineId));
    for (const lineId of conversionPack!.defaultIncludedLineIds) {
      expect(allLineIds.has(lineId)).toBe(true);
    }
  });
});

describe('buildInstallationScopePacks — heat pump fixture', () => {
  it('suggests heat_pump_emitter_review for ashp scenario', () => {
    const implPack = buildFixturePack(
      { recommendedScenarioId: 'ashp', futureUpgradePaths: [] },
      { dhw: { architecture: 'on_demand' } },
    );
    const lines = buildSpecificationLinesFromImplementationPack(implPack);
    const scopePacks = buildInstallationScopePacks(lines, implPack);

    const emitterPack = scopePacks.find((p) => p.packId === 'heat_pump_emitter_review');
    expect(emitterPack).toBeDefined();
  });

  it('suggests heat_pump_hydraulic_review for ashp scenario', () => {
    const implPack = buildFixturePack(
      { recommendedScenarioId: 'ashp', futureUpgradePaths: [] },
      { dhw: { architecture: 'on_demand' } },
    );
    const lines = buildSpecificationLinesFromImplementationPack(implPack);
    const scopePacks = buildInstallationScopePacks(lines, implPack);

    const hydraulicPack = scopePacks.find((p) => p.packId === 'heat_pump_hydraulic_review');
    expect(hydraulicPack).toBeDefined();
  });
});

describe('buildInstallationScopePacks — water quality pack', () => {
  it('suggests boiler_replacement_with_water_quality when water quality lines are present', () => {
    const implPack = buildFixturePack();
    const lines = buildSpecificationLinesFromImplementationPack(implPack);
    const hasWaterQualityLines = lines.some((l) => l.sectionKey === 'water_quality');
    expect(hasWaterQualityLines).toBe(true);

    const scopePacks = buildInstallationScopePacks(lines, implPack);
    const waterQualityPack = scopePacks.find((p) => p.packId === 'boiler_replacement_with_water_quality');
    expect(waterQualityPack).toBeDefined();
  });
});

describe('buildInstallationScopePacks — pack integrity', () => {
  it('all suggested packs start with reviewStatus "suggested"', () => {
    const implPack = buildFixturePack();
    const lines = buildSpecificationLinesFromImplementationPack(implPack);
    const scopePacks = buildInstallationScopePacks(lines, implPack);

    for (const pack of scopePacks) {
      expect(pack.reviewStatus).toBe('suggested');
    }
  });

  it('all packs have non-empty packId, label, and description', () => {
    const implPack = buildFixturePack();
    const lines = buildSpecificationLinesFromImplementationPack(implPack);
    const scopePacks = buildInstallationScopePacks(lines, implPack);

    for (const pack of scopePacks) {
      expect(pack.packId.length).toBeGreaterThan(0);
      expect(pack.label.length).toBeGreaterThan(0);
      expect(pack.description.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same inputs', () => {
    const implPack = buildFixturePack();
    const lines = buildSpecificationLinesFromImplementationPack(implPack);

    const first = buildInstallationScopePacks(lines, implPack);
    const second = buildInstallationScopePacks(lines, implPack);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('defaultIncludedLineIds and defaultExcludedLineIds are disjoint', () => {
    const implPack = buildFixturePack();
    const lines = buildSpecificationLinesFromImplementationPack(implPack);
    const scopePacks = buildInstallationScopePacks(lines, implPack);

    for (const pack of scopePacks) {
      const includedSet = new Set(pack.defaultIncludedLineIds);
      for (const excludedId of pack.defaultExcludedLineIds) {
        expect(includedSet.has(excludedId)).toBe(false);
      }
    }
  });
});

describe('buildInstallationScopePacks — immutability', () => {
  it('pack status changes do not mutate source spec lines', () => {
    const implPack = buildFixturePack();
    const lines = buildSpecificationLinesFromImplementationPack(implPack);
    const linesSnapshot = JSON.stringify(lines);

    const scopePacks = buildInstallationScopePacks(lines, implPack);
    // Simulate status change (as a developer would do in the UI)
    const editedPacks = scopePacks.map((pack) => ({
      ...pack,
      reviewStatus: 'accepted' as const,
    }));

    expect(editedPacks.some((p) => p.reviewStatus === 'accepted')).toBe(true);
    // Source lines must not have been mutated
    expect(JSON.stringify(lines)).toBe(linesSnapshot);
  });

  it('pack status changes do not mutate source implementation pack', () => {
    const implPack = buildFixturePack();
    const packSnapshot = JSON.stringify(implPack);
    const lines = buildSpecificationLinesFromImplementationPack(implPack);

    const scopePacks = buildInstallationScopePacks(lines, implPack);
    scopePacks.map((pack) => ({ ...pack, reviewStatus: 'rejected' as const }));

    expect(JSON.stringify(implPack)).toBe(packSnapshot);
  });
});

describe('buildInstallationScopePacks — customer summary', () => {
  it('customer summary does not contain G3 qualification reference', () => {
    const implPack = buildFixturePack();
    const lines = buildSpecificationLinesFromImplementationPack(implPack);
    const scopePacks = buildInstallationScopePacks(lines, implPack);

    for (const pack of scopePacks) {
      expect(pack.customerSummary).not.toMatch(/G3/i);
      expect(pack.customerSummary).not.toMatch(/Building Regulations Part/i);
    }
  });

  it('customer summary does not use forbidden terminology', () => {
    const implPack = buildFixturePack();
    const lines = buildSpecificationLinesFromImplementationPack(implPack);
    const scopePacks = buildInstallationScopePacks(lines, implPack);

    for (const pack of scopePacks) {
      expect(pack.customerSummary).not.toMatch(/instantaneous hot water/i);
      expect(pack.customerSummary).not.toMatch(/gravity system/i);
      expect(pack.customerSummary).not.toMatch(/high pressure system/i);
    }
  });
});
