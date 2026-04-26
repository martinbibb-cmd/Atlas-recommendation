/**
 * buildCustomerSummary.test.ts
 *
 * Tests for buildCustomerSummary and validateAiCustomerSummary.
 *
 * Required scenarios (from problem statement):
 *  - ASHP selected remains ASHP in summary.
 *  - Combi current system does not become combi recommendation.
 *  - Rejected combi scenario cannot appear as advice.
 *  - Verification items appear only under requiredChecks.
 *  - Header tank/cylinder/pipe checks are not converted into claimed benefits.
 *  - AI summary fallback uses deterministic summary when validation fails.
 */

import { describe, it, expect } from 'vitest';
import { buildCustomerSummary } from '../../engine/modules/buildCustomerSummary';
import { validateAiCustomerSummary } from '../../engine/modules/validateAiCustomerSummary';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { QuoteScopeItem } from '../../contracts/QuoteScope';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

function makeScenario(
  scenarioId: string,
  type: ScenarioResult['system']['type'],
  overrides: Partial<ScenarioResult> = {},
): ScenarioResult {
  return {
    scenarioId,
    system: { type, summary: `${type} system summary` },
    performance: {
      hotWater: 'good',
      heating: 'good',
      efficiency: 'good',
      reliability: 'good',
    },
    keyBenefits: [`${type} benefit`],
    keyConstraints: [`${type} constraint`],
    dayToDayOutcomes: [`${type} outcome`],
    requiredWorks: [],
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
    headline: 'An air source heat pump is the right fit for this home.',
    summary: 'The heat pump provides low-carbon heating and hot water at reduced running cost.',
    keyReasons: ['Low carbon emissions', 'Better running costs'],
    avoidedRisks: ['Avoided gas boiler dependency'],
    dayToDayOutcomes: ['Consistent background warmth'],
    requiredWorks: [],
    compatibilityWarnings: [],
    includedItems: [],
    quoteScope: [],
    futureUpgradePaths: [],
    supportingFacts: [],
    lifecycle: {
      currentSystem: {
        type: 'combi',
        ageYears: 10,
        condition: 'fair',
      },
      influencingFactors: {
        waterQuality: 'unknown',
        scaleRisk: 'low',
        usageIntensity: 'medium',
      },
      projectedLifespanYears: 5,
      summary: 'System in fair condition',
      maintenanceActions: [],
    },
    ...overrides,
  };
}

// ─── buildCustomerSummary ─────────────────────────────────────────────────────

