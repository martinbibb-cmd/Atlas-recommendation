/**
 * buildVisualBlocks.test.ts
 *
 * Covers:
 *  - hero block is always first
 *  - facts block is always second
 *  - lifecycle warning block is emitted when condition is worn or at_risk
 *  - lifecycle warning block is omitted when condition is good
 *  - problem block is emitted when a weaker scenario exists
 *  - problem block is omitted when only one scenario is provided
 *  - solution block references the recommended scenario
 *  - daily_use block is omitted when dayToDayOutcomes is empty
 *  - included_scope block is omitted when includedItems is empty
 *  - future_upgrade block is omitted when futureUpgradePaths is empty
 *  - portal_cta block is always last
 *  - supportingPoints on hero are capped at 3
 */

import { describe, it, expect } from 'vitest';
import { buildVisualBlocks } from '../modules/buildVisualBlocks';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { VisualBlock, WarningBlock } from '../../contracts/VisualBlock';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRecommendedScenario(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    scenarioId: 'system_unvented',
    system: { type: 'system', summary: 'System boiler with unvented cylinder' },
    performance: {
      hotWater:    'excellent',
      heating:     'very_good',
      efficiency:  'good',
      reliability: 'very_good',
    },
    keyBenefits:      ['Simultaneous hot water across multiple outlets', 'Mains-pressure delivery'],
    keyConstraints:   ['Requires space for cylinder'],
    dayToDayOutcomes: ['Instant hot water at all outlets', 'No cold-water wait'],
    requiredWorks:    ['Install unvented cylinder'],
    upgradePaths:     ['Heat pump ready', 'Solar thermal compatible'],
    physicsFlags:     {},
    ...overrides,
  };
}

function makeWeakerCombiScenario(): ScenarioResult {
  return {
    scenarioId: 'combi',
    system: { type: 'combi', summary: 'Combi boiler — on-demand DHW' },
    performance: {
      hotWater:    'poor',
      heating:     'good',
      efficiency:  'good',
      reliability: 'good',
    },
    keyBenefits:      ['No cylinder needed'],
    keyConstraints:   ['Simultaneous demand risk with 2 bathrooms', 'Flow rate limited'],
    dayToDayOutcomes: ['Single-outlet hot water'],
    requiredWorks:    [],
    upgradePaths:     [],
    physicsFlags:     { combiFlowRisk: true },
  };
}

