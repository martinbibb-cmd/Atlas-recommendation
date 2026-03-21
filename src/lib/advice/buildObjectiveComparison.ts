/**
 * buildObjectiveComparison.ts
 *
 * PR8 — Objective comparison builder for the customer portal.
 *
 * Produces ObjectiveComparisonView objects that power the priority-selector
 * comparison panel.  Each view describes how the available options rank for
 * a given customer priority, and includes notes for the recommended option
 * and (when the customer has diverged) the chosen option.
 *
 * Rules:
 *   - Presentation layer only — no engine / scoring changes.
 *   - All option data is sourced from EngineOutputV1.
 *   - rankedOptionIds contains only options present in engineOutput.options,
 *     ordered from most to least suited for the given priority.
 *   - recommendedOptionNote and chosenOptionNote use rank-relative language,
 *     not raw scores.
 */

import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { RecommendationPresentationState } from '../selection/optionSelection';
import { hasCustomerDivergence } from '../selection/optionSelection';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Customer-facing priority identifiers for the objective comparison panel. */
export type ObjectivePriorityId =
  | 'running_costs'
  | 'hot_water'
  | 'space_saving'
  | 'simplicity'
  | 'future_flexibility'
  | 'lower_disruption';

/**
 * Presentation model for a single priority comparison view.
 *
 * Matches the shape described in the PR8 specification:
 *   objectiveId       — stable priority identifier
 *   title             — short customer-facing priority label
 *   intro             — "Best if your priority is…" opener sentence
 *   rankedOptionIds   — available options ordered best→least for this priority
 *   recommendedOptionNote — how the recommended option performs on this priority
 *   chosenOptionNote  — how the customer-chosen option performs (divergent only)
 */
export interface ObjectiveComparisonView {
  objectiveId: ObjectivePriorityId;
  title: string;
  intro: string;
  /** Option IDs (subset of engineOutput.options) ordered best→least for this priority. */
  rankedOptionIds: string[];
  recommendedOptionNote?: string;
  chosenOptionNote?: string;
}

// ─── Internal priority rankings ───────────────────────────────────────────────

/**
 * Canonical preference order for each priority.
 * Options not present in the engine output are silently skipped.
 * Rejected options are placed last within each group.
 */
const PRIORITY_RANK_ORDER: Record<ObjectivePriorityId, string[]> = {
  running_costs: [
    'ashp',
    'system_unvented',
    'stored_unvented',
    'regular_vented',
    'stored_vented',
    'combi',
  ],
  hot_water: [
    'stored_unvented',
    'system_unvented',
    'stored_vented',
    'regular_vented',
    'ashp',
    'combi',
  ],
  space_saving: [
    'combi',
    'regular_vented',
    'stored_vented',
    'stored_unvented',
    'system_unvented',
    'ashp',
  ],
  simplicity: [
    'combi',
    'stored_vented',
    'regular_vented',
    'stored_unvented',
    'system_unvented',
    'ashp',
  ],
  future_flexibility: [
    'system_unvented',
    'stored_unvented',
    'ashp',
    'regular_vented',
    'stored_vented',
    'combi',
  ],
  lower_disruption: [
    'combi',
    'stored_vented',
    'regular_vented',
    'stored_unvented',
    'system_unvented',
    'ashp',
  ],
};

// ─── Rank-based note helpers ──────────────────────────────────────────────────

/**
 * Return a customer-facing note for an option given its zero-based rank
 * and the total number of available options.
 */
function rankNote(rank: number, total: number): string {
  if (total <= 1) return 'Good fit for this priority.';
  const thirds = total / 3;
  if (rank < thirds)        return 'A strong fit for this priority.';
  if (rank < thirds * 2)    return 'A reasonable fit — not its standout strength.';
  return 'Less strong here — other options score higher for this priority.';
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Build an ObjectiveComparisonView for the given priority.
 *
 * @param output           Engine output for the current recommendation.
 * @param priorityId       Which priority to build a view for.
 * @param presentationState  Current presentation / selection state.
 */
export function buildObjectiveComparison(
  output: EngineOutputV1,
  priorityId: ObjectivePriorityId,
  presentationState: RecommendationPresentationState,
): ObjectiveComparisonView {
  const options = output.options ?? [];
  const prefOrder = PRIORITY_RANK_ORDER[priorityId];

  // Rank available options: viable/caution first (by preference order),
  // rejected last (also by preference order).
  const viable = prefOrder.filter(id =>
    options.some(o => o.id === id && o.status !== 'rejected'),
  );
  const rejected = prefOrder.filter(id =>
    options.some(o => o.id === id && o.status === 'rejected'),
  );
  const rankedOptionIds = [...viable, ...rejected];

  // Lookup ranks for recommended and chosen options.
  const recId   = presentationState.recommendedOptionId;
  const recRank = rankedOptionIds.indexOf(recId);

  const recommendedOptionNote =
    recRank >= 0 ? rankNote(recRank, rankedOptionIds.length) : undefined;

  let chosenOptionNote: string | undefined;
  if (hasCustomerDivergence(presentationState)) {
    const chosenId   = presentationState.chosenOptionId;
    const chosenRank = rankedOptionIds.indexOf(chosenId);
    chosenOptionNote =
      chosenRank >= 0 ? rankNote(chosenRank, rankedOptionIds.length) : undefined;
  }

  const { title, intro } = PRIORITY_META[priorityId];

  return {
    objectiveId: priorityId,
    title,
    intro,
    rankedOptionIds,
    recommendedOptionNote,
    chosenOptionNote,
  };
}

// ─── Priority metadata ────────────────────────────────────────────────────────

const PRIORITY_META: Record<ObjectivePriorityId, { title: string; intro: string }> = {
  running_costs: {
    title: 'Running costs',
    intro: 'Best if your priority is keeping running costs low…',
  },
  hot_water: {
    title: 'Hot water performance',
    intro: 'Best if your priority is consistent, reliable hot water…',
  },
  space_saving: {
    title: 'Space saving',
    intro: 'Best if your priority is freeing up space in your home…',
  },
  simplicity: {
    title: 'Simplicity',
    intro: 'Best if your priority is a straightforward, low-maintenance system…',
  },
  future_flexibility: {
    title: 'Future flexibility',
    intro: 'Best if your priority is keeping your options open for the future…',
  },
  lower_disruption: {
    title: 'Lower disruption',
    intro: 'Best if your priority is a smooth, contained installation…',
  },
};

// ─── All-priorities builder ───────────────────────────────────────────────────

/** Ordered list of all priority IDs for use in the chip row. */
export const OBJECTIVE_PRIORITY_IDS: ObjectivePriorityId[] = [
  'running_costs',
  'hot_water',
  'space_saving',
  'simplicity',
  'future_flexibility',
  'lower_disruption',
];

/**
 * Build ObjectiveComparisonView objects for all priorities.
 * Returns a map keyed by priority ID for efficient lookup.
 */
export function buildAllObjectiveComparisons(
  output: EngineOutputV1,
  presentationState: RecommendationPresentationState,
): Map<ObjectivePriorityId, ObjectiveComparisonView> {
  const map = new Map<ObjectivePriorityId, ObjectiveComparisonView>();
  for (const id of OBJECTIVE_PRIORITY_IDS) {
    map.set(id, buildObjectiveComparison(output, id, presentationState));
  }
  return map;
}
