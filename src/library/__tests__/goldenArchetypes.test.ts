import { describe, expect, it } from 'vitest';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import { buildDemoWelcomePack } from '../dev/buildDemoWelcomePack';
import { detectWelcomePackArchetype, welcomePackArchetypes } from '../packComposer/archetypes/welcomePackArchetypes';
import type { WelcomePackComposerInputV1 } from '../packComposer/WelcomePackComposerV1';

// ─── Shared builders ──────────────────────────────────────────────────────────

function buildBaseLifecycle(): AtlasDecisionV1['lifecycle'] {
  return {
    currentSystem: { type: 'system', ageYears: 10, condition: 'average' },
    expectedLifespan: { typicalRangeYears: [10, 15], adjustedRangeYears: [10, 15] },
    influencingFactors: { waterQuality: 'unknown', scaleRisk: 'low', usageIntensity: 'medium', maintenanceLevel: 'unknown' },
    riskIndicators: [],
    summary: 'Lifecycle data not fully available.',
  };
}

function buildCombiDecision(summary: CustomerSummaryV1): AtlasDecisionV1 {
  return {
    recommendedScenarioId: summary.recommendedScenarioId,
    headline: summary.headline,
    summary: summary.fitNarrative,
    keyReasons: [...summary.whyThisWins],
    avoidedRisks: [...summary.whatThisAvoids],
    dayToDayOutcomes: ['Day-to-day guidance available'],
    requiredWorks: ['Installation scope defined'],
    compatibilityWarnings: [],
    includedItems: [...summary.includedNow],
    quoteScope: [],
    futureUpgradePaths: [...summary.futureReady],
    supportingFacts: [],
    lifecycle: buildBaseLifecycle(),
  };
}

function buildSystemScenario(scenarioId: string, systemType: 'system' | 'regular' | 'combi' | 'ashp'): ScenarioResult {
  return {
    scenarioId,
    system: { type: systemType, summary: `${scenarioId} system` },
    performance: { hotWater: 'good', heating: 'good', efficiency: 'good', reliability: 'good' },
    keyBenefits: [],
    keyConstraints: [],
    dayToDayOutcomes: [],
    requiredWorks: [],
    upgradePaths: [],
    physicsFlags: {},
  };
}

function buildInput(overrides: Partial<WelcomePackComposerInputV1>): WelcomePackComposerInputV1 {
  const scenarios = overrides.scenarios ?? [buildSystemScenario('system_unvented', 'system')];
  const firstScenarioId = scenarios[0]?.scenarioId ?? 'system_unvented';

  const defaultSummary: CustomerSummaryV1 = {
    recommendedScenarioId: firstScenarioId,
    // Use a plain label that does not contain trigger words ("stored hot water", "cylinder")
    // to avoid accidentally activating text-based archetype detection
    recommendedSystemLabel: 'Replacement system',
    headline: 'System recommended.',
    plainEnglishDecision: 'This system fits this home.',
    whyThisWins: ['Good fit.'],
    whatThisAvoids: ['Avoids unnecessary changes.'],
    includedNow: ['Replacement system'],
    requiredChecks: [],
    optionalUpgrades: [],
    futureReady: [],
    confidenceNotes: [],
    hardConstraints: [],
    performancePenalties: [],
    fitNarrative: 'This system is recommended.',
  };
  return {
    customerSummary: defaultSummary,
    atlasDecision: buildCombiDecision(defaultSummary),
    scenarios,
    ...overrides,
  };
}

// ─── Golden archetype detection tests ─────────────────────────────────────────

