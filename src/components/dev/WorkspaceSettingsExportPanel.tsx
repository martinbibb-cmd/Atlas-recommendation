import { useState, type CSSProperties, type ChangeEvent } from 'react';
import {
  buildWorkspaceSettingsExportPackage,
  exportWorkspaceSettingsPackageAsJsonBlob,
  importWorkspaceSettingsPackageFromJsonBlob,
  validateWorkspaceSettingsExportPackage,
  WORKSPACE_SETTINGS_EXPORT_REQUIRED_FILES,
  type WorkspaceSettingsExportPackageV1,
  type WorkspaceSettingsImportPreviewV1,
} from '../../auth/workspaceSettings/exportPackage';
import type {
  WorkspaceSettingsStorageAdapterV1,
  WorkspaceSettingsImportResult,
} from '../../auth/workspaceSettings/storage/WorkspaceSettingsStorageAdapterV1';

interface Props {
  readonly workspaceId: string;
  readonly storageAdapter: WorkspaceSettingsStorageAdapterV1;
  readonly canAdminConfirmWorkspaceReplacement: boolean;
  readonly googleDriveConnectorAvailable: boolean;
  readonly onImportApplied?: (
    result: Extract<WorkspaceSettingsImportResult, { readonly ok: true }>,
  ) => Promise<void> | void;
}

const CARD_STYLE: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  background: '#fff',
  padding: '0.85rem',
};

interface PackagePreviewState {
  readonly pkg: WorkspaceSettingsExportPackageV1;
  readonly preview: WorkspaceSettingsImportPreviewV1;
  readonly fileName: string;
}

