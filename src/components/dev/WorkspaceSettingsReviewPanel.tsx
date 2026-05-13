import { useState, type CSSProperties } from 'react';
import type { AtlasWorkspaceV1 } from '../../auth/profile';
import type { WorkspaceJoinRequestV1 } from '../../auth/workspaceOnboarding';
import type { WorkspaceSettingsChangeSetV1 } from '../../auth/workspaceSettings';
import type { WorkspaceSettingsDraftV1 } from '../../auth/workspaceSettings/WorkspaceSettingsDraftV1';
import type {
  WorkspaceSettingsStorageAdapterV1,
  WorkspaceSettingsApplyResult,
} from '../../auth/workspaceSettings/storage/WorkspaceSettingsStorageAdapterV1';

interface Props {
  readonly changeSet: WorkspaceSettingsChangeSetV1;
  readonly storageAdapter: WorkspaceSettingsStorageAdapterV1;
  readonly draft: WorkspaceSettingsDraftV1;
  readonly currentWorkspace: AtlasWorkspaceV1;
  readonly currentJoinRequests: readonly WorkspaceJoinRequestV1[];
  readonly onLocalApplySuccess?: (
    result: Extract<WorkspaceSettingsApplyResult, { readonly ok: true }>,
  ) => Promise<void> | void;
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
  URL.revokeObjectURL(url);
}

export default function WorkspaceSettingsReviewPanel({
  changeSet,
  storageAdapter,
  draft,
  currentWorkspace,
  currentJoinRequests,
  onLocalApplySuccess,
}: Props) {
  const [applyResult, setApplyResult] = useState<WorkspaceSettingsApplyResult | null>(null);
  const [applying, setApplying] = useState(false);

  const canApplyLocally =
    changeSet.canCommit && storageAdapter.target === 'local_only' && !applying;

  async function handleApplyLocally() {
    if (!canApplyLocally) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const result = await storageAdapter.applyChangeSet(changeSet, {
        draft,
        currentWorkspace,
        currentJoinRequests,
      });
      setApplyResult(result);
      if (result.ok) {
        await onLocalApplySuccess?.(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setApplyResult({ ok: false, reason: `Unexpected error: ${message}` });
    } finally {
      setApplying(false);
    }
  }

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

      {applyResult !== null && (
        <div
          data-testid="workspace-settings-apply-result"
          style={{
            marginBottom: '0.85rem',
            padding: '0.6rem 0.75rem',
            borderRadius: 8,
            fontSize: 12,
            background: applyResult.ok ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${applyResult.ok ? '#bbf7d0' : '#fecaca'}`,
            color: applyResult.ok ? '#166534' : '#991b1b',
          }}
        >
          {applyResult.ok
            ? `Changes applied locally. Saved at: ${applyResult.savedAt}`
            : `Apply failed: ${applyResult.reason}`}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={!canApplyLocally}
          onClick={handleApplyLocally}
          data-testid="workspace-settings-apply-changes"
          style={{
            fontSize: 12,
            padding: '0.25rem 0.6rem',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: canApplyLocally ? '#f8fafc' : '#f1f5f9',
            color: canApplyLocally ? '#334155' : '#94a3b8',
            cursor: canApplyLocally ? 'pointer' : 'not-allowed',
          }}
        >
          {applying ? 'Applying…' : 'Apply changes locally'}
        </button>

        {storageAdapter.target === 'google_drive' && (
          <button
            type="button"
            disabled
            data-testid="workspace-settings-apply-google-drive"
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
            Apply via Google Drive (unavailable)
          </button>
        )}

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
