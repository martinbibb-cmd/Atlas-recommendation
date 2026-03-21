/**
 * buildRealWorldBehaviourCards.test.ts
 *
 * PR4 — Unit tests for the presentation-layer behaviour card builder.
 *
 * Coverage:
 *   1. Returns empty array when realWorldBehaviours is absent.
 *   2. Maps engine outcome tiers to PresentationOutcome correctly.
 *   3. Cards render for a standard recommendation flow (no divergence).
 *   4. recommendedOptionNote is always populated from engine outcome.
 *   5. chosenOptionNote is absent when no customer divergence.
 *   6. Chosen-option divergence adds chosenOptionNote (comparative wording).
 *   7. Combi vs stored hot water difference reflected in outcome/limitingFactor.
 *   8. Shared-mains case produces a card with limitingFactor 'mains'.
 *   9. No banned harsh language appears in any generated note.
 *  10. graceful degradation when alternative_option_outcome is missing.
 */

import { describe, it, expect } from 'vitest';
import { buildRealWorldBehaviourCards } from '../buildRealWorldBehaviourCards';
import type { EngineOutputV1, RealWorldBehaviourCard as EngineCard } from '../../../contracts/EngineOutputV1';
import type { RecommendationPresentationState } from '../../selection/optionSelection';
import { BANNED_CUSTOMER_PHRASES } from '../../copy/customerCopy';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEngineCard(overrides: Partial<EngineCard> = {}): EngineCard {
  return {
    scenario_id: 'shower_and_tap',
    title: 'Morning shower + kitchen tap',
    summary: 'Both outlets perform well — minimal pressure drop expected.',
    recommended_option_outcome: 'strong',
    ...overrides,
  };
}

function makeEngineOutput(cards: EngineCard[] = []): EngineOutputV1 {
  return {
    eligibility: [],
    redFlags: [],
    recommendation: { primary: 'Combi boiler' },
    explainers: [],
    realWorldBehaviours: cards,
  };
}

const BASE_STATE: RecommendationPresentationState = {
  recommendedOptionId: 'combi',
  chosenByCustomer: false,
};

const DIVERGENT_STATE: RecommendationPresentationState = {
  recommendedOptionId: 'combi',
  chosenOptionId: 'stored_unvented',
  chosenByCustomer: true,
};

// ─── Tests: graceful degradation ─────────────────────────────────────────────

describe('buildRealWorldBehaviourCards — graceful degradation', () => {
  it('returns empty array when realWorldBehaviours is absent', () => {
    const output = makeEngineOutput();
    delete (output as { realWorldBehaviours?: unknown }).realWorldBehaviours;
    const result = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(result).toEqual([]);
  });

  it('returns empty array when realWorldBehaviours is empty', () => {
    const output = makeEngineOutput([]);
    const result = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(result).toEqual([]);
  });

  it('omits chosenOptionNote when alternative_option_outcome is missing and customer diverged', () => {
    const output = makeEngineOutput([
      makeEngineCard({ recommended_option_outcome: 'acceptable' }),
    ]);
    const result = buildRealWorldBehaviourCards(output, DIVERGENT_STATE);
    expect(result[0].chosenOptionNote).toBeUndefined();
  });
});

// ─── Tests: standard recommendation flow (no divergence) ─────────────────────

