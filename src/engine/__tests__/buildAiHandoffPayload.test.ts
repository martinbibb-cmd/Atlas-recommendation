/**
 * buildAiHandoffPayload.test.ts
 *
 * Unit tests for buildAiHandoffPayload and serialiseAiHandoffPayload.
 *
 * Coverage:
 *   - buildAiHandoffPayload populates static policy fields (introduction,
 *     validationPolicy, trustedSourceCategories, sourceUseRules).
 *   - buildAiHandoffPayload projects recommendedHeadline from decision.
 *   - buildAiHandoffPayload includes up to 3 keyReasons.
 *   - buildAiHandoffPayload excludes the recommended scenario from optionsConsidered.
 *   - buildAiHandoffPayload falls back constraint to 'less suited for this home configuration'.
 *   - buildAiHandoffPayload includes up to 6 householdFacts.
 *   - buildAiHandoffPayload includes up to 8 includedScope items.
 *   - buildAiHandoffPayload includes up to 5 requiredWorks items.
 *   - buildAiHandoffPayload includes up to 3 warnings.
 *   - buildAiHandoffPayload includes up to 4 futureUpgrades.
 *   - serialiseAiHandoffPayload opens with the ATLAS header.
 *   - serialiseAiHandoffPayload includes introduction section.
 *   - serialiseAiHandoffPayload lists validationPolicy lines as bullets.
 *   - serialiseAiHandoffPayload lists trustedSourceCategories as bullets.
 *   - serialiseAiHandoffPayload lists sourceUseRules as bullets.
 *   - serialiseAiHandoffPayload includes recommended headline.
 *   - serialiseAiHandoffPayload renders warnings section when present.
 *   - serialiseAiHandoffPayload renders assumptions (futureUpgrades) section when present.
 *   - serialiseAiHandoffPayload omits empty sections.
 *   - serialiseAiHandoffPayload closes with the Atlas attribution line.
 */

import { describe, it, expect } from 'vitest';
import {
  buildAiHandoffPayload,
  serialiseAiHandoffPayload,
  ASSISTANT_INTRODUCTION,
  VALIDATION_POLICY,
  TRUSTED_SOURCE_CATEGORIES,
  SOURCE_USE_RULES,
} from '../modules/buildAiHandoffPayload';
import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDecision(overrides: Partial<AtlasDecisionV1> = {}): AtlasDecisionV1 {
  return {
    recommendedScenarioId:  'system_unvented',
    headline:               'A system boiler with unvented cylinder is the right fit for this home.',
    summary:                'System boiler with unvented cylinder.',
    keyReasons:             ['Two bathrooms require stored hot water', 'Mains pressure is suitable'],
    avoidedRisks:           ['Simultaneous demand failure'],
    dayToDayOutcomes:       ['Instant hot water at all outlets'],
    requiredWorks:          ['Install unvented cylinder'],
    compatibilityWarnings:  [],
    includedItems:          ['System boiler', 'Unvented cylinder'],
    quoteScope:             [],
    futureUpgradePaths:     ['Heat pump ready'],
    supportingFacts: [
      { label: 'Occupants',  value: 3,  source: 'survey' },
      { label: 'Bathrooms',  value: 2,  source: 'survey' },
    ],
    lifecycle: {
      currentSystem:    { type: 'combi', ageYears: 12, condition: 'good' },
      expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [10, 14] },
      influencingFactors: {
        waterQuality: 'good', scaleRisk: 'low',
        usageIntensity: 'moderate', maintenanceLevel: 'average',
      },
      riskIndicators: [],
      summary: 'The system is in reasonable condition.',
    },
    ...overrides,
  };
}

function makeScenario(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    scenarioId:       'system_unvented',
    system:           { type: 'system', summary: 'System boiler with unvented cylinder' },
    performance:      { hotWater: 'excellent', heating: 'very_good', efficiency: 'good', reliability: 'very_good' },
    keyBenefits:      ['Mains-pressure delivery'],
    keyConstraints:   ['Requires cylinder space'],
    dayToDayOutcomes: ['Instant hot water'],
    requiredWorks:    ['Install cylinder'],
    upgradePaths:     ['Heat pump ready'],
    physicsFlags:     {},
    ...overrides,
  };
}

