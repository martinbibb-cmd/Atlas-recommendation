/**
 * SessionCaptureImportFlow.tsx
 *
 * Full import flow for a SessionCaptureV1 payload.
 *
 * Steps:
 *   1. Parse and validate the JSON (auto-triggered when `preloadedFile` is set)
 *   2. Pre-import review — shows what was captured, what is missing, readiness
 *   3. Confirm → create DB record, upload photos to R2, store transcript
 *   4. Import complete — summary of what was stored
 *
 * This is the primary import surface for captures arriving from Atlas Scan iOS.
 * It must not surface raw SessionCaptureV1 types to any component outside the
 * scanImport feature boundary.
 *
 * Architecture rules:
 *   - Raw capture types stay inside this boundary.
 *   - Callers receive only an opaque completion signal (onImported / onCancel).
 *   - R2/D1 persistence is best-effort — the review screen is shown regardless.
 *   - Transcript text is stored as text only; no audio is transmitted.
 */

import { useState, useEffect } from 'react';
import {
  importSessionCapture,
  type SessionCaptureImportResult,
  type SessionCaptureReview,
} from '../importer/sessionCaptureImporter';
import SessionCaptureImportReview from './SessionCaptureImportReview';
import type { SessionCaptureV1 } from '@atlas/contracts';

// ─── Server sync helpers ──────────────────────────────────────────────────────

async function createScanSession(capture: SessionCaptureV1): Promise<string> {
  const body = {
    id: capture.sessionId,
    job_reference: capture.sessionId,
    property_address:
      [capture.property?.address, capture.property?.postcode]
        .filter(Boolean)
        .join(', ') || capture.sessionId,
    scan_state: 'scanned',
    review_state: capture.status === 'ready' ? 'scanned' : 'needs_attention',
  };

  const res = await fetch('/api/scan-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Failed to create scan session: ${res.status}`);
  }

  const data = (await res.json()) as { ok: boolean; id: string };
  return data.id;
}

async function uploadPhoto(
  sessionId: string,
  photoFile: File,
  capturedAt: string,
): Promise<void> {
  const form = new FormData();
  form.append('file', photoFile);
  form.append('asset_type', 'photo');
  form.append('captured_at', capturedAt);

  const res = await fetch(`/api/scan-sessions/${sessionId}/assets`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    console.warn(`[Atlas] Photo upload failed for session ${sessionId}: ${res.status}`);
  }
}

