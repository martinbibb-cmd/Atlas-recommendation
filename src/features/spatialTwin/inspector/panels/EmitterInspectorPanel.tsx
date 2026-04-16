
import type { AtlasEmitterV1 } from '../../../atlasSpatial/atlasSpatialModel.types';

interface EmitterInspectorPanelProps {
  emitter: AtlasEmitterV1;
}

export function EmitterInspectorPanel({ emitter }: EmitterInspectorPanelProps) {
  return (
    <div style={{ padding: '12px' }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Emitter</h4>
      <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>ID</td><td>{emitter.emitterId}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Type</td><td>{emitter.type}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Room</td><td>{emitter.roomId}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Output @ΔT50</td><td>{emitter.outputWattsAtDt50 != null ? `${emitter.outputWattsAtDt50} W` : '—'}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Output @Design</td><td>{emitter.outputWattsAtDesign != null ? `${emitter.outputWattsAtDesign} W` : '—'}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