function downloadPackage(pkg: WorkspaceSettingsExportPackageV1): void {
  const blob = exportWorkspaceSettingsPackageAsJsonBlob(pkg);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${pkg.folderName}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function WorkspaceSettingsExportPanel({
  workspaceId,
  storageAdapter,
  canAdminConfirmWorkspaceReplacement,
  googleDriveConnectorAvailable,
  onImportApplied,
}: Props) {
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<PackagePreviewState | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmWorkspaceReplacement, setConfirmWorkspaceReplacement] = useState(false);

  async function handleExportPackage() {
    setExportStatus(null);
    setIsExporting(true);
    try {
      const loaded = await storageAdapter.loadWorkspaceSettings(workspaceId);
      if (!loaded.ok) {
        setExportStatus(
          loaded.notFound
            ? `No locally applied settings found for workspace "${workspaceId}".`
            : `Export failed: ${loaded.reason}`,
        );
        return;
      }

      const pkg = buildWorkspaceSettingsExportPackage({
        persistedSettings: loaded.snapshot,
      });
      downloadPackage(pkg);
      setExportStatus(`Exported ${pkg.folderName}.json`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportStatus(`Export failed: ${message}`);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';

    setImportStatus(null);
    setConfirmWorkspaceReplacement(false);
    setPreviewState(null);

    if (!file) {
      return;
    }

    const result = await importWorkspaceSettingsPackageFromJsonBlob(file, {
      currentWorkspaceId: workspaceId,
      allowWorkspaceReplacement: false,
      googleDriveConnectorAvailable,
    });

    if (!result.ok) {
      setImportStatus(result.reason);
      return;
    }

    setPreviewState({
      pkg: result.pkg,
      preview: result.preview,
      fileName: file.name,
    });
  }

  async function handleApplyImportedPackage() {
    if (!previewState) return;

    setImportStatus(null);
    setIsImporting(true);

    try {
      const validated = validateWorkspaceSettingsExportPackage(previewState.pkg, {
        currentWorkspaceId: workspaceId,
        allowWorkspaceReplacement:
          previewState.preview.requiresWorkspaceReplacementConfirmation &&
          confirmWorkspaceReplacement &&
          canAdminConfirmWorkspaceReplacement,
        googleDriveConnectorAvailable,
      });

      if (!validated.ok) {
        setImportStatus(validated.reason);
        return;
      }

      if (validated.preview.blockingReasons.length > 0) {
        setImportStatus(`Import blocked: ${validated.preview.blockingReasons[0]}`);
        return;
      }

      const result = await storageAdapter.importWorkspaceSettings(
        JSON.stringify(validated.preview.persistedSettings),
      );

      if (!result.ok) {
        setImportStatus(`Import failed: ${result.reason}`);
        return;
      }

      setImportStatus('Imported package and applied settings locally.');
      await onImportApplied?.(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setImportStatus(`Import failed: ${message}`);
    } finally {
      setIsImporting(false);
    }
  }

  const replacementRequired = previewState?.preview.requiresWorkspaceReplacementConfirmation ?? false;
  const hasBlockers = (previewState?.preview.blockingReasons.length ?? 0) > 0;

  const canApplyImportedPackage =
    previewState !== null &&
    !hasBlockers &&
    (!replacementRequired || (confirmWorkspaceReplacement && canAdminConfirmWorkspaceReplacement)) &&
    !isImporting;

  return (
    <section data-testid="workspace-settings-export-panel" style={CARD_STYLE}>
      <h2 style={{ margin: '0 0 0.65rem', fontSize: 16 }}>Workspace settings package</h2>

      <p style={{ margin: '0 0 0.8rem', fontSize: 12, color: '#64748b' }}>
        Export locally applied settings as a portable package, then import and apply them on another device.
      </p>

      <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
        <button
          type="button"
          onClick={() => {
            void handleExportPackage();
          }}
          disabled={isExporting}
          data-testid="workspace-settings-export-package-btn"
          style={{
            fontSize: 12,
            padding: '0.25rem 0.6rem',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: isExporting ? '#f1f5f9' : '#f8fafc',
            color: isExporting ? '#94a3b8' : '#334155',
            cursor: isExporting ? 'not-allowed' : 'pointer',
          }}
        >
          {isExporting ? 'Exporting…' : 'Export workspace settings package'}
        </button>

        <label
          htmlFor="workspace-settings-import-package-input"
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
          Import workspace settings package
        </label>
        <input
          id="workspace-settings-import-package-input"
          data-testid="workspace-settings-import-package-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            void handleImportFileChange(event);
          }}
          style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
        />
      </div>

      {exportStatus !== null && (
        <div
          data-testid="workspace-settings-export-package-status"
          style={{
            marginBottom: '0.8rem',
            fontSize: 12,
            color: exportStatus.startsWith('Exported') ? '#166534' : '#991b1b',
          }}
        >
          {exportStatus}
        </div>
      )}

      {previewState !== null && (
        <div
          data-testid="workspace-settings-package-preview"
          style={{
            marginBottom: '0.85rem',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '0.65rem 0.75rem',
            background: '#f8fafc',
          }}
        >
          <h3 style={{ margin: '0 0 0.4rem', fontSize: 13 }}>Import preview</h3>
          <p style={{ margin: '0 0 0.45rem', fontSize: 12, color: '#475569' }}>
            File: {previewState.fileName}
          </p>
          <p style={{ margin: '0 0 0.45rem', fontSize: 12, color: '#475569' }}>
            Package workspace: {previewState.preview.persistedSettings.workspaceId}
          </p>
          <ul
            data-testid="workspace-settings-package-preview-files"
            style={{ margin: '0 0 0.45rem', paddingLeft: '1.1rem', fontSize: 12, color: '#334155' }}
          >
            {WORKSPACE_SETTINGS_EXPORT_REQUIRED_FILES.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>

          {previewState.preview.warnings.length > 0 && (
            <ul
              data-testid="workspace-settings-package-warnings"
              style={{ margin: '0 0 0.45rem', paddingLeft: '1.1rem', fontSize: 12, color: '#b45309' }}
            >
              {previewState.preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          {previewState.preview.blockingReasons.length > 0 && (
            <ul
              data-testid="workspace-settings-package-blockers"
              style={{ margin: '0 0 0.45rem', paddingLeft: '1.1rem', fontSize: 12, color: '#b91c1c' }}
            >
              {previewState.preview.blockingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}

          {replacementRequired && (
            <div style={{ fontSize: 12, color: '#991b1b' }}>
              {canAdminConfirmWorkspaceReplacement ? (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    data-testid="workspace-settings-package-confirm-replacement"
                    checked={confirmWorkspaceReplacement}
                    onChange={(event) => setConfirmWorkspaceReplacement(event.target.checked)}
                  />
                  Confirm replacement of local settings for a different workspace ID.
                </label>
              ) : (
                <span>Only an owner or admin can confirm replacement for mismatched workspace IDs.</span>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            void handleApplyImportedPackage();
          }}
          disabled={!canApplyImportedPackage}
          data-testid="workspace-settings-apply-import-package"
          style={{
            fontSize: 12,
            padding: '0.25rem 0.6rem',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: canApplyImportedPackage ? '#f8fafc' : '#f1f5f9',
            color: canApplyImportedPackage ? '#334155' : '#94a3b8',
            cursor: canApplyImportedPackage ? 'pointer' : 'not-allowed',
          }}
        >
          {isImporting ? 'Applying import…' : 'Apply imported package locally'}
        </button>

        {importStatus !== null && (
          <span
            data-testid="workspace-settings-import-package-result"
            style={{
              fontSize: 12,
              color: importStatus.startsWith('Imported') ? '#166534' : '#991b1b',
            }}
          >
            {importStatus}
          </span>
        )}
      </div>
    </section>
  );
}
