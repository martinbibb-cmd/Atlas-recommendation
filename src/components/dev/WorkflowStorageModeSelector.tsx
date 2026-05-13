/**
 * WorkflowStorageModeSelector.tsx
 *
 * Dev-only UI control for the implementation workflow storage mode.
 *
 * Renders three mode chips (Not saved / Local device / Google Drive workspace)
 * and provides save / load / export / import controls that call the active adapter.
 *
 * Architecture note:
 *   Atlas = composer + renderer + workflow brain.
 *   This panel surfaces the storage adapter boundary in the dev UI so it is
 *   visible and testable before any production storage is wired.
 *
 *   "Local device" is clearly labelled as browser-local.
 *   "Google Drive workspace" shows as not-yet-configured.
 *   "Not saved" (disabled adapter) is the zero-configuration default.
 */

import { useState } from 'react';
import type { WorkflowStorageTarget, WorkflowStorageAdapterV1 } from '../../storage/workflow';
import type {
  PersistedImplementationWorkflowV1,
  WorkflowExportPackageManifestV1,
  WorkflowExportPackageV1,
} from '../../storage/workflow';
import {
  LocalWorkflowStorageAdapter,
  GoogleDriveWorkflowStorageAdapterStub,
  DisabledWorkflowStorageAdapter,
  exportPackageAsJsonBlob,
} from '../../storage/workflow';
import { WorkspaceSessionGuard, useWorkspaceSession } from '../../auth/profile';

// ─── Adapters ─────────────────────────────────────────────────────────────────

const ADAPTERS: Readonly<Record<WorkflowStorageTarget, WorkflowStorageAdapterV1>> = {
  disabled: new DisabledWorkflowStorageAdapter(),
  local_only: new LocalWorkflowStorageAdapter(),
  google_drive: new GoogleDriveWorkflowStorageAdapterStub(),
};

const MODE_LABELS: Readonly<Record<WorkflowStorageTarget, string>> = {
  disabled: 'Not saved',
  local_only: 'Local device',
  google_drive: 'Google Drive workspace',
};

const MODE_DESCRIPTIONS: Readonly<Record<WorkflowStorageTarget, string>> = {
  disabled: 'Workflow state is session-only. Nothing is written to storage.',
  local_only: '🔵 Local to this browser/device. Data stays on this machine.',
  google_drive: '🔗 Google Drive workspace. Connection not yet configured.',
};

// ─── Status message ───────────────────────────────────────────────────────────

type StatusKind = 'idle' | 'success' | 'error' | 'busy';

interface StatusMessage {
  kind: StatusKind;
  text: string;
}