async function storeTranscript(
  sessionId: string,
  text: string,
): Promise<void> {
  const res = await fetch(`/api/scan-sessions/${sessionId}/transcripts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'voice_note', text }),
  });

  if (!res.ok) {
    console.warn(`[Atlas] Transcript store failed for session ${sessionId}: ${res.status}`);
  }
}

// ─── Step types ───────────────────────────────────────────────────────────────

type Step =
  | { name: 'parsing' }
  | { name: 'review'; importResult: SessionCaptureImportResult & { status: 'success' | 'success_with_warnings' } }
  | { name: 'error'; importResult: SessionCaptureImportResult & { status: 'rejected_invalid' } }
  | { name: 'importing'; review: SessionCaptureReview }
  | { name: 'done'; review: SessionCaptureReview; warnings: string[] };

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SessionCaptureImportFlowProps {
  /** Called when the import completes successfully. */
  onImported: (sessionId: string) => void;
  /** Called when the user cancels at any step. */
  onCancel: () => void;
  /**
   * Pre-loaded session capture file.  When set, the flow auto-starts parsing
   * without showing a file-picker step.
   */
  preloadedFile?: File;
  /**
   * Optional additional photo files that arrived alongside the capture file.
   * These are uploaded to R2 after the session DB record is created.
   */
  photoFiles?: File[];
}

// ─── Component ────────────────────────────────────────────────────────────────

function safeParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function SessionCaptureImportFlow({
  onImported,
  onCancel,
  preloadedFile,
  photoFiles = [],
}: SessionCaptureImportFlowProps) {
  const [step, setStep] = useState<Step>({ name: 'parsing' });

  // ── Auto-parse on mount when a file is preloaded ──────────────────────────
  useEffect(() => {
    if (!preloadedFile) {
      setStep({
        name: 'error',
        importResult: {
          status: 'rejected_invalid',
          errors: ['No session capture file was provided.'],
        },
      });
      return;
    }

    let cancelled = false;
    const reader = new FileReader();

    reader.onload = () => {
      if (cancelled) return;
      const text = typeof reader.result === 'string' ? reader.result : '';
      const json = safeParseJson(text);

      if (json === null) {
        setStep({
          name: 'error',
          importResult: {
            status: 'rejected_invalid',
            errors: ['session_capture.json is not valid JSON.'],
          },
        });
        return;
      }

      const result = importSessionCapture(json);

      if (result.status === 'rejected_invalid') {
        setStep({ name: 'error', importResult: result });
        return;
      }

      setStep({ name: 'review', importResult: result });
    };

    reader.onerror = () => {
      if (!cancelled) {
        setStep({
          name: 'error',
          importResult: {
            status: 'rejected_invalid',
            errors: [`Could not read session capture file: ${preloadedFile.name}`],
          },
        });
      }
    };

    reader.readAsText(preloadedFile);

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Confirm handler ───────────────────────────────────────────────────────
  async function handleConfirm(capture: SessionCaptureV1, review: SessionCaptureReview) {
    setStep({ name: 'importing', review });

    const warnings: string[] = [];

    try {
      // 1. Create scan session record in D1
      const sessionId = await createScanSession(capture);

      // 2. Upload any photo files that were provided alongside the capture
      if (photoFiles.length > 0) {
        const photoMap = new Map(
          capture.photos.map((p) => {
            const basename = p.uri.split('/').pop() ?? p.uri;
            return [basename.toLowerCase(), p];
          }),
        );

        for (const photoFile of photoFiles) {
          const capturePhoto = photoMap.get(photoFile.name.toLowerCase());
          try {
            await uploadPhoto(
              sessionId,
              photoFile,
              capturePhoto?.createdAt ?? new Date().toISOString(),
            );
          } catch (err) {
            warnings.push(
              `Photo upload failed: ${photoFile.name} — ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }

      // 3. Store transcript text (no audio transmitted)
      const transcriptText = capture.audio.transcription?.text;
      if (transcriptText) {
        try {
          await storeTranscript(sessionId, transcriptText);
        } catch (err) {
          warnings.push(
            `Transcript storage failed — ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      setStep({ name: 'done', review, warnings });
    } catch (err) {
      // Session creation failed — still surface the review so work isn't lost
      warnings.push(
        `Session record creation failed — ${err instanceof Error ? err.message : String(err)}`,
      );
      setStep({ name: 'done', review, warnings });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 640,
    margin: '0 auto',
    padding: 24,
  };

  // Parsing
  if (step.name === 'parsing') {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Reading session capture…</p>
      </div>
    );
  }

  // Validation error
  if (step.name === 'error') {
    const { errors } = step.importResult;
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={onCancel} style={{ fontSize: 13, padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: 'none', cursor: 'pointer' }}>
            ← Back
          </button>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Invalid session capture</h1>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#b91c1c' }}>
            This file could not be validated as a SessionCaptureV1.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#991b1b' }}>
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
        <button
          onClick={onCancel}
          style={{ padding: '8px 20px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  // Review
  if (step.name === 'review') {
    const { importResult } = step;
    return (
      <SessionCaptureImportReview
        review={importResult.review}
        onConfirm={() => void handleConfirm(importResult.capture, importResult.review)}
        onCancel={onCancel}
      />
    );
  }

  // Importing
  if (step.name === 'importing') {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#6b7280', fontSize: 14 }}>
          Storing capture — uploading assets…
        </p>
      </div>
    );
  }

  // Done (step.name === 'done')
  const { review, warnings } = step;
  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Capture imported</h2>
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
          Session evidence has been stored and is ready for use in engineer and report outputs.
        </p>
      </div>

      {/* Summary */}
      <section style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#166534' }}>Import summary</h3>
        <table style={{ fontSize: 14, borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {[
              ['Rooms', review.roomCount],
              ['Objects', review.objectCount],
              ['Photos', review.photoCount],
              ['Notes', review.noteCount],
              ['Transcript', review.hasTranscript ? 'Stored' : '—'],
            ].map(([label, value]) => (
              <tr key={String(label)}>
                <td style={{ color: '#6b7280', paddingRight: 20, paddingBottom: 6 }}>{label}</td>
                <td style={{ fontWeight: 600, paddingBottom: 6 }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Upload warnings */}
      {warnings.length > 0 && (
        <section style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#92400e' }}>
            Partial import warnings ({warnings.length})
          </h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#78350f' }}>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </section>
      )}

      <button
        onClick={() => onImported(review.sessionId)}
        style={{ padding: '10px 24px', fontSize: 14, fontWeight: 600, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
      >
        Continue →
      </button>
    </div>
  );
}