function makeDecision(overrides: Partial<AtlasDecisionV1> = {}): AtlasDecisionV1 {
  return {
    recommendedScenarioId: 'system_unvented',
    headline: 'A system boiler is the right fit for this home.',
    summary:  'System boiler with unvented cylinder. The existing system is in worn condition.',
    keyReasons: [
      'Two bathrooms require stored hot water',
      'Mains pressure supports unvented operation',
      'Simultaneous demand would exceed combi capacity',
      'Additional reason four',
    ],
    avoidedRisks:           ['Simultaneous demand failure'],
    dayToDayOutcomes:       ['Instant hot water at all outlets', 'No cold-water wait'],
    requiredWorks:          ['Install unvented cylinder'],
    compatibilityWarnings:  [],
    includedItems:          ['System boiler', 'Unvented cylinder', 'Smart controls'],
    quoteScope:             [],
    futureUpgradePaths:     ['Heat pump ready', 'Solar thermal compatible'],
    supportingFacts: [
      { label: 'Occupants',       value: 4,          source: 'survey' },
      { label: 'Bathrooms',       value: 2,          source: 'survey' },
      { label: 'System age',      value: '18 years', source: 'survey' },
      { label: 'Boiler type',     value: 'regular',  source: 'survey' },
      { label: 'Condition band',  value: 'worn',     source: 'engine' },
    ],
    lifecycle: {
      currentSystem: {
        type:      'regular',
        ageYears:  18,
        condition: 'worn',
      },
      expectedLifespan: {
        typicalRangeYears:  [15, 20],
        adjustedRangeYears: [13, 18],
      },
      influencingFactors: {
        waterQuality:     'moderate',
        scaleRisk:        'medium',
        usageIntensity:   'high',
        maintenanceLevel: 'average',
      },
      riskIndicators: ['System age approaching adjusted lifespan', 'High usage intensity'],
      summary: 'The existing system is showing signs of age and may be approaching the end of its reliable service life.',
    },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildVisualBlocks — block ordering and presence', () => {
  const scenarios = [makeRecommendedScenario(), makeWeakerCombiScenario()];
  const decision  = makeDecision();
  let blocks: VisualBlock[];

  it('produces a non-empty array', () => {
    blocks = buildVisualBlocks(decision, scenarios);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('first block is a hero block', () => {
    blocks = buildVisualBlocks(decision, scenarios);
    expect(blocks[0].type).toBe('hero');
  });

  it('second block is a facts block', () => {
    blocks = buildVisualBlocks(decision, scenarios);
    expect(blocks[1].type).toBe('facts');
  });

  it('last block is a portal_cta', () => {
    blocks = buildVisualBlocks(decision, scenarios);
    expect(blocks[blocks.length - 1].type).toBe('portal_cta');
  });

  it('includes a solution block', () => {
    blocks = buildVisualBlocks(decision, scenarios);
    expect(blocks.some((b) => b.type === 'solution')).toBe(true);
  });

  it('includes a daily_use block when dayToDayOutcomes is non-empty', () => {
    blocks = buildVisualBlocks(decision, scenarios);
    expect(blocks.some((b) => b.type === 'daily_use')).toBe(true);
  });

  it('includes an included_scope block when includedItems is non-empty', () => {
    blocks = buildVisualBlocks(decision, scenarios);
    expect(blocks.some((b) => b.type === 'included_scope')).toBe(true);
  });

  it('includes a future_upgrade block when futureUpgradePaths is non-empty', () => {
    blocks = buildVisualBlocks(decision, scenarios);
    expect(blocks.some((b) => b.type === 'future_upgrade')).toBe(true);
  });

  it('problem block appears when a weaker scenario exists', () => {
    blocks = buildVisualBlocks(decision, scenarios);
    expect(blocks.some((b) => b.type === 'problem')).toBe(true);
  });
});

describe('buildVisualBlocks — hero block content', () => {
  it('hero block carries the recommendedScenarioId', () => {
    const decision = makeDecision();
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    const hero     = blocks.find((b) => b.type === 'hero');
    expect(hero).toBeDefined();
    if (hero?.type !== 'hero') return;
    expect(hero.recommendedScenarioId).toBe('system_unvented');
  });

  it('hero block supportingPoints are capped at 3', () => {
    const decision = makeDecision(); // keyReasons has 4 entries
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    const hero     = blocks.find((b) => b.type === 'hero');
    expect(hero?.supportingPoints?.length).toBeLessThanOrEqual(3);
  });

  it('hero block outcome equals the decision headline', () => {
    const decision = makeDecision();
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    const hero     = blocks.find((b) => b.type === 'hero');
    expect(hero?.outcome).toBe(decision.headline);
  });
});

describe('buildVisualBlocks — lifecycle warning', () => {
  it('emits a warning block when condition is worn', () => {
    const decision = makeDecision({ lifecycle: { ...makeDecision().lifecycle, currentSystem: { type: 'regular', ageYears: 18, condition: 'worn' } } });
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    const warning  = blocks.find((b) => b.type === 'warning') as WarningBlock | undefined;
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('important');
  });

  it('emits a warning block when condition is at_risk', () => {
    const decision = makeDecision({ lifecycle: { ...makeDecision().lifecycle, currentSystem: { type: 'regular', ageYears: 25, condition: 'at_risk' } } });
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    expect(blocks.some((b) => b.type === 'warning')).toBe(true);
  });

  it('does NOT emit a lifecycle warning when condition is good', () => {
    const decision = makeDecision({ lifecycle: { ...makeDecision().lifecycle, currentSystem: { type: 'regular', ageYears: 5, condition: 'good' } } });
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    // If there are no compatibility warnings either, no warning block at all
    expect(blocks.filter((b) => b.type === 'warning').length).toBe(0);
  });

  it('lifecycle warning visualKey is boiler_lifecycle_warning', () => {
    const decision = makeDecision();
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    const warning  = blocks.find((b) => b.type === 'warning') as WarningBlock | undefined;
    expect(warning?.visualKey).toBe('boiler_lifecycle_warning');
  });

  it('lifecycle warning outcome comes from lifecycle.summary', () => {
    const decision = makeDecision();
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    const warning  = blocks.find((b) => b.id === 'lifecycle-warning') as WarningBlock | undefined;
    expect(warning?.outcome).toBe(decision.lifecycle.summary);
  });
});

describe('buildVisualBlocks — optional blocks omitted when empty', () => {
  it('omits daily_use block when dayToDayOutcomes is empty', () => {
    const decision = makeDecision({ dayToDayOutcomes: [] });
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    expect(blocks.some((b) => b.type === 'daily_use')).toBe(false);
  });

  it('included_scope block is always emitted, even when includedItems is empty', () => {
    const decision = makeDecision({ includedItems: [], quoteScope: [] });
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    expect(blocks.some((b) => b.type === 'included_scope')).toBe(true);
  });

  it('omits future_upgrade block when futureUpgradePaths is empty', () => {
    const decision = makeDecision({ futureUpgradePaths: [] });
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    expect(blocks.some((b) => b.type === 'future_upgrade')).toBe(false);
  });

  it('omits problem block when only one scenario provided', () => {
    const decision = makeDecision();
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    expect(blocks.some((b) => b.type === 'problem')).toBe(false);
  });

  it('omits problem block when weaker scenario has no keyConstraints', () => {
    const noConstraintsWeaker: ScenarioResult = {
      ...makeWeakerCombiScenario(),
      keyConstraints: [],
    };
    const decision = makeDecision();
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario(), noConstraintsWeaker]);
    expect(blocks.some((b) => b.type === 'problem')).toBe(false);
  });

  it('omits problem block when weaker scenario has no physics flag (no generic combi page)', () => {
    const unflaggedWeaker: ScenarioResult = {
      ...makeWeakerCombiScenario(),
      physicsFlags: {},
      keyConstraints: ['Some constraint without a physics measurement'],
    };
    const decision = makeDecision();
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario(), unflaggedWeaker]);
    expect(blocks.some((b) => b.type === 'problem')).toBe(false);
  });
});

