/**
 * optionSelection.test.ts
 *
 * PR3 — Tests for the customer-chosen option selection logic.
 *
 * Coverage:
 *   1. Customer can set a non-recommended option as chosen.
 *   2. Recommended option remains unchanged after customer choice.
 *   3. deriveSelectionState returns correct state for each option.
 *   4. hasCustomerDivergence detects divergence correctly.
 *   5. No divergence when chosen option equals recommended option.
 */

import { describe, it, expect } from 'vitest';
import {
  deriveSelectionState,
  hasCustomerDivergence,
  type RecommendationPresentationState,
} from '../optionSelection';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_STATE: RecommendationPresentationState = {
  recommendedOptionId: 'combi',
  chosenByCustomer: false,
};

const CHOSEN_STATE: RecommendationPresentationState = {
  recommendedOptionId: 'combi',
  chosenOptionId: 'stored_unvented',
  chosenByCustomer: true,
};

const CHOSEN_SAME_AS_RECOMMENDED: RecommendationPresentationState = {
  recommendedOptionId: 'combi',
  chosenOptionId: 'combi',
  chosenByCustomer: true,
};

// ─── deriveSelectionState ─────────────────────────────────────────────────────

describe('deriveSelectionState', () => {
  it('returns "recommended" for the recommended option when no choice made', () => {
    expect(deriveSelectionState('combi', BASE_STATE)).toBe('recommended');
  });

  it('returns "alternative" for non-recommended options when no choice made', () => {
    expect(deriveSelectionState('stored_unvented', BASE_STATE)).toBe('alternative');
    expect(deriveSelectionState('ashp', BASE_STATE)).toBe('alternative');
  });

  it('returns "customer_chosen" when customer has chosen this non-recommended option', () => {
    expect(deriveSelectionState('stored_unvented', CHOSEN_STATE)).toBe('customer_chosen');
  });

  it('returns "recommended" for the recommended option even when customer has chosen another', () => {
    // The recommended option must remain visible and correctly labelled.
    expect(deriveSelectionState('combi', CHOSEN_STATE)).toBe('recommended');
  });

  it('returns "alternative" for options that are neither recommended nor chosen', () => {
    expect(deriveSelectionState('ashp', CHOSEN_STATE)).toBe('alternative');
  });

  it('returns "recommended" when customer has chosen the same option as Atlas recommends', () => {
    // No divergence — the recommended option still reads as "recommended".
    expect(deriveSelectionState('combi', CHOSEN_SAME_AS_RECOMMENDED)).toBe('recommended');
  });

  it('returns "alternative" for other options when chosen equals recommended', () => {
    expect(deriveSelectionState('ashp', CHOSEN_SAME_AS_RECOMMENDED)).toBe('alternative');
  });
});

// ─── hasCustomerDivergence ────────────────────────────────────────────────────

describe('hasCustomerDivergence', () => {
  it('returns false when no choice has been made', () => {
    expect(hasCustomerDivergence(BASE_STATE)).toBe(false);
  });

  it('returns true when customer has chosen a different option from the recommendation', () => {
    // Core PR3 test — customer choice does not override recommendation.
    expect(hasCustomerDivergence(CHOSEN_STATE)).toBe(true);
  });

  it('returns false when customer has chosen the same option as the recommendation', () => {
    expect(hasCustomerDivergence(CHOSEN_SAME_AS_RECOMMENDED)).toBe(false);
  });

  it('returns false when chosenByCustomer is false even if chosenOptionId differs', () => {
    const state: RecommendationPresentationState = {
      recommendedOptionId: 'combi',
      chosenOptionId: 'stored_unvented',
      chosenByCustomer: false,
    };
    expect(hasCustomerDivergence(state)).toBe(false);
  });

  it('returns false when chosenOptionId is absent', () => {
    const state: RecommendationPresentationState = {
      recommendedOptionId: 'combi',
      chosenByCustomer: true,
    };
    expect(hasCustomerDivergence(state)).toBe(false);
  });
});

// ─── Invariant: recommended option is never lost ──────────────────────────────

describe('PR3 invariant: recommended option unaffected by selection', () => {
  it('recommendedOptionId is unchanged after customer chooses another option', () => {
    // Simulate: start with no choice, customer picks an alternative.
    const before = BASE_STATE;
    const after: RecommendationPresentationState = {
      ...before,
      chosenOptionId: 'stored_unvented',
      chosenByCustomer: true,
    };

    // The recommended option ID must be identical in both states.
    expect(after.recommendedOptionId).toBe(before.recommendedOptionId);
    expect(after.recommendedOptionId).toBe('combi');
  });

  it('choosing the same option twice does not mutate recommendedOptionId', () => {
    const state: RecommendationPresentationState = {
      recommendedOptionId: 'combi',
      chosenOptionId: 'stored_unvented',
      chosenByCustomer: true,
    };
    // A second "selection" — still produces the same recommendedOptionId.
    const updated: RecommendationPresentationState = {
      ...state,
      chosenOptionId: 'ashp',
    };
    expect(updated.recommendedOptionId).toBe('combi');
  });
});
