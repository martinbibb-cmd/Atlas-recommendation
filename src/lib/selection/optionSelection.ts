/**
 * optionSelection.ts
 *
 * PR3 — Customer-chosen option selection state.
 *
 * Defines the presentation-layer selection state that allows a customer to
 * prefer an option without altering the engine recommendation or physics.
 *
 * Rules:
 *   - Selection state lives in the presentation / report layer only.
 *   - The engine recommendation is never overwritten or recalculated.
 *   - Both the recommended option and the customer-chosen option are preserved.
 *   - No "mode" is introduced — this is a display preference only.
 */

// ─── Option selection state ───────────────────────────────────────────────────

/**
 * Tracks how a given option is currently presented to the customer.
 *
 * 'recommended'    — Atlas recommends this option.
 * 'alternative'    — A non-recommended option available for comparison.
 * 'customer_chosen' — The customer has expressed a preference for this option.
 *                     The recommended option is still shown alongside it.
 */
export type OptionSelectionState =
  | 'recommended'
  | 'alternative'
  | 'customer_chosen';

// ─── Presentation state ───────────────────────────────────────────────────────

/**
 * Presentation-layer record of the recommended and (optionally) customer-chosen option.
 *
 * Persisted alongside the saved report so that portals, QR-linked pages, and
 * summary views can reflect the customer's preference alongside the Atlas
 * recommendation.
 *
 * The recommended option is never replaced — both fields coexist so that the
 * difference between what Atlas recommends and what the customer prefers is
 * always visible.
 */
export interface RecommendationPresentationState {
  /** The ID of the option Atlas recommends. Derived from engine output. */
  recommendedOptionId: string;
  /**
   * The ID of the option the customer has expressed a preference for.
   * Only set when the customer has actively chosen an option.
   * May equal recommendedOptionId (no divergence) or differ from it.
   */
  chosenOptionId?: string;
  /**
   * True when the customer has actively chosen an option via the UI.
   * False or absent when no selection has been made.
   */
  chosenByCustomer: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives the selection state for a given option ID given the current
 * presentation state.
 *
 * An option is 'customer_chosen' if it is the customer's chosen option AND
 * the customer has actively made a selection.  An option is 'recommended'
 * if it is the recommended option.  All others are 'alternative'.
 *
 * When both recommendedOptionId and chosenOptionId are the same, the
 * recommended option gets 'recommended' — no divergence state.
 */
export function deriveSelectionState(
  optionId: string,
  state: RecommendationPresentationState,
): OptionSelectionState {
  if (
    state.chosenByCustomer &&
    state.chosenOptionId != null &&
    state.chosenOptionId !== state.recommendedOptionId &&
    optionId === state.chosenOptionId
  ) {
    return 'customer_chosen';
  }
  if (optionId === state.recommendedOptionId) {
    return 'recommended';
  }
  return 'alternative';
}

/**
 * Returns true when the customer has chosen a different option from the
 * Atlas recommendation.
 */
export function hasCustomerDivergence(
  state: RecommendationPresentationState,
): boolean {
  return (
    state.chosenByCustomer &&
    state.chosenOptionId != null &&
    state.chosenOptionId !== state.recommendedOptionId
  );
}
