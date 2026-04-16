import React from 'react';
import { Layer, Circle, Text } from 'react-konva';
import type { AtlasEmitterV1, AtlasRoomV1 } from '../../atlasSpatial/atlasSpatialModel.types';
import type { SpatialHeatSourceV1, SpatialStoreV1 } from '../state/spatialTwin.types';

// GRID = 24 canvas units per metre (matches FloorPlanBuilder.tsx)
const GRID = 24;
/** Default centre offset for objects that have no room geometry. */
const DEFAULT_OBJECT_X = 40;
const DEFAULT_OBJECT_Y = 40;

/**
 * Derive a canvas position for an entity by finding the centre of its parent
 * room bounding box.  Falls back to a stacked default position when the room or
 * its geometry is not available.
 */
function roomCentre(
  roomId: string | undefined,
  rooms: AtlasRoomV1[],
  fallbackIndex: number,
): { x: number; y: number } {
  if (roomId != null) {
    const room = rooms.find((r) => r.roomId === roomId);
    const bb = room?.geometry?.boundingBox;
    if (bb != null) {
      return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
    }
  }
  // Scatter objects horizontally so they don't overlap the room layer
  return {
    x: DEFAULT_OBJECT_X + (fallbackIndex % 8) * (GRID * 2),
    y: DEFAULT_OBJECT_Y + Math.floor(fallbackIndex / 8) * (GRID * 2),
  };
}

interface SpatialTwinLayerObjectsProps {
  emitters: AtlasEmitterV1[];
  heatSources: SpatialHeatSourceV1[];
  stores: SpatialStoreV1[];
  rooms: AtlasRoomV1[];
  selectedEntityId: string | null;
  onSelect: (entityId: string) => void;
}

export function SpatialTwinLayerObjects({
  emitters,
  heatSources,
  stores,
  rooms,
  selectedEntityId,
  onSelect,
}: SpatialTwinLayerObjectsProps) {
  return (
    <Layer>
      {emitters.map((emitter, idx) => {
        const { x, y } = roomCentre(emitter.roomId, rooms, idx);
        const isSelected = selectedEntityId === emitter.emitterId;
        return (
          <React.Fragment key={emitter.emitterId}>
            <Circle
              x={x}
              y={y}
              radius={8}
              fill={isSelected ? '#fbbf24' : '#fed7aa'}
              stroke={isSelected ? '#d97706' : '#f97316'}
              strokeWidth={isSelected ? 2 : 1}
              onClick={() => { onSelect(emitter.emitterId); }}
            />
          </React.Fragment>
        );
      })}
      {heatSources.map((hs, idx) => {
        const { x, y } = roomCentre(hs.roomId, rooms, emitters.length + idx);
        const isSelected = selectedEntityId === hs.heatSourceId;
        return (
          <React.Fragment key={hs.heatSourceId}>
            <Circle
              x={x}
              y={y}
              radius={10}
              fill={isSelected ? '#fca5a5' : '#fecaca'}
              stroke={isSelected ? '#dc2626' : '#ef4444'}
              strokeWidth={isSelected ? 2 : 1}
              onClick={() => { onSelect(hs.heatSourceId); }}
            />
            <Text x={x - 8} y={y + 14} text={hs.label.slice(0, 6)} fontSize={9} fill='#374151' listening={false} />
          </React.Fragment>
        );
      })}
      {stores.map((store, idx) => {
        const { x, y } = roomCentre(store.roomId, rooms, emitters.length + heatSources.length + idx);
        const isSelected = selectedEntityId === store.storeId;
        return (
          <React.Fragment key={store.storeId}>
            <Circle
              x={x}
              y={y}
              radius={10}
              fill={isSelected ? '#a5f3fc' : '#cffafe'}
              stroke={isSelected ? '#0891b2' : '#06b6d4'}
              strokeWidth={isSelected ? 2 : 1}
              onClick={() => { onSelect(store.storeId); }}
            />
          </React.Fragment>
        );
      })}
    </Layer>
  );
}
