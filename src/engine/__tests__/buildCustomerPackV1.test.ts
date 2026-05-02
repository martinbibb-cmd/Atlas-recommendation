/**
 * buildCustomerPackV1.test.ts
 *
 * Mind PR 35 — Tests for buildCustomerPackV1.
 *
 * Required invariants:
 *  1. No alternative recommendation appears in the decision section.
 *  2. Anti-default is evidence-based (comes only from hardConstraints /
 *     performancePenalties aggregated by the decision builder).
 *  3. No rejected/unconfirmed scan evidence appears in any section.
 *  4. Recommendation headline remains engine-derived (verbatim from
 *     AtlasDecisionV1.headline).
 *  5. Brand changes style only, not content — pack data is identical regardless
 *     of brand.
 */

import { describe, it, expect } from 'vitest';
import { buildCustomerPackV1 } from '../../engine/modules/buildCustomerPackV1';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { QuoteScopeItem } from '../../contracts/QuoteScope';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeLifecycle(): AtlasDecisionV1['lifecycle'] {
  return {
    currentSystem: { type: 'combi', ageYears: 12, condition: 'good' },
    expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [11, 14] },
    influencingFactors: {
      waterQuality: 'moderate',
      scaleRisk: 'low',
      usageIntensity: 'medium',
      maintenanceLevel: 'average',
    },
    riskIndicators: [],
    summary: 'The system is in reasonable condition.',
  };
}

function makeScenario(
  scenarioId: string,
  type: ScenarioResult['system']['type'],
  overrides: Partial<ScenarioResult> = {},
): ScenarioResult {
  return {
    scenarioId,
    system: { type, summary: `${type} system` },
    performance: {
      hotWater: 'excellent',
      heating: 'very_good',
      efficiency: 'good',
      reliability: 'very_good',
    },
    keyBenefits: [`${scenarioId} benefit`],
    keyConstraints: [`${scenarioId} constraint`],
    dayToDayOutcomes: [`Day-to-day outcome for ${scenarioId}`],
    requiredWorks: [`Required work for ${scenarioId}`],
    upgradePaths: [],
    physicsFlags: {},
    ...overrides,
  };
}

function makeDecision(
  recommendedScenarioId: string,
  overrides: Partial<AtlasDecisionV1> = {},
): AtlasDecisionV1 {
  return {
    recommendedScenarioId,
    headline: `${recommendedScenarioId} headline — engine-derived.`,
    summary:  `${recommendedScenarioId} summary sentence.`,
    keyReasons: [`${recommendedScenarioId} reason`],
    avoidedRisks: [],
    dayToDayOutcomes: [`${recommendedScenarioId} day-to-day`],
    requiredWorks: [],
    compatibilityWarnings: [],
    includedItems: [`${recommendedScenarioId} item`],
    quoteScope: [],
    futureUpgradePaths: [],
    supportingFacts: [],
    lifecycle: makeLifecycle(),
    ...overrides,
  };
}

// ─── Invariant 1: no alternative recommendation in decision section ───────────

describe('buildCustomerPackV1 — invariant 1: decision section is locked to recommended', () => {

  it('decision.recommendedScenarioId matches the decision input exactly', () => {
    const scenarios = [
      makeScenario('system_unvented', 'system'),
      makeScenario('combi', 'combi'),
    ];
    const decision = makeDecision('system_unvented');

    const pack = buildCustomerPackV1(decision, scenarios);

    expect(pack.decision.recommendedScenarioId).toBe('system_unvented');
  });

  it('decision section does not contain the alternative scenario ID', () => {
    const scenarios = [
      makeScenario('system_unvented', 'system'),
      makeScenario('combi', 'combi'),
    ];
    const decision = makeDecision('system_unvented');

    const pack = buildCustomerPackV1(decision, scenarios);

    // The rejected combi scenario ID must not appear in the decision section
    expect(pack.decision.recommendedScenarioId).not.toBe('combi');
    expect(pack.decision.recommendedSystemLabel).not.toContain('combi');
    expect(pack.decision.headline).not.toContain('combi');
  });

  it('whyThisWorks.reasons contain only decision.keyReasons — not rejected scenario benefits', () => {
    const scenarios = [
      makeScenario('system_unvented', 'system', { keyBenefits: ['system benefit — correct'] }),
      makeScenario('combi', 'combi',           { keyBenefits: ['combi benefit — must not appear'] }),
    ];
    const decision = makeDecision('system_unvented', {
      keyReasons: ['system benefit — correct'],
    });

    const pack = buildCustomerPackV1(decision, scenarios);

    expect(pack.whyThisWorks.reasons).toContain('system benefit — correct');
    expect(pack.whyThisWorks.reasons).not.toContain('combi benefit — must not appear');
  });

  it('dailyBenefits.outcomes come from decision.dayToDayOutcomes — not from rejected scenarios', () => {
    const scenarios = [
      makeScenario('ashp', 'ashp',   { dayToDayOutcomes: ['ASHP outcome — correct'] }),
      makeScenario('combi', 'combi', { dayToDayOutcomes: ['combi outcome — must not appear'] }),
    ];
    const decision = makeDecision('ashp', {
      dayToDayOutcomes: ['ASHP outcome — correct'],
    });

    const pack = buildCustomerPackV1(decision, scenarios);

    expect(pack.dailyBenefits.outcomes).toContain('ASHP outcome — correct');
    expect(pack.dailyBenefits.outcomes).not.toContain('combi outcome — must not appear');
  });
});

