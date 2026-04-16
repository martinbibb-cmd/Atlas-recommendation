import React from 'react';
import { Layer, Rect, Text } from 'react-konva';
import type { AtlasRoomV1 } from '../../atlasSpatial/atlasSpatialModel.types';

const GRID = 24; // canvas units per metre
const ROOM_WIDTH = GRID * 5;  // default 5 m
const ROOM_HEIGHT = GRID * 4; // default 4 m
const ROOM_PADDING = 10;

interface SpatialTwinLayerRoomsProps {
  rooms: AtlasRoomV1[];
  selectedEntityId: string | null;
  hoveredEntityId: string | null;
  onSelect: (entityId: string) => void;
  onHover: (entityId: string | null) => void;
}

export function SpatialTwinLayerRooms({
  rooms,
  selectedEntityId,
  hoveredEntityId,
  onSelect,
  onHover,
}: SpatialTwinLayerRoomsProps) {
  return (
    <Layer>
      {rooms.map((room, idx) => {
        const geo = room.geometry?.boundingBox;
        const x = geo ? geo.x : (idx % 5) * (ROOM_WIDTH + ROOM_PADDING) + ROOM_PADDING;
        const y = geo ? geo.y : Math.floor(idx / 5) * (ROOM_HEIGHT + ROOM_PADDING) + ROOM_PADDING;
        const w = geo ? geo.width : ROOM_WIDTH;
        const h = geo ? geo.height : ROOM_HEIGHT;
        const isSelected = selectedEntityId === room.roomId;
        const isHovered = hoveredEntityId === room.roomId;

        return (
          <React.Fragment key={room.roomId}>
            <Rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={isSelected ? '#bfdbfe' : isHovered ? '#e0f2fe' : '#f0f9ff'}
              stroke={isSelected ? '#2563eb' : '#94a3b8'}
              strokeWidth={isSelected ? 2 : 1}
              cornerRadius={4}
              onClick={() => { onSelect(room.roomId); }}
              onMouseEnter={() => { onHover(room.roomId); }}
              onMouseLeave={() => { onHover(null); }}
            />
            <Text
              x={x + 6}
              y={y + 6}
              text={room.label}
              fontSize={11}
              fill='#334155'
              listening={false}
            />
          </React.Fragment>
        );
      })}
    </Layer>
  );
}

// Named export for use in canvas wrapper
export function KonvaRoom({
  room,
  isSelected,
  onSelect,
}: {
  room: AtlasRoomV1;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const geo = room.geometry?.boundingBox;
  const x = geo ? geo.x : 10;
  const y = geo ? geo.y : 10;
  const w = geo ? geo.width : ROOM_WIDTH;
  const h = geo ? geo.height : ROOM_HEIGHT;

  return (
    <React.Fragment>
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={isSelected ? '#bfdbfe' : '#f0f9ff'}
        stroke={isSelected ? '#2563eb' : '#94a3b8'}
        strokeWidth={isSelected ? 2 : 1}
        cornerRadius={4}
        onClick={() => { onSelect(room.roomId); }}
      />
      <Text x={x + 6} y={y + 6} text={room.label} fontSize={11} fill='#334155' listening={false} />
    </React.Fragment>
  );
}
