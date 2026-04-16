/**
 * projectHeatSourcesToScene.ts
 *
 * Projects SpatialHeatSourceV1 entities into simple box scene nodes.
 *
 * Heat sources carry an EntityStatus that drives compare-mode visual treatment:
 *   existing / unchanged → neutral (current branch)
 *   proposed             → proposed (proposed branch, accent colour)
 *   removed              → ghost (current branch, faded)
 */

import type { SpatialHeatSourceV1 } from '../../state/spatialTwin.types';
import type { SpatialTwinSceneNode, SceneNodeTone, SceneNodeBranch } from '../sceneGraph.types';
import type { SceneMode } from '../sceneGraph.types';
import { makeNode, GRID } from '../sceneGraph.builders';

const BOX_W = GRID * 0.75;
const BOX_D = GRID * 0.6;
const BOX_H = GRID * 1.2;

// Simple grid offset so co-located heat sources don't overlap
const BASE_X = 10 * GRID;
const BASE_Y = 5 * GRID;

function resolveToneAndBranch(
  status: SpatialHeatSourceV1['status'],
  mode: SceneMode,
): { tone: SceneNodeTone; branch: SceneNodeBranch } {
  if (status === 'proposed') {
    return { tone: 'proposed', branch: 'proposed' };
  }
  if (status === 'removed') {
    return { tone: mode === 'compare' ? 'ghost' : 'removed', branch: 'current' };
  }
  return { tone: 'neutral', branch: 'current' };
}

export function projectHeatSourcesToScene(
  heatSources: SpatialHeatSourceV1[],
  mode: SceneMode,
): SpatialTwinSceneNode[] {
  return heatSources
    .filter((hs) => {
      if (mode === 'current') return hs.status === 'existing' || hs.status === 'unchanged';
      if (mode === 'proposed') return hs.status !== 'removed';
      return true; // compare — show all with delta colouring
    })
    .map((hs, index) => {
      const { tone, branch } = resolveToneAndBranch(hs.status, mode);
      return makeNode({
        entityId: hs.heatSourceId,
        entityKind: 'heatSource',
        branch,
        tone,
        label: hs.label,
        geometry: {
          type: 'box',
          width: BOX_W,
          depth: BOX_D,
          height: BOX_H,
          position: { x: BASE_X + index * (BOX_W + GRID * 0.5), y: BASE_Y, z: 0 },
        },
        certainty: hs.certainty,
        status: hs.status,
      });
    });
}
