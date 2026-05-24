import { describe, expect, it } from 'vitest';
import { buildDecisionFromScenarios } from '../buildDecisionFromScenarios';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';

const baseScenario = (overrides: Partial<ScenarioResult>): ScenarioResult => ({
  scenarioId: 'combi',
  system: { type: 'combi', summary: 'On-demand hot water' },
  performance: { hotWater: 'good', heating: 'good', efficiency: 'good', reliability: 'good' },
  keyBenefits: ['Good match'],
  keyConstraints: [],
  dayToDayOutcomes: [],
  requiredWorks: [],
  upgradePaths: [],
  physicsFlags: {},
  ...overrides,
});

describe('buildDecisionFromScenarios', () => {
  it('does not recommend a heat pump when high flow temperature means emitter upgrades are required', () => {
    const decision = buildDecisionFromScenarios({
      scenarios: [
        baseScenario({
          scenarioId: 'ashp_cylinder',
          system: { type: 'ashp', summary: 'Air source heat pump' },
          performance: { hotWater: 'excellent', heating: 'excellent', efficiency: 'excellent', reliability: 'excellent' },
          physicsFlags: { highTempRequired: true },
          hardConstraints: ['Emitter upgrades required before a low-temperature heat pump can be recommended'],
        }),
        baseScenario({
          scenarioId: 'system_unvented',
          system: { type: 'system', summary: 'System boiler with stored hot water' },
          performance: { hotWater: 'very_good', heating: 'very_good', efficiency: 'good', reliability: 'very_good' },
        }),
      ],
      boilerType: 'combi',
      ageYears: 10,
      occupancyCount: 3,
      bathroomCount: 2,
    });

    expect(decision.recommendedScenarioId).toBe('system_unvented');
    expect(decision.hardConstraints?.join(' ')).toMatch(/emitter upgrades|required/i);
  });
});
