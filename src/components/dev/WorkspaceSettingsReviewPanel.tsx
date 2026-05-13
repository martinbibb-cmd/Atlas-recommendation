import type { CSSProperties } from 'react';
import type { WorkspaceSettingsChangeSetV1 } from '../../auth/workspaceSettings';

interface Props {
  readonly changeSet: WorkspaceSettingsChangeSetV1;
}

const CARD_STYLE: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  background: '#fff',
  padding: '0.85rem',
};

function downloadChangeSet(changeSet: WorkspaceSettingsChangeSetV1): void {
  const blob = new Blob([JSON.stringify(changeSet, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'workspace-settings-change-set.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function WorkspaceSettingsReviewPanel({ changeSet }: Props) {
  return (
    <section data-testid="workspace-settings-review-panel" style={CARD_STYLE}>
      <h2 style={{ margin: '0 0 0.65rem', fontSize: 16 }}>Save plan review</h2>

      <div style={{ marginBottom: '0.85rem' }}>
        <h3 style={{ margin: '0 0 0.35rem', fontSize: 13 }}>Pending changes ({changeSet.changes.length})</h3>
        {changeSet.changes.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No pending changes.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 12, color: '#334155' }}>
            {changeSet.changes.map((change, index) => (
              <li key={`${change.type}:${index}`} data-testid={`workspace-settings-change-${index}`}>
                {change.summary}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginBottom: '0.85rem' }}>
        <h3 style={{ margin: '0 0 0.35rem', fontSize: 13 }}>Warnings ({changeSet.warnings.length})</h3>
        {changeSet.warnings.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No warnings.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 12, color: '#b45309' }}>
            {changeSet.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginBottom: '0.85rem' }}>
        <h3 style={{ margin: '0 0 0.35rem', fontSize: 13 }}>Blockers ({changeSet.blockingReasons.length})</h3>
        {changeSet.blockingReasons.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No blocking reasons.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 12, color: '#b91c1c' }}>
            {changeSet.blockingReasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled
          data-testid="workspace-settings-apply-changes"
          style={{
            fontSize: 12,
            padding: '0.25rem 0.6rem',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: '#f1f5f9',
            color: '#94a3b8',
            cursor: 'not-allowed',
          }}
        >
          Apply changes (coming soon)
        </button>
        <button
          type="button"
          onClick={() => downloadChangeSet(changeSet)}
          data-testid="workspace-settings-export-change-set-json"
          style={{
            fontSize: 12,
            padding: '0.25rem 0.6rem',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
            color: '#334155',
            cursor: 'pointer',
          }}
        >
          Export change set JSON
        </button>
      </div>
    </section>
  );
}