// ─── Invariant 2: anti-default is evidence-based ──────────────────────────────

describe('buildCustomerPackV1 — invariant 2: anti-default evidence-based', () => {

  it('antiDefault.evidencePoints include hardConstraints from the decision', () => {
    const scenarios = [makeScenario('system_unvented', 'system')];
    const decision = makeDecision('system_unvented', {
      hardConstraints: ['Combi cannot satisfy simultaneous DHW demand — mains flow is insufficient'],
    });

    const pack = buildCustomerPackV1(decision, scenarios);

    expect(pack.antiDefault.evidencePoints).toContain(
      'Combi cannot satisfy simultaneous DHW demand — mains flow is insufficient',
    );
  });

  it('antiDefault.evidencePoints include performancePenalties from the decision', () => {
    const scenarios = [makeScenario('system_unvented', 'system')];
    const decision = makeDecision('system_unvented', {
      performancePenalties: ['Short-draw efficiency collapse below 30 % on combi at low flow rates'],
    });

    const pack = buildCustomerPackV1(decision, scenarios);

    expect(pack.antiDefault.evidencePoints).toContain(
      'Short-draw efficiency collapse below 30 % on combi at low flow rates',
    );
  });

  it('antiDefault.evidencePoints is empty when no constraints or penalties exist', () => {
    const scenarios = [makeScenario('combi', 'combi')];
    const decision = makeDecision('combi', {
      hardConstraints:      [],
      performancePenalties: [],
    });

    const pack = buildCustomerPackV1(decision, scenarios);

    expect(pack.antiDefault.evidencePoints).toHaveLength(0);
  });

  it('antiDefault.narrative is present and non-empty for all system types', () => {
    const types: Array<ScenarioResult['system']['type']> = ['combi', 'system', 'regular', 'ashp'];
    for (const type of types) {
      const scenario = makeScenario(type, type);
      const decision = makeDecision(type);
      const pack = buildCustomerPackV1(decision, [scenario]);
      expect(pack.antiDefault.narrative.length).toBeGreaterThan(0);
    }
  });

  it('antiDefault.narrative mentions the system type — it is system-specific, not generic', () => {
    const scenarios = [makeScenario('system_unvented', 'system')];
    const decision = makeDecision('system_unvented');

    const pack = buildCustomerPackV1(decision, scenarios);

    // Narrative must reflect the system (system boiler / stored) — not a generic message
    const narrative = pack.antiDefault.narrative.toLowerCase();
    expect(
      narrative.includes('system boiler') || narrative.includes('stored'),
    ).toBe(true);
  });
});

// ─── Invariant 3: no rejected/unconfirmed scan evidence ──────────────────────

