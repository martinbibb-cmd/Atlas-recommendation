/**
 * ScanPhotoEvidenceGrid.tsx
 *
 * Engineer-facing grid viewer for photos captured in a SessionCaptureV2.
 *
 * Because photos originate from a mobile device, their URIs are device-local
 * paths (e.g. file://session/ph-v2-001.jpg) and cannot be loaded as <img>
 * src values in a web context.  The grid therefore shows metadata cards
 * with filename, scope, room association, tags, and capture timestamp.
 *
 * When review callbacks are provided, each photo card shows inline
 * Confirm / Needs Review / Reject controls so the engineer can classify
 * photos before they appear in customer-facing proof output.
 */

import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import { selectPhotos } from './scanEvidenceSelectors';
import type { PhotoV2 } from './scanEvidenceSelectors';
import { EvidenceReviewControls } from './EvidenceReviewControls';
import type { EvidenceReviewDecisionV1, EvidenceReviewStatus } from './EvidenceReviewDecisionV1';

// ─── Rejected-item style tokens ──────────────────────────────────────────────

const REJECTED_BG = '#fef2f2';
const REJECTED_BORDER = '#fca5a5';
const DEFAULT_BG = '#f8fafc';
const DEFAULT_BORDER = '#e2e8f0';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a human-readable filename from a URI. */
function uriToFilename(uri: string): string {
  try {
    const parts = uri.split('/');
    return parts[parts.length - 1] || uri;
  } catch {
    return uri;
  }
}

/** Format a capturedAt ISO timestamp as a compact local time string. */
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const SCOPE_LABELS: Record<PhotoV2['scope'], string> = {
  session: 'Session',
  room: 'Room',
  object: 'Object',
};

// ─── Photo card ───────────────────────────────────────────────────────────────

function PhotoCard({
  photo,
  decision,
  onDecide,
  onClear,
}: {
  photo: PhotoV2;
  decision?: EvidenceReviewDecisionV1;
  onDecide?: (
    itemId: string,
    kind: 'photo',
    status: EvidenceReviewStatus,
    note?: string,
  ) => void;
  onClear?: (itemId: string) => void;
}) {
  return (
    <div
      data-testid={`scan-photo-card-${photo.photoId}`}
      style={{
        background: decision?.status === 'rejected' ? REJECTED_BG : DEFAULT_BG,
        border: `1px solid ${decision?.status === 'rejected' ? REJECTED_BORDER : DEFAULT_BORDER}`,
        borderRadius: 6,
        padding: '0.6rem 0.8rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
      }}
    >
      {/* Scope pill + filename */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '0.68rem',
          fontWeight: 600,
          padding: '0.1rem 0.4rem',
          borderRadius: 3,
          background: '#e0f2fe',
          color: '#0369a1',
          border: '1px solid #bae6fd',
        }}>
          {SCOPE_LABELS[photo.scope]}
        </span>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b', wordBreak: 'break-all' }}>
          {uriToFilename(photo.uri)}
        </span>
      </div>

      {/* Room association */}
      {photo.roomId && (
        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
          Room: <code style={{ fontSize: '0.7rem' }}>{photo.roomId}</code>
        </span>
      )}

      {/* Object pin association */}
      {photo.objectPinId && (
        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
          Pin: <code style={{ fontSize: '0.7rem' }}>{photo.objectPinId}</code>
        </span>
      )}

      {/* Tags */}
      {photo.tags && photo.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {photo.tags.map((tag) => (
            <span key={tag} style={{
              fontSize: '0.65rem',
              padding: '0.05rem 0.35rem',
              borderRadius: 3,
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0',
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Timestamp */}
      <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.1rem' }}>
        {formatTime(photo.capturedAt)}
      </span>

      {/* Review controls — shown only when review callbacks are provided */}
      {onDecide && (
        <EvidenceReviewControls
          itemId={photo.photoId}
          kind="photo"
          currentStatus={decision?.status}
          currentNote={decision?.engineerNote}
          onDecide={(itemId, _kind, status, note) => onDecide(itemId, 'photo', status, note)}
          onClear={onClear}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ScanPhotoEvidenceGridProps {
  capture: SessionCaptureV2;
  /**
   * Review decisions keyed by photoId.
   * When provided alongside onDecide, each photo card shows review controls.
   */
  reviewDecisions?: Record<string, EvidenceReviewDecisionV1>;
  /** Called when the engineer makes a review decision for a photo. */
  onDecide?: (
    itemId: string,
    kind: 'photo',
    status: EvidenceReviewStatus,
    note?: string,
  ) => void;
  /** Called when the engineer clears a review decision. */
  onClear?: (itemId: string) => void;
}

export function ScanPhotoEvidenceGrid({
  capture,
  reviewDecisions,
  onDecide,
  onClear,
}: ScanPhotoEvidenceGridProps) {
  const photos = selectPhotos(capture);

  if (photos.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
        No photos captured.
      </p>
    );
  }

  return (
    <div
      data-testid="scan-photo-evidence-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '0.5rem',
      }}
    >
      {photos.map((photo) => (
        <PhotoCard
          key={photo.photoId}
          photo={photo}
          decision={reviewDecisions?.[photo.photoId]}
          onDecide={onDecide}
          onClear={onClear}
        />
      ))}
    </div>
  );
}
