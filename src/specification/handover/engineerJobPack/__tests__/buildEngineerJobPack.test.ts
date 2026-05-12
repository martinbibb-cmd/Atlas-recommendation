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
  return { implementationPack, handover, specificationLines, surveyInput, scanData: options.scanData };
}

function allSections(pack: ReturnType<typeof buildEngineerJobPack>) {
  return [
    pack.jobSummary,
    pack.fitThis,
    pack.removeThis,
    pack.checkThis,
    pack.discussWithCustomer,
    pack.locationsAndRoutes,
    pack.commissioning,
    pack.unresolvedBeforeInstall,
    pack.doNotMiss,
    pack.locationsToConfirm,
  ];
}

describe('buildEngineerJobPack', () => {
  it('output contains no educational copy', () => {
    const { implementationPack, handover, surveyInput, scanData, specificationLines } = buildFixture();
    const pack = buildEngineerJobPack(handover, implementationPack, surveyInput, scanData, specificationLines);
    const text = JSON.stringify(pack).toLowerCase();
    expect(text).not.toContain('why this wins');
    expect(text).not.toContain('plain english');
    expect(text).not.toContain('educational');
    expect(text).not.toContain('analogy');
  });

  it('contains no paragraph-length items', () => {
    const { implementationPack, handover, surveyInput, scanData, specificationLines } = buildFixture();
    const pack = buildEngineerJobPack(handover, implementationPack, surveyInput, scanData, specificationLines);
    for (const section of allSections(pack)) {
      for (const item of section) {
        expect(item.text.length).toBeLessThanOrEqual(140);
      }
    }
  });

  it('expansion vessel appears only in fit/check, not customer discussion', () => {
    const { implementationPack, handover, surveyInput, scanData, specificationLines } = buildFixture();
    const pack = buildEngineerJobPack(handover, implementationPack, surveyInput, scanData, specificationLines);
    const fitAndCheckText = JSON.stringify([...pack.fitThis, ...pack.checkThis]).toLowerCase();
    const discussText = JSON.stringify(pack.discussWithCustomer).toLowerCase();
    expect(fitAndCheckText).toContain('expansion vessel');
    expect(discussText).not.toContain('expansion vessel');
  });

  it('G3 and tundish appear under check/commissioning sections', () => {
    const { implementationPack, handover, surveyInput, scanData, specificationLines } = buildFixture();
    const pack = buildEngineerJobPack(handover, implementationPack, surveyInput, scanData, specificationLines);
    const checkAndCommissioningText = JSON.stringify([
      ...pack.checkThis,
      ...pack.commissioning,
    ]).toLowerCase();
    expect(checkAndCommissioningText).toContain('g3');
    expect(checkAndCommissioningText).toContain('tundish');
  });

  it('unresolved risks are marked for on-site confirmation', () => {
    const { implementationPack, handover, surveyInput, scanData, specificationLines } = buildFixture();
    const pack = buildEngineerJobPack(handover, implementationPack, surveyInput, scanData, specificationLines);
    expect(pack.unresolvedBeforeInstall.length).toBeGreaterThan(0);
    expect(pack.unresolvedBeforeInstall[0]?.mustConfirmOnSite).toBe(true);
    for (const item of pack.unresolvedBeforeInstall) {
      expect(item.confidence).toBe('needs_survey');
    }
  });

  it('enforces max 7 bullets per section', () => {
    const { implementationPack, handover, surveyInput, scanData, specificationLines } = buildFixture();
    const inflatedImplementationPack = {
      ...implementationPack,
      allUnresolvedRisks: Array.from({ length: 20 }, (_, index) => ({
        id: `risk_${index}`,
        description: `Risk ${index}`,
        resolution: `Resolve ${index}`,
        severity: 'required' as const,
      })),
      allRequiredValidations: Array.from({ length: 20 }, (_, index) => ({
        id: `validation_risk_${index}`,
        check: `Validation ${index}`,
        reason: `Reason ${index}`,
        severity: 'required' as const,
      })),
      commissioning: {
        ...implementationPack.commissioning,
        steps: Array.from({ length: 20 }, (_, index) => `Commissioning step ${index}`),
        requiredDocumentation: Array.from({ length: 20 }, (_, index) => `Document ${index}`),
      },
    };
    const pack = buildEngineerJobPack(
      handover,
      inflatedImplementationPack,
      surveyInput,
      scanData,
      specificationLines,
    );
    for (const section of allSections(pack)) {
      expect(section.length).toBeLessThanOrEqual(7);
    }
  });

  it('is deterministic for the same inputs', () => {
    const { implementationPack, handover, surveyInput, scanData, specificationLines } = buildFixture();
    const first = buildEngineerJobPack(handover, implementationPack, surveyInput, scanData, specificationLines);
    const second = buildEngineerJobPack(handover, implementationPack, surveyInput, scanData, specificationLines);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('maps tundish to cylinder/discharge route', () => {
    const { implementationPack, handover, surveyInput, scanData, specificationLines } = buildFixture();
    const pack = buildEngineerJobPack(handover, implementationPack, surveyInput, scanData, specificationLines);
    const tundishItem = allSections(pack)
      .flat()
      .find((item) => item.text.toLowerCase().includes('tundish'));
    expect(['cylinder_location', 'discharge_route']).toContain(tundishItem?.location?.type);
  });

  it('maps heat-pump emitter review to radiator/room when scan data exists', () => {
    const { implementationPack, handover, surveyInput, specificationLines } = buildFixture({
      decisionOverrides: {
        recommendedScenarioId: 'ashp',
      },
      scanData: { pipeworkInspected: true, engineerNotes: 'Room by room emitter checks captured.' },
    });
    const pack = buildEngineerJobPack(
      handover,
      implementationPack,
      surveyInput,
      { pipeworkInspected: true, engineerNotes: 'Room by room emitter checks captured.' },
      specificationLines,
    );
    const emitterItem = allSections(pack)
      .flat()
      .find((item) => item.text.toLowerCase().includes('emitter') || item.text.toLowerCase().includes('radiator'));
    expect(['radiator', 'room']).toContain(emitterItem?.location?.type);
  });

  it('marks unknown locations as needs_survey and includes locations-to-confirm marker', () => {
    const { implementationPack, handover, surveyInput, scanData, specificationLines } = buildFixture();
    const augmentedHandover = {
      ...handover,
      engineerInstallNotes: {
        ...handover.engineerInstallNotes,
        packs: handover.engineerInstallNotes.packs.map((pack, index) =>
          index === 0
            ? {
              ...pack,
              lines: [
                ...pack.lines,
                {
                  lineId: 'line_unknown_route',
                  packId: pack.packId,
                  packLabel: pack.packLabel,
                  sectionKey: 'pipework',
                  lineType: 'installer_note',
                  label: 'Site route ambiguity',
                  description: 'Confirm final route with customer-provided access note.',
                },
              ],
            }
            : pack),
      },
    };
    const pack = buildEngineerJobPack(
      augmentedHandover,
      implementationPack,
      surveyInput,
      scanData,
      specificationLines,
    );
    const unknown = allSections(pack)
      .flat()
      .find((item) => item.text.toLowerCase().includes('site route ambiguity'));
    expect(unknown?.location?.type).toBe('unknown');
    expect(unknown?.location?.confidence).toBe('needs_survey');
    expect(pack.locationsToConfirm.length).toBeGreaterThan(0);
    expect(pack.locationsToConfirm.some((item) => item.location?.confidence === 'needs_survey')).toBe(true);
  });
});
