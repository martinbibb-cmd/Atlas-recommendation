// src/components/advice/__tests__/buildAdviceCards.test.ts
//
// Unit tests for buildAdviceCards — PR11 decision synthesis logic.
//
// Coverage:
//   - Returns a complete AdviceResult from minimal engine output
//   - bestAllRound uses the engine recommendation
//   - All 6 objective cards are present with required fields
//   - Installation recipe has all required sections
//   - Recommendation scope (Essential / Best Advice / Enhanced / Future Potential)
//   - Trade-off warnings are generated for relevant combinations
//   - Engine plans (pathways) are used when present
//   - Handles empty options array gracefully

import { describe, it, expect } from 'vitest';
import { buildAdviceCards } from '../buildAdviceCards';
import type { EngineOutputV1, OptionCardV1 } from '../../../contracts/EngineOutputV1';

// ─── Minimal fixtures ─────────────────────────────────────────────────────────

function makeOption(
  id: OptionCardV1['id'],
  status: OptionCardV1['status'],
  overrides: Partial<OptionCardV1> = {},
): OptionCardV1 {
  return {
    id,
    label: id,
    status,
    headline: `${id} headline`,
    why: [`${id} is suitable`],
    requirements: [],
    typedRequirements: {
      mustHave: [`Install ${id}`],
      likelyUpgrades: [`Upgrade for ${id}`],
      niceToHave: [`Optional: ${id} extra`],
    },
    heat: { status: 'ok', headline: 'Heat ok', bullets: ['Heat bullet'] },
    dhw: { status: 'ok', headline: 'DHW ok', bullets: ['DHW bullet'] },
    engineering: { status: 'ok', headline: 'Eng ok', bullets: ['Eng bullet'] },
    sensitivities: [],
    ...overrides,
  };
}

function makeMinimalOutput(overrides: Partial<EngineOutputV1> = {}): EngineOutputV1 {
  return {
    eligibility: [],
    redFlags: [],
    recommendation: { primary: 'Combi boiler' },
    explainers: [],
    options: [
      makeOption('combi', 'viable'),
    ],
    ...overrides,
  };
}

// ─── Structure tests ──────────────────────────────────────────────────────────

describe('buildAdviceCards — structure', () => {
  it('returns a complete AdviceResult', () => {
    const result = buildAdviceCards(makeMinimalOutput());
    expect(result.bestAllRound).toBeDefined();
    expect(result.objectiveCards).toBeDefined();
    expect(result.installationRecipe).toBeDefined();
    expect(result.recommendationScope).toBeDefined();
    expect(result.tradeOffWarnings).toBeDefined();
  });

  it('always returns exactly 6 objective cards', () => {
    const result = buildAdviceCards(makeMinimalOutput());
    expect(result.objectiveCards).toHaveLength(6);
  });

  it('returns objective cards with all required fields', () => {
    const result = buildAdviceCards(makeMinimalOutput());
    for (const card of result.objectiveCards) {
      expect(card.id).toBeTruthy();
      expect(card.icon).toBeTruthy();
      expect(card.title).toBeTruthy();
      expect(card.systemPath).toBeTruthy();
      expect(card.why).toBeTruthy();
      expect(Array.isArray(card.keyInclusions)).toBe(true);
    }
  });

  it('produces all 6 expected objective IDs', () => {
    const result = buildAdviceCards(makeMinimalOutput());
    const ids = result.objectiveCards.map(c => c.id);
    expect(ids).toContain('running_cost');
    expect(ids).toContain('install_cost');
    expect(ids).toContain('longevity');
    expect(ids).toContain('carbon');
    expect(ids).toContain('performance');
    expect(ids).toContain('future_ready');
  });
});

// ─── bestAllRound ─────────────────────────────────────────────────────────────

