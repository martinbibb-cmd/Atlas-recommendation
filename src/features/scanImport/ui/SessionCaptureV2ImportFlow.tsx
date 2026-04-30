/**
 * SessionCaptureV2ImportFlow.tsx
 *
 * Full import flow for a SessionCaptureV2 payload.
 *
 * Steps:
 *   1. Parse and validate the JSON (auto-triggered when `preloadedFile` is set)
 *   2. Pre-import review — shows rooms, object pins, photos, voice notes,
 *      floor-plan snapshots, QA flags, missing fields, readiness
 *   3. Evidence review — engineer confirms/rejects each item and sets
 *      customer-report visibility before import is finalised
 *   4. Confirm → create DB record, upload photos to R2, store transcripts,
 *      persist review decisions
 *   5. Import complete — summary of what was stored
 *
 * This is the V2 primary import surface for captures arriving from Atlas Scan iOS.
 * It must not surface raw SessionCaptureV2 types to any component outside the
 * scanImport feature boundary.
 *
 * Architecture rules:
 *   - Raw V2 capture types stay inside this boundary.
 *   - Callers receive only an opaque completion signal (onImported / onCancel).
 *   - R2/D1 persistence is best-effort — the review screen is shown regardless.
 *   - Transcript text is stored as text only; no audio is transmitted.
 *   - Photos are stored as evidence records with stable asset keys.
 *   - Customer-facing outputs must only show reviewed/safe evidence.
 *   - Review decisions (reviewStatus, includeInCustomerReport) are persisted
 *     to scan_assets so they survive reload and apply to downstream outputs.
 */

import { useState, useEffect } from 'react';
import {
  importSessionCaptureV2,
  type SessionCaptureV2ImportResult,
  type SessionCaptureV2Review,
  type SessionCaptureV2,
} from '../importer/sessionCaptureV2Importer';
import { buildCaptureReviewModel, type CaptureReviewModel } from '../importer/captureReviewModel';
import SessionCaptureV2ImportReview from './SessionCaptureV2ImportReview';
import CaptureEvidenceReviewScreen from './CaptureEvidenceReviewScreen';

// ─── Server sync helpers ──────────────────────────────────────────────────────

