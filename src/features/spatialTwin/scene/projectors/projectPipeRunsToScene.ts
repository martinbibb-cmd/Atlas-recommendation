/**
 * projectPipeRunsToScene.ts
 *
 * Projects SpatialPipeRunV1 entities into elevated polyline3d scene nodes.
 *
 * Rendering conventions:
 *   confirmed / existing  → solid line, neutral tone
 *   inferred              → dashed line, neutral tone
 *   proposed              → dashed line, proposed tone
 *   removed               → dashed line, ghost/removed tone
 */

import type { SpatialPipeRunV1 } from '../../state/spatialTwin.types';
import type { SpatialTwinSceneNode, SceneNodeTone, SceneNodeBranch } from '../sceneGraph.types';
import type { SceneMode } from '../sceneGraph.types';
import { makeNode, DEFAULT_PIPE_ELEVATION } from '../sceneGraph.builders';

function resolveToneAndBranch(
  pipe: SpatialPipeRunV1,
  mode: SceneMode,
): { tone: SceneNodeTone; branch: SceneNodeBranch; dashed: boolean } {
  if (pipe.status === 'proposed') {
    return { tone: 'proposed', branch: 'proposed', dashed: true };
  }
  if (pipe.status === 'removed') {
    return {
      tone: mode === 'compare' ? 'ghost' : 'removed',
      branch: 'current',
      dashed: true,
    };
  }
  const dashed = pipe.certainty === 'inferred' || pipe.certainty === 'unknown';
  return { tone: 'neutral', branch: pipe.status === 'existing' ? 'current' : 'shared', dashed };
}

export function projectPipeRunsToScene(
  pipeRuns: SpatialPipeRunV1[],
  mode: SceneMode,
  pipeElevationUnits = DEFAULT_PIPE_ELEVATION,
): SpatialTwinSceneNode[] {
  return pipeRuns
    .filter((p) => {
      if (mode === 'current') return p.status === 'existing' || p.status === 'unchanged';
      if (mode === 'proposed') return p.status !== 'removed';
      return true;
    })
    .map((pipe) => {
      const { tone, branch, dashed } = resolveToneAndBranch(pipe, mode);
      return makeNode({
        entityId: pipe.pipeRunId,
        entityKind: 'pipeRun',
        branch,
        tone,
        label: pipe.label,
        dashed,
        geometry: {
          type: 'polyline3d',
          points: pipe.route.map((pt) => ({ x: pt.x, y: pt.y, z: pipeElevationUnits })),
        },
        certainty: pipe.certainty,
        status: pipe.status,
      });
    });
}
