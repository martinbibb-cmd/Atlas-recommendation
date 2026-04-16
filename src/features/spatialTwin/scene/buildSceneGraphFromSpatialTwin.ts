/**
 * buildSceneGraphFromSpatialTwin.ts
 *
 * Main entry point for projecting a SpatialTwinModelV1 into a SpatialTwinSceneGraph.
 *
 * Rules enforced here:
 *  - deterministic output (same input → same output)
 *  - source model is never mutated
 *  - no physics calculations
 *  - no recommendation decisions
 *  - every output node carries a canonical entityId
 */

import type { SpatialTwinModelV1 } from '../state/spatialTwin.types';
import type {
  SpatialTwinSceneGraph,
  SceneMode,
  SpatialTwinSceneBuildOptions,
} from './sceneGraph.types';
import { DEFAULT_ROOM_HEIGHT, DEFAULT_PIPE_ELEVATION } from './sceneGraph.builders';
import { projectRoomsToScene } from './projectors/projectRoomsToScene';
import { projectEmittersToScene } from './projectors/projectEmittersToScene';
import { projectHeatSourcesToScene } from './projectors/projectHeatSourcesToScene';
import { projectStoresToScene } from './projectors/projectStoresToScene';
import { projectPipeRunsToScene } from './projectors/projectPipeRunsToScene';
import { projectEvidenceToScene } from './projectors/projectEvidenceToScene';

/**
 * Build a complete SpatialTwinSceneGraph from a SpatialTwinModelV1.
 *
 * @param model    The canonical Spatial Twin model (read-only).
 * @param mode     Rendering mode: 'current', 'proposed', or 'compare'.
 * @param options  Optional overrides for projection behaviour.
 */
export function buildSceneGraphFromSpatialTwin(
  model: SpatialTwinModelV1,
  mode: SceneMode,
  options: SpatialTwinSceneBuildOptions = {},
): SpatialTwinSceneGraph {
  const roomHeight = options.roomHeightUnits ?? DEFAULT_ROOM_HEIGHT;
  const pipeElevation = options.pipeElevationUnits ?? DEFAULT_PIPE_ELEVATION;

  const roomNodes = projectRoomsToScene(model.spatial.rooms, mode, roomHeight);

  const emitterNodes = projectEmittersToScene(
    model.spatial.emitters,
    model.spatial.rooms,
    mode,
  );

  const heatSourceNodes = projectHeatSourcesToScene(model.heatSources, mode);

  const storeNodes = projectStoresToScene(model.stores, mode);

  const pipeNodes = options.omitPipes
    ? []
    : projectPipeRunsToScene(model.pipeRuns, mode, pipeElevation);

  const evidenceNodes = options.omitEvidence
    ? []
    : projectEvidenceToScene(model.evidenceMarkers, mode);

  const nodes = [
    ...roomNodes,
    ...emitterNodes,
    ...heatSourceNodes,
    ...storeNodes,
    ...pipeNodes,
    ...evidenceNodes,
  ];

  return {
    nodes,
    metadata: {
      mode,
      generatedAt: new Date().toISOString(),
      sourceModelId: model.propertyId,
      sourceRevision: 1,
    },
  };
}

/**
 * Stub hook for future export pipeline.
 * Returns a SceneExportPayload without performing any actual serialisation.
 */
export function buildPresentationScenePayload(
  model: SpatialTwinModelV1,
  mode: SceneMode,
  formatHint?: 'usdz' | 'glb' | 'internal',
) {
  const graph = buildSceneGraphFromSpatialTwin(model, mode);
  return { graph, formatHint };
}
