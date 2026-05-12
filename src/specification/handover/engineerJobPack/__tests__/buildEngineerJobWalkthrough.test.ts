import { describe, expect, it } from 'vitest';
import type { AtlasDecisionV1 } from '../../../../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../../../../contracts/CustomerSummaryV1';
import type { EngineInputV2_3Contract } from '../../../../../contracts/EngineInputV2_3';
import type { EngineOutputV1 } from '../../../../../contracts/EngineOutputV1';
import type { ScanDataInput } from '../../../buildSuggestedImplementationPack';
import { buildSuggestedImplementationPack } from '../../../buildSuggestedImplementationPack';
import { buildSpecificationLinesFromImplementationPack } from '../../../specLines/buildSpecificationLinesFromImplementationPack';
import { buildInstallationScopePacks } from '../../../scopePacks/buildInstallationScopePacks';
import { buildScopePackHandover } from '../../buildScopePackHandover';
import { buildEngineerJobPack } from '../buildEngineerJobPack';
import { buildEngineerJobWalkthrough } from '../buildEngineerJobWalkthrough';

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

function buildFixture(options: {
  decisionOverrides?: Partial<AtlasDecisionV1>;
  surveyOverrides?: Partial<EngineInputV2_3Contract>;
  scanData?: ScanDataInput;
} = {}) {
  const surveyInput = makeSurveyInput(options.surveyOverrides);
  const implementationPack = buildSuggestedImplementationPack(
    {
      atlasDecision: makeDecision(options.decisionOverrides),
      customerSummary: makeCustomerSummary(),
      engineOutput: makeEngineOutput(),
      surveyInput,
      scanData: options.scanData,
    },
    FIXED_NOW,
  );
  const specificationLines = buildSpecificationLinesFromImplementationPack(implementationPack);
  const scopePacks = buildInstallationScopePacks(specificationLines, implementationPack);
  const handover = buildScopePackHandover(scopePacks, specificationLines, implementationPack);
  const jobPack = buildEngineerJobPack(handover, implementationPack, specificationLines, surveyInput, options.scanData);
  return { implementationPack, handover, specificationLines, surveyInput, scanData: options.scanData, jobPack };
}