describe('buildCustomerSummary', () => {
  it('ASHP selected remains ASHP in summary — recommendedScenarioId and label match', () => {
    const scenarios = [
      makeScenario('ashp', 'ashp'),
      makeScenario('combi', 'combi'),
    ];
    const decision = makeDecision('ashp');
    const summary = buildCustomerSummary(decision, scenarios);

    expect(summary.recommendedScenarioId).toBe('ashp');
    expect(summary.recommendedSystemLabel).toBe('Air source heat pump');
  });

  it('combi current system does not become combi recommendation when ASHP is recommended', () => {
    // Current system is combi (in lifecycle), but recommendation is ASHP
    const scenarios = [
      makeScenario('ashp', 'ashp'),
      makeScenario('combi', 'combi'),
    ];
    const decision = makeDecision('ashp', {
      lifecycle: {
        currentSystem: { type: 'combi', ageYears: 12, condition: 'worn' },
        influencingFactors: { waterQuality: 'unknown', scaleRisk: 'low', usageIntensity: 'medium' },
        projectedLifespanYears: 3,
        summary: 'Ageing combi — replacement recommended',
        maintenanceActions: [],
      },
    });

    const summary = buildCustomerSummary(decision, scenarios);

    // The summary must reflect the ASHP recommendation, not the existing combi
    expect(summary.recommendedScenarioId).toBe('ashp');
    expect(summary.recommendedSystemLabel).toBe('Air source heat pump');
    expect(summary.recommendedSystemLabel).not.toContain('combi');
  });

  it('rejected combi scenario cannot appear as advice — whyThisWins comes only from keyReasons', () => {
    const scenarios = [
      makeScenario('ashp', 'ashp', { keyBenefits: ['Low carbon', 'Efficient'] }),
      makeScenario('combi', 'combi', { keyBenefits: ['Combi benefit — should not appear'] }),
    ];
    const decision = makeDecision('ashp', {
      keyReasons: ['Low carbon', 'Efficient'],
    });

    const summary = buildCustomerSummary(decision, scenarios);

    expect(summary.whyThisWins).toEqual(['Low carbon', 'Efficient']);
    expect(summary.whyThisWins).not.toContain('Combi benefit — should not appear');
  });

  it('whatThisAvoids comes only from avoidedRisks, not from rejected scenario constraints', () => {
    const scenarios = [
      makeScenario('ashp', 'ashp'),
      makeScenario('combi', 'combi', { keyConstraints: ['combi constraint — should not appear in avoids'] }),
    ];
    const decision = makeDecision('ashp', {
      avoidedRisks: ['Avoided gas dependency'],
    });

    const summary = buildCustomerSummary(decision, scenarios);

    expect(summary.whatThisAvoids).toEqual(['Avoided gas dependency']);
    expect(summary.whatThisAvoids).not.toContain('combi constraint — should not appear in avoids');
  });

  it('verification items appear only under requiredChecks — not in includedNow', () => {
    const verificationItem: QuoteScopeItem = {
      id: 'scope-required-compliance-0',
      label: 'Confirm cylinder location before ordering',
      category: 'compliance',
      status: 'required',
    };
    const includedItem: QuoteScopeItem = {
      id: 'scope-included-heat_source-1',
      label: 'Air source heat pump',
      category: 'heat_source',
      status: 'included',
      customerBenefit: 'Reliable low-carbon heat',
    };
    const decision = makeDecision('ashp', {
      quoteScope: [verificationItem, includedItem],
    });
    const scenarios = [makeScenario('ashp', 'ashp')];

    const summary = buildCustomerSummary(decision, scenarios);

    // Verification item must not appear in includedNow
    expect(summary.includedNow).not.toContain('Confirm cylinder location before ordering');
    // Verification item must appear in requiredChecks
    expect(summary.requiredChecks).toContain('Confirm cylinder location before ordering');
    // The real included item appears in includedNow
    expect(summary.includedNow).toContain('Air source heat pump');
  });

  it('header tank/cylinder/pipe check items are not converted into benefits', () => {
    const checkItems: QuoteScopeItem[] = [
      {
        id: 'scope-required-compliance-0',
        label: 'Check header tank remains accessible',
        category: 'compliance',
        status: 'required',
      },
      {
        id: 'scope-required-pipework-1',
        label: 'Verify primary pipework diameter',
        category: 'pipework',
        status: 'required',
      },
    ];
    const decision = makeDecision('ashp', {
      quoteScope: checkItems,
      compatibilityWarnings: [],
    });
    const scenarios = [makeScenario('ashp', 'ashp')];

    const summary = buildCustomerSummary(decision, scenarios);

    // Check items must not appear in includedNow (no benefit framing)
    expect(summary.includedNow).not.toContain('Check header tank remains accessible');
    expect(summary.includedNow).not.toContain('Verify primary pipework diameter');
    // They must appear in requiredChecks
    expect(summary.requiredChecks).toContain('Check header tank remains accessible');
    expect(summary.requiredChecks).toContain('Verify primary pipework diameter');
  });

  it('compliance quoteScope items appear in requiredChecks', () => {
    const complianceItem: QuoteScopeItem = {
      id: 'scope-included-compliance-0',
      label: 'G3 notification',
      category: 'compliance',
      status: 'included',
      engineerNote: 'Required: G3 notification',
    };
    const decision = makeDecision('ashp', {
      quoteScope: [complianceItem],
    });
    const scenarios = [makeScenario('ashp', 'ashp')];

    const summary = buildCustomerSummary(decision, scenarios);

    expect(summary.requiredChecks).toContain('G3 notification');
    expect(summary.includedNow).not.toContain('G3 notification');
  });

  it('optional upgrades come from recommended/optional quoteScope items (non-future)', () => {
    const optionalItem: QuoteScopeItem = {
      id: 'scope-recommended-controls-0',
      label: 'Smart controls upgrade',
      category: 'controls',
      status: 'recommended',
    };
    const futureItem: QuoteScopeItem = {
      id: 'scope-optional-future-1',
      label: 'Solar PV ready',
      category: 'future',
      status: 'optional',
    };
    const decision = makeDecision('ashp', {
      quoteScope: [optionalItem, futureItem],
    });
    const scenarios = [makeScenario('ashp', 'ashp')];

    const summary = buildCustomerSummary(decision, scenarios);

    expect(summary.optionalUpgrades).toContain('Smart controls upgrade');
    // Future items go to futureReady, not optionalUpgrades
    expect(summary.optionalUpgrades).not.toContain('Solar PV ready');
    expect(summary.futureReady).toContain('Solar PV ready');
  });

  it('futureReady merges futureUpgradePaths and future quoteScope items without duplication', () => {
    const futureItem: QuoteScopeItem = {
      id: 'scope-optional-future-0',
      label: 'EV charger ready',
      category: 'future',
      status: 'optional',
    };
    const decision = makeDecision('ashp', {
      futureUpgradePaths: ['Solar PV pathway', 'EV charger ready'],
      quoteScope: [futureItem],
    });
    const scenarios = [makeScenario('ashp', 'ashp')];

    const summary = buildCustomerSummary(decision, scenarios);

    // Both sources merged, deduped
    expect(summary.futureReady).toContain('Solar PV pathway');
    expect(summary.futureReady).toContain('EV charger ready');
    // No duplicates
    const count = summary.futureReady.filter((s) => s === 'EV charger ready').length;
    expect(count).toBe(1);
  });

  it('confidenceNotes includes lifecycle urgency for at_risk systems', () => {
    const decision = makeDecision('ashp', {
      lifecycle: {
        currentSystem: { type: 'combi', ageYears: 22, condition: 'at_risk' },
        influencingFactors: { waterQuality: 'unknown', scaleRisk: 'high', usageIntensity: 'high' },
        projectedLifespanYears: 1,
        summary: 'At risk — failure imminent',
        maintenanceActions: [],
      },
    });
    const scenarios = [makeScenario('ashp', 'ashp')];

    const summary = buildCustomerSummary(decision, scenarios);

    expect(summary.confidenceNotes.some((n) => n.includes('elevated risk of failure'))).toBe(true);
  });

  it('confidenceNotes includes lifecycle urgency for worn systems', () => {
    const decision = makeDecision('ashp', {
      lifecycle: {
        currentSystem: { type: 'combi', ageYears: 16, condition: 'worn' },
        influencingFactors: { waterQuality: 'unknown', scaleRisk: 'medium', usageIntensity: 'medium' },
        projectedLifespanYears: 3,
        summary: 'Worn — approaching end of lifespan',
        maintenanceActions: [],
      },
    });
    const scenarios = [makeScenario('ashp', 'ashp')];

    const summary = buildCustomerSummary(decision, scenarios);

    expect(summary.confidenceNotes.some((n) => n.includes('reliability may decline'))).toBe(true);
  });

  it('throws when recommended scenario is missing from scenarios array', () => {
    const scenarios = [makeScenario('combi', 'combi')];
    const decision = makeDecision('ashp');

    expect(() => buildCustomerSummary(decision, scenarios)).toThrow(
      /scenario "ashp" not found/,
    );
  });

  it('headline comes from decision.headline, not scenario summary', () => {
    const scenarios = [makeScenario('ashp', 'ashp', { system: { type: 'ashp', summary: 'scenario summary text' } })];
    const decision = makeDecision('ashp', {
      headline: 'An air source heat pump is the right fit for this home.',
    });

    const summary = buildCustomerSummary(decision, scenarios);

    expect(summary.headline).toBe('An air source heat pump is the right fit for this home.');
    expect(summary.headline).not.toBe('scenario summary text');
  });

  it('plainEnglishDecision comes from decision.summary, not scenario fields', () => {
    const scenarios = [makeScenario('ashp', 'ashp')];
    const decision = makeDecision('ashp', {
      summary: 'The heat pump is the authoritative summary.',
    });

    const summary = buildCustomerSummary(decision, scenarios);

    expect(summary.plainEnglishDecision).toBe('The heat pump is the authoritative summary.');
  });

  it('fitNarrative equals decision.summary', () => {
    const scenarios = [makeScenario('ashp', 'ashp')];
    const decision = makeDecision('ashp', {
      summary: 'Single canonical narrative from engine.',
    });

    const summary = buildCustomerSummary(decision, scenarios);

    expect(summary.fitNarrative).toBe('Single canonical narrative from engine.');
  });

  it('hardConstraints populated from decision.hardConstraints', () => {
    const scenarios = [makeScenario('ashp', 'ashp')];
    const decision = makeDecision('ashp', {
      hardConstraints: ['Combi: mains pressure too low — burner cannot fire'],
    });

    const summary = buildCustomerSummary(decision, scenarios);

    expect(summary.hardConstraints).toEqual(['Combi: mains pressure too low — burner cannot fire']);
  });

  it('performancePenalties populated from decision.performancePenalties', () => {
    const scenarios = [makeScenario('ashp', 'ashp')];
    const decision = makeDecision('ashp', {
      performancePenalties: ['Short draws collapse combi efficiency to ~28%'],
    });

    const summary = buildCustomerSummary(decision, scenarios);

    expect(summary.performancePenalties).toEqual(['Short draws collapse combi efficiency to ~28%']);
  });

  it('hardConstraints and performancePenalties default to empty arrays when absent from decision', () => {
    const scenarios = [makeScenario('ashp', 'ashp')];
    const decision = makeDecision('ashp');

    const summary = buildCustomerSummary(decision, scenarios);

    expect(summary.hardConstraints).toEqual([]);
    expect(summary.performancePenalties).toEqual([]);
  });
});

