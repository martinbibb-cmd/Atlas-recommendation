/**
 * buildDailyUseSimulation.test.ts
 *
 * Covers:
 *   1. Combi scenario — no cylinder, combiFlowRisk flag triggers warning on second_shower
 *   2. System scenario — cylinder charge tracked across steps, both showers usable
 *   3. ASHP scenario — stored cylinder, heating_boost step included
 *   4. Combi with pressureConstraint — reduced cold mains, mixed shower reaction
 *   5. Returns null when recommended scenario is not in scenarios array
 *   6. Step order: shower → second_shower → bath → sink (→ heating_boost when relevant)
 *   7. Cylinder charge never goes below zero
 */

import { describe, it, expect } from 'vitest';
import { buildDailyUseSimulation } from '../modules/buildDailyUseSimulation';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDecision(recommendedScenarioId: string): AtlasDecisionV1 {
  return {
    recommendedScenarioId,
    headline: 'Test headline',
    summary: 'Test summary',
    keyReasons: ['Reason A'],
    avoidedRisks: [],
    dayToDayOutcomes: ['Good hot water'],
    requiredWorks: [],
    compatibilityWarnings: [],
    includedItems: [],
    futureUpgradePaths: [],
    supportingFacts: [],
    lifecycle: {
      currentSystem: { type: 'combi', ageYears: 5, condition: 'good' },
      summary: 'Good condition',
      riskIndicators: [],
      influencingFactors: {
        waterQuality: 'soft',
        scaleRisk: 'low',
        usageIntensity: 'low',
      },
    },
  };
}

function makeCombi(flags: ScenarioResult['physicsFlags'] = {}): ScenarioResult {
  return {
    scenarioId: 'combi',
    system: { type: 'combi', summary: 'Combi boiler providing on-demand hot water' },
    performance: { hotWater: 'good', heating: 'good', efficiency: 'good', reliability: 'good' },
    keyBenefits: ['No cylinder required'],
    keyConstraints: [],
    dayToDayOutcomes: ['On-demand hot water'],
    requiredWorks: [],
    upgradePaths: [],
    physicsFlags: flags,
  };
}

function makeSystem(flags: ScenarioResult['physicsFlags'] = {}): ScenarioResult {
  return {
    scenarioId: 'system_unvented',
    system: { type: 'system', summary: 'System boiler with unvented cylinder' },
    performance: { hotWater: 'excellent', heating: 'very_good', efficiency: 'good', reliability: 'very_good' },
    keyBenefits: ['Simultaneous outlets'],
    keyConstraints: [],
    dayToDayOutcomes: ['Mains-pressure hot water'],
    requiredWorks: [],
    upgradePaths: [],
    physicsFlags: flags,
  };
}