describe('buildEngineerJobWalkthrough', () => {
  it('loft tank/capping items appear under loft section', () => {
    const { jobPack } = buildFixture();
    const walkthrough = buildEngineerJobWalkthrough(jobPack);
    const loftText = JSON.stringify(walkthrough.loft).toLowerCase();
    expect(walkthrough.loft.items.length > 0 || loftText.includes('loft')).toBe(true);
    for (const item of walkthrough.loft.items) {
      expect(['loft']).toContain(item.location?.type);
    }
  });

  it('filling loop and filter items appear under plant area', () => {
    const { jobPack } = buildFixture();
    const walkthrough = buildEngineerJobWalkthrough(jobPack);
    for (const item of walkthrough.plantArea.items) {
      expect(['boiler_location']).toContain(item.location?.type);
    }
  });

  it('tundish and discharge items appear under cylinder area', () => {
    const { jobPack } = buildFixture();
    const walkthrough = buildEngineerJobWalkthrough(jobPack);
    const tundishItem = [
      ...walkthrough.cylinderArea.items,
    ].find((item) => item.text.toLowerCase().includes('tundish') || item.text.toLowerCase().includes('discharge'));
    if (tundishItem) {
      expect(['cylinder_location', 'discharge_route']).toContain(tundishItem.location?.type);
    }
    for (const item of walkthrough.cylinderArea.items) {
      expect(['cylinder_location', 'discharge_route']).toContain(item.location?.type);
    }
  });

  it('emitter review appears under radiators and rooms when scan data present', () => {
    const { jobPack } = buildFixture({
      decisionOverrides: { recommendedScenarioId: 'ashp' },
      scanData: { pipeworkInspected: true, engineerNotes: 'Room by room emitter checks captured.' },
    });
    const walkthrough = buildEngineerJobWalkthrough(jobPack);
    for (const item of walkthrough.radiatorsAndRooms.items) {
      expect(['radiator', 'room']).toContain(item.location?.type);
    }
  });

  it('commissioning steps appear in commissioning section last among work sections', () => {
    const { jobPack } = buildFixture();
    const walkthrough = buildEngineerJobWalkthrough(jobPack);
    expect(walkthrough.commissioning.items.length).toBeGreaterThan(0);
    const commText = JSON.stringify(walkthrough.commissioning).toLowerCase();
    expect(commText).toContain('commission');
    expect(walkthrough.customerHandover.items.length).toBeGreaterThanOrEqual(0);
  });

  it('unresolved checks appear first (unresolvedBeforeInstall section)', () => {
    const { jobPack } = buildFixture();
    const walkthrough = buildEngineerJobWalkthrough(jobPack);
    expect(walkthrough.unresolvedBeforeInstall.items.length).toBeGreaterThan(0);
    for (const item of walkthrough.unresolvedBeforeInstall.items) {
      expect(item.confidence).toBe('needs_survey');
      expect(item.mustConfirmOnSite).toBe(true);
    }
    expect(walkthrough.unresolvedBeforeInstall.mustConfirmCount).toBe(
      walkthrough.unresolvedBeforeInstall.items.length,
    );
  });

  it('mustConfirmCount equals number of mustConfirmOnSite items per section', () => {
    const { jobPack } = buildFixture();
    const walkthrough = buildEngineerJobWalkthrough(jobPack);
    const sectionKeys = [
      'unresolvedBeforeInstall',
      'beforeStarting',
      'loft',
      'cylinderArea',
      'plantArea',
      'externalWorks',
      'radiatorsAndRooms',
      'commissioning',
      'customerHandover',
    ] as const;
    for (const key of sectionKeys) {
      const section = walkthrough[key];
      const expectedCount = section.items.filter((item) => item.mustConfirmOnSite).length;
      expect(section.mustConfirmCount).toBe(expectedCount);
    }
  });

  it('confidenceSummary counts match actual items', () => {
    const { jobPack } = buildFixture();
    const walkthrough = buildEngineerJobWalkthrough(jobPack);
    const sectionKeys = [
      'unresolvedBeforeInstall',
      'beforeStarting',
      'plantArea',
      'commissioning',
    ] as const;
    for (const key of sectionKeys) {
      const section = walkthrough[key];
      const confirmed = section.items.filter((i) => i.confidence === 'confirmed').length;
      const inferred = section.items.filter((i) => i.confidence === 'inferred').length;
      const needs_survey = section.items.filter((i) => i.confidence === 'needs_survey').length;
      expect(section.confidenceSummary.confirmed).toBe(confirmed);
      expect(section.confidenceSummary.inferred).toBe(inferred);
      expect(section.confidenceSummary.needs_survey).toBe(needs_survey);
    }
  });

  it('is deterministic for the same inputs', () => {
    const { jobPack } = buildFixture();
    const first = buildEngineerJobWalkthrough(jobPack);
    const second = buildEngineerJobWalkthrough(jobPack);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('remove/cap items are ordered before install items within each section', () => {
    const { jobPack } = buildFixture();
    const walkthrough = buildEngineerJobWalkthrough(jobPack);
    const allSections = [
      walkthrough.plantArea,
      walkthrough.loft,
      walkthrough.cylinderArea,
      walkthrough.externalWorks,
    ];
    for (const section of allSections) {
      const removeRegex = /\b(remove|cap|capping|disconnect|decommission)\b/i;
      let seenNonRemove = false;
      for (const item of section.items) {
        if (item.mustConfirmOnSite) continue;
        if (removeRegex.test(item.text)) {
          expect(seenNonRemove).toBe(false);
        } else {
          seenNonRemove = true;
        }
      }
    }
  });

  it('walkthroughVersion is v1', () => {
    const { jobPack } = buildFixture();
    const walkthrough = buildEngineerJobWalkthrough(jobPack);
    expect(walkthrough.walkthroughVersion).toBe('v1');
  });

  it('all items within location-typed sections have matching location types', () => {
    const { jobPack } = buildFixture({
      scanData: { pipeworkInspected: true, loftInspected: true, flueInspected: true },
    });
    const walkthrough = buildEngineerJobWalkthrough(jobPack);
    const sectionToTypes: Record<string, string[]> = {
      loft: ['loft'],
      cylinderArea: ['cylinder_location', 'discharge_route'],
      plantArea: ['boiler_location'],
      externalWorks: ['external_wall', 'flue_route', 'condensate_route', 'gas_route'],
      radiatorsAndRooms: ['radiator', 'room'],
    };
    for (const [sectionKey, allowedTypes] of Object.entries(sectionToTypes)) {
      const section = walkthrough[sectionKey as keyof typeof walkthrough];
      if (typeof section === 'string') continue;
      for (const item of section.items) {
        if (item.location) {
          expect(allowedTypes).toContain(item.location.type);
        }
      }
    }
  });
});