describe('buildRealWorldBehaviourCards — standard flow (no divergence)', () => {
  it('returns one card per engine card', () => {
    const cards = [
      makeEngineCard({ scenario_id: 'shower_and_tap' }),
      makeEngineCard({ scenario_id: 'two_showers' }),
      makeEngineCard({ scenario_id: 'bath_filling' }),
    ];
    const result = buildRealWorldBehaviourCards(makeEngineOutput(cards), BASE_STATE);
    expect(result).toHaveLength(3);
  });

  it('maps scenario_id to id', () => {
    const output = makeEngineOutput([makeEngineCard({ scenario_id: 'peak_household' })]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.id).toBe('peak_household');
  });

  it('preserves title and summary from engine card', () => {
    const output = makeEngineOutput([
      makeEngineCard({ title: 'Two showers running', summary: 'Good flow at both.' }),
    ]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.title).toBe('Two showers running');
    expect(card.summary).toBe('Good flow at both.');
  });

  it('sets recommendedOptionNote from engine outcome', () => {
    const output = makeEngineOutput([makeEngineCard({ recommended_option_outcome: 'strong' })]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.recommendedOptionNote).toBeTruthy();
    expect(typeof card.recommendedOptionNote).toBe('string');
  });

  it('does not set chosenOptionNote when no divergence', () => {
    const output = makeEngineOutput([
      makeEngineCard({
        recommended_option_outcome: 'strong',
        alternative_option_outcome: 'limited',
      }),
    ]);
    const result = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(result[0].chosenOptionNote).toBeUndefined();
  });
});

// ─── Tests: outcome tier mapping ─────────────────────────────────────────────

describe('buildRealWorldBehaviourCards — outcome tier mapping', () => {
  it('maps "strong" engine outcome to "works_well"', () => {
    const output = makeEngineOutput([makeEngineCard({ recommended_option_outcome: 'strong' })]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.outcome).toBe('works_well');
  });

  it('maps "acceptable" engine outcome to "works_well"', () => {
    const output = makeEngineOutput([makeEngineCard({ recommended_option_outcome: 'acceptable' })]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.outcome).toBe('works_well');
  });

  it('maps "limited" engine outcome to "works_with_limits"', () => {
    const output = makeEngineOutput([makeEngineCard({ recommended_option_outcome: 'limited' })]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.outcome).toBe('works_with_limits');
  });

  it('maps "poor" engine outcome to "best_for_lighter_use"', () => {
    const output = makeEngineOutput([makeEngineCard({ recommended_option_outcome: 'poor' })]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.outcome).toBe('best_for_lighter_use');
  });
});

// ─── Tests: limiting factor mapping ──────────────────────────────────────────

describe('buildRealWorldBehaviourCards — limiting factor mapping', () => {
  it('maps "mains" to "mains"', () => {
    const output = makeEngineOutput([makeEngineCard({ limiting_factor: 'mains' })]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.limitingFactor).toBe('mains');
  });

  it('maps "hot_water_generation" to "instantaneous_output"', () => {
    const output = makeEngineOutput([makeEngineCard({ limiting_factor: 'hot_water_generation' })]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.limitingFactor).toBe('instantaneous_output');
  });

  it('maps "stored_volume" to "storage"', () => {
    const output = makeEngineOutput([makeEngineCard({ limiting_factor: 'stored_volume' })]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.limitingFactor).toBe('storage');
  });

  it('maps "distribution" to "distribution"', () => {
    const output = makeEngineOutput([makeEngineCard({ limiting_factor: 'distribution' })]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.limitingFactor).toBe('distribution');
  });

  it('maps "unknown" limiting factor to undefined', () => {
    const output = makeEngineOutput([makeEngineCard({ limiting_factor: 'unknown' })]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.limitingFactor).toBeUndefined();
  });

  it('leaves limitingFactor undefined when limiting_factor is absent', () => {
    const output = makeEngineOutput([makeEngineCard()]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.limitingFactor).toBeUndefined();
  });

  it('shared-mains scenario produces a card with limitingFactor "mains"', () => {
    const output = makeEngineOutput([
      makeEngineCard({
        scenario_id: 'cold_mains_pressure',
        title: 'Whole-home flow sharing',
        recommended_option_outcome: 'limited',
        limiting_factor: 'mains',
      }),
    ]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.limitingFactor).toBe('mains');
  });
});

// ─── Tests: combi vs stored hot water differences ────────────────────────────

