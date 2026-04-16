import React from 'react';
import { selectSelectedEntity } from '../state/spatialTwin.selectors';
import type { SpatialTwinFeatureState } from '../state/spatialTwin.types';
import { RoomInspectorPanel } from './panels/RoomInspectorPanel';
import { EmitterInspectorPanel } from './panels/EmitterInspectorPanel';
import { HeatSourceInspectorPanel } from './panels/HeatSourceInspectorPanel';
import { StoreInspectorPanel } from './panels/StoreInspectorPanel';
import { PipeRunInspectorPanel } from './panels/PipeRunInspectorPanel';
import { EvidenceInspectorPanel } from './panels/EvidenceInspectorPanel';

interface SpatialTwinInspectorProps {
  state: SpatialTwinFeatureState;
  onDeselect: () => void;
}

export function SpatialTwinInspector({ state, onDeselect }: SpatialTwinInspectorProps) {
  const selected = selectSelectedEntity(state);

  if (selected == null) {
    return (
      <div style={{ padding: '16px', color: '#94a3b8', fontSize: 13 }}>
        Select an entity on the canvas to inspect it.
      </div>
    );
  }

  const header = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>
      <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>{selected.kind}</span>
      <button
        onClick={onDeselect}
        style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
      >
        ✕
      </button>
    </div>
  );

  let panel: React.ReactNode = null;

  switch (selected.kind) {
    case 'room':
      panel = <RoomInspectorPanel room={selected.entity} />;
      break;
    case 'emitter':
      panel = <EmitterInspectorPanel emitter={selected.entity} />;
      break;
    case 'heatSource':
      panel = <HeatSourceInspectorPanel heatSource={selected.entity} />;
      break;
    case 'store':
      panel = <StoreInspectorPanel store={selected.entity} />;
      break;
    case 'pipeRun':
      panel = <PipeRunInspectorPanel pipeRun={selected.entity} />;
      break;
    case 'evidence':
      panel = <EvidenceInspectorPanel evidence={selected.entity} />;
      break;
    default:
      panel = <div style={{ padding: 12, fontSize: 12 }}>Unknown entity type.</div>;
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      {header}
      {panel}
    </div>
  );
}
