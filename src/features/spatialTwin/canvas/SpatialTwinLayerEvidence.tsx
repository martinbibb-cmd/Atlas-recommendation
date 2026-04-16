import React from 'react';
import { Layer, Circle, Text } from 'react-konva';
import type { SpatialEvidenceMarkerV1 } from '../state/spatialTwin.types';

interface SpatialTwinLayerEvidenceProps {
  evidenceMarkers: SpatialEvidenceMarkerV1[];
  selectedEntityId: string | null;
  onSelect: (entityId: string) => void;
}

export function SpatialTwinLayerEvidence({
  evidenceMarkers,
  selectedEntityId,
  onSelect,
}: SpatialTwinLayerEvidenceProps) {
  return (
    <Layer>
      {evidenceMarkers.map((marker) => {
        if (marker.position == null) return null;
        const { x, y } = marker.position;
        const isSelected = selectedEntityId === marker.evidenceId;
        return (
          <React.Fragment key={marker.evidenceId}>
            <Circle
              x={x}
              y={y}
              radius={6}
              fill={isSelected ? '#7c3aed' : '#ddd6fe'}
              stroke={isSelected ? '#4c1d95' : '#7c3aed'}
              strokeWidth={1}
              onClick={() => { onSelect(marker.evidenceId); }}
            />
            <Text
              x={x + 8}
              y={y - 5}
              text={marker.kind === 'photo' ? '📷' : '📝'}
              fontSize={10}
              listening={false}
            />
          </React.Fragment>
        );
      })}
    </Layer>
  );
}
