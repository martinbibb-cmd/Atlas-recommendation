
import type { SpatialStoreV1 } from '../../state/spatialTwin.types';

interface StoreInspectorPanelProps {
  store: SpatialStoreV1;
}

export function StoreInspectorPanel({ store }: StoreInspectorPanelProps) {
  return (
    <div style={{ padding: '12px' }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Hot Water Store</h4>
      <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>ID</td><td>{store.storeId}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Label</td><td>{store.label}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Type</td><td>{store.type}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Status</td><td>{store.status}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Certainty</td><td>{store.certainty}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Capacity</td><td>{store.capacityLitres != null ? `${store.capacityLitres} L` : '—'}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
