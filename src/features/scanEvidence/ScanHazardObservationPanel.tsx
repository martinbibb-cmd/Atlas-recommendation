/**
 * ScanHazardObservationPanel.tsx
 *
 * Engineer-facing panel for hazard observations captured in a SessionCaptureV2.
 *
 * Filtering rules
 * ───────────────
 * - Engineer view: confirmed and pending hazards are shown actively.
 * - Rejected hazards: displayed with an "Audit only" note — they are retained
 *   as evidence but clearly marked as not actioned.
 * - This panel is ENGINEER ONLY.  Customer portal, deck, and PDF must never
 *   show hazard detail — use getCustomerSafeFabricEvidence() gate.
 *
 * Viewer only — read-only, no mutations, no engine calls, no risk scoring.
 */

import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import type {
  HazardObservationCaptureV1,
  HazardSeverityV1,
} from '../scanImport/contracts/sessionCaptureV2';
import { getHazardEvidenceSummary, hasBlockingHazard } from './scanEvidenceSelectors';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import type { ReviewStatus } from './ReviewStatusBadge';

// ─── Severity styling ─────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<
  HazardSeverityV1,
  { bg: string; color: string; border: string; label: string }
> = {
  low:      { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd', label: 'Low' },
  medium:   { bg: '#fffbeb', color: '#92400e', border: '#fcd34d', label: 'Medium' },
  high:     { bg: '#fff7ed', color: '#c2410c', border: '#fdba74', label: 'High' },
  blocking: { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5', label: 'Blocking' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  asbestos_suspected: 'Asbestos suspected',
  electrical:         'Electrical',
  structural:         'Structural',
  gas:                'Gas',
  water_damage:       'Water damage',
  other:              'Other',
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

function toReviewStatus(s: string | undefined): ReviewStatus {
  if (s === 'confirmed' || s === 'rejected') return s;
  return 'pending';
}

// ─── Hazard row ───────────────────────────────────────────────────────────────

function HazardRow({ hazard }: { hazard: HazardObservationCaptureV1 }) {
  const sevStyle = SEVERITY_STYLE[hazard.severity] ?? SEVERITY_STYLE.medium;
  const reviewStatus = toReviewStatus(hazard.reviewStatus);
  const isRejected = reviewStatus === 'rejected';

  return (
    <div
      data-testid={`hazard-row-${hazard.hazardId}`}
      style={{
        border: `1px solid ${sevStyle.border}`,
        borderRadius: 6,
        marginBottom: '0.6rem',
        overflow: 'hidden',
        opacity: isRejected ? 0.72 : 1,
      }}
    >
      {/* Row header */}
      <div
        style={{
          background: sevStyle.bg,
          padding: '0.45rem 0.7rem',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* Severity badge */}
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: sevStyle.color,
          }}
        >
          {sevStyle.label}
        </span>

        {/* Category */}
        <span
          style={{
            fontSize: '0.72rem',
            padding: '0.05rem 0.4rem',
            borderRadius: 3,
            background: 'rgba(255,255,255,0.6)',
            color: sevStyle.color,
            border: `1px solid ${sevStyle.border}`,
          }}
        >
          {categoryLabel(hazard.category)}
        </span>

        {/* Title */}
        <span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#1e293b', flex: 1 }}>
          {hazard.title}
        </span>

        {/* Review status */}
        <ReviewStatusBadge status={reviewStatus} />
        {isRejected && (
          <span
            style={{
              fontSize: '0.65rem',
              fontStyle: 'italic',
              color: '#6b7280',
            }}
          >
            audit only
          </span>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          padding: '0.45rem 0.7rem',
          fontSize: '0.8rem',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.3rem',
        }}
      >
        {hazard.description && (
          <p style={{ margin: 0, color: '#374151' }}>{hazard.description}</p>
        )}

        {hazard.actionRequired && (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
            <span style={{ color: '#64748b', minWidth: 90, flexShrink: 0 }}>Action</span>
            <span style={{ color: '#1e293b', fontWeight: 500 }}>{hazard.actionRequired}</span>
          </div>
        )}

        {hazard.linkedPhotoIds && hazard.linkedPhotoIds.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
            <span style={{ color: '#64748b', minWidth: 90, flexShrink: 0 }}>Photos</span>
            <span
              data-testid={`hazard-photo-ids-${hazard.hazardId}`}
              style={{ color: '#0369a1', fontSize: '0.75rem', fontFamily: 'monospace' }}
            >
              {hazard.linkedPhotoIds.join(', ')}
            </span>
          </div>
        )}

        {hazard.linkedObjectPinIds && hazard.linkedObjectPinIds.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
            <span style={{ color: '#64748b', minWidth: 90, flexShrink: 0 }}>Object pins</span>
            <span
              data-testid={`hazard-pin-ids-${hazard.hazardId}`}
              style={{ color: '#0369a1', fontSize: '0.75rem', fontFamily: 'monospace' }}
            >
              {hazard.linkedObjectPinIds.join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ScanHazardObservationPanelProps {
  capture: SessionCaptureV2;
}

export function ScanHazardObservationPanel({ capture }: ScanHazardObservationPanelProps) {
  const hazards = getHazardEvidenceSummary(capture);
  const blocking = hasBlockingHazard(capture);

  if (hazards.length === 0) {
    return (
      <p
        data-testid="scan-hazard-observation-empty"
        style={{
          margin: 0,
          fontSize: '0.8rem',
          color: '#94a3b8',
          fontStyle: 'italic',
        }}
      >
        No hazard observations received from Scan.
      </p>
    );
  }

  return (
    <div data-testid="scan-hazard-observation-panel">
      {blocking && (
        <div
          data-testid="scan-hazard-blocking-banner"
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 6,
            padding: '0.5rem 0.75rem',
            marginBottom: '0.75rem',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: '#b91c1c',
          }}
        >
          ⚠ One or more blocking hazards require engineer review before proceeding.
        </div>
      )}
      {hazards.map((hazard) => (
        <HazardRow key={hazard.hazardId} hazard={hazard} />
      ))}
    </div>
  );
}
