/**
 * WorkspaceHomePage.tsx
 *
 * The "front door" for the Visit Workspace system.
 *
 * Route: /workspace
 * Title: Visit Workspaces
 *
 * Sections:
 *   - Import Atlas Visit Package — accepts .atlasvisit packages (primary flow)
 *   - Recent Workspaces list with storage / status badges
 *   - Advanced import — legacy JSON file upload (hidden by default)
 *
 * Architecture rules:
 *   - Does NOT write to the remote D1 database.
 *   - All reads/writes go through VisitWorkspaceStore (IndexedDB only).
 *   - Import is local-only; no fetch() calls to /api/* are made.
 *   - After a successful package import, navigates to /workspace/:id?review=1
 *     so the detail page opens directly into evidence review.
 */

import { useState, useEffect, useRef } from 'react';
import type { WorkspaceSummary } from '../../lib/visitWorkspace/VisitWorkspaceV1';
import { visitWorkspaceStore } from '../../lib/visitWorkspace/VisitWorkspaceStore';
import { validateSessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import { readAtlasVisitPackage } from '../../lib/atlasVisit/atlasVisitPackageReader';

// ─── Status / storage badge helpers ──────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  needs_review:     '⚠ Needs review',
  ready_for_report: '✓ Ready for report',
  published:        '✅ Published',
};

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  needs_review:     { bg: '#fffbeb', color: '#a16207', border: '#fcd34d' },
  ready_for_report: { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
  published:        { bg: '#eff6ff', color: '#1e40af', border: '#93c5fd' },
};

const STORAGE_LABELS: Record<string, string> = {
  local: '💾 Local only',
  drive: '☁️ Drive saved',
};

const STORAGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  local: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
  drive: { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function safeParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ─── Badge component ──────────────────────────────────────────────────────────

function Badge({ label, style }: { label: string; style: { bg: string; color: string; border: string } }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 12,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WorkspaceHomePageProps {
  /**
   * Called when a workspace is ready to be opened.
   *
   * `openReview` — when true the workspace detail page should immediately
   * open the evidence review screen (set after a fresh .atlasvisit import).
   */
  onOpenWorkspace: (id: string, openReview?: boolean) => void;
  onBack: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkspaceHomePage({
  onOpenWorkspace,
  onBack,
}: WorkspaceHomePageProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  /** Whether the legacy JSON import section is expanded. */
  const [showLegacyImport, setShowLegacyImport] = useState(false);
  const packageInputRef = useRef<HTMLInputElement>(null);
  const legacyFileInputRef = useRef<HTMLInputElement>(null);

  // ── Load recent workspaces ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    visitWorkspaceStore.listSummaries().then((list) => {
      if (!cancelled) {
        setWorkspaces(list);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // ── .atlasvisit package import ─────────────────────────────────────────────
  function handlePackageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    importPackageFile(file);
    e.target.value = '';
  }

  function importPackageFile(file: File) {
    setImportError(null);
    setImporting(true);

    readAtlasVisitPackage(file)
      .then((result) => {
        if (!result.ok) {
          setImportError(
            `Package import failed: ${result.errors.slice(0, 3).join('; ')}`,
          );
          return;
        }

        return visitWorkspaceStore
          .importFromPackage(
            result.sessionCapture,
            result.meta,
            result.reviewDecisions,
          )
          .then((newId) => {
            // Navigate to workspace detail and auto-open evidence review.
            onOpenWorkspace(newId, true);
          });
      })
      .catch((err: unknown) => {
        setImportError(
          `Package import failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      })
      .finally(() => {
        setImporting(false);
      });
  }

  // ── Drag-and-drop for .atlasvisit packages ────────────────────────────────
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) importPackageFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  // ── Legacy JSON import (advanced / hidden by default) ─────────────────────
  function handleLegacyFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    importLegacyFile(file);
    e.target.value = '';
  }

  function importLegacyFile(file: File) {
    setImportError(null);
    setImporting(true);

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const json = safeParseJson(text);

      if (json === null) {
        setImportError('The selected file is not valid JSON.');
        setImporting(false);
        return;
      }

      const captureJson = extractCapture(json);
      const result = validateSessionCaptureV2(captureJson);
      if (!result.ok) {
        setImportError(
          `Invalid session capture (${result.errors.length} error${result.errors.length !== 1 ? 's' : ''}): ${result.errors.slice(0, 3).join('; ')}`,
        );
        setImporting(false);
        return;
      }

      visitWorkspaceStore.importCapture(result.session).then((newId) => {
        setImporting(false);
        onOpenWorkspace(newId);
      }).catch((err) => {
        setImportError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
        setImporting(false);
      });
    };

    reader.onerror = () => {
      setImportError(`Could not read file: ${file.name}`);
      setImporting(false);
    };

    reader.readAsText(file);
  }

  /**
   * Support two file shapes:
   *  1. Bare SessionCaptureV2 JSON (produced by Atlas Scan iOS)
   *  2. workspace.json wrapper: { sessionCapture: SessionCaptureV2, … }
   */
  function extractCapture(json: unknown): unknown {
    if (
      typeof json === 'object' &&
      json !== null &&
      !Array.isArray(json) &&
      'sessionCapture' in json
    ) {
      return (json as Record<string, unknown>)['sessionCapture'];
    }
    return json;
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const pageStyle: React.CSSProperties = {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    minHeight: '100vh',
    background: '#f8fafc',
    color: '#0f172a',
  };

  const headerStyle: React.CSSProperties = {
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  };

  const bodyStyle: React.CSSProperties = {
    maxWidth: 640,
    margin: '0 auto',
    padding: '24px 20px',
  };

  const importZoneStyle: React.CSSProperties = {
    border: '2px dashed #c7d2fe',
    borderRadius: 12,
    background: '#eef2ff',
    padding: '32px 24px',
    textAlign: 'center',
    marginBottom: 32,
    cursor: 'pointer',
  };

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <button
          onClick={onBack}
          style={{ fontSize: 13, padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
        >
          ← Back
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Visit Workspaces</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Local / Drive — not published to Atlas
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={bodyStyle}>

        {/* Primary import zone — .atlasvisit package */}
        <section
          aria-label="Import Atlas Visit Package"
          style={importZoneStyle}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => !importing && packageInputRef.current?.click()}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
          <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#3730a3' }}>
            Import Atlas Visit Package
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#4338ca' }}>
            Accepts <code>.atlasvisit</code> packages
            <br />Drop a file here or click to browse
          </p>
          <button
            disabled={importing}
            style={{
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: 600,
              background: importing ? '#a5b4fc' : '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: importing ? 'default' : 'pointer',
            }}
          >
            {importing ? 'Importing…' : 'Choose package'}
          </button>
          <input
            ref={packageInputRef}
            type="file"
            accept=".atlasvisit,.zip"
            style={{ display: 'none' }}
            onChange={handlePackageFileChange}
            aria-label="Import Atlas Visit package file"
          />
        </section>

        {/* Import error */}
        {importError && (
          <div
            role="alert"
            style={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 20,
              fontSize: 13,
              color: '#b91c1c',
            }}
          >
            <strong>Import error: </strong>{importError}
          </div>
        )}

        {/* Advanced / legacy JSON import (hidden by default) */}
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setShowLegacyImport((v) => !v)}
            aria-expanded={showLegacyImport}
            aria-controls="legacy-import-panel"
            style={{
              fontSize: 12,
              color: '#64748b',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 0',
              textDecoration: 'underline',
            }}
          >
            {showLegacyImport ? 'Hide advanced' : 'Advanced'}: import JSON file directly
          </button>
          {showLegacyImport && (
            <div
              id="legacy-import-panel"
              style={{
                marginTop: 10,
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                background: '#fff',
                padding: '16px 20px',
              }}
            >
              <p style={{ margin: '0 0 10px', fontSize: 13, color: '#374151' }}>
                Import a bare <code>session_capture_v2.json</code> or{' '}
                <code>workspace.json</code> file directly.
              </p>
              <label style={{ fontSize: 13, cursor: 'pointer' }}>
                <input
                  ref={legacyFileInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleLegacyFileChange}
                  aria-label="Import session capture JSON file"
                  disabled={importing}
                />
                <button
                  disabled={importing}
                  onClick={(e) => {
                    e.stopPropagation();
                    legacyFileInputRef.current?.click();
                  }}
                  style={{
                    padding: '6px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: importing ? '#e2e8f0' : '#f1f5f9',
                    color: importing ? '#94a3b8' : '#374151',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    cursor: importing ? 'default' : 'pointer',
                  }}
                >
                  Choose JSON file
                </button>
              </label>
            </div>
          )}
        </div>

        {/* Recent workspaces */}
        <section aria-label="Recent Workspaces">
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#374151' }}>
            Recent Workspaces
          </h2>

          {loading && (
            <p style={{ color: '#6b7280', fontSize: 14 }}>Loading…</p>
          )}

          {!loading && workspaces.length === 0 && (
            <div
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '24px',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: 14,
              }}
            >
              No workspaces yet. Import an Atlas Visit Package to get started.
            </div>
          )}

          {!loading && workspaces.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {workspaces.map((ws) => (
                <li key={ws.id}>
                  <button
                    onClick={() => onOpenWorkspace(ws.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '14px 16px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {/* Reference + date */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
                          {ws.visitReference}
                        </div>
                        {ws.property?.address && (
                          <div style={{ fontSize: 12, color: '#64748b' }}>{ws.property.address}</div>
                        )}
                        {ws.property?.postcode && (
                          <div style={{ fontSize: 12, color: '#64748b' }}>{ws.property.postcode}</div>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: 8 }}>
                        {formatDate(ws.importedAt)}
                      </div>
                    </div>

                    {/* Evidence counts */}
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                      {ws.roomCount} room{ws.roomCount !== 1 ? 's' : ''} · {ws.photoCount} photo{ws.photoCount !== 1 ? 's' : ''}
                    </div>

                    {/* Badges */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge
                        label={STATUS_LABELS[ws.status] ?? ws.status}
                        style={STATUS_COLORS[ws.status] ?? { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' }}
                      />
                      <Badge
                        label={STORAGE_LABELS[ws.storageType] ?? ws.storageType}
                        style={STORAGE_COLORS[ws.storageType] ?? { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