describe('buildRealWorldBehaviourCards — combi vs stored hot water', () => {
  it('combi with strong outcome maps to works_well', () => {
    const output = makeEngineOutput([
      makeEngineCard({ scenario_id: 'shower_and_tap', recommended_option_outcome: 'strong' }),
    ]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.outcome).toBe('works_well');
  });

  it('stored system with limited simultaneous-demand outcome maps to works_with_limits', () => {
    const output = makeEngineOutput([
      makeEngineCard({
        scenario_id: 'two_showers',
        recommended_option_outcome: 'limited',
        limiting_factor: 'stored_volume',
      }),
    ]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.outcome).toBe('works_with_limits');
    expect(card.limitingFactor).toBe('storage');
  });

  it('stored system with strong outcome maps to works_well', () => {
    const output = makeEngineOutput([
      makeEngineCard({
        scenario_id: 'bath_filling',
        recommended_option_outcome: 'strong',
        limiting_factor: undefined,
      }),
    ]);
    const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
    expect(card.outcome).toBe('works_well');
  });
});

// ─── Tests: divergence comparative wording ───────────────────────────────────

describe('buildRealWorldBehaviourCards — divergence comparative wording', () => {
  it('adds chosenOptionNote when customer has diverged and engine provides alternative outcome', () => {
    const output = makeEngineOutput([
      makeEngineCard({
        recommended_option_outcome: 'strong',
        alternative_option_outcome: 'limited',
      }),
    ]);
    const result = buildRealWorldBehaviourCards(output, DIVERGENT_STATE);
    expect(result[0].chosenOptionNote).toBeTruthy();
    expect(typeof result[0].chosenOptionNote).toBe('string');
  });

  it('chosenOptionNote wording is distinct from recommendedOptionNote on same card', () => {
    const output = makeEngineOutput([
      makeEngineCard({
        recommended_option_outcome: 'strong',
        alternative_option_outcome: 'limited',
      }),
    ]);
    const [card] = buildRealWorldBehaviourCards(output, DIVERGENT_STATE);
    expect(card.recommendedOptionNote).not.toBe(card.chosenOptionNote);
  });

  it('recommendation outcome note is unchanged after customer diverges', () => {
    const output = makeEngineOutput([
      makeEngineCard({
        recommended_option_outcome: 'strong',
        alternative_option_outcome: 'limited',
      }),
    ]);
    const noDivergence = buildRealWorldBehaviourCards(output, BASE_STATE);
    const withDivergence = buildRealWorldBehaviourCards(output, DIVERGENT_STATE);
    // Recommended note must be identical regardless of customer choice
    expect(noDivergence[0].recommendedOptionNote).toBe(withDivergence[0].recommendedOptionNote);
  });
});

// ─── Tests: banned phrase guardrail ──────────────────────────────────────────

describe('buildRealWorldBehaviourCards — banned phrase guardrail', () => {
  const OUTCOME_VALUES: Array<import('../../../contracts/EngineOutputV1').BehaviourOutcome> = [
    'strong', 'acceptable', 'limited', 'poor',
  ];

  for (const outcome of OUTCOME_VALUES) {
    it(`recommendedOptionNote for "${outcome}" contains no banned phrase`, () => {
      const output = makeEngineOutput([
        makeEngineCard({ recommended_option_outcome: outcome }),
      ]);
      const [card] = buildRealWorldBehaviourCards(output, BASE_STATE);
      if (card.recommendedOptionNote) {
        for (const phrase of BANNED_CUSTOMER_PHRASES) {
          expect(card.recommendedOptionNote.toLowerCase()).not.toContain(phrase.toLowerCase());
        }
      }
    });

    it(`chosenOptionNote for alternative "${outcome}" contains no banned phrase`, () => {
      const output = makeEngineOutput([
        makeEngineCard({
          recommended_option_outcome: 'strong',
          alternative_option_outcome: outcome,
        }),
      ]);
      const [card] = buildRealWorldBehaviourCards(output, DIVERGENT_STATE);
      if (card.chosenOptionNote) {
        for (const phrase of BANNED_CUSTOMER_PHRASES) {
          expect(card.chosenOptionNote.toLowerCase()).not.toContain(phrase.toLowerCase());
        }
      }
    });
  }
});
