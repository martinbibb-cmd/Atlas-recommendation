import { describe, expect, it } from 'vitest';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { ScenarioResult, ScenarioSystemType } from '../../contracts/ScenarioResult';
import type { EducationalAssetV1 } from '../contracts/EducationalAssetV1';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import { selectEducationalAssetsForContext } from '../routing/selectEducationalAssetsForContext';

function buildCustomerSummary(recommendedScenarioId: string, systemLabel: string): CustomerSummaryV1 {
  return {
    recommendedScenarioId,
    recommendedSystemLabel: systemLabel,
    headline: 'Recommendation headline',
    plainEnglishDecision: 'Recommendation decision',
    whyThisWins: ['Controls improve comfort and day-to-day operation.'],
    whatThisAvoids: ['Avoids unstable comfort from poor controls setup.'],
    includedNow: ['System controls upgrade'],
    requiredChecks: ['Check radiator emitter output and flow temperature'],
    optionalUpgrades: ['Future zoning controls'],
    futureReady: ['Future upgrade path'],
    confidenceNotes: ['Deterministic recommendation context.'],
    hardConstraints: ['Concurrent draw limitations apply for on-demand hot water.'],
    performancePenalties: ['Flow performance can reduce under simultaneous demand.'],
    fitNarrative: 'Fit narrative',
  };
}

function buildAtlasDecision(recommendedScenarioId: string): AtlasDecisionV1 {
  return {
    recommendedScenarioId,
    headline: 'Headline',
    summary: 'Summary',
    keyReasons: ['Reason'],
    avoidedRisks: ['Risk'],
    dayToDayOutcomes: ['Outcome'],
    requiredWorks: ['Work'],
    compatibilityWarnings: ['Hydraulic and radiator checks required'],
    includedItems: ['Included item'],
    quoteScope: [],
    futureUpgradePaths: ['Future path'],
    supportingFacts: [],
    lifecycle: {
      currentSystem: {
        type: 'system',
        condition: 'unknown',
        ageYears: 0,
      },
      expectedLifespan: {
        typicalRangeYears: [10, 15],
        adjustedRangeYears: [10, 15],
      },
      influencingFactors: {
        waterQuality: 'unknown',
        scaleRisk: 'low',
        usageIntensity: 'medium',
        maintenanceLevel: 'unknown',
      },
      riskIndicators: [],
      summary: 'Lifecycle summary',
    },
  };
}

function buildScenarios(scenarioId: string, type: ScenarioSystemType): ScenarioResult[] {
  return [
    {
      scenarioId,
      system: {
        type,
        summary: `${type} summary`,
      },
      performance: {
        hotWater: 'good',
        heating: 'good',
        efficiency: 'good',
        reliability: 'good',
      },
      keyBenefits: ['Benefit'],
      keyConstraints: ['Constraint'],
      dayToDayOutcomes: ['Outcome'],
      requiredWorks: ['Work'],
      upgradePaths: ['Path'],
      physicsFlags: {
        hydraulicLimit: true,
        combiFlowRisk: type === 'combi',
        highTempRequired: type === 'ashp',
        pressureConstraint: true,
      },
    },
  ];
}

