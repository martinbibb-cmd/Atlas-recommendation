
import type { SpatialTwinModelV1 } from '../state/spatialTwin.types';
import { buildSpatialTwinCompareSummary } from './buildSpatialTwinCompareSummary';

interface SpatialTwinComparePanelProps {
  model: SpatialTwinModelV1 | null;
}

export function SpatialTwinComparePanel({ model }: SpatialTwinComparePanelProps) {
  if (model == null) {
    return (
      <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>
        No model loaded — nothing to compare.
      </div>
    );
  }

  const summary = buildSpatialTwinCompareSummary(model);

  return (
    <div style={{ padding: 16, fontSize: 13 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Compare: Current vs Proposed</h3>

      <p style={{ margin: '0 0 4px', fontWeight: 600 }}>
        Total changes: {summary.totalChanges}
      </p>

      {summary.addedEntities.length > 0 && (
        <section style={{ marginBottom: 12 }}>
          <h4 style={{ margin: '8px 0 4px', fontSize: 12, color: '#16a34a' }}>Added ({summary.addedEntities.length})</h4>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {summary.addedEntities.map((e, i) => (
              <li key={i}><span style={{ color: '#64748b' }}>{e.kind}</span> — {e.label}</li>
            ))}
          </ul>
        </section>
      )}

      {summary.removedEntities.length > 0 && (
        <section style={{ marginBottom: 12 }}>
          <h4 style={{ margin: '8px 0 4px', fontSize: 12, color: '#dc2626' }}>Removed ({summary.removedEntities.length})</h4>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {summary.removedEntities.map((e, i) => (
              <li key={i}><span style={{ color: '#64748b' }}>{e.kind}</span> — {e.label}</li>
            ))}
          </ul>
        </section>
      )}

      {summary.changedEntities.length > 0 && (
        <section style={{ marginBottom: 12 }}>
          <h4 style={{ margin: '8px 0 4px', fontSize: 12, color: '#d97706' }}>Changed ({summary.changedEntities.length})</h4>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {summary.changedEntities.map((e, i) => (
              <li key={i}><span style={{ color: '#64748b' }}>{e.kind}</span> — {e.label}: {e.change}</li>
            ))}
          </ul>
        </section>
      )}

      {summary.totalChanges === 0 && (
        <p style={{ color: '#94a3b8', margin: 0 }}>No differences detected between current and proposed states.</p>
      )}
    </div>
  );
}