describe('buildCustomerPackV1 — invariant 3: no raw scan evidence from rejected scenarios', () => {

  it('fullSystem.includedItems do not contain items from a rejected scenario', () => {
    const includeItem: QuoteScopeItem = {
      id: 'system-boiler',
      label: 'System boiler',
      category: 'heat_source',
      status: 'included',
    };
    const scenarios = [
      makeScenario('system_unvented', 'system'),
      makeScenario('combi', 'combi'),
    ];
    const decision = makeDecision('system_unvented', {
      quoteScope: [includeItem],
      includedItems: ['System boiler'],
    });

    const pack = buildCustomerPackV1(decision, scenarios);

    // The included items come from the decision quoteScope — not from the rejected combi scenario
    expect(pack.fullSystem.includedItems).toContain('System boiler');
    // Nothing from the combi scenario's raw data should appear
    expect(pack.fullSystem.includedItems.join(' ')).not.toMatch(/combi benefit/i);
  });

  it('whyThisWorks does not re-read rejected scenario keyBenefits', () => {
    const scenarios = [
      makeScenario('ashp', 'ashp',   { keyBenefits: ['ASHP benefit'] }),
      makeScenario('combi', 'combi', { keyBenefits: ['combi benefit — scan evidence only'] }),
    ];
    // decision.keyReasons is the authoritative source — already filtered by buildDecisionFromScenarios
    const decision = makeDecision('ashp', { keyReasons: ['ASHP benefit'] });

    const pack = buildCustomerPackV1(decision, scenarios);

    expect(pack.whyThisWorks.reasons.join(' ')).not.toContain('combi benefit — scan evidence only');
  });

  it('futurePath.upgradePaths come only from decision.futureUpgradePaths and quoteScope future items', () => {
    const futureItem: QuoteScopeItem = {
      id: 'hp-pathway',
      label: 'Heat pump pathway',
      category: 'future',
      status: 'optional',
    };
    const scenarios = [
      makeScenario('system_unvented', 'system', { upgradePaths: ['rejected scenario path — must not appear'] }),
    ];
    const decision = makeDecision('system_unvented', {
      futureUpgradePaths: ['Solar thermal compatible'],
      quoteScope: [futureItem],
    });

    const pack = buildCustomerPackV1(decision, scenarios);

    expect(pack.futurePath.upgradePaths).toContain('Solar thermal compatible');
    expect(pack.futurePath.upgradePaths).toContain('Heat pump pathway');
    // The rejected-scenario upgradePath is not included (it never reaches the decision)
    expect(pack.futurePath.upgradePaths).not.toContain('rejected scenario path — must not appear');
  });
});

// ─── Invariant 4: recommendation headline is engine-derived ──────────────────

describe('buildCustomerPackV1 — invariant 4: headline is verbatim from AtlasDecisionV1', () => {

  it('pack.decision.headline equals decision.headline exactly', () => {
    const headline = 'A system boiler with unvented cylinder is the right fit for this home.';
    const scenarios = [makeScenario('system_unvented', 'system')];
    const decision = makeDecision('system_unvented', { headline });

    const pack = buildCustomerPackV1(decision, scenarios);

    expect(pack.decision.headline).toBe(headline);
  });

  it('headline does not change when an alternative scenario is present', () => {
    const headline = 'An air source heat pump is the right fit for this home.';
    const scenarios = [
      makeScenario('ashp', 'ashp'),
      makeScenario('combi', 'combi'),
    ];
    const decision = makeDecision('ashp', { headline });

    const pack = buildCustomerPackV1(decision, scenarios);

    expect(pack.decision.headline).toBe(headline);
  });

  it('headline does not incorporate the current system type (no "like-for-like" corruption)', () => {
    // Current system is combi; recommended is ASHP — headline must not mention combi as recommendation
    const headline = 'An air source heat pump is the right choice for this home.';
    const scenarios = [
      makeScenario('ashp',  'ashp'),
      makeScenario('combi', 'combi'),
    ];
    const decision = makeDecision('ashp', {
      headline,
      lifecycle: {
        ...makeLifecycle(),
        currentSystem: { type: 'combi', ageYears: 15, condition: 'worn' },
      },
    });

    const pack = buildCustomerPackV1(decision, scenarios);

    expect(pack.decision.headline).toBe(headline);
    // The combi current system must not corrupt the headline
    expect(pack.decision.headline).not.toContain('combi');
  });
});

// ─── Invariant 5: brand changes style only, not content ──────────────────────

