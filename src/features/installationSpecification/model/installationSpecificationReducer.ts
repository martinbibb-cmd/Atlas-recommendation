/**
 * installationSpecificationReducer.ts
 *
 * Functional state management for the Atlas Installation Specification.
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
import type { QuotePlanLocationV1, QuotePlanCandidateFlueRouteV1, QuotePlanPipeworkRouteV1 } from './QuoteInstallationPlanV1';

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * Atlas Installation Specification state.
 *
 * `plan` is `null` when no draft has been initialised yet.
 */
export interface InstallationSpecificationState {
  plan: QuoteInstallationPlanV1 | null;
}

/** Initial installation specification state — no active plan. */
export const INITIAL_INSTALLATION_SPECIFICATION_STATE: InstallationSpecificationState = {
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

/**
 * Update a single flue route in the plan's `flueRoutes` array.
 *
 * If a route with the same `flueRouteId` already exists it is replaced;
 * otherwise the route is appended.
 * Has no effect when `state.plan` is `null`.
 */
export interface UpdateFlueRouteAction {
  type: 'QUOTE_PLANNER/UPDATE_FLUE_ROUTE';
  flueRoute: QuotePlanCandidateFlueRouteV1;
}

/**
 * Update a single pipework route in the plan's `pipeworkRoutes` array.
 *
 * If a route with the same `pipeworkRouteId` already exists it is replaced;
 * otherwise the route is appended.
 * Has no effect when `state.plan` is `null`.
 */
export interface UpdatePipeworkRouteAction {
  type: 'QUOTE_PLANNER/UPDATE_PIPEWORK_ROUTE';
  pipeworkRoute: QuotePlanPipeworkRouteV1;
}

/** Discriminated union of all quote planner actions. */
export type QuotePlannerAction =
  | SetPlanAction
  | ClearPlanAction
  | UpdateLocationsAction
  | UpdateFlueRouteAction
  | UpdatePipeworkRouteAction;

// ─── Reducer ──────────────────────────────────────────────────────────────────

/**
 * Pure quote planner reducer.
 *
 * @param state   - Current state snapshot.
 * @param action  - Action to apply.
 * @returns       New state (or the same reference when nothing changes).
 */
export function installationSpecificationReducer(
  state: InstallationSpecificationState,
  action: QuotePlannerAction,
): InstallationSpecificationState {
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

    case 'QUOTE_PLANNER/UPDATE_FLUE_ROUTE': {
      if (!state.plan) return state;
      const { flueRoute } = action;
      const existing = state.plan.flueRoutes;
      const idx = existing.findIndex((r) => r.flueRouteId === flueRoute.flueRouteId);
      const updatedFlueRoutes =
        idx >= 0
          ? existing.map((r) => (r.flueRouteId === flueRoute.flueRouteId ? flueRoute : r))
          : [...existing, flueRoute];
      return {
        ...state,
        plan: { ...state.plan, flueRoutes: updatedFlueRoutes },
      };
    }

    case 'QUOTE_PLANNER/UPDATE_PIPEWORK_ROUTE': {
      if (!state.plan) return state;
      const { pipeworkRoute } = action;
      const existing = state.plan.pipeworkRoutes;
      const idx = existing.findIndex((r) => r.pipeworkRouteId === pipeworkRoute.pipeworkRouteId);
      const updatedPipeworkRoutes =
        idx >= 0
          ? existing.map((r) => (r.pipeworkRouteId === pipeworkRoute.pipeworkRouteId ? pipeworkRoute : r))
          : [...existing, pipeworkRoute];
      return {
        ...state,
        plan: { ...state.plan, pipeworkRoutes: updatedPipeworkRoutes },
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
let _state: InstallationSpecificationState = INITIAL_INSTALLATION_SPECIFICATION_STATE;

/** Returns the current installation specification state snapshot. */
export function getState(): InstallationSpecificationState {
  return _state;
}

/** Dispatches an action through the reducer and stores the new state. */
export function dispatch(action: QuotePlannerAction): void {
  _state = installationSpecificationReducer(_state, action);
}

/**
 * Resets the installation specification state to the initial empty state.
 * Call when a visit ends or a new visit begins.
 */
export function reset(): void {
  _state = INITIAL_INSTALLATION_SPECIFICATION_STATE;
}
