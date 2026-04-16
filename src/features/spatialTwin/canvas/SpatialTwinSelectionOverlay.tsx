
import { Layer, Rect } from 'react-konva';
import type { SpatialTwinModelV1 } from '../state/spatialTwin.types';

interface SpatialTwinSelectionOverlayProps {
  selectedEntityId: string | null;
  model: SpatialTwinModelV1;
}

export function SpatialTwinSelectionOverlay({
  selectedEntityId,
  model,
}: SpatialTwinSelectionOverlayProps) {
  if (selectedEntityId == null) return <Layer />;

  const room = model.spatial.rooms.find((r) => r.roomId === selectedEntityId);
  if (room?.geometry == null) return <Layer />;

  const { x, y, width, height } = room.geometry.boundingBox;

  return (
    <Layer>
      <Rect
        x={x - 3}
        y={y - 3}
        width={width + 6}
        height={height + 6}
        stroke='#2563eb'
        strokeWidth={2}
        dash={[6, 3]}
        fill='transparent'
        listening={false}
      />
    </Layer>
  );
}