describe('buildVisualBlocks — text truncation', () => {
  it('hero outcome longer than 140 chars is truncated', () => {
    const longHeadline = 'A'.repeat(150);
    const decision = makeDecision({ headline: longHeadline });
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    const hero     = blocks.find((b) => b.type === 'hero');
    expect(hero?.outcome?.length).toBeLessThanOrEqual(140);
  });

  it('supporting points longer than 110 chars are truncated', () => {
    const longPoint = 'B'.repeat(120);
    const decision  = makeDecision({ keyReasons: [longPoint] });
    const blocks    = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    const hero      = blocks.find((b) => b.type === 'hero');
    expect((hero?.supportingPoints ?? []).every((p) => p.length <= 110)).toBe(true);
  });

  it('hero outcome within 140 chars is not truncated', () => {
    const shortHeadline = 'A system boiler is the right fit for this home.';
    const decision = makeDecision({ headline: shortHeadline });
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    const hero     = blocks.find((b) => b.type === 'hero');
    expect(hero?.outcome).toBe(shortHeadline);
  });
});

describe('buildVisualBlocks — problem block physics flags', () => {
  it('problem block visualKey is combi_concurrency_problem when combiFlowRisk is set', () => {
    const decision  = makeDecision();
    const scenarios = [makeRecommendedScenario(), makeWeakerCombiScenario()];
    const blocks    = buildVisualBlocks(decision, scenarios);
    const problem   = blocks.find((b) => b.type === 'problem');
    expect(problem?.visualKey).toBe('combi_concurrency_problem');
  });

  it('problem block visualKey is ashp_pipe_limit_problem when hydraulicLimit is set', () => {
    const weaker: ScenarioResult = {
      ...makeWeakerCombiScenario(),
      scenarioId:  'ashp',
      physicsFlags: { hydraulicLimit: true, combiFlowRisk: false },
    };
    const decision  = makeDecision();
    const scenarios = [makeRecommendedScenario(), weaker];
    const blocks    = buildVisualBlocks(decision, scenarios);
    const problem   = blocks.find((b) => b.type === 'problem');
    expect(problem?.visualKey).toBe('ashp_pipe_limit_problem');
  });

  it('problem block title uses "a conventional system" for ashp system type', () => {
    const weaker: ScenarioResult = {
      ...makeWeakerCombiScenario(),
      scenarioId:  'ashp',
      system:      { type: 'ashp', summary: 'Air source heat pump' },
      physicsFlags: { hydraulicLimit: true },
    };
    const decision  = makeDecision();
    const scenarios = [makeRecommendedScenario(), weaker];
    const blocks    = buildVisualBlocks(decision, scenarios);
    const problem   = blocks.find((b) => b.type === 'problem');
    expect(problem?.title).toBe('Why your home needs a conventional system');
  });

  it('problem block title uses "stored hot water" for combi system type', () => {
    const decision  = makeDecision();
    const scenarios = [makeRecommendedScenario(), makeWeakerCombiScenario()];
    const blocks    = buildVisualBlocks(decision, scenarios);
    const problem   = blocks.find((b) => b.type === 'problem');
    expect(problem?.title).toBe('Why your home needs stored hot water');
  });
});

