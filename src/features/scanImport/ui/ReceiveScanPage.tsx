/**
 * ReceiveScanPage.tsx
 *
 * Shown when the app is opened via the Web Share Target API (?receive-scan=1).
 *
 * The service worker (public/sw.js) intercepts the POST to /receive-scan,
 * stores received file(s) in IndexedDB, then redirects to /?receive-scan=1.
 * This page reads the latest file from IDB and routes to:
 *
 *   - ScanPackageImportFlow   — for .json (Atlas Scan bundle packages)
 *   - PointCloudViewer        — for .ply (raw LiDAR point clouds)
 *   - An error / fallback UI  — for unsupported formats or empty IDB
 *
 * The "files=N" query param (written by sw.js) is used to show a count badge;
 * it is not security-critical (IDB is the source of truth).
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import {
  getLatestScanFile,
  clearScanFiles,
  scanEntryToFile,
  type ScanFileEntry,
} from '../../../lib/storage/scanFileCache';
import ScanPackageImportFlow from './ScanPackageImportFlow';
import type { CanonicalFloorPlanDraft } from '../importer/scanMapper';

// Lazy-load the heavy 3D viewer — only downloaded when a .ply file is received
const PointCloudViewer = lazy(
  () => import('../../lidarViewer/PointCloudViewer'),
);

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewState =
  | { name: 'loading' }
  | { name: 'empty' }
  | { name: 'json_import'; file: ScanFileEntry }
  | { name: 'ply_viewer'; file: ScanFileEntry; positions: Float32Array; vertexCount: number }
  | { name: 'processing_ply'; file: ScanFileEntry }
  | { name: 'unsupported'; file: ScanFileEntry }
  | { name: 'error'; message: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function buildFileList(file: ScanFileEntry): FileList {
  const f = scanEntryToFile(file);
  const dt = new DataTransfer();
  dt.items.add(f);
  return dt.files;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ReceiveScanPageProps {
  onImported: (draft: CanonicalFloorPlanDraft) => void;
  onCancel: () => void;
}

export default function ReceiveScanPage({ onImported, onCancel }: ReceiveScanPageProps) {
  const [state, setState] = useState<ViewState>({ name: 'loading' });

  // ── Hydrate from IndexedDB on mount ──
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const entry = await getLatestScanFile();
        if (cancelled) return;

        if (!entry) {
          setState({ name: 'empty' });
          return;
        }

        const ext = getFileExtension(entry.name);

        if (ext === 'json') {
          setState({ name: 'json_import', file: entry });
          return;
        }

        if (ext === 'ply') {
          setState({ name: 'processing_ply', file: entry });
          // Offload PLY parsing to the Web Worker
          const worker = new Worker(
            new URL('../../../workers/scanProcessWorker.ts', import.meta.url),
            { type: 'module' },
          );
          // Clone the buffer so entry.data remains valid (retries re-read from
          // IDB, but keeping entry.data intact avoids a second IDB round-trip
          // in error-recovery scenarios).
          const transferBuffer = entry.data.slice(0);
          worker.postMessage({ type: 'parse_ply', buffer: transferBuffer }, [transferBuffer]);
          worker.onmessage = (e: MessageEvent) => {
            worker.terminate();
            if (cancelled) return;
            const msg = e.data as { type: string; positions?: Float32Array; vertexCount?: number; message?: string };
            if (msg.type === 'ply_result' && msg.positions && msg.vertexCount != null) {
              setState({ name: 'ply_viewer', file: entry, positions: msg.positions, vertexCount: msg.vertexCount });
            } else {
              setState({ name: 'error', message: msg.message ?? 'PLY parsing failed' });
            }
          };
          worker.onerror = (e) => {
            worker.terminate();
            if (!cancelled) setState({ name: 'error', message: e.message });
          };
          return;
        }

        setState({ name: 'unsupported', file: entry });
      } catch (err) {
        if (!cancelled) {
          setState({ name: 'error', message: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const containerStyle: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 720,
    margin: '0 auto',
    padding: 24,
  };

  const handleDone = () => {
    void clearScanFiles();
    onCancel();
  };

  // ── Loading ──
  if (state.name === 'loading') {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Reading received scan file…</p>
      </div>
    );
  }

  // ── Empty (no file in IDB) ──
  if (state.name === 'empty') {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={onCancel} style={{ fontSize: 13, padding: '4px 12px' }}>← Back</button>
          <h1 style={{ margin: 0, fontSize: 22 }}>Receive scan</h1>
        </div>
        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '16px 20px' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#92400e' }}>
            No scan file was received. Share a scan file from your scanning app to import it into Atlas.
          </p>
        </div>
        <div style={{ marginTop: 16, fontSize: 13, color: '#6b7280' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Supported formats:</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li><code>.json</code> — Atlas Scan package bundle</li>
            <li><code>.ply</code> — LiDAR point cloud (binary or ASCII)</li>
          </ul>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (state.name === 'error') {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={onCancel} style={{ fontSize: 13, padding: '4px 12px' }}>← Back</button>
          <h1 style={{ margin: 0, fontSize: 22 }}>Scan receive failed</h1>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '16px 20px' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#b91c1c' }}>{state.message}</p>
        </div>
        <button
          onClick={handleDone}
          style={{ marginTop: 16, padding: '8px 20px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  // ── Unsupported format ──
  if (state.name === 'unsupported') {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={onCancel} style={{ fontSize: 13, padding: '4px 12px' }}>← Back</button>
          <h1 style={{ margin: 0, fontSize: 22 }}>Unsupported file format</h1>
        </div>
        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '16px 20px' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#92400e' }}>
            <strong>{state.file.name}</strong> is not a supported format.
            Atlas supports <code>.json</code> (Atlas Scan bundles) and <code>.ply</code> (LiDAR point clouds).
          </p>
        </div>
        <button
          onClick={handleDone}
          style={{ marginTop: 16, padding: '8px 20px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  // ── Processing PLY ──
  if (state.name === 'processing_ply') {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#6b7280', fontSize: 14 }}>
          Parsing point cloud <strong>{state.file.name}</strong>…
        </p>
      </div>
    );
  }

  // ── PLY viewer ──
  if (state.name === 'ply_viewer') {
    return (
      <div style={{ ...containerStyle, maxWidth: '100%', padding: 0, height: '100dvh', display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#1a1a2e', color: '#e5e7eb' }}>
          <button
            onClick={handleDone}
            style={{ fontSize: 13, padding: '4px 12px', background: 'rgba(255,255,255,0.1)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, cursor: 'pointer' }}
          >
            ← Done
          </button>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{state.file.name}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
            Drag to orbit · Scroll to zoom · Two-finger pan
          </span>
        </div>
        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <Suspense fallback={<p style={{ padding: 24, color: '#9ca3af' }}>Loading 3D viewer…</p>}>
            <PointCloudViewer
              positions={state.positions}
              vertexCount={state.vertexCount}
              height="100%"
            />
          </Suspense>
        </div>
      </div>
    );
  }

  // ── JSON import — delegate to existing ScanPackageImportFlow ──
  // state.name === 'json_import'
  const jsonFile = state.file;
  return (
    <ScanPackageImportFlow
      onImported={(draft) => {
        void clearScanFiles();
        onImported(draft);
      }}
      onCancel={() => {
        void clearScanFiles();
        onCancel();
      }}
      // Inject the received file as a synthetic FileList so the import flow
      // doesn't show the file-picker step.
      preloadedFiles={buildFileList(jsonFile)}
    />
  );
}
