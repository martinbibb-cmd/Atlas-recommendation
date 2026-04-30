/**
 * CaptureEvidenceReviewScreen.tsx
 *
 * Engineer-facing evidence review screen for a CaptureReviewModel.
 *
 * Allows the engineer to:
 *   - Review all imported SessionCaptureV2 evidence grouped by type
 *   - Confirm or reject each item before it becomes trusted in Atlas outputs
 *   - Toggle "Include in customer report" for photos and floor plan snapshots
 *
 * Evidence confidence badges:
 *   ✓ Confirmed  — manually placed or engineer-confirmed item
 *   ◎ Inferred   — LiDAR-derived; pending engineer review
 *   ✗ Rejected   — explicitly rejected; excluded from all outputs
 *   ⚠ Needs review — item in 'pending' state
 *
 * Architecture rules:
 *   - Does NOT import raw SessionCaptureV2 types — works only with
 *     CaptureReviewModel and ReviewStatus.
 *   - LiDAR-inferred pins are shown with an 'Inferred' badge and must be
 *     explicitly confirmed before they are treated as trusted.
 *   - Rejected items are visually dimmed but remain visible in the UI so
 *     the engineer does not lose track of what was excluded.
 *   - "Include in customer report" toggles are shown only for photos and
 *     floor plan snapshots.
 */

import { useState } from 'react';
import type {
  CaptureReviewModel,
  ReviewStatus,
  ReviewPhoto,
  ReviewObjectPin,
  ReviewFloorPlanSnapshot,
  ReviewRoom,
  ReviewVoiceNote,
  ReviewQaFlag,
} from '../importer/captureReviewModel';
import { deriveReviewWarnings } from '../importer/captureReviewModel';

// ─── Shared utilities ─────────────────────────────────────────────────────────

function formatObjectType(objectType: string): string {
  return objectType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const COLORS = {
  confirmed: { bg: '#dcfce7', border: '#86efac', text: '#15803d' },
  pending:   { bg: '#fffbeb', border: '#fcd34d', text: '#a16207' },
  rejected:  { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' },
  inferred:  { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ConfidenceBadgeProps {
  reviewStatus: ReviewStatus;
  isLidar?: boolean;
}

function ConfidenceBadge({ reviewStatus, isLidar }: ConfidenceBadgeProps) {
  let label: string;
  let palette: { bg: string; border: string; text: string };

  if (reviewStatus === 'rejected') {
    label = '✗ Rejected';
    palette = COLORS.rejected;
  } else if (reviewStatus === 'pending' && isLidar) {
    label = '◎ Inferred — needs review';
    palette = COLORS.inferred;
  } else if (reviewStatus === 'pending') {
    label = '⚠ Needs review';
    palette = COLORS.pending;
  } else {
    label = '✓ Confirmed';
    palette = COLORS.confirmed;
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: palette.bg, border: `1px solid ${palette.border}`, color: palette.text,
    }}>
      {label}
    </span>
  );
}

interface ActionButtonsProps {
  reviewStatus: ReviewStatus;
  onConfirm: () => void;
  onReject: () => void;
}

function ActionButtons({ reviewStatus, onConfirm, onReject }: ActionButtonsProps) {
  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      <button
        onClick={onConfirm}
        disabled={reviewStatus === 'confirmed'}
        style={{
          padding: '3px 10px', fontSize: 12, fontWeight: 600, borderRadius: 4,
          border: '1px solid #86efac',
          background: reviewStatus === 'confirmed' ? '#dcfce7' : '#fff',
          color: reviewStatus === 'confirmed' ? '#15803d' : '#374151',
          cursor: reviewStatus === 'confirmed' ? 'default' : 'pointer',
          opacity: reviewStatus === 'confirmed' ? 0.8 : 1,
        }}
      >
        Confirm
      </button>
      <button
        onClick={onReject}
        disabled={reviewStatus === 'rejected'}
        style={{
          padding: '3px 10px', fontSize: 12, fontWeight: 600, borderRadius: 4,
          border: '1px solid #fca5a5',
          background: reviewStatus === 'rejected' ? '#fef2f2' : '#fff',
          color: reviewStatus === 'rejected' ? '#b91c1c' : '#374151',
          cursor: reviewStatus === 'rejected' ? 'default' : 'pointer',
          opacity: reviewStatus === 'rejected' ? 0.8 : 1,
        }}
      >
        Reject
      </button>
    </span>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
  empty?: string;
}

function Section({ title, count, children, empty }: SectionProps) {
  if (count === 0) {
    return (
      <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 12 }}>
        <div style={{ padding: '12px 16px', background: '#f9fafb', borderRadius: '8px 8px 0 0' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{title}</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: '#9ca3af' }}>0</span>
        </div>
        {empty && (
          <div style={{ padding: '12px 16px', fontSize: 13, color: '#9ca3af' }}>{empty}</div>
        )}
      </section>
    );
  }
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 12 }}>
      <div style={{ padding: '12px 16px', background: '#f9fafb', borderRadius: '8px 8px 0 0', borderBottom: '1px solid #e5e7eb' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{title}</span>
        <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>{count}</span>
      </div>
      <div style={{ padding: '0 4px' }}>{children}</div>
    </section>
  );
}

