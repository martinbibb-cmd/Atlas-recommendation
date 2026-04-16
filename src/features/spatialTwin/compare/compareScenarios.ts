import type { SpatialTwinModelV1, SpatialTwinDeltaSummary, AtlasSpatialPatchV1 } from '../state/spatialTwin.types';
import { applyScenarioPatches } from '../patches/applyScenarioPatches';
import { buildSpatialTwinCompareSummary } from './buildSpatialTwinCompareSummary';

/**
 * Per-scenario projection paired with its metadata.
 */
export interface ScenarioProjection {
  scenarioId: string;
  name: string;
  model: SpatialTwinModelV1;
}

/**
 * Diff between two projected scenario models.
 *
 * Each side is expressed relative to the base model so that the caller can
 * interpret additions/removals in context.  `diff` describes the symmetric
 * differences between the two scenarios.
 */
export interface ScenarioDiff {
  scenarioA: ScenarioProjection;
  scenarioB: ScenarioProjection;
  /** Changes present in A relative to base. */
  deltaA: SpatialTwinDeltaSummary;
  /** Changes present in B relative to base. */
  deltaB: SpatialTwinDeltaSummary;
}

/**
 * Project a scenario onto the base model using its ordered patch stack.
 */
export function projectScenario(
  base: SpatialTwinModelV1,
  scenarioId: string,
  name: string,
  patches: AtlasSpatialPatchV1[],
): ScenarioProjection {
  return {
    scenarioId,
    name,
    model: applyScenarioPatches(base, patches),
  };
}

/**
 * Compare two scenarios against the same base model.
 *
 * Returns a `ScenarioDiff` with the delta summary for each scenario
 * relative to the base model.
 *
 * @param base       The canonical base model (before any scenario patches).
 * @param scenarioA  Metadata and patches for scenario A.
 * @param scenarioB  Metadata and patches for scenario B.
 */
export function compareScenarios(
  base: SpatialTwinModelV1,
  scenarioA: { scenarioId: string; name: string; patches: AtlasSpatialPatchV1[] },
  scenarioB: { scenarioId: string; name: string; patches: AtlasSpatialPatchV1[] },
): ScenarioDiff {
  const projA = projectScenario(base, scenarioA.scenarioId, scenarioA.name, scenarioA.patches);
  const projB = projectScenario(base, scenarioB.scenarioId, scenarioB.name, scenarioB.patches);

  return {
    scenarioA: projA,
    scenarioB: projB,
    deltaA: buildSpatialTwinCompareSummary(projA.model),
    deltaB: buildSpatialTwinCompareSummary(projB.model),
  };
}
