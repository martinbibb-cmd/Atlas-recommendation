/**
 * projectRoomsToScene.ts
 *
 * Projects AtlasRoomV1 entities from the spatial model into scene nodes.
 *
 * Rooms are rendered as extruded floor-plate polygons (the dollhouse "shell").
 * All rooms are treated as shared across branches — their geometry does not
 * change between current/proposed scenarios.
 */

import type { AtlasRoomV1 } from '../../../atlasSpatial/atlasSpatialModel.types';
import type { SpatialTwinSceneNode } from '../sceneGraph.types';
import type { SceneMode } from '../sceneGraph.types';
import {
  makeNode,
  boundingBoxToExtrudedPolygon,
  DEFAULT_ROOM_HEIGHT,
} from '../sceneGraph.builders';

export function projectRoomsToScene(
  rooms: AtlasRoomV1[],
  _mode: SceneMode,
  roomHeightUnits = DEFAULT_ROOM_HEIGHT,
): SpatialTwinSceneNode[] {
  return rooms.map((room) => {
    const bb = room.geometry?.boundingBox;
    const geometry =
      bb != null
        ? boundingBoxToExtrudedPolygon(bb, roomHeightUnits)
        : {
            type: 'extrudedPolygon' as const,
            points: [
              { x: 0, y: 0 },
              { x: 48, y: 0 },
              { x: 48, y: 48 },
              { x: 0, y: 48 },
            ],
            height: roomHeightUnits,
          };

    return makeNode({
      entityId: room.roomId,
      entityKind: 'room',
      branch: 'shared',
      tone: 'neutral',
      label: room.label,
      geometry,
    });
  });
}
