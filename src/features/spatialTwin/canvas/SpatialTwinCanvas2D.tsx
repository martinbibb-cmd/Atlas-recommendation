
import { Stage } from 'react-konva';
import type { SpatialTwinModelV1 } from '../state/spatialTwin.types';
import { SpatialTwinLayerRooms } from './SpatialTwinLayerRooms';
import { SpatialTwinLayerObjects } from './SpatialTwinLayerObjects';
import { SpatialTwinLayerPipes } from './SpatialTwinLayerPipes';
import { SpatialTwinLayerEvidence } from './SpatialTwinLayerEvidence';
import { SpatialTwinSelectionOverlay } from './SpatialTwinSelectionOverlay';

interface SpatialTwinCanvas2DProps {
  model: SpatialTwinModelV1 | null;
  selectedEntityId: string | null;
  hoveredEntityId: string | null;
  width: number;
  height: number;
  onSelectEntity: (entityId: string) => void;
  onHoverEntity: (entityId: string | null) => void;
}

export function SpatialTwinCanvas2D({
  model,
  selectedEntityId,
  hoveredEntityId,
  width,
  height,
  onSelectEntity,
  onHoverEntity,
}: SpatialTwinCanvas2DProps) {
  if (model == null) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f1f5f9',
          color: '#94a3b8',
          fontSize: 14,
        }}
      >
        No spatial model loaded
      </div>
    );
  }

  return (
    <Stage width={width} height={height}>
      <SpatialTwinLayerRooms
        rooms={model.spatial.rooms}
        selectedEntityId={selectedEntityId}
        hoveredEntityId={hoveredEntityId}
        onSelect={onSelectEntity}
        onHover={onHoverEntity}
      />
      <SpatialTwinLayerObjects
        emitters={model.spatial.emitters}
        heatSources={model.heatSources}
        stores={model.stores}
        rooms={model.spatial.rooms}
        selectedEntityId={selectedEntityId}
        onSelect={onSelectEntity}
      />
      <SpatialTwinLayerPipes
        pipeRuns={model.pipeRuns}
        selectedEntityId={selectedEntityId}
        onSelect={onSelectEntity}
      />
      <SpatialTwinLayerEvidence
        evidenceMarkers={model.evidenceMarkers}
        selectedEntityId={selectedEntityId}
        onSelect={onSelectEntity}
      />
      <SpatialTwinSelectionOverlay
        selectedEntityId={selectedEntityId}
        model={model}
      />
    </Stage>
  );
}

