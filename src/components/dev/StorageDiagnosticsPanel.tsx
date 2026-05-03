/**
 * src/components/dev/StorageDiagnosticsPanel.tsx
 *
 * Developer-only storage diagnostics panel for Atlas Mind.
 *
 * Shows:
 *   - Active storage adapter (local / d1)
 *   - D1 requested flag (VITE_STORAGE_ADAPTER env var)
 *   - Per-collection item counts and error state
 *   - Per-collection export (download JSON) and import (upload JSON) controls
 *   - Per-collection clear (with confirmation prompt)
 *   - Copy local → active adapter section (disabled when D1 is not available in browser)
 *
 * NOT customer-facing.  Only accessible via the Dev Menu (?devmenu=1).
 *
 * Design rules
 * ────────────
 * - No auth, billing, or engine logic.
 * - No recommendation / simulator changes.
 * - Destructive operations require window.confirm before executing.
 */

import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { localAdapter } from '../../lib/storage/localStorageAdapter';
import type { StorageCollectionName } from '../../lib/storage/storageAdapter';
import {
  ALL_COLLECTIONS,
  gatherStorageDiagnostics,
  exportLocalCollection,
  importCollectionIntoAdapter,
  clearLocalCollection,
  copyLocalToAdapter,
  dryRunLocalToAdapter,
  type StorageDiagnosticsResult,
  type CollectionExport,
  type CollectionCopyResult,
} from '../../lib/storage/storageDiagnostics';
import { D1_ADAPTER_REQUESTED } from '../../lib/storage/adapterFactory';

// ─── Display constants ────────────────────────────────────────────────────────

