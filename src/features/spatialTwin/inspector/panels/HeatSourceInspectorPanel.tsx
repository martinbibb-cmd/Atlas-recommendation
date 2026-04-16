
import type { SpatialHeatSourceV1 } from '../../state/spatialTwin.types';

interface HeatSourceInspectorPanelProps {
  heatSource: SpatialHeatSourceV1;
}

export function HeatSourceInspectorPanel({ heatSource }: HeatSourceInspectorPanelProps) {
  return (
    <div style={{ padding: '12px' }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Heat Source</h4>
      <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>ID</td><td>{heatSource.heatSourceId}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Label</td><td>{heatSource.label}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Type</td><td>{heatSource.type}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Status</td><td>{heatSource.status}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Certainty</td><td>{heatSource.certainty}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Output</td><td>{heatSource.outputKw != null ? `${heatSource.outputKw} kW` : '—'}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Evidence</td><td>{heatSource.evidenceIds.length} item(s)</td></tr>
        </tbody>
      </table>
    </div>
  );
}