describe('golden archetypes — detection priority', () => {
  it('open_vented + unvented tags selects open_vented_to_sealed_unvented over cylinder_upgrade', () => {
    const archetype = detectWelcomePackArchetype(buildInput({
      scenarios: [buildSystemScenario('system_unvented', 'system')],
      userConcernTags: ['open_vented', 'sealed_system_conversion', 'unvented_safety_reassurance'],
    }));

    expect(archetype.archetypeId).toBe('open_vented_to_sealed_unvented');
  });

  it('preserved_system_strength tags selects regular_to_regular_unvented over regular_or_system_boiler_upgrade', () => {
    const archetype = detectWelcomePackArchetype(buildInput({
      scenarios: [buildSystemScenario('regular_unvented', 'regular')],
      userConcernTags: ['preserved_system_strength', 'premium_hot_water_performance'],
    }));

    expect(archetype.archetypeId).toBe('regular_to_regular_unvented');
  });

  it('pressure/flow tags + why_not_combi override generic combi path to water_constraint_reality', () => {
    const archetype = detectWelcomePackArchetype(buildInput({
      scenarios: [buildSystemScenario('combi', 'combi')],
      userConcernTags: ['why_not_combi', 'water_main_limit_not_boiler_limit'],
      propertyConstraintTags: ['pressure', 'flow'],
    }));

    expect(archetype.archetypeId).toBe('water_constraint_reality');
  });

  it('pressure/flow tags WITHOUT golden tags still select water_supply_constraint', () => {
    const archetype = detectWelcomePackArchetype(buildInput({
      scenarios: [{ ...buildSystemScenario('system_unvented', 'system'), physicsFlags: { hydraulicLimit: true } }],
      propertyConstraintTags: ['pressure', 'flow'],
    }));

    expect(archetype.archetypeId).toBe('water_supply_constraint');
  });

  it('hot_radiator_expectation tags select heat_pump_reality over heat_pump_install', () => {
    const archetype = detectWelcomePackArchetype(buildInput({
      scenarios: [buildSystemScenario('ashp', 'ashp')],
      userConcernTags: ['hot_radiator_expectation', 'heat_pump_trust'],
    }));

    expect(archetype.archetypeId).toBe('heat_pump_reality');
  });

  it('ashp WITHOUT expectation tags still selects heat_pump_install', () => {
    const archetype = detectWelcomePackArchetype(buildInput({
      scenarios: [buildSystemScenario('ashp', 'ashp')],
      userConcernTags: ['heat_pump'],
    }));

    expect(archetype.archetypeId).toBe('heat_pump_install');
  });

  it('water_constraint_reality also fires for combi systemType + expectation tags without explicit constraint tags', () => {
    const archetype = detectWelcomePackArchetype(buildInput({
      scenarios: [buildSystemScenario('combi', 'combi')],
      userConcernTags: ['why_not_combi', 'pressure_vs_storage'],
      propertyConstraintTags: [],
    }));

    expect(archetype.archetypeId).toBe('water_constraint_reality');
  });
});

// ─── goldenJourneyId metadata tests ───────────────────────────────────────────

describe('golden archetypes — goldenJourneyId metadata', () => {
  it('all four golden archetypes have a goldenJourneyId set', () => {
    const goldenIds = ['open_vented_to_sealed_unvented', 'regular_to_regular_unvented', 'heat_pump_reality', 'water_constraint_reality'];
    for (const id of goldenIds) {
      const archetype = welcomePackArchetypes.find((a) => a.archetypeId === id);
      expect(archetype?.goldenJourneyId, `${id} should have goldenJourneyId`).toBeTruthy();
    }
  });

  it('goldenJourneyId matches the archetypeId for golden archetypes', () => {
    const goldenIds = ['open_vented_to_sealed_unvented', 'regular_to_regular_unvented', 'heat_pump_reality', 'water_constraint_reality'];
    for (const id of goldenIds) {
      const archetype = welcomePackArchetypes.find((a) => a.archetypeId === id);
      expect(archetype?.goldenJourneyId).toBe(id);
    }
  });

  it('goldenJourneyId does not affect recommendedScenarioId — passes through unchanged', () => {
    const result = buildDemoWelcomePack({ fixtureId: 'heat_pump_reality' });
    expect(result.plan.recommendedScenarioId).toBe('ashp');
  });

  it('goldenJourneyId does not affect recommendedScenarioId for open_vented_to_sealed_unvented', () => {
    const result = buildDemoWelcomePack({ fixtureId: 'open_vented_to_sealed_unvented' });
    expect(result.plan.recommendedScenarioId).toBe('system_unvented');
  });

  it('non-golden archetypes do not have goldenJourneyId set', () => {
    const nonGoldenIds = [
      'combi_replacement', 'combi_to_stored_hot_water', 'regular_or_system_boiler_upgrade',
      'heat_pump_install', 'heat_pump_ready_boiler_install', 'cylinder_upgrade',
      'controls_upgrade', 'water_supply_constraint', 'low_temperature_radiator_upgrade',
      'smart_cylinder_tariff_ready',
    ];
    for (const id of nonGoldenIds) {
      const archetype = welcomePackArchetypes.find((a) => a.archetypeId === id);
      expect(archetype?.goldenJourneyId, `${id} should NOT have goldenJourneyId`).toBeUndefined();
    }
  });
});