interface ItemRowProps {
  children: React.ReactNode;
  rejected?: boolean;
}

function ItemRow({ children, rejected }: ItemRowProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      borderBottom: '1px solid #f3f4f6',
      opacity: rejected ? 0.5 : 1,
    }}>
      {children}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CaptureEvidenceReviewScreenProps {
  /**
   * The capture review model to display.
   * The component manages a mutable local copy; the original is never mutated.
   */
  initialModel: CaptureReviewModel;
  /** Called when the engineer clicks "Confirm all decisions". */
  onConfirm: (model: CaptureReviewModel) => void;
  /** Called when the engineer clicks Cancel. */
  onCancel: () => void;
  /** Set to true while the downstream confirm step is processing. */
  saving?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CaptureEvidenceReviewScreen({
  initialModel,
  onConfirm,
  onCancel,
  saving = false,
}: CaptureEvidenceReviewScreenProps) {
  // Local mutable copy — the model is updated item by item as the engineer
  // makes decisions.
  const [photos, setPhotos] = useState<ReviewPhoto[]>(() =>
    initialModel.photos.map((p) => ({ ...p })),
  );
  const [objectPins, setObjectPins] = useState<ReviewObjectPin[]>(() =>
    initialModel.objectPins.map((p) => ({ ...p })),
  );
  const [floorPlanSnapshots, setFloorPlanSnapshots] = useState<ReviewFloorPlanSnapshot[]>(() =>
    initialModel.floorPlanSnapshots.map((s) => ({ ...s })),
  );

  // Rooms and voice notes are display-only (no confirm/reject)
  const rooms: ReviewRoom[] = initialModel.rooms;
  const voiceNotes: ReviewVoiceNote[] = initialModel.voiceNotes;
  const qaFlags: ReviewQaFlag[] = initialModel.qaFlags;

  // Dynamic review warnings based on current state
  const reviewWarnings = deriveReviewWarnings({ photos, objectPins, floorPlanSnapshots });

  // ── Photo handlers ──────────────────────────────────────────────────────

  function updatePhotoStatus(photoId: string, status: ReviewStatus) {
    setPhotos((prev) =>
      prev.map((p) => (p.photoId === photoId ? { ...p, reviewStatus: status } : p)),
    );
  }

  function togglePhotoCustomerReport(photoId: string) {
    setPhotos((prev) =>
      prev.map((p) =>
        p.photoId === photoId
          ? { ...p, includeInCustomerReport: !p.includeInCustomerReport }
          : p,
      ),
    );
  }

  // ── Object pin handlers ─────────────────────────────────────────────────

  function updatePinStatus(pinId: string, status: ReviewStatus) {
    setObjectPins((prev) =>
      prev.map((p) => (p.pinId === pinId ? { ...p, reviewStatus: status } : p)),
    );
  }

  // ── Floor plan handlers ─────────────────────────────────────────────────

  function updateSnapshotStatus(snapshotId: string, status: ReviewStatus) {
    setFloorPlanSnapshots((prev) =>
      prev.map((s) => (s.snapshotId === snapshotId ? { ...s, reviewStatus: status } : s)),
    );
  }

  function toggleSnapshotCustomerReport(snapshotId: string) {
    setFloorPlanSnapshots((prev) =>
      prev.map((s) =>
        s.snapshotId === snapshotId
          ? { ...s, includeInCustomerReport: !s.includeInCustomerReport }
          : s,
      ),
    );
  }

  // ── Confirm handler ─────────────────────────────────────────────────────

  function handleConfirm() {
    const updatedModel: CaptureReviewModel = {
      ...initialModel,
      photos,
      objectPins,
      floorPlanSnapshots,
    };
    onConfirm(updatedModel);
  }

  // ── Styles ──────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 720,
    margin: '0 auto',
    padding: 24,
  };

  const labelStyle: React.CSSProperties = {
    flex: 1, fontSize: 13, fontWeight: 500, color: '#374151',
  };

  const metaStyle: React.CSSProperties = {
    fontSize: 11, color: '#9ca3af',
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <button
            onClick={onCancel}
            disabled={saving}
            style={{
              fontSize: 13, padding: '4px 12px', background: 'none',
              border: '1px solid #d1d5db', borderRadius: 6,
              cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.5 : 1,
            }}
          >
            ← Back
          </button>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            Review captured evidence
          </h1>
        </div>
        {initialModel.address && (
          <p style={{ margin: 0, fontSize: 14, color: '#374151' }}>{initialModel.address}</p>
        )}
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>
          Session {initialModel.sessionId}
          {initialModel.visitReference ? ` · Visit ${initialModel.visitReference}` : ''}
          {' · '}{new Date(initialModel.capturedAt).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </p>
      </div>

      {/* Static import warnings */}
      {initialModel.evidenceWarnings.length > 0 && (
        <section style={{
          background: '#fffbeb', border: '1px solid #fcd34d',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
        }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>
            Import warnings
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#78350f' }}>
            {initialModel.evidenceWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </section>
      )}

      {/* Dynamic review warnings */}
      {reviewWarnings.length > 0 && (
        <section style={{
          background: '#fef2f2', border: '1px solid #fca5a5',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
        }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>
            Action required
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#991b1b' }}>
            {reviewWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </section>
      )}

      {/* Rooms */}
      <Section title="Rooms" count={rooms.length} empty="No rooms captured.">
        {rooms.map((room) => (
          <ItemRow key={room.roomId}>
            <span style={labelStyle}>
              {room.label || room.roomId}
              {room.areaM2 !== undefined && (
                <span style={{ ...metaStyle, marginLeft: 6 }}>{room.areaM2} m²</span>
              )}
            </span>
            <span style={metaStyle}>Floor {room.floorIndex ?? 0}</span>
            <span style={{
              padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              background: room.status === 'complete' ? '#dcfce7' : '#fffbeb',
              color: room.status === 'complete' ? '#15803d' : '#a16207',
            }}>
              {room.status === 'complete' ? '✓ Complete' : '⚠ Active'}
            </span>
          </ItemRow>
        ))}
      </Section>

      {/* Photos */}
      <Section title="Photos" count={photos.length} empty="No photos captured.">
        {photos.map((photo) => (
          <ItemRow key={photo.photoId} rejected={photo.reviewStatus === 'rejected'}>
            <span style={labelStyle}>
              {photo.scope === 'session' && 'Session overview'}
              {photo.scope === 'room' && `Room photo${photo.roomId ? ` (${photo.roomId})` : ''}`}
              {photo.scope === 'object' && `Object photo${photo.objectPinId ? ` (pin: ${photo.objectPinId})` : ''}`}
              <span style={{ ...metaStyle, marginLeft: 6 }}>{photo.photoId}</span>
            </span>
            <ConfidenceBadge reviewStatus={photo.reviewStatus} />
            <ActionButtons
              reviewStatus={photo.reviewStatus}
              onConfirm={() => updatePhotoStatus(photo.photoId, 'confirmed')}
              onReject={() => updatePhotoStatus(photo.photoId, 'rejected')}
            />
            {photo.customerSafe && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={photo.includeInCustomerReport}
                  onChange={() => togglePhotoCustomerReport(photo.photoId)}
                  disabled={photo.reviewStatus === 'rejected'}
                />
                Customer report
              </label>
            )}
          </ItemRow>
        ))}
      </Section>

      {/* Object Pins */}
      <Section title="Object Pins" count={objectPins.length} empty="No object pins captured.">
        {objectPins.map((pin) => (
          <ItemRow key={pin.pinId} rejected={pin.reviewStatus === 'rejected'}>
            <span style={labelStyle}>
              {pin.label || formatObjectType(pin.objectType)}
              {pin.roomId && <span style={{ ...metaStyle, marginLeft: 6 }}>in {pin.roomId}</span>}
              {pin.needsConfirmation && (
                <span style={{ marginLeft: 6, fontSize: 11, color: '#1e40af', fontWeight: 600 }}>
                  [LiDAR]
                </span>
              )}
            </span>
            <ConfidenceBadge reviewStatus={pin.reviewStatus} isLidar={pin.needsConfirmation} />
            <ActionButtons
              reviewStatus={pin.reviewStatus}
              onConfirm={() => updatePinStatus(pin.pinId, 'confirmed')}
              onReject={() => updatePinStatus(pin.pinId, 'rejected')}
            />
          </ItemRow>
        ))}
      </Section>

      {/* Floor Plans */}
      <Section title="Floor Plans" count={floorPlanSnapshots.length} empty="No floor plan snapshots captured.">
        {floorPlanSnapshots.map((snap) => (
          <ItemRow key={snap.snapshotId} rejected={snap.reviewStatus === 'rejected'}>
            <span style={labelStyle}>
              {snap.floorIndex !== undefined ? `Floor ${snap.floorIndex}` : 'Floor plan snapshot'}
              <span style={{ ...metaStyle, marginLeft: 6 }}>{snap.snapshotId}</span>
            </span>
            <ConfidenceBadge reviewStatus={snap.reviewStatus} />
            <ActionButtons
              reviewStatus={snap.reviewStatus}
              onConfirm={() => updateSnapshotStatus(snap.snapshotId, 'confirmed')}
              onReject={() => updateSnapshotStatus(snap.snapshotId, 'rejected')}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={snap.includeInCustomerReport}
                onChange={() => toggleSnapshotCustomerReport(snap.snapshotId)}
                disabled={snap.reviewStatus === 'rejected'}
              />
              Customer report
            </label>
          </ItemRow>
        ))}
      </Section>

      {/* Voice Notes */}
      <Section title="Notes" count={voiceNotes.length} empty="No voice notes captured.">
        {voiceNotes.map((vn) => (
          <ItemRow key={vn.voiceNoteId}>
            <span style={labelStyle}>
              {vn.transcript
                ? vn.transcript.slice(0, 80) + (vn.transcript.length > 80 ? '…' : '')
                : 'Voice note (no transcript)'}
              {vn.roomId && <span style={{ ...metaStyle, marginLeft: 6 }}>in {vn.roomId}</span>}
            </span>
            <span style={{ ...metaStyle }}>Engineer only</span>
          </ItemRow>
        ))}
      </Section>

      {/* QA Flags */}
      {qaFlags.filter((f) => f.severity !== 'info').length > 0 && (
        <Section
          title="QA Flags"
          count={qaFlags.filter((f) => f.severity !== 'info').length}
        >
          {qaFlags
            .filter((f) => f.severity !== 'info')
            .map((flag, i) => (
              <ItemRow key={`${flag.code}-${i}`}>
                <span style={labelStyle}>
                  {flag.message ?? flag.code}
                  {flag.entityId && <span style={{ ...metaStyle, marginLeft: 6 }}>({flag.entityId})</span>}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  background: flag.severity === 'error' ? '#fef2f2' : '#fffbeb',
                  color: flag.severity === 'error' ? '#b91c1c' : '#a16207',
                }}>
                  {flag.severity.toUpperCase()}
                </span>
                <span style={{ ...metaStyle }}>Engineer only</span>
              </ItemRow>
            ))}
        </Section>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button
          onClick={handleConfirm}
          disabled={saving}
          style={{
            padding: '10px 28px', fontSize: 14, fontWeight: 600,
            background: saving ? '#6b7280' : '#6366f1',
            color: '#fff', border: 'none', borderRadius: 6,
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Confirm all decisions'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: '10px 20px', fontSize: 14,
            background: 'none', border: '1px solid #d1d5db',
            borderRadius: 6, cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
      </div>

      <p style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
        Confirmed items will be trusted in Atlas outputs.
        Rejected items are excluded from all outputs but remain visible here for audit.
        LiDAR-inferred items must be confirmed before use.
      </p>
    </div>
  );
}
