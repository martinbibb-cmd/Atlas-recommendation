/**
 * ScanPackageImportFlow.tsx
 *
 * Full multi-step Atlas Scan package import flow.
 *
 * Steps:
 *   1. File selection — user picks manifest.json, scan_bundle.json, and
 *      optional evidence files from the export package folder
 *   2. Pre-import review — shows manifest-derived summary and readiness verdict
 *   3. Confirm → import runs
 *   4. Import summary — post-import counts and warnings
 *
 * This component is NOT a dev harness — it is the production import entry
 * point.  It must not surface raw contract types to any component outside the
 * scanImport feature boundary.
 *
 * Gated by SCAN_IMPORT_ENABLED in App.tsx (same as ScanImportHarness).
 */

import { useState, useCallback, useRef } from 'react';
import {
  reviewScanPackage,
  confirmScanPackageImport,
  type ScanPackageReviewReady,
  type ScanPackageImportSuccess,
} from '../package/scanPackageImporter';
import ScanPackageReviewPanel from './ScanPackageReviewPanel';
import ScanImportSummary from './ScanImportSummary';
import type { CanonicalFloorPlanDraft } from '../importer/scanMapper';

// ─── Step types ───────────────────────────────────────────────────────────────

type Step =
  | { name: 'select' }
  | { name: 'reviewing'; reviewReady: ScanPackageReviewReady }
  | { name: 'confirming'; reviewReady: ScanPackageReviewReady }
  | { name: 'done'; importResult: ScanPackageImportSuccess }
  | { name: 'error'; errors: string[] };

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ScanPackageImportFlowProps {
  /** Called when the import completes successfully with the canonical draft. */
  onImported: (draft: CanonicalFloorPlanDraft) => void;
  /** Called when the user cancels at any step. */
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScanPackageImportFlow({
  onImported,
  onCancel,
}: ScanPackageImportFlowProps) {
  const [step, setStep] = useState<Step>({ name: 'select' });
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1: File selection ──
  const handleFilesSelected = useCallback(async (files: FileList) => {
    if (files.length === 0) return;
    setLoading(true);
    try {
      const result = await reviewScanPackage(files);
      if (result.status === 'failed') {
        setStep({ name: 'error', errors: result.errors });
      } else if (result.status === 'bundle_invalid') {
        setStep({ name: 'error', errors: result.errors });
      } else {
        setStep({ name: 'reviewing', reviewReady: result });
      }
    } catch (err) {
      setStep({
        name: 'error',
        errors: [err instanceof Error ? err.message : String(err)],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Step 3: Confirm import ──
  const handleConfirm = useCallback((reviewReady: ScanPackageReviewReady) => {
    setStep({ name: 'confirming', reviewReady });
    try {
      const result = confirmScanPackageImport(reviewReady);
      if (result.status === 'failed') {
        setStep({ name: 'error', errors: result.errors });
      } else {
        setStep({ name: 'done', importResult: result });
      }
    } catch (err) {
      setStep({
        name: 'error',
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }, []);

  // ── Step 4: Continue to floor plan ──
  const handleContinue = useCallback((importResult: ScanPackageImportSuccess) => {
    onImported(importResult.draft);
  }, [onImported]);

  // ─────────────────────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 680,
    margin: '0 auto',
    padding: 24,
  };

  if (step.name === 'select') {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={onCancel} style={{ fontSize: 13, padding: '4px 12px' }}>← Back</button>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>Import Atlas Scan package</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
              Select all files from your Atlas Scan export folder.
            </p>
          </div>
        </div>

        <div
          style={{
            border: '2px dashed #c7d2fe',
            borderRadius: 10,
            padding: '40px 24px',
            textAlign: 'center',
            background: '#eef2ff',
            marginBottom: 20,
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: 15, color: '#4338ca', fontWeight: 600 }}>
            Select your Atlas Scan package files
          </p>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
            Choose <code>manifest.json</code>, <code>scan_bundle.json</code>, and any evidence files
            from the export folder.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".json,.jpg,.jpeg,.png,.heic"
            style={{ display: 'none' }}
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesSelected(e.target.files);
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            style={{
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              background: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Reading package…' : 'Choose files'}
          </button>
        </div>

        <div style={{ fontSize: 13, color: '#6b7280' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Required files:</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li><code>manifest.json</code> — package manifest</li>
            <li><code>scan_bundle.json</code> — scan data</li>
          </ul>
          <p style={{ margin: '8px 0 6px', fontWeight: 600 }}>Optional files:</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Evidence photos (.jpg, .jpeg, .png, .heic)</li>
          </ul>
        </div>
      </div>
    );
  }

  if (step.name === 'reviewing') {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button
            onClick={() => setStep({ name: 'select' })}
            style={{ fontSize: 13, padding: '4px 12px' }}
          >
            ← Back
          </button>
          <h1 style={{ margin: 0, fontSize: 22 }}>Import Atlas Scan package</h1>
        </div>
        <ScanPackageReviewPanel
          review={step.reviewReady.review}
          onConfirm={() => handleConfirm(step.reviewReady)}
          onCancel={() => setStep({ name: 'select' })}
        />
      </div>
    );
  }

  if (step.name === 'confirming') {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Importing…</h1>
        </div>
        <ScanPackageReviewPanel
          review={step.reviewReady.review}
          onConfirm={() => {}}
          onCancel={() => {}}
          confirming
        />
      </div>
    );
  }

  if (step.name === 'done') {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Import Atlas Scan package</h1>
        </div>
        <ScanImportSummary
          summary={step.importResult.summary}
          warnings={step.importResult.warnings}
          onContinue={() => handleContinue(step.importResult)}
        />
      </div>
    );
  }

  if (step.name === 'error') {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={() => setStep({ name: 'select' })} style={{ fontSize: 13, padding: '4px 12px' }}>← Back</button>
          <h1 style={{ margin: 0, fontSize: 22 }}>Import failed</h1>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#b91c1c' }}>
            Could not import package
          </h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#7f1d1d' }}>
            {step.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
        <button
          onClick={() => setStep({ name: 'select' })}
          style={{ padding: '8px 20px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
        >
          Try again
        </button>
      </div>
    );
  }

  return null;
}