// ─── buildAiHandoffPayload ─────────────────────────────────────────────────────

describe('buildAiHandoffPayload', () => {
  it('populates assistantIntroduction with the static constant', () => {
    const payload = buildAiHandoffPayload(makeDecision(), [makeScenario()]);
    expect(payload.assistantIntroduction).toBe(ASSISTANT_INTRODUCTION);
  });

  it('populates validationPolicy with the static constant', () => {
    const payload = buildAiHandoffPayload(makeDecision(), [makeScenario()]);
    expect(payload.validationPolicy).toBe(VALIDATION_POLICY);
  });

  it('populates trustedSourceCategories with the static constant', () => {
    const payload = buildAiHandoffPayload(makeDecision(), [makeScenario()]);
    expect(payload.trustedSourceCategories).toBe(TRUSTED_SOURCE_CATEGORIES);
  });

  it('populates sourceUseRules with the static constant', () => {
    const payload = buildAiHandoffPayload(makeDecision(), [makeScenario()]);
    expect(payload.sourceUseRules).toBe(SOURCE_USE_RULES);
  });

  it('projects recommendedHeadline from decision.headline', () => {
    const decision = makeDecision({ headline: 'Heat pump is the right fit.' });
    const payload  = buildAiHandoffPayload(decision, [makeScenario()]);
    expect(payload.recommendedHeadline).toBe('Heat pump is the right fit.');
  });

  it('includes up to 3 keyReasons', () => {
    const decision = makeDecision({
      keyReasons: ['Reason A', 'Reason B', 'Reason C', 'Reason D'],
    });
    const payload = buildAiHandoffPayload(decision, [makeScenario()]);
    expect(payload.keyReasons).toEqual(['Reason A', 'Reason B', 'Reason C']);
  });

  it('excludes the recommended scenario from optionsConsidered', () => {
    const recommended = makeScenario({ scenarioId: 'system_unvented' });
    const rejected    = makeScenario({
      scenarioId: 'combi',
      system:     { type: 'combi', summary: 'Combi boiler' },
      keyConstraints: ['Not suitable for two bathrooms'],
    });
    const payload = buildAiHandoffPayload(makeDecision(), [recommended, rejected]);
    expect(payload.optionsConsidered).toHaveLength(1);
    expect(payload.optionsConsidered[0].summary).toBe('Combi boiler');
    expect(payload.optionsConsidered[0].constraint).toBe('Not suitable for two bathrooms');
  });

  it('falls back constraint to "less suited for this home configuration" when keyConstraints is empty', () => {
    const rejected = makeScenario({
      scenarioId:    'combi',
      system:        { type: 'combi', summary: 'Combi boiler' },
      keyConstraints: [],
    });
    const payload = buildAiHandoffPayload(makeDecision(), [makeScenario(), rejected]);
    expect(payload.optionsConsidered[0].constraint).toBe('less suited for this home configuration');
  });

  it('includes up to 6 householdFacts', () => {
    const decision = makeDecision({
      supportingFacts: [
        { label: 'F1', value: 1, source: 'survey' },
        { label: 'F2', value: 2, source: 'survey' },
        { label: 'F3', value: 3, source: 'survey' },
        { label: 'F4', value: 4, source: 'survey' },
        { label: 'F5', value: 5, source: 'survey' },
        { label: 'F6', value: 6, source: 'survey' },
        { label: 'F7', value: 7, source: 'survey' },
      ],
    });
    const payload = buildAiHandoffPayload(decision, [makeScenario()]);
    expect(payload.householdFacts).toHaveLength(6);
    expect(payload.householdFacts[5].label).toBe('F6');
  });

  it('includes up to 8 includedScope items', () => {
    const decision = makeDecision({
      includedItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
    });
    const payload = buildAiHandoffPayload(decision, [makeScenario()]);
    expect(payload.includedScope).toHaveLength(8);
    expect(payload.includedScope[7]).toBe('H');
  });

  it('includes up to 5 requiredWorks items', () => {
    const decision = makeDecision({
      requiredWorks: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'],
    });
    const payload = buildAiHandoffPayload(decision, [makeScenario()]);
    expect(payload.requiredWorks).toHaveLength(5);
  });

  it('includes up to 3 warnings', () => {
    const decision = makeDecision({
      compatibilityWarnings: ['Warn A', 'Warn B', 'Warn C', 'Warn D'],
    });
    const payload = buildAiHandoffPayload(decision, [makeScenario()]);
    expect(payload.warnings).toHaveLength(3);
  });

  it('includes up to 4 futureUpgrades', () => {
    const decision = makeDecision({
      futureUpgradePaths: ['Up A', 'Up B', 'Up C', 'Up D', 'Up E'],
    });
    const payload = buildAiHandoffPayload(decision, [makeScenario()]);
    expect(payload.futureUpgrades).toHaveLength(4);
  });

  it('returns empty optionsConsidered when there is only one scenario matching the recommendation', () => {
    const payload = buildAiHandoffPayload(makeDecision(), [makeScenario()]);
    expect(payload.optionsConsidered).toHaveLength(0);
  });

  it('returns empty recommendedUpgrades when quoteScope has no recommended items', () => {
    const payload = buildAiHandoffPayload(makeDecision({ quoteScope: [] }), [makeScenario()]);
    expect(payload.recommendedUpgrades).toEqual([]);
  });

  it('populates recommendedUpgrades from quoteScope recommended items with benefit', () => {
    const decision = makeDecision({
      quoteScope: [
        {
          id: 'rec-controls',
          label: 'Smart thermostat',
          category: 'controls',
          status: 'recommended',
          customerBenefit: 'Improves comfort and reduces wasted energy',
        },
        {
          id: 'rec-filter',
          label: 'Magnetic filter',
          category: 'protection',
          status: 'recommended',
          customerBenefit: 'Captures debris and sludge',
        },
      ],
    });
    const payload = buildAiHandoffPayload(decision, [makeScenario()]);
    expect(payload.recommendedUpgrades).toHaveLength(2);
    expect(payload.recommendedUpgrades[0]).toBe('Smart thermostat — Improves comfort and reduces wasted energy');
    expect(payload.recommendedUpgrades[1]).toBe('Magnetic filter — Captures debris and sludge');
  });

  it('includes label only (no benefit suffix) when customerBenefit is absent', () => {
    const decision = makeDecision({
      quoteScope: [
        {
          id: 'rec-pipe',
          label: 'Pipework upgrade',
          category: 'pipework',
          status: 'recommended',
        },
      ],
    });
    const payload = buildAiHandoffPayload(decision, [makeScenario()]);
    expect(payload.recommendedUpgrades[0]).toBe('Pipework upgrade');
  });

  it('caps recommendedUpgrades at 5 items', () => {
    const decision = makeDecision({
      quoteScope: Array.from({ length: 7 }, (_, i) => ({
        id: `rec-${i}`,
        label: `Upgrade ${i + 1}`,
        category: 'controls' as const,
        status: 'recommended' as const,
      })),
    });
    const payload = buildAiHandoffPayload(decision, [makeScenario()]);
    expect(payload.recommendedUpgrades).toHaveLength(5);
  });
});

