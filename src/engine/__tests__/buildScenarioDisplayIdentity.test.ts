/**
 * buildScenarioDisplayIdentity.test.ts
 *
 * Regression tests for the centralised scenario display identity resolver.
 *
 * Guarantees:
 *   1. recommendation.primary = MIXERGY_RECOMMENDATION_LABEL produces
 *      "Mixergy cylinder" in title, atlasPickLabel, headline, familyLabel.
 *   2. No Mixergy scenario renders "unvented cylinder" as the primary label.
 *   3. Combi non-viable scenario populates a compromiseHeadline.
 *   4. Rejected/non-viable combi surfaces compromiseHeadline, not "Combi not advisable".
 *   5. buildScenariosFromEngineOutput populates scenario.display correctly
 *      when the engine flags a Mixergy recommendation.
 *   6. buildPortalViewModel comparison card title equals display.title.
 *   7. buildPortalViewModel daily-use card title contains display.title.
 *   8. buildDecisionFromScenarios headline equals display.headline for Mixergy.
 */

import { describe, it, expect } from 'vitest';
import {
  buildScenarioDisplayIdentity,
  COMBI_SELECTED_COMPROMISE_HEADLINE,
} from '../../engine/modules/buildScenarioDisplayIdentity';
import { buildScenariosFromEngineOutput } from '../../engine/modules/buildScenariosFromEngineOutput';
import { buildPortalViewModel } from '../../engine/modules/buildPortalViewModel';
import { buildDecisionFromScenarios } from '../../engine/modules/buildDecisionFromScenarios';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeScenario(
  overrides: Partial<ScenarioResult> = {},
): ScenarioResult {
  return {
    scenarioId:       'system_unvented',
    system:           { type: 'system', summary: 'System boiler with unvented cylinder' },
    performance:      { hotWater: 'excellent', heating: 'very_good', efficiency: 'very_good', reliability: 'very_good' },
    keyBenefits:      ['High flow rate for multiple outlets'],
    keyConstraints:   [],
    dayToDayOutcomes: ['Hot water on demand from stored cylinder'],
    requiredWorks:    ['G3 unvented installation'],
    upgradePaths:     [],
    physicsFlags:     {},
    ...overrides,
  };
}

function makeCombiScenario(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return makeScenario({
    scenarioId: 'combi',
    system: { type: 'combi', summary: 'Combi boiler — on-demand hot water' },
    ...overrides,
  });
}

function makeMinimalDecision(recommended: ScenarioResult): AtlasDecisionV1 {
  return buildDecisionFromScenarios({
    scenarios:   [recommended],
    boilerType:  'combi',
    ageYears:    10,
  });
}

/** Minimal EngineOutputV1 with a Mixergy primary recommendation. */
function makeMixergyEngineOutput(): EngineOutputV1 {
  return {
    recommendation: { primary: 'Mixergy unvented cylinder' },
    options: [
      {
        id: 'system_unvented',
        label: 'Mixergy unvented cylinder',
        status: 'viable',
        headline: 'Stored hot water system',
        why: ['Pressure-tolerant stored system'],
        requirements: [],
        dhw: { status: 'ok', bullets: [] },
        heat: { status: 'ok', bullets: [] },
        sensitivities: [],
      },
      {
        id: 'combi',
        label: 'Combi boiler',
        status: 'caution',
        headline: 'Combi boiler',
        why: ['Simultaneous demand risk'],
        requirements: [],
        dhw: { status: 'caution', bullets: ['Risk of reduced flow under simultaneous use'] },
        heat: { status: 'ok', bullets: [] },
        sensitivities: [],
      },
    ],
    confidence: { level: 'high', score: 0.9, reasons: [] },
    limiterLedger: { limiters: [] },
    version: '1.0',
    explainers: [],
  } as unknown as EngineOutputV1;
}

// ─── buildScenarioDisplayIdentity unit tests ──────────────────────────────────

