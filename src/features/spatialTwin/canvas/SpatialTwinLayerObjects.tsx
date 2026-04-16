import React from 'react';
import { Layer, Circle, Text } from 'react-konva';
import type { AtlasEmitterV1 } from '../../atlasSpatial/atlasSpatialModel.types';
import type { SpatialHeatSourceV1, SpatialStoreV1 } from '../state/spatialTwin.types';

interface SpatialTwinLayerObjectsProps {
  emitters: AtlasEmitterV1[];
  heatSources: SpatialHeatSourceV1[];
  stores: SpatialStoreV1[];
  selectedEntityId: string | null;
  onSelect: (entityId: string) => void;
}

export function SpatialTwinLayerObjects({
  emitters,
  heatSources,
  stores,
  selectedEntityId,
  onSelect,
}: SpatialTwinLayerObjectsProps) {
  return (
    <Layer>
      {emitters.map((emitter, idx) => {
        const x = 20 + idx * 30;
        const y = 200;
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
        const x = 20 + idx * 40;
        const y = 240;
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
        const x = 20 + idx * 40;
        const y = 280;
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