// ─── serialiseAiHandoffPayload ─────────────────────────────────────────────────

describe('serialiseAiHandoffPayload', () => {
  function basePayload() {
    return buildAiHandoffPayload(
      makeDecision({
        compatibilityWarnings: ['Check radiator sizing'],
        futureUpgradePaths:    ['Heat pump pathway'],
      }),
      [makeScenario()],
    );
  }

  it('opens with the ATLAS RECOMMENDATION SUMMARY header', () => {
    const text = serialiseAiHandoffPayload(basePayload());
    expect(text).toMatch(/^=== ATLAS RECOMMENDATION SUMMARY ===/);
  });

  it('includes the assistant introduction section', () => {
    const text = serialiseAiHandoffPayload(basePayload());
    expect(text).toContain('--- Instructions for the AI assistant ---');
    expect(text).toContain('Atlas has helped me understand your home');
  });

  it('lists validationPolicy lines as bullets', () => {
    const text = serialiseAiHandoffPayload(basePayload());
    expect(text).toContain('• Explain the Atlas recommendation in plain English.');
    expect(text).toContain('• If sources conflict, say so.');
  });

  it('lists trustedSourceCategories as bullets', () => {
    const text = serialiseAiHandoffPayload(basePayload());
    expect(text).toContain('• Manufacturer installation manuals');
    expect(text).toContain('• Energy Saving Trust guidance');
  });

  it('lists sourceUseRules as bullets', () => {
    const text = serialiseAiHandoffPayload(basePayload());
    expect(text).toContain('• Use Ofgem for energy supplier, tariff, meter, and consumer energy rights questions.');
  });

  it('includes the recommended headline in the case-specific section', () => {
    const text = serialiseAiHandoffPayload(basePayload());
    expect(text).toContain('Recommended: A system boiler with unvented cylinder is the right fit for this home.');
  });

  it('renders the Warnings section when warnings are present', () => {
    const text = serialiseAiHandoffPayload(basePayload());
    expect(text).toContain('Warnings:');
    expect(text).toContain('• Check radiator sizing');
  });

  it('renders the Future upgrades section (assumptions) when present', () => {
    const text = serialiseAiHandoffPayload(basePayload());
    expect(text).toContain('Future upgrades:');
    expect(text).toContain('• Heat pump pathway');
  });

  it('omits Warnings section when warnings is empty', () => {
    const payload = buildAiHandoffPayload(makeDecision({ compatibilityWarnings: [] }), [makeScenario()]);
    const text = serialiseAiHandoffPayload(payload);
    expect(text).not.toContain('Warnings:');
  });

  it('omits Future upgrades section when futureUpgrades is empty', () => {
    const payload = buildAiHandoffPayload(makeDecision({ futureUpgradePaths: [] }), [makeScenario()]);
    const text = serialiseAiHandoffPayload(payload);
    expect(text).not.toContain('Future upgrades:');
  });

  it('closes with the Atlas attribution line', () => {
    const text = serialiseAiHandoffPayload(basePayload());
    expect(text).toMatch(/Generated by Atlas — paste into any AI assistant to discuss this recommendation\.$/);
  });

  it('renders the scope section label', () => {
    const payload = buildAiHandoffPayload(makeDecision({ includedItems: ['System boiler'] }), [makeScenario()]);
    const text = serialiseAiHandoffPayload(payload);
    expect(text).toContain('Included scope:');
    expect(text).toContain('• System boiler');
  });

  it('renders rejected alternatives when present', () => {
    const rejected = makeScenario({
      scenarioId:    'combi',
      system:        { type: 'combi', summary: 'Combi boiler' },
      keyConstraints: ['Two bathrooms exceed combi capacity'],
    });
    const payload = buildAiHandoffPayload(makeDecision(), [makeScenario(), rejected]);
    const text = serialiseAiHandoffPayload(payload);
    expect(text).toContain('Options considered:');
    expect(text).toContain('• Combi boiler — Two bathrooms exceed combi capacity');
  });

  it('renders Recommended upgrades section when recommendedUpgrades is non-empty', () => {
    const payload = buildAiHandoffPayload(
      makeDecision({
        quoteScope: [
          {
            id: 'rec-ctrl',
            label: 'Smart thermostat',
            category: 'controls',
            status: 'recommended',
            customerBenefit: 'Improves comfort and reduces wasted energy',
          },
        ],
      }),
      [makeScenario()],
    );
    const text = serialiseAiHandoffPayload(payload);
    expect(text).toContain('Recommended upgrades (advised but not yet committed):');
    expect(text).toContain('• Smart thermostat — Improves comfort and reduces wasted energy');
  });

  it('omits Recommended upgrades section when recommendedUpgrades is empty', () => {
    const payload = buildAiHandoffPayload(makeDecision({ quoteScope: [] }), [makeScenario()]);
    const text = serialiseAiHandoffPayload(payload);
    expect(text).not.toContain('Recommended upgrades');
  });
});
