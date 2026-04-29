/**
 * SessionCaptureImportReview.tsx
 *
 * Pre-import review screen for a SessionCaptureV1 payload.
 *
 * Shows the engineer:
 *   - What was imported (rooms, objects, photos, notes, transcript)
 *   - What is missing from the capture
 *   - What requires verification before use
 *   - What is safe to surface in customer vs engineer outputs
 *
 * The component accepts the `SessionCaptureReview` derived by
 * `importSessionCapture` — no raw SessionCaptureV1 types reach this component.
 *
 * The `onConfirm` callback triggers the actual import (R2 upload, D1 records).
 * The `onCancel` callback aborts the flow.
 */

import type { SessionCaptureReview } from '../importer/sessionCaptureImporter';

// ─── Sub-components ───────────────────────────────────────────────────────────

interface BadgeProps {
  count: number;
  label: string;
  color: 'green' | 'blue' | 'amber' | 'slate';
}

function CountBadge({ count, label, color }: BadgeProps) {
  const palette: Record<BadgeProps['color'], { bg: string; border: string; text: string }> = {
    green: { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    blue:  { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
    amber: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
    slate: { bg: '#f8fafc', border: '#cbd5e1', text: '#475569' },
  };
  const p = palette[color];
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: p.bg, border: `1px solid ${p.border}`,
      borderRadius: 8, padding: '12px 20px', minWidth: 80,
    }}>
      <span style={{ fontSize: 24, fontWeight: 700, color: p.text }}>{count}</span>
      <span style={{ fontSize: 12, color: p.text, marginTop: 2 }}>{label}</span>
    </div>
  );
}

interface StatusChipProps {
  label: string;
  ok: boolean;
}

function StatusChip({ label, ok }: StatusChipProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: ok ? '#dcfce7' : '#fef9c3',
      color: ok ? '#15803d' : '#a16207',
    }}>
      {ok ? '✓' : '⚠'} {label}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SessionCaptureImportReviewProps {
  review: SessionCaptureReview;
  /** Set to true while the confirm step is uploading assets. */
  importing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SessionCaptureImportReview({
  review,
  importing = false,
  onConfirm,
  onCancel,
}: SessionCaptureImportReviewProps) {
  const hasWarnings =
    review.missingFields.length > 0 || review.verificationRequired.length > 0;

  const customerSafeCount = review.customerSafeEvidence.length;
  const engineerCount = review.engineerEvidence.length;

  const containerStyle: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 640,
    margin: '0 auto',
    padding: 24,
  };

  const sectionStyle: React.CSSProperties = {
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    padding: '16px 20px',
    marginBottom: 16,
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <button
            onClick={onCancel}
            disabled={importing}
            style={{
              fontSize: 13, padding: '4px 12px',
              background: 'none', border: '1px solid #d1d5db',
              borderRadius: 6, cursor: importing ? 'default' : 'pointer',
              opacity: importing ? 0.5 : 1,
            }}
          >
            ← Back
          </button>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            Review capture
          </h1>
        </div>
        {review.address && (
          <p style={{ margin: 0, fontSize: 15, color: '#374151' }}>
            {review.address}
          </p>
        )}
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          Session&nbsp;
          <code style={{ fontSize: 12, background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>
            {review.sessionId}
          </code>
          {' · '}
          {new Date(review.startedAt).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
          {review.device?.appVersion && (
            <span style={{ color: '#9ca3af', marginLeft: 8 }}>
              · {review.device.appVersion}
            </span>
          )}
        </p>
      </div>

      {/* Evidence counts */}
      <section style={{ ...sectionStyle, background: '#fafafa' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#374151' }}>
          Captured evidence
        </h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <CountBadge count={review.roomCount}   label="Rooms"   color="blue"  />
          <CountBadge count={review.objectCount} label="Objects" color="blue"  />
          <CountBadge count={review.photoCount}  label="Photos"  color="green" />
          <CountBadge count={review.noteCount}   label="Notes"   color="slate" />
          {review.hasTranscript && (
            <CountBadge count={1} label="Transcript" color="green" />
          )}
        </div>
      </section>

      {/* Readiness signals */}
      <section style={{ ...sectionStyle, background: hasWarnings ? '#fffbeb' : '#f0fdf4', borderColor: hasWarnings ? '#fcd34d' : '#86efac' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: hasWarnings ? '#92400e' : '#166534' }}>
          {hasWarnings ? 'Review required' : 'Ready to import'}
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: review.missingFields.length > 0 || review.verificationRequired.length > 0 ? 12 : 0 }}>
          <StatusChip label={`Status: ${review.status}`} ok={review.status === 'ready' || review.status === 'synced'} />
          <StatusChip label={`${review.roomCount} rooms`} ok={review.roomCount > 0} />
          <StatusChip label={review.hasTranscript ? 'Transcript available' : 'No transcript'} ok={review.hasTranscript} />
        </div>
        {review.missingFields.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#b45309' }}>Missing:</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#92400e' }}>
              {review.missingFields.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        )}
        {review.verificationRequired.length > 0 && (
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#a16207' }}>Needs verification:</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#78350f' }}>
              {review.verificationRequired.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
          </div>
        )}
      </section>

      {/* Evidence routing */}
      <section style={sectionStyle}>
        <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#374151' }}>
          Evidence routing
        </h2>
        <table style={{ fontSize: 13, borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            <tr>
              <td style={{ color: '#6b7280', paddingRight: 20, paddingBottom: 8, verticalAlign: 'top' }}>
                Engineer outputs
              </td>
              <td style={{ fontWeight: 600, paddingBottom: 8 }}>
                {engineerCount} item{engineerCount !== 1 ? 's' : ''}
                <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>
                  (rooms, objects, photos, notes, transcript)
                </span>
              </td>
            </tr>
            <tr>
              <td style={{ color: '#6b7280', paddingRight: 20, verticalAlign: 'top' }}>
                Customer outputs
              </td>
              <td style={{ fontWeight: 600 }}>
                {customerSafeCount} item{customerSafeCount !== 1 ? 's' : ''}
                <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>
                  (rooms, session and room photos only)
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <p style={{ margin: '12px 0 0', fontSize: 12, color: '#9ca3af' }}>
          Object-level photos, engineer notes, and transcript text are not surfaced in customer-facing outputs.
        </p>
      </section>

      {/* Transcript preview */}
      {review.hasTranscript && (
        <section style={sectionStyle}>
          <h2 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#374151' }}>
            Transcript
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#4b5563' }}>
            Transcript text is available and will be stored as a searchable record linked to this session.
            No raw audio will be stored or transmitted.
          </p>
          {review.transcriptStatus && review.transcriptStatus !== 'complete' && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#b45309' }}>
              Transcript status: <strong>{review.transcriptStatus}</strong>
            </p>
          )}
        </section>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button
          onClick={onConfirm}
          disabled={importing}
          style={{
            padding: '10px 28px', fontSize: 14, fontWeight: 600,
            background: importing ? '#6b7280' : '#6366f1',
            color: '#fff', border: 'none', borderRadius: 6,
            cursor: importing ? 'default' : 'pointer',
          }}
        >
          {importing ? 'Importing…' : 'Confirm import'}
        </button>
        <button
          onClick={onCancel}
          disabled={importing}
          style={{
            padding: '10px 20px', fontSize: 14,
            background: 'none', border: '1px solid #d1d5db',
            borderRadius: 6, cursor: importing ? 'default' : 'pointer',
            opacity: importing ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
