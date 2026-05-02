/**
 * src/features/externalFiles/ExternalVisitManifestPanel.tsx
 *
 * Panel for viewing and editing an external visit file manifest.
 *
 * Displays:
 *   - Visit ID and tenant ID
 *   - Summary: total files, file kinds present, count by kind
 *   - File reference list with provider, file kind, access mode, expiresAt,
 *     open-link button (when URI is present), and remove button
 *
 * Actions:
 *   - Add file reference (opens ClientFileReferenceForm inline)
 *   - Save manifest
 *   - Delete manifest
 *
 * Design rules
 * ────────────
 * - Lists URI as an anchor link only — never proxies or fetches the file.
 * - Never displays file contents.
 * - Never stores uploaded blobs.
 * - No engine or recommendation logic.
 */

import { useState, useEffect } from 'react';
import {
  loadManifestForVisit,
  saveManifest,
  deleteManifestForVisit,
  upsertFileReference,
  removeFileReference,
} from './externalVisitManifestStore';
import { ClientFileReferenceForm } from './ClientFileReferenceForm';
import type { ExternalVisitManifestV1 } from '../../contracts/ExternalVisitManifestV1';
import type { ClientFileReferenceV1 } from '../../contracts/ClientFileReferenceV1';

// ─── Label maps ───────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  google_drive: 'Google Drive',
  onedrive: 'OneDrive',
  icloud: 'iCloud',
  local_device: 'Local device',
  other: 'Other',
};

const FILE_KIND_LABELS: Record<string, string> = {
  scan: 'Scan',
  photo: 'Photo',
  report: 'Report',
  floor_plan: 'Floor plan',
  transcript: 'Transcript',
  handoff: 'Handoff',
  other: 'Other',
};

