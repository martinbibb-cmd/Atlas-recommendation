
import type { SpatialPipeRunV1 } from '../../state/spatialTwin.types';

interface PipeRunInspectorPanelProps {
  pipeRun: SpatialPipeRunV1;
}

export function PipeRunInspectorPanel({ pipeRun }: PipeRunInspectorPanelProps) {
  return (
    <div style={{ padding: '12px' }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Pipe Run</h4>
      <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>ID</td><td>{pipeRun.pipeRunId}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Label</td><td>{pipeRun.label}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Status</td><td>{pipeRun.status}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Certainty</td><td>{pipeRun.certainty}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Diameter</td><td>{pipeRun.diameterMm != null ? `${pipeRun.diameterMm} mm` : '—'}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Points</td><td>{pipeRun.route.length}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