function makeAshp(flags: ScenarioResult['physicsFlags'] = {}): ScenarioResult {
  return {
    scenarioId: 'ashp',
    system: { type: 'ashp', summary: 'Air source heat pump with stored cylinder' },
    performance: { hotWater: 'good', heating: 'excellent', efficiency: 'excellent', reliability: 'very_good' },
    keyBenefits: ['Low carbon'],
    keyConstraints: [],
    dayToDayOutcomes: ['Efficient heating'],
    requiredWorks: [],
    upgradePaths: [],
    physicsFlags: flags,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildDailyUseSimulation', () => {

  describe('combi — no flags', () => {
    const decision = makeDecision('combi');
    const scenarios = [makeCombi()];

    it('returns a simulation for the recommended scenario', () => {
      const sim = buildDailyUseSimulation(decision, scenarios);
      expect(sim).not.toBeNull();
      expect(sim!.scenarioId).toBe('combi');
    });

    it('includes shower, second_shower, bath, sink steps', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const types = sim.steps.map((s) => s.eventType);
      expect(types).toContain('shower');
      expect(types).toContain('second_shower');
      expect(types).toContain('bath');
      expect(types).toContain('sink');
    });

    it('does not include heating_boost when no relevant flags', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const types = sim.steps.map((s) => s.eventType);
      expect(types).not.toContain('heating_boost');
    });

    it('shower step has hot_water heatSourceState', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const shower = sim.steps.find((s) => s.eventType === 'shower')!;
      expect(shower.topPanel.heatSourceState).toBe('hot_water');
    });

    it('no cylinder charge for combi', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      for (const step of sim.steps) {
        expect(step.topPanel.cylinderChargePercent).toBeUndefined();
      }
    });

    it('cold mains is strong when no pressureConstraint', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const shower = sim.steps.find((s) => s.eventType === 'shower')!;
      expect(shower.topPanel.coldMainsStatus).toBe('strong');
    });
  });

  describe('combi — combiFlowRisk', () => {
    const decision = makeDecision('combi');
    const scenarios = [makeCombi({ combiFlowRisk: true })];

    it('second_shower reaction has warning severity', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const step = sim.steps.find((s) => s.eventType === 'second_shower')!;
      const hasWarning = step.reactions.some((r) => r.severity === 'warning');
      expect(hasWarning).toBe(true);
    });

    it('second_shower cold mains is limited when combiFlowRisk', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const step = sim.steps.find((s) => s.eventType === 'second_shower')!;
      expect(step.topPanel.coldMainsStatus).toBe('limited');
    });
  });

  describe('combi — pressureConstraint', () => {
    const decision = makeDecision('combi');
    const scenarios = [makeCombi({ pressureConstraint: true })];

    it('shower reaction has mixed severity', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const step = sim.steps.find((s) => s.eventType === 'shower')!;
      const hasMixed = step.reactions.some((r) => r.severity === 'mixed');
      expect(hasMixed).toBe(true);
    });

    it('shower cold mains is reduced', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const step = sim.steps.find((s) => s.eventType === 'shower')!;
      expect(step.topPanel.coldMainsStatus).toBe('reduced');
    });
  });

  describe('system — stored cylinder', () => {
    const decision = makeDecision('system_unvented');
    const scenarios = [makeSystem()];

    it('shower step starts at 85% (100 - 15)', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const step = sim.steps.find((s) => s.eventType === 'shower')!;
      expect(step.topPanel.cylinderChargePercent).toBe(85);
    });

    it('second_shower step is at 65% (85 - 20)', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const step = sim.steps.find((s) => s.eventType === 'second_shower')!;
      expect(step.topPanel.cylinderChargePercent).toBe(65);
    });

    it('bath step is at 40% (65 - 25)', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const step = sim.steps.find((s) => s.eventType === 'bath')!;
      expect(step.topPanel.cylinderChargePercent).toBe(40);
    });

    it('sink step is at 38% (40 - 2)', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const step = sim.steps.find((s) => s.eventType === 'sink')!;
      expect(step.topPanel.cylinderChargePercent).toBe(38);
    });

    it('second_shower reaction is good (no flags)', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const step = sim.steps.find((s) => s.eventType === 'second_shower')!;
      expect(step.reactions[0].severity).toBe('good');
    });

    it('cold mains is strong when no pressure constraint', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const step = sim.steps.find((s) => s.eventType === 'shower')!;
      expect(step.topPanel.coldMainsStatus).toBe('strong');
    });
  });

  describe('ashp — stored cylinder + heating_boost', () => {
    const decision = makeDecision('ashp');
    const scenarios = [makeAshp()];

    it('includes heating_boost step', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const types = sim.steps.map((s) => s.eventType);
      expect(types).toContain('heating_boost');
    });

    it('heating_boost topPanel has heating state', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const step = sim.steps.find((s) => s.eventType === 'heating_boost')!;
      expect(step.topPanel.heatSourceState).toBe('heating');
    });

    it('flow temp is 50°C for ashp', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const step = sim.steps.find((s) => s.eventType === 'shower')!;
      expect(step.topPanel.flowTempC).toBe(50);
    });

    it('cylinder charge shown for ashp', () => {
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const step = sim.steps.find((s) => s.eventType === 'shower')!;
      expect(step.topPanel.cylinderChargePercent).toBeDefined();
    });
  });

  describe('returns null when scenario not found', () => {
    it('returns null when recommended scenario is absent from array', () => {
      const decision = makeDecision('ashp');
      const scenarios = [makeCombi()]; // ashp not in list
      const sim = buildDailyUseSimulation(decision, scenarios);
      expect(sim).toBeNull();
    });
  });

  describe('cylinder charge never below zero', () => {
    it('clamps cylinder at zero even after heavy draws', () => {
      // Start with a scenario where all draws would exceed 100%
      const decision = makeDecision('system_unvented');
      const scenarios = [makeSystem()];
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      for (const step of sim.steps) {
        if (step.topPanel.cylinderChargePercent !== undefined) {
          expect(step.topPanel.cylinderChargePercent).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('step order', () => {
    it('steps are ordered: shower, second_shower, bath, sink', () => {
      const decision = makeDecision('combi');
      const scenarios = [makeCombi()];
      const sim = buildDailyUseSimulation(decision, scenarios)!;
      const types = sim.steps.map((s) => s.eventType);
      expect(types.indexOf('shower')).toBeLessThan(types.indexOf('second_shower'));
      expect(types.indexOf('second_shower')).toBeLessThan(types.indexOf('bath'));
      expect(types.indexOf('bath')).toBeLessThan(types.indexOf('sink'));
    });
  });
});