const ACCESS_MODE_LABELS: Record<string, string> = {
  owner_controlled: 'Owner controlled',
  signed_link: 'Signed link',
  local_only: 'Local only',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ExternalVisitManifestPanelProps {
  visitId: string;
  tenantId: string;
  onClose?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExternalVisitManifestPanel({
  visitId,
  tenantId,
  onClose,
}: ExternalVisitManifestPanelProps) {
  const [manifest, setManifest] = useState<ExternalVisitManifestV1 | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'deleted'>('idle');

  // Load manifest on mount and whenever visitId changes.
  useEffect(() => {
    setManifest(loadManifestForVisit(visitId));
    setShowAddForm(false);
    setSaveStatus('idle');
  }, [visitId]);

  function handleAddReference(fileRef: ClientFileReferenceV1) {
    upsertFileReference(visitId, tenantId, fileRef);
    setManifest(loadManifestForVisit(visitId));
    setShowAddForm(false);
  }

  function handleRemoveReference(referenceId: string) {
    removeFileReference(visitId, referenceId);
    setManifest(loadManifestForVisit(visitId));
  }

  function handleSave() {
    if (!manifest) return;
    saveManifest(manifest);
    setManifest(loadManifestForVisit(visitId));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }

  function handleDelete() {
    if (!window.confirm('Delete this manifest and all file references? This cannot be undone.')) return;
    deleteManifestForVisit(visitId);
    setManifest(null);
    setSaveStatus('deleted');
  }

  // ── Shared styles ──────────────────────────────────────────────────────────

  const panelStyle: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '1.25rem',
    maxWidth: '640px',
    width: '100%',
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 0.5rem',
  };

  const metaStyle: React.CSSProperties = {
    fontSize: '0.78rem',
    color: '#6b7280',
    marginBottom: '0.25rem',
  };

  const sectionHeadStyle: React.CSSProperties = {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#374151',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    margin: '1rem 0 0.4rem',
  };

  const chipStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    fontSize: '0.72rem',
    fontWeight: 600,
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    marginRight: '0.3rem',
    marginBottom: '0.3rem',
  };

  const refRowStyle: React.CSSProperties = {
    borderTop: '1px solid #f3f4f6',
    paddingTop: '0.6rem',
    paddingBottom: '0.6rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  };

  const btnSecondaryStyle: React.CSSProperties = {
    padding: '0.35rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    background: '#fff',
    fontSize: '0.8rem',
    cursor: 'pointer',
  };

  const btnDangerStyle: React.CSSProperties = {
    ...btnSecondaryStyle,
    border: '1px solid #fca5a5',
    color: '#991b1b',
  };

  const btnPrimaryStyle: React.CSSProperties = {
    padding: '0.35rem 0.75rem',
    border: 'none',
    borderRadius: '4px',
    background: '#1d4ed8',
    color: '#fff',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontWeight: 600,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={panelStyle} data-testid="external-visit-manifest-panel">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2 style={headingStyle}>External files</h2>
        {onClose && (
          <button
            onClick={onClose}
            style={{ ...btnSecondaryStyle, padding: '0.2rem 0.5rem' }}
            aria-label="Close external files panel"
            data-testid="manifest-panel-close"
          >
            ✕
          </button>
        )}
      </div>

      <p style={metaStyle} data-testid="manifest-visit-id">Visit: {visitId}</p>
      <p style={metaStyle} data-testid="manifest-tenant-id">Tenant: {tenantId}</p>

      {/* Summary */}
      {manifest ? (
        <>
          <p style={sectionHeadStyle}>Summary</p>
          <p style={{ fontSize: '0.85rem', color: '#374151', margin: '0 0 0.3rem' }} data-testid="manifest-total-files">
            Total files: <strong>{manifest.summary.totalFiles}</strong>
          </p>
          {manifest.summary.fileKindsPresent.length > 0 && (
            <div data-testid="manifest-kinds-present">
              {manifest.summary.fileKindsPresent.map((kind) => (
                <span key={kind} style={chipStyle}>
                  {FILE_KIND_LABELS[kind] ?? kind}
                  {manifest.summary.countByKind[kind] != null
                    ? ` ×${manifest.summary.countByKind[kind]}`
                    : ''}
                </span>
              ))}
            </div>
          )}

          {/* File reference list */}
          <p style={sectionHeadStyle}>File references</p>
          {manifest.files.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: '#9ca3af' }} data-testid="manifest-empty-list">
              No file references yet.
            </p>
          ) : (
            <div data-testid="manifest-file-list">
              {manifest.files.map((ref) => (
                <div key={ref.referenceId} style={refRowStyle} data-testid={`manifest-file-row-${ref.referenceId}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#111827' }}>
                        {FILE_KIND_LABELS[ref.fileKind] ?? ref.fileKind}
                      </span>
                      {' · '}
                      <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        {PROVIDER_LABELS[ref.provider] ?? ref.provider}
                      </span>
                      {' · '}
                      <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        {ACCESS_MODE_LABELS[ref.accessMode] ?? ref.accessMode}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveReference(ref.referenceId)}
                      style={btnDangerStyle}
                      aria-label={`Remove file reference ${ref.referenceId}`}
                      data-testid={`manifest-remove-ref-${ref.referenceId}`}
                    >
                      Remove
                    </button>
                  </div>

                  {ref.expiresAt && (
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                      Expires: {new Date(ref.expiresAt).toLocaleString()}
                    </p>
                  )}

                  {/* Open link — anchor only, never fetched or proxied */}
                  {ref.uri && ref.accessMode !== 'local_only' && (
                    <a
                      href={ref.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.78rem', color: '#1d4ed8' }}
                      data-testid={`manifest-open-link-${ref.referenceId}`}
                    >
                      Open link ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0.75rem 0' }} data-testid="manifest-none">
          No manifest exists for this visit yet. Add a file reference to create one.
        </p>
      )}

      {/* Add file reference form */}
      {showAddForm ? (
        <ClientFileReferenceForm
          visitId={visitId}
          tenantId={tenantId}
          onSubmit={handleAddReference}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          style={{ ...btnPrimaryStyle, marginTop: '0.75rem' }}
          data-testid="manifest-add-ref-btn"
        >
          + Add file reference
        </button>
      )}

      {/* Action bar */}
      {manifest && !showAddForm && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' as const }}>
          <button
            onClick={handleSave}
            style={btnPrimaryStyle}
            data-testid="manifest-save-btn"
          >
            {saveStatus === 'saved' ? '✓ Saved' : 'Save manifest'}
          </button>
          <button
            onClick={handleDelete}
            style={btnDangerStyle}
            data-testid="manifest-delete-btn"
          >
            Delete manifest
          </button>
        </div>
      )}

      {saveStatus === 'deleted' && (
        <p
          style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '0.5rem' }}
          data-testid="manifest-deleted-msg"
          role="status"
        >
          Manifest deleted.
        </p>
      )}
    </div>
  );
}