const COLLECTION_LABELS: Record<StorageCollectionName, string> = {
  tenants: 'Tenants',
  brandProfiles: 'Brand profiles',
  visits: 'Visits',
  scanCaptures: 'Scan captures',
  visitManifests: 'Visit manifests',
  userProfiles: 'User profiles',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function StorageDiagnosticsPanel() {
  const [diagnostics, setDiagnostics] = useState<StorageDiagnosticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copyPreview, setCopyPreview] = useState<Record<StorageCollectionName, { itemCount: number }> | null>(null);
  const [copyResults, setCopyResults] = useState<Record<StorageCollectionName, CollectionCopyResult> | null>(null);
  const [copyRunning, setCopyRunning] = useState(false);
  const fileInputRefs = useRef<Partial<Record<StorageCollectionName, HTMLInputElement | null>>>({});

  function showStatus(msg: string) {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  }

  async function refresh() {
    setLoading(true);
    try {
      // In browser context the active adapter is always localAdapter (no D1 binding).
      const result = await gatherStorageDiagnostics(localAdapter);
      setDiagnostics(result);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // ── Export ────────────────────────────────────────────────────────────────

  function handleExport(collection: StorageCollectionName) {
    const payload = exportLocalCollection(collection);
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atlas-${collection}-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus(`✓ Exported ${collection} as JSON`);
  }

  // ── Import ────────────────────────────────────────────────────────────────

  function handleImportClick(collection: StorageCollectionName) {
    fileInputRefs.current[collection]?.click();
  }

  async function handleFileChange(
    collection: StorageCollectionName,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-imported
    e.target.value = '';

    let payload: CollectionExport;
    try {
      const text = await file.text();
      payload = JSON.parse(text) as CollectionExport;
    } catch {
      showStatus(`✗ Failed to parse JSON file`);
      return;
    }

    if (payload.schemaVersion !== 1 || payload.collection !== collection) {
      showStatus(
        `✗ File is not a valid export for collection "${collection}" (got "${payload.collection ?? 'unknown'}")`,
      );
      return;
    }

    const itemCount = Object.keys(payload.items ?? {}).length;
    if (
      !window.confirm(
        `Import ${itemCount} item(s) into "${collection}"?\n\n` +
          `Existing items with matching IDs will be overwritten.`,
      )
    ) {
      return;
    }

    const { imported, errors } = await importCollectionIntoAdapter(localAdapter, payload);
    await refresh();
    if (errors.length > 0) {
      showStatus(`✓ Imported ${imported} item(s) — ${errors.length} error(s): ${errors[0]}`);
    } else {
      showStatus(`✓ Imported ${imported} item(s) into "${collection}"`);
    }
  }

  // ── Clear ────────────────────────────────────────────────────────────────

  function handleClear(collection: StorageCollectionName) {
    const snapshot = diagnostics?.collections.find(c => c.collection === collection);
    const count = snapshot?.count ?? 0;
    if (
      !window.confirm(
        `Clear all ${count} item(s) from "${collection}"?\n\n` +
          `This cannot be undone. Export first if you need to keep a backup.`,
      )
    ) {
      return;
    }
    clearLocalCollection(collection);
    void refresh();
    showStatus(`✓ Cleared collection "${collection}"`);
  }

  // ── Copy local → adapter ─────────────────────────────────────────────────

  function handleDryRun() {
    // In browser D1 binding is unavailable — preview against localAdapter as a
    // placeholder.  The output reflects local item counts regardless.
    const preview = dryRunLocalToAdapter(localAdapter);
    setCopyPreview(preview);
    setCopyResults(null);
  }

  async function handleCopyToAdapter() {
    if (!copyPreview) return;
    const totalItems = Object.values(copyPreview).reduce((n, v) => n + v.itemCount, 0);
    if (
      !window.confirm(
        `Copy ${totalItems} item(s) from local storage into the active adapter?\n\n` +
          `Existing items with matching IDs will be overwritten.`,
      )
    ) {
      return;
    }
    setCopyRunning(true);
    try {
      // In browser the active adapter is always local; this writes the same
      // data back, which is idempotent.  When running in a Workers context
      // with a D1 binding, pass the D1 adapter here instead.
      const results = await copyLocalToAdapter(localAdapter);
      setCopyResults(results);
      await refresh();
      const totalCopied = Object.values(results).reduce((n, v) => n + v.copied, 0);
      showStatus(`✓ Copied ${totalCopied} item(s) into active adapter`);
    } finally {
      setCopyRunning(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={STYLES.panel}>
      {/* Header */}
      <div style={STYLES.sectionHeader}>
        <h2 style={STYLES.sectionTitle}>💾 Storage Diagnostics</h2>
        <span style={STYLES.devBadge}>DEV ONLY</span>
      </div>
      <p style={STYLES.hint}>
        Inspect the active storage adapter, view item counts, export/import collections, and clear
        individual collections. No customer-facing controls.
      </p>

      {statusMessage && <div style={STYLES.statusBanner}>{statusMessage}</div>}

      {/* Adapter status */}
      <div style={STYLES.card}>
        <div style={STYLES.cardHeader}>
          <span style={STYLES.cardTitle}>Adapter status</span>
          <button
            className="chip-btn"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>

        {diagnostics == null ? (
          <p style={STYLES.muted}>{loading ? 'Gathering diagnostics…' : 'No data yet.'}</p>
        ) : (
          <table style={STYLES.table}>
            <tbody>
              <DiagRow label="Active adapter" value={
                <AdapterBadge kind={diagnostics.activeAdapterKind} />
              } />
              <DiagRow label="D1 requested (env)" value={
                <span style={{ ...STYLES.badge, ...(D1_ADAPTER_REQUESTED ? STYLES.badgeWarn : STYLES.badgeMuted) }}>
                  {D1_ADAPTER_REQUESTED ? 'Yes — VITE_STORAGE_ADAPTER=d1' : 'No'}
                </span>
              } />
              <DiagRow label="D1 available in browser" value={
                <span style={{ ...STYLES.badge, ...STYLES.badgeMuted }}>
                  Not available (browser context)
                </span>
              } />
              <DiagRow label="Last error" value={
                diagnostics.lastError != null ? (
                  <span style={{ ...STYLES.badge, ...STYLES.badgeError }}>{diagnostics.lastError}</span>
                ) : (
                  <span style={{ ...STYLES.badge, ...STYLES.badgeOk }}>None</span>
                )
              } />
              <DiagRow label="Gathered at" value={
                <code style={STYLES.code}>{diagnostics.gatheredAt}</code>
              } />
            </tbody>
          </table>
        )}
      </div>

      {/* Collection table */}
      <div style={STYLES.card}>
        <div style={STYLES.cardHeader}>
          <span style={STYLES.cardTitle}>Collections</span>
        </div>

        <table style={STYLES.collectionTable}>
          <thead>
            <tr>
              <th style={STYLES.th}>Collection</th>
              <th style={{ ...STYLES.th, textAlign: 'right' }}>Items</th>
              <th style={STYLES.th}>Status</th>
              <th style={STYLES.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ALL_COLLECTIONS.map(col => {
              const snap = diagnostics?.collections.find(c => c.collection === col);
              return (
                <tr key={col} style={STYLES.tr}>
                  <td style={STYLES.td}>
                    <code style={STYLES.code}>{col}</code>
                    <span style={STYLES.colLabel}>{COLLECTION_LABELS[col]}</span>
                  </td>
                  <td style={{ ...STYLES.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {snap == null ? '—' : snap.count}
                  </td>
                  <td style={STYLES.td}>
                    {snap == null ? (
                      <span style={{ ...STYLES.badge, ...STYLES.badgeMuted }}>—</span>
                    ) : snap.error != null ? (
                      <span style={{ ...STYLES.badge, ...STYLES.badgeError }} title={snap.error}>Error</span>
                    ) : (
                      <span style={{ ...STYLES.badge, ...STYLES.badgeOk }}>OK</span>
                    )}
                  </td>
                  <td style={STYLES.td}>
                    <div style={STYLES.actionRow}>
                      <button
                        className="chip-btn"
                        onClick={() => handleExport(col)}
                        title={`Download ${col} as JSON`}
                      >
                        ↓ Export
                      </button>
                      <button
                        className="chip-btn"
                        onClick={() => handleImportClick(col)}
                        title={`Import JSON into ${col}`}
                      >
                        ↑ Import
                      </button>
                      <button
                        className="chip-btn chip-btn--danger"
                        onClick={() => handleClear(col)}
                        title={`Clear all items from ${col}`}
                        disabled={snap == null || snap.count === 0}
                      >
                        🗑 Clear
                      </button>
                      {/* Hidden file input for import */}
                      <input
                        ref={el => { fileInputRefs.current[col] = el; }}
                        type="file"
                        accept=".json,application/json"
                        style={{ display: 'none' }}
                        onChange={e => void handleFileChange(col, e)}
                        aria-label={`Import JSON for ${col}`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Copy local → active adapter */}
      <div style={STYLES.card}>
        <div style={STYLES.cardHeader}>
          <span style={STYLES.cardTitle}>Copy local → active adapter</span>
        </div>
        <p style={STYLES.hint}>
          Copies all local storage data into the active adapter. In browser context the
          active adapter is always <strong>local</strong> — this operation is idempotent
          and safe for testing. To copy into D1, deploy to a Workers environment with a
          D1 binding.
        </p>

        <div style={STYLES.copyActions}>
          <button
            className="chip-btn"
            onClick={handleDryRun}
            disabled={copyRunning}
          >
            🔍 Dry run (preview)
          </button>
          {copyPreview != null && (
            <button
              className="chip-btn chip-btn--warn"
              onClick={() => void handleCopyToAdapter()}
              disabled={copyRunning}
            >
              {copyRunning ? 'Copying…' : '⇒ Copy local → adapter'}
            </button>
          )}
        </div>

        {copyPreview != null && copyResults == null && (
          <div style={STYLES.previewBlock}>
            <p style={STYLES.previewTitle}>Dry run — items that would be copied:</p>
            <table style={STYLES.collectionTable}>
              <tbody>
                {ALL_COLLECTIONS.map(col => (
                  <tr key={col} style={STYLES.tr}>
                    <td style={STYLES.td}><code style={STYLES.code}>{col}</code></td>
                    <td style={{ ...STYLES.td, textAlign: 'right' }}>{copyPreview[col]?.itemCount ?? 0} item(s)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {copyResults != null && (
          <div style={STYLES.previewBlock}>
            <p style={STYLES.previewTitle}>Copy results:</p>
            <table style={STYLES.collectionTable}>
              <thead>
                <tr>
                  <th style={STYLES.th}>Collection</th>
                  <th style={{ ...STYLES.th, textAlign: 'right' }}>Copied</th>
                  <th style={STYLES.th}>Errors</th>
                </tr>
              </thead>
              <tbody>
                {ALL_COLLECTIONS.map(col => {
                  const r = copyResults[col];
                  return (
                    <tr key={col} style={STYLES.tr}>
                      <td style={STYLES.td}><code style={STYLES.code}>{col}</code></td>
                      <td style={{ ...STYLES.td, textAlign: 'right' }}>{r?.copied ?? 0}</td>
                      <td style={STYLES.td}>
                        {(r?.errors.length ?? 0) > 0 ? (
                          <span style={{ ...STYLES.badge, ...STYLES.badgeError }}>
                            {r.errors.length} error(s)
                          </span>
                        ) : (
                          <span style={{ ...STYLES.badge, ...STYLES.badgeOk }}>None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AdapterBadge({ kind }: { kind: 'local' | 'd1' }) {
  const isD1 = kind === 'd1';
  return (
    <span style={{ ...STYLES.badge, ...(isD1 ? STYLES.badgeD1 : STYLES.badgeLocal) }}>
      {isD1 ? 'D1 (Cloudflare)' : 'Local (browser)'}
    </span>
  );
}

function DiagRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td style={STYLES.diagLabel}>{label}</td>
      <td style={STYLES.diagValue}>{value}</td>
    </tr>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES: Record<string, CSSProperties> = {
  panel: {
    fontFamily: 'inherit',
    color: '#1e293b',
    maxWidth: 900,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.5rem',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#1e293b',
  },
  devBadge: {
    display: 'inline-block',
    background: '#7c3aed',
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    textTransform: 'uppercase',
  },
  hint: {
    color: '#64748b',
    fontSize: '0.875rem',
    margin: '0 0 1rem',
  },
  statusBanner: {
    background: '#dbeafe',
    border: '1px solid #93c5fd',
    borderRadius: '6px',
    padding: '0.6rem 1rem',
    marginBottom: '1rem',
    fontSize: '0.875rem',
    color: '#1e40af',
    fontWeight: 500,
  },
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '1.25rem',
    marginBottom: '1.25rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.75rem',
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: '#1e293b',
    flexGrow: 1,
  },
  table: {
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
    width: '100%',
  },
  collectionTable: {
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
    width: '100%',
  },
  th: {
    textAlign: 'left',
    fontWeight: 600,
    color: '#475569',
    fontSize: '0.8rem',
    padding: '0.4rem 0.75rem',
    borderBottom: '1px solid #e2e8f0',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '0.5rem 0.75rem',
    verticalAlign: 'middle',
  },
  diagLabel: {
    fontWeight: 600,
    color: '#475569',
    padding: '0.35rem 1rem 0.35rem 0',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    fontSize: '0.875rem',
  },
  diagValue: {
    padding: '0.35rem 0',
    color: '#1e293b',
    fontSize: '0.875rem',
    verticalAlign: 'middle',
  },
  colLabel: {
    color: '#94a3b8',
    fontSize: '0.78rem',
    marginLeft: '0.4rem',
  },
  actionRow: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
  },
  badge: {
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.78rem',
    fontWeight: 600,
    border: '1px solid currentColor',
  },
  badgeOk: { color: '#16a34a', background: '#f0fdf4' },
  badgeWarn: { color: '#d97706', background: '#fffbeb' },
  badgeError: { color: '#dc2626', background: '#fef2f2' },
  badgeMuted: { color: '#64748b', background: '#f8fafc' },
  badgeLocal: { color: '#2563eb', background: '#eff6ff' },
  badgeD1: { color: '#7c3aed', background: '#f5f3ff' },
  code: {
    fontFamily: 'monospace',
    fontSize: '0.82rem',
    background: '#f1f5f9',
    padding: '0.1rem 0.35rem',
    borderRadius: '3px',
    border: '1px solid #e2e8f0',
  },
  muted: {
    color: '#94a3b8',
    fontSize: '0.875rem',
    margin: 0,
  },
  copyActions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginBottom: '0.75rem',
  },
  previewBlock: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '0.75rem',
    marginTop: '0.75rem',
  },
  previewTitle: {
    margin: '0 0 0.5rem',
    fontWeight: 600,
    fontSize: '0.85rem',
    color: '#475569',
  },
};