describe('buildAdviceCards — bestAllRound', () => {
  it('uses the engine recommendation primary string', () => {
    const output = makeMinimalOutput({
      recommendation: { primary: 'Unvented cylinder system' },
    });
    const result = buildAdviceCards(output);
    expect(result.bestAllRound.systemPath).toBe('Unvented cylinder system');
  });

  it('uses verdict primaryReason as the why when available', () => {
    const output = makeMinimalOutput({
      verdict: {
        title: 'Good match',
        status: 'good',
        reasons: ['Reason A'],
        confidence: { level: 'high', reasons: [] },
        assumptionsUsed: [],
        primaryReason: 'Best because of emitter suitability',
      },
    });
    const result = buildAdviceCards(output);
    expect(result.bestAllRound.why).toBe('Best because of emitter suitability');
  });

  it('falls back to first verdict reason when primaryReason is absent', () => {
    const output = makeMinimalOutput({
      verdict: {
        title: 'Good',
        status: 'good',
        reasons: ['First reason here'],
        confidence: { level: 'medium', reasons: [] },
        assumptionsUsed: [],
      },
    });
    const result = buildAdviceCards(output);
    expect(result.bestAllRound.why).toBe('First reason here');
  });

  it('includes confidence when verdict confidence is present', () => {
    const output = makeMinimalOutput({
      verdict: {
        title: 'Good',
        status: 'good',
        reasons: [],
        confidence: { level: 'high', reasons: [] },
        assumptionsUsed: [],
      },
    });
    const result = buildAdviceCards(output);
    expect(result.bestAllRound.confidence).toBe('high');
  });

  it('returns null confidence when no verdict is present', () => {
    const result = buildAdviceCards(makeMinimalOutput());
    expect(result.bestAllRound.confidence).toBeNull();
  });
});

// ─── Objective card priority ──────────────────────────────────────────────────

describe('buildAdviceCards — objective card priority', () => {
  it('running_cost card prefers ashp when viable', () => {
    const output = makeMinimalOutput({
      options: [
        makeOption('combi', 'viable'),
        makeOption('ashp', 'viable'),
      ],
    });
    const result = buildAdviceCards(output);
    const card = result.objectiveCards.find(c => c.id === 'running_cost')!;
    expect(card.systemPath).toContain('heat pump');
  });

  it('install_cost card prefers combi when viable', () => {
    const output = makeMinimalOutput({
      options: [
        makeOption('combi', 'viable'),
        makeOption('stored_unvented', 'viable'),
      ],
    });
    const result = buildAdviceCards(output);
    const card = result.objectiveCards.find(c => c.id === 'install_cost')!;
    expect(card.systemPath).toContain('Combi');
  });

  it('install_cost card skips rejected combi', () => {
    const output = makeMinimalOutput({
      options: [
        makeOption('combi', 'rejected'),
        makeOption('stored_unvented', 'viable'),
      ],
    });
    const result = buildAdviceCards(output);
    const card = result.objectiveCards.find(c => c.id === 'install_cost')!;
    // Should not be combi (rejected); fallback to stored_unvented
    expect(card.systemPath).not.toContain('Combi');
  });

  it('carbon card prefers ashp and mentions zero combustion', () => {
    const output = makeMinimalOutput({
      options: [
        makeOption('combi', 'viable'),
        makeOption('ashp', 'viable'),
      ],
    });
    const result = buildAdviceCards(output);
    const card = result.objectiveCards.find(c => c.id === 'carbon')!;
    expect(card.why).toMatch(/combustion|zero/i);
  });

  it('carbon card mentions "at point of use" in trade-off', () => {
    const output = makeMinimalOutput({
      options: [makeOption('ashp', 'viable')],
    });
    const result = buildAdviceCards(output);
    const card = result.objectiveCards.find(c => c.id === 'carbon')!;
    expect(card.tradeOff).toMatch(/point of use/i);
  });

  it('performance card prefers stored_unvented for delivery', () => {
    const output = makeMinimalOutput({
      options: [
        makeOption('combi', 'viable'),
        makeOption('stored_unvented', 'viable'),
      ],
    });
    const result = buildAdviceCards(output);
    const card = result.objectiveCards.find(c => c.id === 'performance')!;
    expect(card.systemPath).toContain('Unvented');
  });
});