// ─── validateAiCustomerSummary ────────────────────────────────────────────────

describe('validateAiCustomerSummary', () => {
function makeLockedSummary() {
    return {
      recommendedScenarioId: 'ashp',
      recommendedSystemLabel: 'Air source heat pump',
      headline: 'An air source heat pump is the right fit for this home.',
      plainEnglishDecision: 'The heat pump provides low-carbon heating at reduced cost.',
      fitNarrative: 'The heat pump provides low-carbon heating at reduced cost.',
      whyThisWins: ['Low carbon', 'Efficient'],
      whatThisAvoids: ['Avoided gas dependency'],
      hardConstraints: [],
      performancePenalties: [],
      includedNow: ['Air source heat pump', 'Pipework upgrade'],
      requiredChecks: ['Hydraulic assessment required'],
      optionalUpgrades: ['Smart controls'],
      futureReady: ['Solar PV pathway'],
      confidenceNotes: [],
    };
  }

  it('passes valid AI rewrite that mentions the recommended system', () => {
    const text = 'The air source heat pump is a great choice for your home. It provides low-carbon heating and reduces your running costs. A hydraulic assessment is required before installation.';
    const result = validateAiCustomerSummary(text, makeLockedSummary());
    expect(result.valid).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('rejects when selected system label is absent', () => {
    const text = 'A new heating system will work well for your home.';
    const result = validateAiCustomerSummary(text, makeLockedSummary());
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes('absent'))).toBe(true);
  });

  it('rejects when another system appears near a recommendation phrase', () => {
    const text = 'The air source heat pump is installed. A combi boiler is the best choice for most homes.';
    const result = validateAiCustomerSummary(text, makeLockedSummary());
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes('combi boiler'))).toBe(true);
  });

  it('AI summary fallback: validation failure is detected so caller can use deterministic text', () => {
    // This test verifies the validator returns valid=false so the caller
    // knows to fall back to lockedSummary.plainEnglishDecision
    const badText = 'The system boiler should be your first choice — it is the recommended option here.';
    const result = validateAiCustomerSummary(badText, makeLockedSummary());
    // Either the system label is absent or a non-selected system appears near a phrase
    expect(result.valid).toBe(false);
  });

  it('rejects text with invented physics measurements', () => {
    const text = 'The air source heat pump suits your home, which has a heat loss of 8 kW.';
    const result = validateAiCustomerSummary(text, makeLockedSummary());
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes('measurement'))).toBe(true);
  });

  it('rejects text with invented flow rate figures', () => {
    const text = 'The air source heat pump works well with your 2.5 bar mains pressure.';
    const result = validateAiCustomerSummary(text, makeLockedSummary());
    expect(result.valid).toBe(false);
  });

  it('does not reject text that only mentions recommended system near a recommendation phrase', () => {
    const text = 'The air source heat pump is the best choice for your home. It is recommended for low-carbon homes.';
    const result = validateAiCustomerSummary(text, makeLockedSummary());
    // System label is present; no other system near recommendation phrase
    // (may still fail on invented physics, but not on the recommendation gate)
    const nonPhysicsReasons = result.reasons.filter((r) => !r.includes('measurement'));
    expect(nonPhysicsReasons).toHaveLength(0);
  });
});
