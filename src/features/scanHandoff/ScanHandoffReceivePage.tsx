/**
 * ScanHandoffReceivePage.tsx
 *
 * The Atlas Mind receive page for a typed ScanToMindHandoffV1 handoff.
 *
 * Shown when the engineer navigates to /receive-scan (path-based route).
 * Atlas Scan iOS constructs a ScanToMindHandoffV1 JSON payload and shares it
 * to Atlas Mind via deep-link or Web Share.  The payload arrives as:
 *
 *   - A URL query param:  ?payload=<URL-encoded JSON>
 *   - A shared JSON file: read from the scan file cache (IDB) with name
 *     "scan_handoff.json"
 *
 * This page:
 *   1. Reads the payload from the URL or IDB.
 *   2. Parses and validates it via receiveScanHandoff.
 *   3. On success: stores the capture and calls onVisitReady(visit).
 *   4. On failure: shows inline errors.
 *
 * Design rules
 * ────────────
 * - No engine calls — capture is stored raw; simulation happens elsewhere.
 * - No PDF/export changes.
 * - Uses inline styles consistent with the existing scan import pages.
 */

import { useState, useEffect } from 'react';
import { receiveScanHandoff } from './receiveScanHandoff';
import type { ReceiveScanHandoffResult } from './receiveScanHandoff';
import type { AtlasVisitV1 } from './contracts/AtlasVisitV1';
import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState =
  | { name: 'loading' }
  | { name: 'success'; result: ReceiveScanHandoffResult & { ok: true; visit: AtlasVisitV1; capture: SessionCaptureV2 } }
  | { name: 'error'; errors: string[]; warnings: string[] }
  | { name: 'empty' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Attempt to read a ScanToMindHandoffV1 payload from the URL query param
 * `?payload=<URL-encoded JSON>`.
 *
 * Returns the parsed object on success, or null when the param is absent or
 * the JSON is malformed.
 */
function readPayloadFromUrl(): unknown | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('payload');
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface ScanHandoffReceivePageProps {
  /**
   * Called when a valid handoff has been received and the capture stored.
   * The caller is responsible for navigating to the visit.
   */
  onVisitReady: (visit: AtlasVisitV1) => void;
  /** Called when the user cancels or dismisses the page. */
  onCancel: () => void;
}

const containerStyle: React.CSSProperties = {
  fontFamily: 'system-ui, sans-serif',
  maxWidth: 720,
  margin: '0 auto',
  padding: 24,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginBottom: 24,
};

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
};

export function ScanHandoffReceivePage({
  onVisitReady,
  onCancel,
}: ScanHandoffReceivePageProps) {
  const [state, setState] = useState<PageState>({ name: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Try URL param first (deep-link from iOS).
      const urlPayload = readPayloadFromUrl();

      if (urlPayload !== null) {
        const result = receiveScanHandoff(urlPayload);
        if (cancelled) return;
        if (result.ok && result.visit && result.capture) {
          setState({ name: 'success', result: result as ReceiveScanHandoffResult & { ok: true; visit: AtlasVisitV1; capture: SessionCaptureV2 } });
        } else {
          setState({ name: 'error', errors: result.errors, warnings: result.warnings });
        }
        return;
      }

      // Fallback: try to read a "scan_handoff.json" from the IDB file cache.
      try {
        const { getLatestScanFile, scanEntryToFile } = await import(
          '../../lib/storage/scanFileCache'
        );
        const entry = await getLatestScanFile();
        if (cancelled) return;

        if (!entry || !entry.name.endsWith('.json')) {
          setState({ name: 'empty' });
          return;
        }

        const file = scanEntryToFile(entry);
        const text = await file.text();
        const parsed: unknown = JSON.parse(text);

        if (cancelled) return;
        const result = receiveScanHandoff(parsed);

        if (result.ok && result.visit && result.capture) {
          setState({ name: 'success', result: result as ReceiveScanHandoffResult & { ok: true; visit: AtlasVisitV1; capture: SessionCaptureV2 } });
        } else {
          setState({ name: 'error', errors: result.errors, warnings: result.warnings });
        }
      } catch {
        if (!cancelled) setState({ name: 'empty' });
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  // ── Automatically navigate when valid visit is ready ─────────────────────
  useEffect(() => {
    if (state.name === 'success') {
      onVisitReady(state.result.visit);
    }
  // onVisitReady is a stable callback from the parent — intentionally excluded
  // from deps to avoid calling it twice on re-renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.name]);

  // ── Loading ──
  if (state.name === 'loading') {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Receiving scan handoff…</p>
      </div>
    );
  }

  // ── Empty (no payload found) ──
  if (state.name === 'empty') {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <button onClick={onCancel} style={{ fontSize: 13, padding: '4px 12px' }}>← Back</button>
          <h1 style={headingStyle}>Receive scan handoff</h1>
        </div>
        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '16px 20px' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#92400e' }}>
            No scan handoff was found. Share a visit capture from Atlas Scan to open it here.
          </p>
        </div>
        <div style={{ marginTop: 16, fontSize: 13, color: '#6b7280' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Expected format:</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>A <code>ScanToMindHandoffV1</code> JSON payload from Atlas Scan iOS</li>
            <li>Delivered via deep-link query param or Web Share</li>
          </ul>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (state.name === 'error') {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <button onClick={onCancel} style={{ fontSize: 13, padding: '4px 12px' }}>← Back</button>
          <h1 style={headingStyle}>Scan handoff failed</h1>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#b91c1c' }}>
            The received payload could not be validated:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#b91c1c' }}>
            {state.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
        {state.warnings.length > 0 && (
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#92400e' }}>
              {state.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
        <button
          onClick={onCancel}
          style={{ padding: '8px 20px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  // ── Success — briefly shown before onVisitReady navigates away ──
  const { visit, capture, warnings } = state.result;
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={headingStyle}>Scan received</h1>
      </div>
      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
        <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#166534' }}>
          Capture stored for visit
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#166534', fontFamily: 'monospace' }}>
          {visit.visitId}
        </p>
        {capture.property?.address && (
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#166534' }}>
            {capture.property.address}
          </p>
        )}
      </div>
      {warnings.length > 0 && (
        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#92400e' }}>Warnings:</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#92400e' }}>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
      <p style={{ fontSize: 13, color: '#6b7280' }}>Opening visit…</p>
    </div>
  );
}
