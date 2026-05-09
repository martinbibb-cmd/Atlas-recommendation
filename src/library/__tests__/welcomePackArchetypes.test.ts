import { describe, expect, it } from 'vitest';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import { detectWelcomePackArchetype, welcomePackArchetypes } from '../packComposer/archetypes/welcomePackArchetypes';
import type { WelcomePackComposerInputV1 } from '../packComposer/WelcomePackComposerV1';

function buildInput(overrides?: Partial<WelcomePackComposerInputV1>): WelcomePackComposerInputV1 {
  const customerSummary: CustomerSummaryV1 = {
    recommendedScenarioId: 'combi',
    recommendedSystemLabel: 'Combi boiler',
    headline: 'Combi replacement keeps the journey simple.',
    plainEnglishDecision: 'A combi is the best fit for this home.',
    whyThisWins: ['Simple replacement keeps disruption low.'],
    whatThisAvoids: ['Cylinder changes are not needed.'],
    includedNow: ['Combi boiler'],
    requiredChecks: [],
    optionalUpgrades: [],
    futureReady: [],
    confidenceNotes: ['Locked recommendation facts are available.'],
    hardConstraints: [],
    performancePenalties: [],
    fitNarrative: 'A combi replacement is the recommended route.',
  };

  const atlasDecision: AtlasDecisionV1 = {
    recommendedScenarioId: 'combi',
    headline: customerSummary.headline,
    summary: customerSummary.fitNarrative,
    keyReasons: [...customerSummary.whyThisWins],
    avoidedRisks: [...customerSummary.whatThisAvoids],
    dayToDayOutcomes: ['Familiar on-demand hot water'],
    requiredWorks: ['Replace boiler'],
    compatibilityWarnings: [],
    includedItems: ['Combi boiler'],
    quoteScope: [],
    futureUpgradePaths: [],
    supportingFacts: [],
    lifecycle: {
      currentSystem: {
        type: 'combi',
        ageYears: 8,
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

  return {
    customerSummary,
    atlasDecision,
    scenarios,
    ...overrides,
  };
}

describe('welcomePackArchetypes', () => {
  it('registers the expected initial archetypes', () => {
    expect(welcomePackArchetypes.map((item) => item.archetypeId)).toEqual([
      'combi_replacement',
      'combi_to_stored_hot_water',
      'regular_or_system_boiler_upgrade',
      'heat_pump_install',
      'heat_pump_ready_boiler_install',
      'cylinder_upgrade',
      'controls_upgrade',
      'water_supply_constraint',
      'low_temperature_radiator_upgrade',
      'smart_cylinder_tariff_ready',
    ]);
  });

  it('detects water-supply-constraint journeys before generic boiler archetypes', () => {
    const archetype = detectWelcomePackArchetype(buildInput({
      propertyConstraintTags: ['pressure', 'flow'],
      scenarios: [
        {
          ...buildInput().scenarios[0],
          physicsFlags: { hydraulicLimit: true, pressureConstraint: true },
        },
      ],
    }));

    expect(archetype.archetypeId).toBe('water_supply_constraint');
  });

  it('detects heat pump installs from the recommended scenario type', () => {
    const input = buildInput({
      customerSummary: {
        ...buildInput().customerSummary,
        recommendedScenarioId: 'ashp',
        recommendedSystemLabel: 'Air source heat pump with cylinder',
        requiredChecks: ['Check radiator emitter output'],
      },
      atlasDecision: {
        ...buildInput().atlasDecision,
        recommendedScenarioId: 'ashp',
        dayToDayOutcomes: ['Lower flow-temperature operation'],
        compatibilityWarnings: ['Emitter checks required'],
      },
      scenarios: [
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
          keyBenefits: ['Lower-temperature heating'],
          keyConstraints: ['Emitter checks'],
          dayToDayOutcomes: ['Steady low-temperature comfort'],
          requiredWorks: ['Install heat pump and cylinder'],
          upgradePaths: [],
          physicsFlags: {
            highTempRequired: true,
          },
        },
      ],
    });

    expect(detectWelcomePackArchetype(input).archetypeId).toBe('heat_pump_install');
  });
});
