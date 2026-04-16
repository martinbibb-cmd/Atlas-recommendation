/**
 * projectEmittersToScene.ts
 *
 * Projects AtlasEmitterV1 entities into scene nodes (small boxes).
 *
 * Emitters are assumed present in both branches (they inherit from the
 * spatial model), so they are tagged as 'shared'.
 */

import type { AtlasEmitterV1, AtlasRoomV1 } from '../../../atlasSpatial/atlasSpatialModel.types';
import type { SpatialTwinSceneNode } from '../sceneGraph.types';
import type { SceneMode } from '../sceneGraph.types';
import { makeNode, boundingBoxCentroid, GRID } from '../sceneGraph.builders';

const EMITTER_BOX_W = GRID * 0.8;
const EMITTER_BOX_D = GRID * 0.15;
const EMITTER_BOX_H = GRID * 0.5;

export function projectEmittersToScene(
  emitters: AtlasEmitterV1[],
  rooms: AtlasRoomV1[],
  _mode: SceneMode,
): SpatialTwinSceneNode[] {
  return emitters.map((emitter) => {
    const room = rooms.find((r) => r.roomId === emitter.roomId);
    const bb = room?.geometry?.boundingBox;
    const centre = bb != null ? boundingBoxCentroid(bb) : { x: 0, y: 0, z: 0 };

    return makeNode({
      entityId: emitter.emitterId,
      entityKind: 'emitter',
      branch: 'shared',
      tone: 'current',
      label: emitter.type === 'ufh' ? 'UFH' : 'Radiator',
      geometry: {
        type: 'box',
        width: EMITTER_BOX_W,
        depth: EMITTER_BOX_D,
        height: EMITTER_BOX_H,
        position: { x: centre.x, y: centre.y, z: 0 },
      },
    });
  });
}