describe('buildCustomerPackV1 — invariant 5: brand does not affect content', () => {

  it('pack content is identical regardless of context.portalUrl presence', () => {
    const scenarios = [makeScenario('system_unvented', 'system')];
    const decision = makeDecision('system_unvented');

    const packWithUrl    = buildCustomerPackV1(decision, scenarios, { portalUrl: 'https://example.com/portal' });
    const packWithoutUrl = buildCustomerPackV1(decision, scenarios);

    // All content sections must be identical — only close.portalUrl differs
    expect(packWithUrl.decision).toEqual(packWithoutUrl.decision);
    expect(packWithUrl.whyThisWorks).toEqual(packWithoutUrl.whyThisWorks);
    expect(packWithUrl.antiDefault).toEqual(packWithoutUrl.antiDefault);
    expect(packWithUrl.dailyBenefits).toEqual(packWithoutUrl.dailyBenefits);
    expect(packWithUrl.fullSystem).toEqual(packWithoutUrl.fullSystem);
    expect(packWithUrl.dailyUse).toEqual(packWithoutUrl.dailyUse);
    expect(packWithUrl.futurePath).toEqual(packWithoutUrl.futurePath);

    // Only close.portalUrl differs between the two builds
    expect(packWithUrl.close.portalUrl).toBe('https://example.com/portal');
    expect(packWithoutUrl.close.portalUrl).toBeUndefined();
    expect(packWithUrl.close.nextStep).toBe(packWithoutUrl.close.nextStep);
  });

  it('pack content is identical whether built for brand-A or brand-B context', () => {
    // Context carries no brand data — brand is a view-layer concern only
    const scenarios = [makeScenario('system_unvented', 'system')];
    const decision = makeDecision('system_unvented');

    const packBrandA = buildCustomerPackV1(decision, scenarios, {});
    const packBrandB = buildCustomerPackV1(decision, scenarios, {});

    expect(packBrandA).toEqual(packBrandB);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('buildCustomerPackV1 — error handling', () => {

  it('throws when the recommended scenario is not in the array', () => {
    const scenarios = [makeScenario('combi', 'combi')];
    const decision = makeDecision('system_unvented'); // not in scenarios

    expect(() => buildCustomerPackV1(decision, scenarios)).toThrow(
      /scenario "system_unvented" not found/,
    );
  });
});

// ─── Structural completeness ──────────────────────────────────────────────────

describe('buildCustomerPackV1 — all 8 sections are populated', () => {

  it('returns all 8 required sections', () => {
    const scenarios = [makeScenario('system_unvented', 'system')];
    const decision  = makeDecision('system_unvented');

    const pack = buildCustomerPackV1(decision, scenarios);

    expect(pack).toHaveProperty('decision');
    expect(pack).toHaveProperty('whyThisWorks');
    expect(pack).toHaveProperty('antiDefault');
    expect(pack).toHaveProperty('dailyBenefits');
    expect(pack).toHaveProperty('fullSystem');
    expect(pack).toHaveProperty('dailyUse');
    expect(pack).toHaveProperty('futurePath');
    expect(pack).toHaveProperty('close');
  });

  it('dailyUse.guidance is non-empty for all four system types', () => {
    const types: Array<ScenarioResult['system']['type']> = ['combi', 'system', 'regular', 'ashp'];
    for (const type of types) {
      const scenario = makeScenario(type, type);
      const decision = makeDecision(type);
      const pack = buildCustomerPackV1(decision, [scenario]);
      expect(pack.dailyUse.guidance.length).toBeGreaterThan(0);
    }
  });

  it('close.nextStep is always a non-empty string', () => {
    const scenarios = [makeScenario('combi', 'combi')];
    const decision  = makeDecision('combi');

    const pack = buildCustomerPackV1(decision, scenarios);

    expect(typeof pack.close.nextStep).toBe('string');
    expect(pack.close.nextStep.length).toBeGreaterThan(0);
  });

  it('fullSystem.includedItems falls back to decision.includedItems when quoteScope is empty', () => {
    const scenarios = [makeScenario('combi', 'combi')];
    const decision  = makeDecision('combi', {
      quoteScope:    [],
      includedItems: ['Combi boiler', 'Magnetic filter'],
    });

    const pack = buildCustomerPackV1(decision, scenarios);

    expect(pack.fullSystem.includedItems).toContain('Combi boiler');
    expect(pack.fullSystem.includedItems).toContain('Magnetic filter');
  });
});