// ─── Installation recipe ──────────────────────────────────────────────────────

describe('buildAdviceCards — installation recipe', () => {
  it('includes heatSource derived from the primary option', () => {
    const output = makeMinimalOutput({
      options: [makeOption('combi', 'viable')],
    });
    const result = buildAdviceCards(output);
    expect(result.installationRecipe.heatSource).toMatch(/combi/i);
  });

  it('includes dhwArrangement', () => {
    const result = buildAdviceCards(makeMinimalOutput());
    expect(result.installationRecipe.dhwArrangement).toBeTruthy();
  });

  it('includes controls with at least one entry', () => {
    const result = buildAdviceCards(makeMinimalOutput());
    expect(result.installationRecipe.controls.length).toBeGreaterThan(0);
  });

  it('includes emitterAction with at least one entry', () => {
    const result = buildAdviceCards(makeMinimalOutput());
    expect(result.installationRecipe.emitterAction.length).toBeGreaterThan(0);
  });

  it('includes protection with at least one entry', () => {
    const result = buildAdviceCards(makeMinimalOutput());
    expect(result.installationRecipe.protection.length).toBeGreaterThan(0);
  });

  it('extracts controls from mustHave items mentioning "control"', () => {
    const output = makeMinimalOutput({
      options: [
        makeOption('combi', 'viable', {
          typedRequirements: {
            mustHave: ['Weather compensation control', 'Fit TRVs'],
            likelyUpgrades: [],
            niceToHave: [],
          },
        }),
      ],
    });
    const result = buildAdviceCards(output);
    expect(result.installationRecipe.controls).toContain('Weather compensation control');
  });

  it('includes default filter and flush when no protection in requirements', () => {
    const result = buildAdviceCards(makeMinimalOutput());
    const protection = result.installationRecipe.protection.join(' ');
    expect(protection).toMatch(/filter|flush/i);
  });
});

// ─── Recommendation scope ─────────────────────────────────────────────────────

describe('buildAdviceCards — recommendation scope', () => {
  it('returns a RecommendationScope with an essential card', () => {
    const result = buildAdviceCards(makeMinimalOutput());
    expect(result.recommendationScope.essential).toBeDefined();
    expect(result.recommendationScope.essential.title).toBe('Essential');
    expect(Array.isArray(result.recommendationScope.essential.items)).toBe(true);
  });

  it('essential card has at least one item', () => {
    const result = buildAdviceCards(makeMinimalOutput());
    expect(result.recommendationScope.essential.items.length).toBeGreaterThan(0);
  });

  it('bestAdvice items are all selectable', () => {
    const result = buildAdviceCards(makeMinimalOutput());
    if (result.recommendationScope.bestAdvice) {
      for (const item of result.recommendationScope.bestAdvice.items) {
        expect(item.selectable).toBe(true);
      }
    }
  });

  it('uses engine plans.pathways when available', () => {
    const output = makeMinimalOutput({
      plans: {
        sharedConstraints: [],
        pathways: [
          {
            id: 'p1',
            title: 'Combi now, ASHP later',
            rationale: 'Lowest disruption path',
            outcomeToday: 'Combi installed',
            prerequisites: [],
            confidence: { level: 'high', reasons: [] },
            rank: 1,
          },
          {
            id: 'p2',
            title: 'Upgrade emitters',
            rationale: 'Improve heat distribution',
            outcomeToday: 'Radiators upgraded',
            prerequisites: [],
            confidence: { level: 'medium', reasons: [] },
            rank: 2,
          },
          {
            id: 'p3',
            title: 'Install heat pump',
            rationale: 'Full electrification',
            outcomeToday: 'ASHP installed',
            prerequisites: [],
            confidence: { level: 'medium', reasons: [] },
            rank: 3,
          },
        ],
      },
    });
    const result = buildAdviceCards(output);
    expect(result.recommendationScope.essential.items[0].label).toBe('Lowest disruption path');
    expect(result.recommendationScope.bestAdvice?.items[0].label).toBe('Improve heat distribution');
  });

  it('essential item mentions the recommended system', () => {
    const output = makeMinimalOutput({
      options: [makeOption('combi', 'viable')],
    });
    const result = buildAdviceCards(output);
    const essentialText = result.recommendationScope.essential.items.map(i => i.label).join(' ');
    expect(essentialText).toMatch(/combi/i);
  });
});

