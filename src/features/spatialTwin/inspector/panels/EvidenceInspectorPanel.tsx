
import type { SpatialEvidenceMarkerV1 } from '../../state/spatialTwin.types';

interface EvidenceInspectorPanelProps {
  evidence: SpatialEvidenceMarkerV1;
}

export function EvidenceInspectorPanel({ evidence }: EvidenceInspectorPanelProps) {
  return (
    <div style={{ padding: '12px' }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Evidence</h4>
      <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>ID</td><td>{evidence.evidenceId}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Kind</td><td>{evidence.kind}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Label</td><td>{evidence.label}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Room</td><td>{evidence.roomId ?? '—'}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Entity</td><td>{evidence.entityId ?? '—'}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 8 }}>Source ref</td><td>{evidence.sourceRef ?? '—'}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
