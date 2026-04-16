
import type { AtlasRoomV1 } from '../../../atlasSpatial/atlasSpatialModel.types';

interface RoomInspectorPanelProps {
  room: AtlasRoomV1;
}

export function RoomInspectorPanel({ room }: RoomInspectorPanelProps) {
  return (
    <div style={{ padding: '12px' }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Room</h4>
      <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>ID</td><td>{room.roomId}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Label</td><td>{room.label}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Type</td><td>{room.roomType}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Status</td><td>{room.status}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Zones</td><td>{room.zoneIds.length}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