async function createScanSessionV2(capture: SessionCaptureV2): Promise<string> {
  const body = {
    id: capture.sessionId,
    job_reference: capture.visitReference ?? capture.sessionId,
    property_address:
      [capture.property?.address, capture.property?.postcode]
        .filter(Boolean)
        .join(', ') || capture.sessionId,
    scan_state: 'scanned',
    // V2 captures are always exported (complete), mark as ready
    review_state: 'scanned',
    capture_version: '2.0',
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

async function uploadPhotoAsset(
  sessionId: string,
  photoFile: File,
  capturedAt: string,
  photoId: string,
): Promise<void> {
  const form = new FormData();
  form.append('file', photoFile);
  form.append('asset_type', 'photo');
  form.append('captured_at', capturedAt);
  // Store with the stable photo ID so it can be looked up by reference
  form.append('asset_key', photoId);

  const res = await fetch(`/api/scan-sessions/${sessionId}/assets`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    console.warn(`[Atlas] Photo upload failed for session ${sessionId}: ${res.status}`);
  }
}

async function storeVoiceNoteTranscript(
  sessionId: string,
  voiceNoteId: string,
  text: string,
): Promise<void> {
  const res = await fetch(`/api/scan-sessions/${sessionId}/transcripts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // No raw audio — transcript text only
    body: JSON.stringify({ source: 'voice_note', voice_note_id: voiceNoteId, text }),
  });

  if (!res.ok) {
    console.warn(
      `[Atlas] Transcript store failed for voice note ${voiceNoteId} in session ${sessionId}: ${res.status}`,
    );
  }
}

async function storeFloorPlanSnapshot(
  sessionId: string,
  snapshotFile: File,
  snapshotId: string,
  capturedAt: string,
): Promise<void> {
  const form = new FormData();
  form.append('file', snapshotFile);
  form.append('asset_type', 'floor_plan_snapshot');
  form.append('captured_at', capturedAt);
  form.append('asset_key', snapshotId);

  const res = await fetch(`/api/scan-sessions/${sessionId}/assets`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    console.warn(
      `[Atlas] Floor plan snapshot upload failed for session ${sessionId}: ${res.status}`,
    );
  }
}

/**
 * storeReviewDecisions — persists per-item review decisions (reviewStatus,
 * includeInCustomerReport) to the scan_assets table via the API.
 *
 * This ensures review decisions survive reload and are applied to downstream
 * outputs (customer proof, engineer handoff) when the session is re-opened.
 *
 * Best-effort: failures are logged but do not block the import flow.
 */
async function storeReviewDecisions(
  sessionId: string,
  model: CaptureReviewModel,
): Promise<void> {
  const decisions: Array<{
    ref: string;
    kind: string;
    reviewStatus: string;
    includeInCustomerReport: boolean;
  }> = [];

  for (const photo of model.photos) {
    decisions.push({
      ref: photo.photoId,
      kind: 'photo',
      reviewStatus: photo.reviewStatus,
      includeInCustomerReport: photo.includeInCustomerReport,
    });
  }

  for (const pin of model.objectPins) {
    decisions.push({
      ref: pin.pinId,
      kind: 'object_pin',
      reviewStatus: pin.reviewStatus,
      includeInCustomerReport: false,
    });
  }

  for (const snap of model.floorPlanSnapshots) {
    decisions.push({
      ref: snap.snapshotId,
      kind: 'floor_plan_snapshot',
      reviewStatus: snap.reviewStatus,
      includeInCustomerReport: snap.includeInCustomerReport,
    });
  }

  const res = await fetch(`/api/scan-sessions/${sessionId}/review-decisions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisions }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.warn(
      `[Atlas] Review decisions store failed for session ${sessionId}: ${res.status}${detail ? ` — ${detail}` : ''}`,
    );
  }
}

// ─── Step types ───────────────────────────────────────────────────────────────

type Step =
  | { name: 'parsing' }
  | { name: 'review'; importResult: SessionCaptureV2ImportResult & { status: 'success' | 'success_with_warnings' }; capture: SessionCaptureV2 }
  | { name: 'evidence_review'; capture: SessionCaptureV2; review: SessionCaptureV2Review; reviewModel: CaptureReviewModel }
  | { name: 'error'; importResult: SessionCaptureV2ImportResult & { status: 'rejected_invalid' } }
  | { name: 'importing'; review: SessionCaptureV2Review }
  | { name: 'done'; review: SessionCaptureV2Review; warnings: string[] };

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SessionCaptureV2ImportFlowProps {
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
   * Each file is matched by basename to the photo URIs in the capture.
   * Photos are stored in R2 with their stable photoId as the asset key.
   */
  photoFiles?: File[];
  /**
   * Optional floor-plan snapshot files that arrived alongside the capture.
   * Matched by basename to floorPlanSnapshot URIs.
   */
  snapshotFiles?: File[];
}

// ─── Component ────────────────────────────────────────────────────────────────

function safeParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function SessionCaptureV2ImportFlow({
  onImported,
  onCancel,
  preloadedFile,
  photoFiles = [],
  snapshotFiles = [],
}: SessionCaptureV2ImportFlowProps) {
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

      const result = importSessionCaptureV2(json);

      if (result.status === 'rejected_invalid') {
        setStep({ name: 'error', importResult: result });
        return;
      }

      setStep({ name: 'review', importResult: result, capture: result.capture });
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
  // preloadedFile is intentionally omitted from the dependency array.
  // The flow runs once on mount to parse the pre-loaded file; re-running
  // on subsequent renders is not desired (this matches the same pattern used
  // in SessionCaptureImportFlow.tsx for the V1 import path).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pre-import review confirm: advance to evidence review ────────────────
  function handlePreImportConfirm(capture: SessionCaptureV2, review: SessionCaptureV2Review) {
    const reviewModel = buildCaptureReviewModel(capture);
    setStep({ name: 'evidence_review', capture, review, reviewModel });
  }

  // ── Evidence review confirm: run import with reviewed model ───────────────
  async function handleConfirm(
    capture: SessionCaptureV2,
    review: SessionCaptureV2Review,
    reviewModel: CaptureReviewModel,
  ) {
    setStep({ name: 'importing', review });

    const warnings: string[] = [];

    try {
      // 1. Create scan session record in D1
      const sessionId = await createScanSessionV2(capture);

      // 2. Persist review decisions (reviewStatus, includeInCustomerReport)
      try {
        await storeReviewDecisions(sessionId, reviewModel);
      } catch (err) {
        warnings.push(
          `Review decisions storage failed — ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // 3. Upload photo files matched by basename to their stable photoId key.
      //    Photos are stored as evidence records — not just counted.
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
            await uploadPhotoAsset(
              sessionId,
              photoFile,
              capturePhoto?.capturedAt ?? new Date().toISOString(),
              capturePhoto?.photoId ?? photoFile.name,
            );
          } catch (err) {
            warnings.push(
              `Photo upload failed: ${photoFile.name} — ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }

      // 4. Store voice note transcripts — text only, no audio transmitted.
      for (const vn of capture.voiceNotes) {
        if (vn.transcript) {
          try {
            await storeVoiceNoteTranscript(sessionId, vn.voiceNoteId, vn.transcript);
          } catch (err) {
            warnings.push(
              `Transcript storage failed (${vn.voiceNoteId}) — ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }

      // 5. Upload floor-plan snapshot files matched by basename.
      if (snapshotFiles.length > 0) {
        const snapshotMap = new Map(
          capture.floorPlanSnapshots.map((s) => {
            const basename = s.uri.split('/').pop() ?? s.uri;
            return [basename.toLowerCase(), s];
          }),
        );

        for (const snapshotFile of snapshotFiles) {
          const captureSnapshot = snapshotMap.get(snapshotFile.name.toLowerCase());
          try {
            await storeFloorPlanSnapshot(
              sessionId,
              snapshotFile,
              captureSnapshot?.snapshotId ?? snapshotFile.name,
              captureSnapshot?.capturedAt ?? new Date().toISOString(),
            );
          } catch (err) {
            warnings.push(
              `Floor plan snapshot upload failed: ${snapshotFile.name} — ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }

      setStep({ name: 'done', review, warnings });
    } catch (err) {
      // Session creation failed — surface warning so work is not lost
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
            This file could not be validated as a SessionCaptureV2.
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

  // Review (pre-import summary)
  if (step.name === 'review') {
    const { importResult, capture } = step;
    return (
      <SessionCaptureV2ImportReview
        review={importResult.review}
        onConfirm={() => handlePreImportConfirm(capture, importResult.review)}
        onCancel={onCancel}
      />
    );
  }

  // Evidence review (per-item confirm/reject)
  if (step.name === 'evidence_review') {
    const { capture, review, reviewModel } = step;
    return (
      <CaptureEvidenceReviewScreen
        initialModel={reviewModel}
        onConfirm={(confirmedModel) => void handleConfirm(capture, review, confirmedModel)}
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
              ['Object pins', review.objectPinCount],
              ['Photos', review.photoCount],
              ['Voice notes', review.voiceNoteCount],
              ['Floor plan snapshots', review.floorPlanSnapshotCount],
              ['Transcripts stored', review.hasTranscript ? `${review.voiceNoteCount} note(s)` : '—'],
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