describe('buildVisualBlocks — system_work_explainer block', () => {
  it('emits a system_work_explainer block when quoteScope has included items with descriptions', () => {
    const decision = makeDecision({
      quoteScope: [
        {
          id: 'flush-1', label: 'Power flush', category: 'flush', status: 'included',
          whatItDoes: 'Clears sludge from the circuit', customerBenefit: 'Radiators heat evenly',
        },
      ],
    });
    const blocks = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    expect(blocks.some((b) => b.type === 'system_work_explainer')).toBe(true);
  });

  it('system_work_explainer cards contain whatItIs, whatItDoes, whyItHelps', () => {
    const decision = makeDecision({
      quoteScope: [
        {
          id: 'filter-1', label: 'Magnetic filter', category: 'protection', status: 'included',
          whatItDoes: 'Captures magnetite particles', customerBenefit: 'Keeps the boiler efficient',
        },
      ],
    });
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    const explainer = blocks.find((b) => b.type === 'system_work_explainer') as import('../../contracts/VisualBlock').SystemWorkExplainerBlock | undefined;
    expect(explainer?.cards).toBeDefined();
    expect(explainer?.cards[0].whatItIs).toBe('Magnetic filter');
    expect(explainer?.cards[0].whatItDoes).toBe('Captures magnetite particles');
    expect(explainer?.cards[0].whyItHelps).toBe('Keeps the boiler efficient');
  });

  it('system_work_explainer block is omitted when quoteScope is empty', () => {
    const decision = makeDecision({ quoteScope: [] });
    const blocks   = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    expect(blocks.some((b) => b.type === 'system_work_explainer')).toBe(false);
  });

  it('system_work_explainer caps cards at 6', () => {
    const manyItems = Array.from({ length: 8 }, (_, i) => ({
      id: `item-${i}`, label: `Item ${i + 1}`, category: 'protection' as const, status: 'included' as const,
      whatItDoes: 'Does something', customerBenefit: 'Helps you',
    }));
    const decision  = makeDecision({ quoteScope: manyItems });
    const blocks    = buildVisualBlocks(decision, [makeRecommendedScenario()]);
    const explainer = blocks.find((b) => b.type === 'system_work_explainer') as import('../../contracts/VisualBlock').SystemWorkExplainerBlock | undefined;
    expect(explainer?.cards.length).toBeLessThanOrEqual(6);
  });
});
