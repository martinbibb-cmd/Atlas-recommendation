import { describe, expect, it } from 'vitest';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import { buildWelcomePackPlan } from '../packComposer/buildWelcomePackPlan';

function buildBaseDecision(customerSummary: CustomerSummaryV1): AtlasDecisionV1 {
  return {
    recommendedScenarioId: customerSummary.recommendedScenarioId,
    headline: customerSummary.headline,
    summary: customerSummary.fitNarrative,
    keyReasons: [...customerSummary.whyThisWins],
    avoidedRisks: [...customerSummary.whatThisAvoids],
    dayToDayOutcomes: ['Day-to-day guidance is available'],
    requiredWorks: ['Installation scope is defined'],
    compatibilityWarnings: [],
    includedItems: [...customerSummary.includedNow],
    quoteScope: [],
    futureUpgradePaths: [...customerSummary.futureReady],
    supportingFacts: [],
    lifecycle: {
      currentSystem: {
        type: 'system',
        ageYears: 0,
        condition: 'unknown',
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
      summary: 'Lifecycle data is not fully available yet.',
    },
  };
}

describe('buildWelcomePackPlan archetypes', () => {
  it('adds heat-pump and living-with-system concepts for heat-pump installs', () => {
    const customerSummary: CustomerSummaryV1 = {
      recommendedScenarioId: 'ashp',
      recommendedSystemLabel: 'Air source heat pump with cylinder',
      headline: 'Heat pump is the right fit for this property.',
      plainEnglishDecision: 'A heat pump suits the property and hot-water setup.',
      whyThisWins: ['Low-temperature operation fits the surveyed fabric.'],
      whatThisAvoids: ['Avoids another boiler replacement cycle.'],
      includedNow: ['Heat pump', 'Cylinder', 'Weather compensation controls'],
      requiredChecks: ['Check radiator emitter output'],
      optionalUpgrades: ['Future zoning controls'],
      futureReady: ['Tariff-ready charging later'],
      confidenceNotes: ['Recommendation is based on surveyed demand and constraints.'],
      hardConstraints: [],
      performancePenalties: [],
      fitNarrative: 'Heat pump is recommended due to property fit and future-ready value.',
    };
    const atlasDecision = {
      ...buildBaseDecision(customerSummary),
      compatibilityWarnings: ['Emitter checks required'],
    };
    const scenarios: ScenarioResult[] = [
      {
        scenarioId: 'ashp',
        system: {
          type: 'ashp',
          summary: 'Air source heat pump',
        },
        performance: {
          hotWater: 'good',
          heating: 'very_good',
          efficiency: 'very_good',
          reliability: 'good',
        },
        keyBenefits: ['Low-temperature comfort'],
        keyConstraints: ['Emitter checks required'],
        dayToDayOutcomes: ['Steady comfort at lower flow temperatures'],
        requiredWorks: ['Install heat pump and cylinder'],
        upgradePaths: ['Future tariff optimisation'],
        physicsFlags: {
          highTempRequired: true,
        },
      },
    ];

    const plan = buildWelcomePackPlan({
      customerSummary,
      atlasDecision,
      scenarios,
      accessibilityPreferences: {
        prefersPrint: true,
      },
      userConcernTags: ['heat_pump', 'radiator'],
    });

    expect(plan.archetypeId).toBe('heat_pump_install');
    expect([...plan.selectedConceptIds, ...plan.deferredConceptIds]).toContain('hp_cylinder_temperature');
    expect([...plan.selectedConceptIds, ...plan.deferredConceptIds]).toEqual(
      expect.arrayContaining(['driving_style', 'operating_behaviour']),
    );
    expect(plan.recommendedScenarioId).toBe(atlasDecision.recommendedScenarioId);
  });

  it('keeps combi replacement packs free from irrelevant heat-pump concepts', () => {
    const customerSummary: CustomerSummaryV1 = {
      recommendedScenarioId: 'combi',
      recommendedSystemLabel: 'Combi boiler',
      headline: 'Combi replacement is the best fit.',
      plainEnglishDecision: 'This home suits a combi replacement.',
      whyThisWins: ['Keeps the install simple.'],
      whatThisAvoids: ['Avoids unnecessary cylinder changes.'],
      includedNow: ['Combi boiler', 'Controls setup'],
      requiredChecks: [],
      optionalUpgrades: [],
      futureReady: [],
      confidenceNotes: ['Recommendation is based on surveyed demand and constraints.'],
      hardConstraints: [],
      performancePenalties: ['Cycling risk can be reduced with good controls.'],
      fitNarrative: 'Combi replacement is recommended due to scope and service fit.',
    };
    const atlasDecision = buildBaseDecision(customerSummary);
    const scenarios: ScenarioResult[] = [
      {
        scenarioId: 'combi',
        system: {
          type: 'combi',
          summary: 'Combi boiler',
        },
        performance: {
          hotWater: 'good',
          heating: 'good',
          efficiency: 'good',
          reliability: 'good',
        },
        keyBenefits: ['Simple replacement'],
        keyConstraints: [],
        dayToDayOutcomes: ['Familiar on-demand hot water'],
        requiredWorks: ['Replace boiler'],
        upgradePaths: [],
        physicsFlags: {},
      },
    ];

    const plan = buildWelcomePackPlan({
      customerSummary,
      atlasDecision,
      scenarios,
      userConcernTags: ['comparison'],
    });

    expect(plan.archetypeId).toBe('combi_replacement');
    expect(plan.selectedConceptIds).not.toContain('hp_cylinder_temperature');
    expect(plan.selectedConceptIds).not.toContain('legionella_pasteurisation');
  });

  it('prioritises pressure and flow explainers for water-supply constraints and remains deterministic', () => {
    const customerSummary: CustomerSummaryV1 = {
      recommendedScenarioId: 'system_unvented',
      recommendedSystemLabel: 'System boiler with stored hot water',
      headline: 'Stored hot water is the right fit for this home.',
      plainEnglishDecision: 'Stored hot water better fits the home than on-demand hot water.',
      whyThisWins: ['Stored hot water supports concurrent demand.'],
      whatThisAvoids: ['Avoids flow-limited on-demand hot water.'],
      includedNow: ['System boiler', 'Cylinder'],
      requiredChecks: ['Check primary pipework and available flow'],
      optionalUpgrades: [],
      futureReady: [],
      confidenceNotes: ['Recommendation is based on surveyed demand and constraints.'],
      hardConstraints: ['On-demand hot water option fails simultaneous demand.'],
      performancePenalties: ['Flow restriction limits comfort.'],
      fitNarrative: 'Stored hot water is recommended because water supply constraints matter here.',
    };
    const atlasDecision = {
      ...buildBaseDecision(customerSummary),
      compatibilityWarnings: ['Hydraulic checks required'],
    };
    const scenarios: ScenarioResult[] = [
      {
        scenarioId: 'system_unvented',
        system: {
          type: 'system',
          summary: 'System boiler with stored hot water',
        },
        performance: {
          hotWater: 'very_good',
          heating: 'good',
          efficiency: 'good',
          reliability: 'good',
        },
        keyBenefits: ['Stored hot water supports concurrent demand'],
        keyConstraints: ['Hydraulic checks required'],
        dayToDayOutcomes: ['Stored hot water with stable delivery'],
        requiredWorks: ['Check primary pipework'],
        upgradePaths: [],
        physicsFlags: {
          hydraulicLimit: true,
          pressureConstraint: true,
        },
      },
    ];

    const input = {
      customerSummary,
      atlasDecision,
      scenarios,
      propertyConstraintTags: ['pressure', 'flow', 'hydraulic'],
      userConcernTags: ['pressure', 'flow'],
    };

    const first = buildWelcomePackPlan(input);
    const second = buildWelcomePackPlan(input);

    expect(first.archetypeId).toBe('water_supply_constraint');
    expect([...first.selectedConceptIds, ...first.deferredConceptIds]).toEqual(
      expect.arrayContaining(['flow_restriction', 'pipework_constraint']),
    );
    expect(first.selectedAssetIds).toContain('PrimariesDiagram');
    expect(first.qrDestinations.some((destination) => destination.includes('FlowRestrictionAnimation'))).toBe(true);
    expect(first.pageBudgetUsed).toBeLessThanOrEqual(first.printPageBudget);
    expect(first.omittedAssetIdsWithReason.every((item) => item.reason.length > 0)).toBe(true);
    expect(first).toEqual(second);
  });
});
