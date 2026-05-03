/**
 * quotePlannerReducer.ts
 *
 * Functional state management for the Atlas Quote Planner.
 *
 * Follows the same pure-reducer pattern used elsewhere in Atlas Mind:
 * a `reducer` pure function (state + action → new state) and a lightweight
 * in-memory state holder with `getState` / `dispatch` / `reset`.
 *
 * This is an internal Mind-owned draft state — it does not drive any
 * customer-facing output surface and must not alter recommendation decisions
 * or customer/safety flows.
 *
 * Design rules:
 *   - `reducer` is pure and side-effect-free.
 *   - Actions are discriminated unions with a `type` string.
 *   - `getState` returns the current state snapshot.
 *   - `dispatch` runs the reducer and stores the new state.
 *   - `reset` clears state back to `null` (no active plan).
 *   - Scan evidence provenance / confidence is never modified by the reducer —
 *     only by `SET_PLAN` (which replaces the whole plan).
 */

import type { QuoteInstallationPlanV1 } from './QuoteInstallationPlanV1';
import type { QuotePlanLocationV1 } from './QuoteInstallationPlanV1';

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * Atlas Quote Planner state.
 *
 * `plan` is `null` when no draft has been initialised yet.
 */
export interface QuotePlannerState {
  plan: QuoteInstallationPlanV1 | null;
}

/** Initial quote planner state — no active plan. */
export const INITIAL_QUOTE_PLANNER_STATE: QuotePlannerState = {
  plan: null,
};

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Replace (or initialise) the active plan draft. */
export interface SetPlanAction {
  type: 'QUOTE_PLANNER/SET_PLAN';
  plan: QuoteInstallationPlanV1;
}

/** Clear the active plan draft — e.g. when a visit ends. */
export interface ClearPlanAction {
  type: 'QUOTE_PLANNER/CLEAR_PLAN';
}

/**
 * Update the engineer-confirmed location set.
 *
 * Replaces the `locations` array on the current plan.
 * Use after the engineer reviews and confirms scan-inferred locations.
 * Has no effect when `state.plan` is `null`.
 */
export interface UpdateLocationsAction {
  type: 'QUOTE_PLANNER/UPDATE_LOCATIONS';
  locations: QuotePlanLocationV1[];
}

/** Discriminated union of all quote planner actions. */
export type QuotePlannerAction =
  | SetPlanAction
  | ClearPlanAction
  | UpdateLocationsAction;

// ─── Reducer ──────────────────────────────────────────────────────────────────

/**
 * Pure quote planner reducer.
 *
 * @param state   - Current state snapshot.
 * @param action  - Action to apply.
 * @returns       New state (or the same reference when nothing changes).
 */
export function quotePlannerReducer(
  state: QuotePlannerState,
  action: QuotePlannerAction,
): QuotePlannerState {
  switch (action.type) {
    case 'QUOTE_PLANNER/SET_PLAN':
      return { ...state, plan: action.plan };

    case 'QUOTE_PLANNER/CLEAR_PLAN':
      return { ...state, plan: null };

    case 'QUOTE_PLANNER/UPDATE_LOCATIONS': {
      if (!state.plan) return state;
      return {
        ...state,
        plan: { ...state.plan, locations: action.locations },
      };
    }

    default: {
      // Exhaustiveness check — TypeScript will error if a new action is added
      // without a corresponding case.
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

// ─── In-memory state holder ───────────────────────────────────────────────────

/**
 * Lightweight in-memory state holder for the quote planner.
 *
 * Follows the same pattern as the scan evidence and visit stores: a module-
 * level variable that holds the current state, with `getState`, `dispatch`,
 * and `reset` as the public API.
 *
 * This is intentionally not persisted to localStorage — the plan draft is
 * session-scoped and rebuilt from source data on each visit.
 */
let _state: QuotePlannerState = INITIAL_QUOTE_PLANNER_STATE;

/** Returns the current quote planner state snapshot. */
export function getState(): QuotePlannerState {
  return _state;
}

/** Dispatches an action through the reducer and stores the new state. */
export function dispatch(action: QuotePlannerAction): void {
  _state = quotePlannerReducer(_state, action);
}

/**
 * Resets the quote planner state to the initial empty state.
 * Call when a visit ends or a new visit begins.
 */
export function reset(): void {
  _state = INITIAL_QUOTE_PLANNER_STATE;
}