describe('buildScenarioDisplayIdentity', () => {
  describe('Mixergy scenarios', () => {
    it('returns title "Mixergy cylinder" when dhwSubtype is mixergy', () => {
      const scenario = makeScenario({ dhwSubtype: 'mixergy' });
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.title).toBe('Mixergy cylinder');
    });

    it('returns shortTitle "Mixergy" when dhwSubtype is mixergy', () => {
      const scenario = makeScenario({ dhwSubtype: 'mixergy' });
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.shortTitle).toBe('Mixergy');
    });

    it('returns familyLabel "Stored hot water" when dhwSubtype is mixergy', () => {
      const scenario = makeScenario({ dhwSubtype: 'mixergy' });
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.familyLabel).toBe('Stored hot water');
    });

    it('returns atlasPickLabel "Mixergy cylinder" when dhwSubtype is mixergy', () => {
      const scenario = makeScenario({ dhwSubtype: 'mixergy' });
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.atlasPickLabel).toBe('Mixergy cylinder');
    });

    it('returns Mixergy headline when dhwSubtype is mixergy', () => {
      const scenario = makeScenario({ dhwSubtype: 'mixergy' });
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.headline).toContain('Mixergy cylinder');
      expect(display.headline).toContain('pressure-tolerant');
    });

    it('does NOT render "unvented cylinder" as the primary label for Mixergy scenarios', () => {
      const scenario = makeScenario({ dhwSubtype: 'mixergy' });
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.title).not.toBe('unvented cylinder');
      expect(display.title).not.toContain('unvented cylinder');
      expect(display.atlasPickLabel).not.toContain('unvented cylinder');
    });

    it('populates constraintAwareDescription for Mixergy scenarios', () => {
      const scenario = makeScenario({ dhwSubtype: 'mixergy' });
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.constraintAwareDescription).toBeTruthy();
      expect(display.constraintAwareDescription).toContain('Mixergy');
    });
  });

  describe('Combi scenarios', () => {
    it('returns title "Combi boiler" for combi system type', () => {
      const scenario = makeCombiScenario();
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.title).toBe('Combi boiler');
    });

    it('returns familyLabel "On-demand hot water" for combi', () => {
      const scenario = makeCombiScenario();
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.familyLabel).toBe('On-demand hot water');
    });

    it('populates compromiseHeadline for combi scenarios', () => {
      const scenario = makeCombiScenario();
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.compromiseHeadline).toBe(COMBI_SELECTED_COMPROMISE_HEADLINE);
    });

    it('compromiseHeadline does not contain "Combi not advisable"', () => {
      const scenario = makeCombiScenario();
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.compromiseHeadline).not.toContain('Combi not advisable');
    });
  });

  describe('Stored-water scenarios', () => {
    it('returns "System boiler" title for system_unvented scenarioId', () => {
      const scenario = makeScenario({ scenarioId: 'system_unvented', system: { type: 'system', summary: 'System boiler' } });
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.title).toBe('System boiler');
    });

    it('returns "Stored hot water" familyLabel for system boiler', () => {
      const scenario = makeScenario({ scenarioId: 'system_unvented', system: { type: 'system', summary: 'System boiler' } });
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.familyLabel).toBe('Stored hot water');
    });

    it('returns "Regular boiler" title for regular_vented scenarioId', () => {
      const scenario = makeScenario({
        scenarioId: 'regular_vented',
        system: { type: 'regular', summary: 'Regular boiler' },
      });
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.title).toBe('Regular boiler');
    });

    it('does not populate compromiseHeadline for non-combi scenarios', () => {
      const scenario = makeScenario({ scenarioId: 'system_unvented', system: { type: 'system', summary: 'System boiler' } });
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.compromiseHeadline).toBeUndefined();
    });
  });

  describe('ASHP scenarios', () => {
    it('returns "Air source heat pump" title for ashp', () => {
      const scenario = makeScenario({ scenarioId: 'ashp', system: { type: 'ashp', summary: 'Heat pump' } });
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.title).toBe('Air source heat pump');
    });

    it('returns "Heat pump" familyLabel for ashp', () => {
      const scenario = makeScenario({ scenarioId: 'ashp', system: { type: 'ashp', summary: 'Heat pump' } });
      const display = buildScenarioDisplayIdentity(scenario);
      expect(display.familyLabel).toBe('Heat pump');
    });
  });
});

// ─── Integration: buildScenariosFromEngineOutput ──────────────────────────────