function StatusBanner({ status }: { status: StatusMessage }) {
  if (status.kind === 'idle') return null;
  const colors: Record<StatusKind, { background: string; color: string; border: string }> = {
    idle: { background: 'transparent', color: 'transparent', border: 'transparent' },
    busy: { background: '#f8fafc', color: '#334155', border: '#e2e8f0' },
    success: { background: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
    error: { background: '#fef2f2', color: '#991b1b', border: '#fecaca' },
  };
  const { background, color, border } = colors[status.kind];
  return (
    <div
      style={{
        marginTop: '0.5rem',
        padding: '0.35rem 0.6rem',
        borderRadius: 6,
        fontSize: 12,
        background,
        color,
        border: `1px solid ${border}`,
      }}
      data-testid="workflow-storage-status-banner"
    >
      {status.text}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /**
   * Current workflow state to save.  Built by the caller from resolutionSimulation,
   * scopePackStatuses, specLineStatuses, and materialsReviewState.
   */
  workflowState: PersistedImplementationWorkflowV1;
  /** Optional portable export package payload for workflow folder export. */
  workflowExportPackage?: WorkflowExportPackageV1;
  /**
   * Called when a successful load returns a persisted state so the parent can
   * merge it into the active review state.
   */
  onLoad?: (state: PersistedImplementationWorkflowV1) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkflowStorageModeSelector({ workflowState, workflowExportPackage, onLoad }: Props) {
  const workspaceSession = useWorkspaceSession();
  const [target, setTarget] = useState<WorkflowStorageTarget>('disabled');
  const [status, setStatus] = useState<StatusMessage>({ kind: 'idle', text: '' });
  const [savedList, setSavedList] = useState<readonly { visitReference: string; updatedAt: string; label: string }[]>([]);
  const [showList, setShowList] = useState(false);

  const adapter = ADAPTERS[target];
  const manifest = workflowExportPackage?.files['manifest.json'] as WorkflowExportPackageManifestV1 | undefined;
  const manifestOwnership = manifest?.ownership;

  async function handleSave() {
    setStatus({ kind: 'busy', text: 'Saving…' });
    const result = await adapter.saveWorkflowState(workflowState);
    if (result.ok) {
      setStatus({ kind: 'success', text: `Saved at ${new Date(result.savedAt).toLocaleTimeString()}.` });
    } else {
      setStatus({ kind: 'error', text: `Save failed: ${result.reason}` });
    }
  }

  async function handleLoad() {
    setStatus({ kind: 'busy', text: 'Loading…' });
    const result = await adapter.loadWorkflowState(workflowState.visitReference);
    if (result.ok) {
      onLoad?.(result.state);
      setStatus({ kind: 'success', text: 'Loaded — workflow state restored from storage.' });
    } else if (result.notFound) {
      setStatus({ kind: 'error', text: 'No saved workflow found for this visit reference.' });
    } else {
      setStatus({ kind: 'error', text: `Load failed: ${result.reason}` });
    }
  }

  async function handleExport() {
    setStatus({ kind: 'busy', text: 'Exporting…' });
    const result = await adapter.exportWorkflowState(workflowState.visitReference);
    if (result.ok) {
      const blob = new Blob([result.json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `atlas-workflow-${workflowState.visitReference}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ kind: 'success', text: 'Export downloaded.' });
    } else {
      setStatus({ kind: 'error', text: `Export failed: ${result.reason}` });
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus({ kind: 'busy', text: 'Importing…' });
    const text = await file.text();
    const result = await adapter.importWorkflowState(text);
    if (result.ok) {
      setStatus({ kind: 'success', text: `Imported and saved at ${new Date(result.savedAt).toLocaleTimeString()}.` });
      // Automatically load the imported state.
      const loadResult = await adapter.loadWorkflowState(workflowState.visitReference);
      if (loadResult.ok) {
        onLoad?.(loadResult.state);
      }
    } else {
      setStatus({ kind: 'error', text: `Import failed: ${result.reason}` });
    }
    // Reset so the same file can be re-imported if needed.
    e.target.value = '';
  }

  function handleExportWorkflowPackage() {
    if (!workflowExportPackage) {
      setStatus({ kind: 'error', text: 'Workflow package export is not available in this view.' });
      return;
    }
    if (workspaceSession.status === 'workspace_active' && workflowState.ownership === undefined) {
      setStatus({ kind: 'error', text: 'Ownership is required before exporting in an active workspace.' });
      return;
    }
    const blob = exportPackageAsJsonBlob(workflowExportPackage);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowExportPackage.folderName}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus({ kind: 'success', text: 'Workflow package downloaded.' });
  }

  async function handleShowList() {
    const list = await adapter.listWorkflowStates();
    setSavedList(list);
    setShowList(true);
  }

  function handleModeChange(next: WorkflowStorageTarget) {
    setTarget(next);
    setStatus({ kind: 'idle', text: '' });
    setShowList(false);
  }

  const isDisabled = target === 'disabled';
  const isGoogleDrive = target === 'google_drive';

  return (
    <section
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        padding: '0.75rem',
        background: '#fff',
      }}
      data-testid="workflow-storage-mode-selector"
    >
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
        Storage mode
      </h3>
      <WorkspaceSessionGuard showWorkspaceActiveState />
      {workspaceSession.status !== 'workspace_active' && (
        <p style={{ margin: '0 0 0.6rem', fontSize: 12, color: '#92400e' }}>
          Demo/session mode export — package will be labelled unowned.
        </p>
      )}
      {workflowExportPackage != null && (
        <p
          style={{ margin: '0 0 0.6rem', fontSize: 12, color: manifestOwnership ? '#166534' : '#92400e' }}
          data-testid="workflow-storage-ownership-state"
        >
          {manifestOwnership ? 'Owned export package' : 'Unowned export package'}
        </p>
      )}

      {/* ── Mode chips ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {(Object.keys(MODE_LABELS) as WorkflowStorageTarget[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleModeChange(t)}
            aria-pressed={target === t}
            data-testid={`workflow-storage-mode-${t}`}
            style={{
              borderRadius: 999,
              padding: '0.2rem 0.65rem',
              fontSize: 12,
              fontWeight: 600,
              border: '1.5px solid',
              cursor: 'pointer',
              background: target === t ? '#1e3a8a' : '#f8fafc',
              color: target === t ? '#fff' : '#334155',
              borderColor: target === t ? '#1e3a8a' : '#cbd5e1',
            }}
          >
            {MODE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ── Mode description ─────────────────────────────────────────────── */}
      <p style={{ margin: '0 0 0.6rem', fontSize: 12, color: '#64748b' }} data-testid="workflow-storage-mode-description">
        {MODE_DESCRIPTIONS[target]}
      </p>

      {/* ── Controls ────────────────────────────────────────────────────── */}
      {!isDisabled && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isGoogleDrive}
            data-testid="workflow-storage-save-btn"
            style={{
              fontSize: 12,
              padding: '0.25rem 0.6rem',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: isGoogleDrive ? '#f1f5f9' : '#1e3a8a',
              color: isGoogleDrive ? '#94a3b8' : '#fff',
              cursor: isGoogleDrive ? 'not-allowed' : 'pointer',
            }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleLoad}
            disabled={isGoogleDrive}
            data-testid="workflow-storage-load-btn"
            style={{
              fontSize: 12,
              padding: '0.25rem 0.6rem',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: isGoogleDrive ? '#94a3b8' : '#334155',
              cursor: isGoogleDrive ? 'not-allowed' : 'pointer',
            }}
          >
            Load
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isGoogleDrive}
            data-testid="workflow-storage-export-btn"
            style={{
              fontSize: 12,
              padding: '0.25rem 0.6rem',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: isGoogleDrive ? '#94a3b8' : '#334155',
              cursor: isGoogleDrive ? 'not-allowed' : 'pointer',
            }}
          >
            Export JSON
          </button>
          <label
            style={{
              fontSize: 12,
              padding: '0.25rem 0.6rem',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: isGoogleDrive ? '#94a3b8' : '#334155',
              cursor: isGoogleDrive ? 'not-allowed' : 'pointer',
            }}
            data-testid="workflow-storage-import-label"
          >
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
              disabled={isGoogleDrive}
              data-testid="workflow-storage-import-input"
            />
          </label>
          <button
            type="button"
            onClick={handleShowList}
            disabled={isGoogleDrive}
            data-testid="workflow-storage-list-btn"
            style={{
              fontSize: 12,
              padding: '0.25rem 0.6rem',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: isGoogleDrive ? '#94a3b8' : '#334155',
              cursor: isGoogleDrive ? 'not-allowed' : 'pointer',
            }}
          >
            List saved
          </button>
          <button
            type="button"
            onClick={handleExportWorkflowPackage}
            disabled={isGoogleDrive || workflowExportPackage == null}
            data-testid="workflow-storage-export-package-btn"
            style={{
              fontSize: 12,
              padding: '0.25rem 0.6rem',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: isGoogleDrive || workflowExportPackage == null ? '#94a3b8' : '#334155',
              cursor: isGoogleDrive || workflowExportPackage == null ? 'not-allowed' : 'pointer',
            }}
          >
            Export workflow package
          </button>
        </div>
      )}

      {/* ── Google Drive unavailable notice ─────────────────────────────── */}
      {isGoogleDrive && (
        <p
          style={{ margin: '0.5rem 0 0', fontSize: 12, color: '#92400e', fontStyle: 'italic' }}
          data-testid="workflow-storage-gdrive-notice"
        >
          Google Drive connection not configured. Controls are disabled until the adapter is wired.
        </p>
      )}

      {/* ── Status banner ────────────────────────────────────────────────── */}
      <StatusBanner status={status} />

      {/* ── Saved list ──────────────────────────────────────────────────── */}
      {showList && (
        <div style={{ marginTop: '0.5rem' }} data-testid="workflow-storage-saved-list">
          <p style={{ margin: '0 0 0.25rem', fontSize: 12, fontWeight: 700 }}>
            Saved workflows ({savedList.length}):
          </p>
          {savedList.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>None saved yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 12 }}>
              {savedList.map((entry) => (
                <li key={entry.visitReference}>
                  <code>{entry.visitReference}</code> — {entry.label} — {new Date(entry.updatedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
