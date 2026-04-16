import type { SpatialTwinFeatureState, SpatialTwinModelV1, SpatialTwinScenarioV1, AtlasSpatialPatchV1 } from './spatialTwin.types';
import { applyScenarioPatches } from '../patches/applyScenarioPatches';

/**
 * Returns the scenario with the given ID, or null when not found.
 */
export function selectScenarioById(
  state: SpatialTwinFeatureState,
  scenarioId: string,
): SpatialTwinScenarioV1 | null {
  return state.scenarios.find((s) => s.scenarioId === scenarioId) ?? null;
}

/**
 * Returns all scenarios, ordered by creation time (ascending).
 */
export function selectAllScenarios(
  state: SpatialTwinFeatureState,
): SpatialTwinScenarioV1[] {
  return state.scenarios;
}

/**
 * Returns the scenario currently marked as recommended, or null.
 */
export function selectRecommendedScenario(
  state: SpatialTwinFeatureState,
): SpatialTwinScenarioV1 | null {
  return state.scenarios.find((s) => s.isRecommended === true) ?? null;
}

/**
 * Returns the patches belonging to the active scenario, or an empty array
 * when no scenario is active.
 */
export function selectActiveScenarioPatches(
  state: SpatialTwinFeatureState,
): AtlasSpatialPatchV1[] {
  if (state.activeScenarioId == null) return [];
  return state.patchesByScenario[state.activeScenarioId] ?? [];
}

/**
 * Projects the base model through the active scenario's patch stack and
 * returns the resulting view model.
 *
 * Returns the base model unchanged when:
 * - no model has been loaded yet (returns null), or
 * - no scenario is active (base model view).
 */
export function selectActiveScenarioModel(
  state: SpatialTwinFeatureState,
): SpatialTwinModelV1 | null {
  if (state.model == null) return null;
  if (state.activeScenarioId == null) return state.model;

  const patches = state.patchesByScenario[state.activeScenarioId] ?? [];
  return applyScenarioPatches(state.model, patches);
}

/**
 * Returns the scenarios that are flagged for inclusion in a generated report.
 */
export function selectScenariosForReport(
  state: SpatialTwinFeatureState,
): SpatialTwinScenarioV1[] {
  return state.scenarios.filter((s) => s.includeInReport !== false);
}