describe('buildScenariosFromEngineOutput — Mixergy display propagation', () => {
  it('populates display.title as "Mixergy cylinder" on unvented scenario when Mixergy is recommended', () => {
    const output = makeMixergyEngineOutput();
    const scenarios = buildScenariosFromEngineOutput(output);
    const mixergyScenario = scenarios.find(s => s.scenarioId === 'system_unvented');
    expect(mixergyScenario).toBeDefined();
    expect(mixergyScenario?.display?.title).toBe('Mixergy cylinder');
  });

  it('populates display.atlasPickLabel as "Mixergy cylinder" on unvented scenario', () => {
    const output = makeMixergyEngineOutput();
    const scenarios = buildScenariosFromEngineOutput(output);
    const mixergyScenario = scenarios.find(s => s.scenarioId === 'system_unvented');
    expect(mixergyScenario?.display?.atlasPickLabel).toBe('Mixergy cylinder');
  });

  it('does not label Mixergy scenario as "unvented cylinder" in display.title', () => {
    const output = makeMixergyEngineOutput();
    const scenarios = buildScenariosFromEngineOutput(output);
    const mixergyScenario = scenarios.find(s => s.scenarioId === 'system_unvented');
    expect(mixergyScenario?.display?.title).not.toContain('unvented cylinder');
  });

  it('labels the combi alternative correctly even when Mixergy is primary', () => {
    const output = makeMixergyEngineOutput();
    const scenarios = buildScenariosFromEngineOutput(output);
    const combiScenario = scenarios.find(s => s.scenarioId === 'combi');
    expect(combiScenario?.display?.title).toBe('Combi boiler');
  });
});

// ─── Integration: buildDecisionFromScenarios headline ────────────────────────

describe('buildDecisionFromScenarios — Mixergy headline', () => {
  it('produces Mixergy headline when recommended scenario has dhwSubtype mixergy', () => {
    const mixergyScenario = makeScenario({ dhwSubtype: 'mixergy' });
    const decision = makeMinimalDecision(mixergyScenario);
    expect(decision.headline).toContain('Mixergy cylinder');
    expect(decision.headline).toContain('pressure-tolerant');
  });

  it('does not produce "unvented cylinder" headline for Mixergy scenario', () => {
    const mixergyScenario = makeScenario({ dhwSubtype: 'mixergy' });
    const decision = makeMinimalDecision(mixergyScenario);
    expect(decision.headline).not.toContain('unvented cylinder');
  });
});

// ─── Integration: buildPortalViewModel ───────────────────────────────────────

describe('buildPortalViewModel — display identity in cards', () => {
  it('comparison card title for Mixergy scenario is "Mixergy cylinder"', () => {
    const mixergyScenario = makeScenario({ dhwSubtype: 'mixergy', display: buildScenarioDisplayIdentity(makeScenario({ dhwSubtype: 'mixergy' })) });
    const decision = makeMinimalDecision(mixergyScenario);
    const viewModel = buildPortalViewModel(decision, [mixergyScenario], []);
    const card = viewModel.verdictData.comparisonCards.find(c => c.scenarioId === 'system_unvented');
    expect(card?.title).toBe('Mixergy cylinder');
  });

  it('daily-use card title for Mixergy scenario contains "Mixergy cylinder"', () => {
    const mixergyScenario = makeScenario({ dhwSubtype: 'mixergy', display: buildScenarioDisplayIdentity(makeScenario({ dhwSubtype: 'mixergy' })) });
    const decision = makeMinimalDecision(mixergyScenario);
    const viewModel = buildPortalViewModel(decision, [mixergyScenario], []);
    const card = viewModel.experienceData.cards.find(c => c.scenarioId === 'system_unvented');
    expect(card?.title).toContain('Mixergy cylinder');
  });

  it('comparison card title for combi scenario is "Combi boiler"', () => {
    const combiScenario = makeCombiScenario({ display: buildScenarioDisplayIdentity(makeCombiScenario()) });
    const decision = makeMinimalDecision(combiScenario);
    const viewModel = buildPortalViewModel(decision, [combiScenario], []);
    const card = viewModel.verdictData.comparisonCards.find(c => c.scenarioId === 'combi');
    expect(card?.title).toBe('Combi boiler');
  });
});
