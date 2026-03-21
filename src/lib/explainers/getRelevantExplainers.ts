/**
 * getRelevantExplainers.ts
 *
 * PR5 — Relevance mapping helpers for the explainer system.
 *
 * Decides which explainers are relevant to surface from:
 *   - behaviour card limiting factors (for inline "Learn why" links)
 *   - behaviour cards as a collection (for overlay context section additions)
 *
 * Rules:
 *   - presentation layer only: no engine/scoring changes.
 *   - returns only explainer IDs that exist in EDUCATIONAL_EXPLAINERS.
 *   - deduplicates all output arrays.
 */

import type { PresentationLimitingFactor } from '../behaviour/buildRealWorldBehaviourCards';

// ─── Limiting factor → explainer mapping ─────────────────────────────────────

/**
 * Maps a behaviour card limiting factor to the most directly relevant
 * educational explainer ID.
 *
 * Returns null when no directly relevant explainer exists for the factor
 * (e.g. 'recovery' has no dedicated explainer yet).
 */
export function getExplainerIdForLimitingFactor(
  factor: PresentationLimitingFactor | undefined,
): string | null {
  if (factor == null) return null;
  switch (factor) {
    case 'mains':
      return 'shared_mains_flow';
    case 'instantaneous_output':
      return 'multiple_taps';
    case 'storage':
      return 'on_demand_vs_stored';
    case 'distribution':
      return 'pressure_vs_flow';
    case 'recovery':
      // No dedicated explainer yet; on_demand_vs_stored covers recovery broadly.
      return 'on_demand_vs_stored';
    default:
      return null;
  }
}

// ─── Behaviour-card collection → context explainer IDs ───────────────────────

interface MinimalBehaviourCard {
  limitingFactor?: PresentationLimitingFactor;
}

/**
 * Returns additional educational explainer IDs to surface in the overlay
 * "For this recommendation" section, derived from behaviour card limiting
 * factors.
 *
 * These supplement the engine-signal–based context IDs already computed in
 * DecisionSynthesisPage — they are appended (duplicates are removed by the
 * caller).
 *
 * @param cards  Presentation-layer behaviour cards (limitingFactor is the key field).
 */
export function getExplainerIdsFromBehaviourCards(
  cards: readonly MinimalBehaviourCard[],
): string[] {
  const ids = new Set<string>();
  for (const card of cards) {
    const id = getExplainerIdForLimitingFactor(card.limitingFactor);
    if (id != null) ids.add(id);
  }
  return Array.from(ids);
}