describe('selectEducationalAssetsForContext', () => {
  it('combi + simultaneous-use concern selects relevant explainer', () => {
    const scenarioId = 'combi_case';
    const selection = selectEducationalAssetsForContext({
      customerSummary: buildCustomerSummary(scenarioId, 'Combination boiler'),
      atlasDecision: buildAtlasDecision(scenarioId),
      scenarios: buildScenarios(scenarioId, 'combi'),
      educationalAssets: educationalAssetRegistry,
      userConcernTags: ['simultaneous_use', 'flow'],
      propertyConstraintTags: ['hydraulic'],
      packMode: 'welcome',
    });

    expect(selection.selected.some((item) => item.assetId === 'FlowRestrictionAnimation')).toBe(true);
    expect(selection.selected.some((item) => item.ruleId === 'combi_simultaneous_use_limitation')).toBe(true);
  });

  it('heat pump + low-flow-temperature concern selects low-temperature living guidance', () => {
    const scenarioId = 'ashp_case';
    const selection = selectEducationalAssetsForContext({
      customerSummary: buildCustomerSummary(scenarioId, 'Air source heat pump'),
      atlasDecision: buildAtlasDecision(scenarioId),
      scenarios: buildScenarios(scenarioId, 'ashp'),
      educationalAssets: educationalAssetRegistry,
      userConcernTags: ['low_flow_temperature', 'radiator'],
      propertyConstraintTags: ['emitters'],
      packMode: 'welcome',
    });

    expect(selection.selected.some((item) => item.assetId === 'RadiatorUpgradeAnimation')).toBe(true);
    expect(selection.selected.some((item) => item.ruleId === 'heat_pump_low_flow_temperature_behaviour')).toBe(true);
  });

  it('print-first preference favours printable assets', () => {
    const scenarioId = 'system_case';
    const selection = selectEducationalAssetsForContext({
      customerSummary: buildCustomerSummary(scenarioId, 'System boiler with stored hot water'),
      atlasDecision: buildAtlasDecision(scenarioId),
      scenarios: buildScenarios(scenarioId, 'system'),
      educationalAssets: educationalAssetRegistry,
      accessibilityPreferences: {
        prefersPrint: true,
      },
      userConcernTags: ['controls'],
      propertyConstraintTags: [],
      packMode: 'print',
    });

    expect(selection.selected.length).toBeGreaterThan(0);
    const firstAsset = educationalAssetRegistry.find((asset) => asset.id === selection.selected[0].assetId);
    expect(firstAsset?.hasPrintEquivalent).toBe(true);
  });

  it('ADHD/dyslexia preference avoids high cognitive-load assets unless appendix requested', () => {
    const scenarioId = 'system_case';

    const highLoadAsset: EducationalAssetV1 = {
      ...educationalAssetRegistry[0],
      id: 'HighLoadExplainer',
      title: 'High load asset',
      assetType: 'explainer',
      cognitiveLoad: 'high',
      requiredEngineFacts: ['recommended_scenario_available'],
      conceptIds: ['system_fit_explanation'],
      triggerTags: ['dyslexia'],
    };

    const lowLoadAsset: EducationalAssetV1 = {
      ...educationalAssetRegistry[1],
      id: 'LowLoadExplainer',
      title: 'Low load asset',
      assetType: 'explainer',
      cognitiveLoad: 'low',
      hasStaticFallback: true,
      supportsReducedMotion: true,
      requiredEngineFacts: ['recommended_scenario_available'],
      conceptIds: ['system_fit_explanation'],
      triggerTags: ['dyslexia'],
    };

    const withoutAppendix = selectEducationalAssetsForContext({
      customerSummary: buildCustomerSummary(scenarioId, 'System boiler with stored hot water'),
      atlasDecision: buildAtlasDecision(scenarioId),
      scenarios: buildScenarios(scenarioId, 'system'),
      educationalAssets: [highLoadAsset, lowLoadAsset],
      accessibilityPreferences: {
        profiles: ['dyslexia'],
      },
      packMode: 'welcome',
    });

    expect(withoutAppendix.selected.some((item) => item.assetId === 'HighLoadExplainer')).toBe(false);
    expect(withoutAppendix.selected.some((item) => item.assetId === 'LowLoadExplainer')).toBe(true);

    const withAppendix = selectEducationalAssetsForContext({
      customerSummary: buildCustomerSummary(scenarioId, 'System boiler with stored hot water'),
      atlasDecision: buildAtlasDecision(scenarioId),
      scenarios: buildScenarios(scenarioId, 'system'),
      educationalAssets: [highLoadAsset, lowLoadAsset],
      accessibilityPreferences: {
        profiles: ['dyslexia'],
        includeTechnicalAppendix: true,
      },
      packMode: 'welcome',
    });

    expect(withAppendix.selected.some((item) => item.assetId === 'HighLoadExplainer')).toBe(true);
  });

  it('irrelevant assets are omitted with reasons', () => {
    const scenarioId = 'combi_case';
    const selection = selectEducationalAssetsForContext({
      customerSummary: buildCustomerSummary(scenarioId, 'Combination boiler'),
      atlasDecision: buildAtlasDecision(scenarioId),
      scenarios: buildScenarios(scenarioId, 'combi'),
      educationalAssets: educationalAssetRegistry,
      userConcernTags: ['unrelated_tag'],
      propertyConstraintTags: ['unrelated_constraint'],
      packMode: 'welcome',
    });

    expect(selection.omitted.length).toBeGreaterThan(0);
    expect(selection.omitted.every((item) => item.reason.length > 0)).toBe(true);
  });

  it('routing output is deterministic', () => {
    const scenarioId = 'system_case';
    const input = {
      customerSummary: buildCustomerSummary(scenarioId, 'System boiler with stored hot water'),
      atlasDecision: buildAtlasDecision(scenarioId),
      scenarios: buildScenarios(scenarioId, 'system'),
      educationalAssets: educationalAssetRegistry,
      accessibilityPreferences: {
        prefersPrint: true,
        profiles: ['adhd'] as const,
      },
      userConcernTags: ['controls', 'flow'],
      propertyConstraintTags: ['hydraulic'],
      packMode: 'print' as const,
    };

    const first = selectEducationalAssetsForContext(input);
    const second = selectEducationalAssetsForContext(input);

    expect(second).toEqual(first);
  });

  it('optionally warns when selected concepts depend on omitted prior concepts', () => {
    const scenarioId = 'combi_case';

    const selectedCandidate: EducationalAssetV1 = {
      ...educationalAssetRegistry[0],
      id: 'A_SelectedConcept',
      title: 'Selected concept asset',
      assetType: 'animation',
      conceptIds: ['flow_restriction'],
      requiredEngineFacts: ['hydraulic_constraint_present'],
      triggerTags: ['flow'],
      cognitiveLoad: 'low',
      hasPrintEquivalent: false,
      supportsReducedMotion: true,
    };

    const omittedPriorCandidate: EducationalAssetV1 = {
      ...educationalAssetRegistry[1],
      id: 'Z_OmittedPriorConcept',
      title: 'Prior concept asset',
      assetType: 'animation',
      conceptIds: ['pipework_constraint'],
      requiredEngineFacts: ['hydraulic_constraint_present'],
      triggerTags: ['flow'],
      cognitiveLoad: 'low',
      hasPrintEquivalent: false,
      supportsReducedMotion: true,
    };

    const selection = selectEducationalAssetsForContext({
      customerSummary: buildCustomerSummary(scenarioId, 'Combination boiler'),
      atlasDecision: buildAtlasDecision(scenarioId),
      scenarios: buildScenarios(scenarioId, 'combi'),
      educationalAssets: [selectedCandidate, omittedPriorCandidate],
      userConcernTags: ['flow'],
      propertyConstraintTags: ['flow'],
      taxonomyValidation: {
        enabled: true,
      },
      packMode: 'welcome',
    });

    expect(selection.selected.some((item) => item.assetId === 'A_SelectedConcept')).toBe(true);
    expect(selection.selected.some((item) => item.assetId === 'Z_OmittedPriorConcept')).toBe(false);
    expect(selection.warnings).toContain(
      'Concept "flow_restriction" depends on omitted prior concept "pipework_constraint".',
    );
  });
});
