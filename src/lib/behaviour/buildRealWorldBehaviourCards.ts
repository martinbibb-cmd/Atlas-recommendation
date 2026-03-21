/**
 * buildRealWorldBehaviourCards.ts
 *
 * PR4 — Presentation-layer helper for real-world behaviour cards.
 *
 * Takes engine outputs (realWorldBehaviours) and the current presentation state,
 * and returns enriched PresentationBehaviourCard objects suitable for rendering.
 *
 * Rules:
 *   - Presentation layer only: no engine scoring changes.
 *   - Derives recommendedOptionNote and chosenOptionNote from copy maps.
 *   - chosenOptionNote is only populated when the customer has actively
 *     diverged from the Atlas recommendation (PR3 divergence state).
 *   - Falls back gracefully when realWorldBehaviours is absent.
 */

import type {
  EngineOutputV1,
  RealWorldBehaviourCard as EngineCard,
  BehaviourOutcome,
} from '../../contracts/EngineOutputV1';
import type { RecommendationPresentationState } from '../selection/optionSelection';
import { hasCustomerDivergence } from '../selection/optionSelection';
import {
  BEHAVIOUR_OUTCOME_RECOMMENDED_NOTE,
  BEHAVIOUR_OUTCOME_CHOSEN_NOTE,
} from '../copy/customerCopy';

// ─── Presentation types ───────────────────────────────────────────────────────

/**
 * Presentation-layer outcome tier.
 *
 * Coarser than the engine's BehaviourOutcome; maps engine fine-grained levels
 * into three customer-readable tiers.
 *
 *   works_well           — strong or acceptable engine outcome
 *   works_with_limits    — limited engine outcome
 *   best_for_lighter_use — poor engine outcome
 */
export type PresentationOutcome =
  | 'works_well'
  | 'works_with_limits'
  | 'best_for_lighter_use';

/**
 * Presentation-layer limiting factor identifier.
 *
 * Mapped from BehaviourLimitingFactor; excludes 'unknown' (produces undefined).
 */
export type PresentationLimitingFactor =
  | 'mains'
  | 'storage'
  | 'instantaneous_output'
  | 'recovery'
  | 'distribution';

/**
 * Enriched behaviour card for the presentation layer.
 *
 * Wraps the engine's RealWorldBehaviourCard with:
 *   - coarser outcome tier (PresentationOutcome)
 *   - recommendedOptionNote: always present when engine data is available
 *   - chosenOptionNote: present only when customer has diverged from recommendation
 */
export interface PresentationBehaviourCard {
  /** Stable scenario identifier — from engine scenario_id. */
  id: string;
  /** Short customer-facing scenario title. */
  title: string;
  /** One-line customer-facing summary of expected behaviour. */
  summary: string;
  /** Coarser customer-readable outcome tier. */
  outcome: PresentationOutcome;
  /**
   * The primary factor shaping the outcome.
   * Undefined when the engine cannot determine the limiting factor.
   */
  limitingFactor?: PresentationLimitingFactor;
  /**
   * Short physics explanation (engine-provided).
   * Kept brief; detailed engineering information is in option cards / limiters.
   */
  explanation?: string;
  /** Confidence in this scenario assessment. */
  confidence?: 'high' | 'medium' | 'low';
  /**
   * Short note about how the recommended option handles this scenario.
   * Used in the divergence comparison view.
   */
  recommendedOptionNote?: string;
  /**
   * Short note about how the customer-chosen option handles this scenario.
   * Only present when the customer has actively chosen a different option (divergence).
   */
  chosenOptionNote?: string;
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function mapOutcome(outcome: BehaviourOutcome): PresentationOutcome {
  switch (outcome) {
    case 'strong':
    case 'acceptable':
      return 'works_well';
    case 'limited':
      return 'works_with_limits';
    case 'poor':
      return 'best_for_lighter_use';
  }
}

function mapLimitingFactor(factor?: string): PresentationLimitingFactor | undefined {
  switch (factor) {
    case 'mains':                return 'mains';
    case 'hot_water_generation': return 'instantaneous_output';
    case 'stored_volume':        return 'storage';
    case 'distribution':         return 'distribution';
    // 'recovery' is a valid PresentationLimitingFactor (included for future use when
    // the engine emits recovery-constraint scenarios via BehaviourLimitingFactor).
    // The engine's StoredDhwModule tracks recovery-limited constraintKind internally,
    // but it is not yet surfaced through BehaviourLimitingFactor in scenario cards.
    case 'recovery':             return 'recovery';
    default:                     return undefined;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the presentation-layer behaviour card array from engine output and
 * current presentation state.
 *
 * Returns an empty array when:
 *   - engineOutput.realWorldBehaviours is absent or empty
 *   - input is otherwise malformed
 *
 * @param engineOutput   Full EngineOutputV1 — realWorldBehaviours is read from here.
 * @param presentationState  Current PR3 presentation state (recommended + chosen option).
 */
export function buildRealWorldBehaviourCards(
  engineOutput: EngineOutputV1,
  presentationState: RecommendationPresentationState,
): PresentationBehaviourCard[] {
  const cards = engineOutput.realWorldBehaviours;
  if (cards == null || cards.length === 0) return [];

  const isDivergent = hasCustomerDivergence(presentationState);

  return cards.map((card: EngineCard): PresentationBehaviourCard => {
    const outcome = mapOutcome(card.recommended_option_outcome);
    const limitingFactor = mapLimitingFactor(card.limiting_factor);

    // Recommended option note: always derive from engine outcome for use in
    // divergence comparison; omitted when engine does not supply an outcome key.
    const recommendedNoteRaw =
      BEHAVIOUR_OUTCOME_RECOMMENDED_NOTE[card.recommended_option_outcome];
    const recommendedOptionNote =
      recommendedNoteRaw != null ? recommendedNoteRaw : undefined;

    // Chosen option note: only set when customer has actively chosen a different
    // option AND the engine has computed an alternative_option_outcome.
    const chosenOptionNote =
      isDivergent && card.alternative_option_outcome != null
        ? (BEHAVIOUR_OUTCOME_CHOSEN_NOTE[card.alternative_option_outcome] ?? undefined)
        : undefined;

    return {
      id: card.scenario_id,
      title: card.title,
      summary: card.summary,
      outcome,
      limitingFactor,
      explanation: card.explanation,
      confidence: card.confidence,
      recommendedOptionNote,
      chosenOptionNote,
    };
  });
}
