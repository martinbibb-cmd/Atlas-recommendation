
import type { AtlasThermalZoneV1 } from '../../../atlasSpatial/atlasSpatialModel.types';

interface WallInspectorPanelProps {
  zone: AtlasThermalZoneV1;
}

export function WallInspectorPanel({ zone }: WallInspectorPanelProps) {
  return (
    <div style={{ padding: '12px' }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Zone / Wall</h4>
      <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Zone ID</td><td>{zone.zoneId}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Label</td><td>{zone.label}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Construction</td><td>{zone.wallConstruction ?? 'unknown'}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Floor area</td><td>{zone.floorAreaM2 != null ? `${zone.floorAreaM2} m²` : '—'}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