// ─── Trade-off warnings ───────────────────────────────────────────────────────

describe('buildAdviceCards — trade-off warnings', () => {
  it('includes no warnings when only a single option with no alternatives', () => {
    const result = buildAdviceCards(makeMinimalOutput({
      options: [makeOption('combi', 'viable')],
    }));
    // Single viable option, no combi vs stored or ASHP comparison
    // combi is primary so "combi cheaper upfront" warning does not trigger
    const ids = result.tradeOffWarnings.map(w => w.id);
    expect(ids).not.toContain('combi_cheaper_upfront');
  });

  it('warns about combi being cheaper when primary is not combi', () => {
    const output = makeMinimalOutput({
      options: [
        // stored_unvented is first viable → becomes primaryOption
        makeOption('stored_unvented', 'viable'),
        makeOption('combi', 'viable'),
      ],
      recommendation: { primary: 'Unvented cylinder system' },
    });
    const result = buildAdviceCards(output);
    const ids = result.tradeOffWarnings.map(w => w.id);
    expect(ids).toContain('combi_cheaper_upfront');
  });

  it('warns about ASHP future cost when ASHP is viable and not primary', () => {
    const output = makeMinimalOutput({
      options: [
        makeOption('combi', 'viable'),
        makeOption('ashp', 'viable'),
      ],
      recommendation: { primary: 'Combi boiler' },
    });
    const result = buildAdviceCards(output);
    const ids = result.tradeOffWarnings.map(w => w.id);
    expect(ids).toContain('ashp_future_cost');
  });

  it('includes ASHP barrier warning when ASHP is caution', () => {
    const output = makeMinimalOutput({
      options: [
        makeOption('combi', 'viable'),
        makeOption('ashp', 'caution', {
          heat: { status: 'caution', headline: 'Flow temperature too high for ASHP', bullets: [] },
        }),
      ],
    });
    const result = buildAdviceCards(output);
    const ids = result.tradeOffWarnings.map(w => w.id);
    expect(ids).toContain('ashp_barrier');
  });

  it('does not include ASHP future cost warning when ASHP is primary', () => {
    const output = makeMinimalOutput({
      options: [makeOption('ashp', 'viable')],
      recommendation: { primary: 'Air source heat pump' },
    });
    const result = buildAdviceCards(output);
    const ids = result.tradeOffWarnings.map(w => w.id);
    expect(ids).not.toContain('ashp_future_cost');
  });
});

// ─── Empty / edge cases ───────────────────────────────────────────────────────

describe('buildAdviceCards — edge cases', () => {
  it('handles empty options array without throwing', () => {
    const output = makeMinimalOutput({ options: [] });
    expect(() => buildAdviceCards(output)).not.toThrow();
  });

  it('handles missing verdict without throwing', () => {
    const output = makeMinimalOutput({ verdict: undefined });
    expect(() => buildAdviceCards(output)).not.toThrow();
  });

  it('handles missing plans without throwing', () => {
    const output = makeMinimalOutput({ plans: undefined });
    expect(() => buildAdviceCards(output)).not.toThrow();
  });

  it('returns a fallback systemPath for objective cards with no options', () => {
    const output = makeMinimalOutput({ options: [] });
    const result = buildAdviceCards(output);
    for (const card of result.objectiveCards) {
      expect(card.systemPath).toBeTruthy();
    }
  });
});
