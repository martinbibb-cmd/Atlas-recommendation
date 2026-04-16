
import { Layer, Line } from 'react-konva';
import type { SpatialPipeRunV1 } from '../state/spatialTwin.types';

interface SpatialTwinLayerPipesProps {
  pipeRuns: SpatialPipeRunV1[];
  selectedEntityId: string | null;
  onSelect: (entityId: string) => void;
}

export function SpatialTwinLayerPipes({
  pipeRuns,
  selectedEntityId,
  onSelect,
}: SpatialTwinLayerPipesProps) {
  return (
    <Layer>
      {pipeRuns.map((pipe) => {
        if (pipe.route.length < 2) return null;
        const points = pipe.route.flatMap((pt) => [pt.x, pt.y]);
        const isSelected = selectedEntityId === pipe.pipeRunId;
        return (
          <Line
            key={pipe.pipeRunId}
            points={points}
            stroke={isSelected ? '#1d4ed8' : '#64748b'}
            strokeWidth={isSelected ? 3 : 2}
            lineCap='round'
            lineJoin='round'
            onClick={() => { onSelect(pipe.pipeRunId); }}
          />
        );
      })}
    </Layer>
  );
}
