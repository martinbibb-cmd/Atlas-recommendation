/**
 * projectStoresToScene.ts
 *
 * Projects SpatialStoreV1 (cylinders, thermal stores, buffers) into box nodes.
 *
 * Stores follow the same status-to-tone mapping as heat sources.
 */

import type { SpatialStoreV1 } from '../../state/spatialTwin.types';
import type { SpatialTwinSceneNode, SceneNodeTone, SceneNodeBranch } from '../sceneGraph.types';
import type { SceneMode } from '../sceneGraph.types';
import { makeNode, GRID } from '../sceneGraph.builders';

const BOX_W = GRID * 0.5;
const BOX_D = GRID * 0.5;
const BOX_H = GRID * 1.8; // cylinders are tall

const BASE_X = 15 * GRID;
const BASE_Y = 5 * GRID;

function resolveToneAndBranch(
  status: SpatialStoreV1['status'],
  mode: SceneMode,
): { tone: SceneNodeTone; branch: SceneNodeBranch } {
  if (status === 'proposed') {
    return { tone: 'proposed', branch: 'proposed' };
  }
  if (status === 'removed') {
    return { tone: mode === 'compare' ? 'ghost' : 'removed', branch: 'current' };
  }
  return { tone: 'warning', branch: 'current' }; // amber = hot water store
}

export function projectStoresToScene(
  stores: SpatialStoreV1[],
  mode: SceneMode,
): SpatialTwinSceneNode[] {
  return stores
    .filter((s) => {
      if (mode === 'current') return s.status === 'existing' || s.status === 'unchanged';
      if (mode === 'proposed') return s.status !== 'removed';
      return true;
    })
    .map((store, index) => {
      const { tone, branch } = resolveToneAndBranch(store.status, mode);
      return makeNode({
        entityId: store.storeId,
        entityKind: 'store',
        branch,
        tone,
        label: store.label,
        geometry: {
          type: 'box',
          width: BOX_W,
          depth: BOX_D,
          height: BOX_H,
          position: { x: BASE_X + index * (BOX_W + GRID * 0.5), y: BASE_Y, z: 0 },
        },
        certainty: store.certainty,
        status: store.status,
      });
    });
}