// ─── Golden archetype calm pack tests ─────────────────────────────────────────

describe('golden archetypes — all build calm packs', () => {
  const goldenFixtureIds = [
    'open_vented_to_sealed_unvented',
    'regular_to_regular_unvented',
    'heat_pump_reality',
    'water_constraint_reality',
  ] as const;

  for (const fixtureId of goldenFixtureIds) {
    it(`${fixtureId} builds a plan without error`, () => {
      expect(() => buildDemoWelcomePack({ fixtureId })).not.toThrow();
    });

    it(`${fixtureId} selects the correct golden archetype`, () => {
      const { plan } = buildDemoWelcomePack({ fixtureId });
      expect(plan.archetypeId).toBe(fixtureId);
    });

    it(`${fixtureId} produces non-empty selectedConceptIds`, () => {
      const { plan } = buildDemoWelcomePack({ fixtureId });
      expect(plan.selectedConceptIds.length).toBeGreaterThan(0);
    });

    it(`${fixtureId} stays within page budget`, () => {
      const { plan } = buildDemoWelcomePack({ fixtureId });
      expect(plan.pageBudgetUsed).toBeLessThanOrEqual(plan.printPageBudget);
    });
  }
});

// ─── Integration: plan builds confirm golden archetype concepts ───────────────

describe('golden archetypes — concept inclusion', () => {
  it('open_vented_to_sealed_unvented includes system_fit_explanation and stored_hot_water_efficiency', () => {
    const { plan } = buildDemoWelcomePack({ fixtureId: 'open_vented_to_sealed_unvented' });

    expect(plan.archetypeId).toBe('open_vented_to_sealed_unvented');
    expect([...plan.selectedConceptIds, ...plan.deferredConceptIds]).toContain('system_fit_explanation');
    expect([...plan.selectedConceptIds, ...plan.deferredConceptIds]).toContain('stored_hot_water_efficiency');
  });

  it('heat_pump_reality includes emitter_sizing and flow_temperature', () => {
    const { plan } = buildDemoWelcomePack({ fixtureId: 'heat_pump_reality' });

    expect(plan.archetypeId).toBe('heat_pump_reality');
    expect([...plan.selectedConceptIds, ...plan.deferredConceptIds]).toContain('emitter_sizing');
    expect([...plan.selectedConceptIds, ...plan.deferredConceptIds]).toContain('flow_temperature');
  });

  it('water_constraint_reality includes pipework_constraint and flow_restriction', () => {
    const { plan } = buildDemoWelcomePack({ fixtureId: 'water_constraint_reality' });

    expect(plan.archetypeId).toBe('water_constraint_reality');
    expect([...plan.selectedConceptIds, ...plan.deferredConceptIds]).toContain('pipework_constraint');
    expect([...plan.selectedConceptIds, ...plan.deferredConceptIds]).toContain('flow_restriction');
  });

  it('regular_to_regular_unvented includes system_fit_explanation and stored_hot_water_efficiency', () => {
    const { plan } = buildDemoWelcomePack({ fixtureId: 'regular_to_regular_unvented' });

    expect(plan.archetypeId).toBe('regular_to_regular_unvented');
    expect([...plan.selectedConceptIds, ...plan.deferredConceptIds]).toContain('system_fit_explanation');
    expect([...plan.selectedConceptIds, ...plan.deferredConceptIds]).toContain('stored_hot_water_efficiency');
  });
});
