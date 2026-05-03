/**
 * ScanFabricEvidencePanel.tsx
 *
 * Engineer-facing panel for floor-plan fabric evidence captured in a
 * SessionCaptureV2.
 *
 * Shows per-room fabric records with boundaries (external/internal/party/
 * unknown) and openings (door/window/patio/rooflight/open_arch).  Each
 * element carries a ReviewStatusBadge.
 *
 * Filtering rules
 * ───────────────
 * - This panel is ENGINEER ONLY.  Fabric data is internal until the heat-loss
 *   pipeline integration is in place.
 * - Rejected elements are shown with an "Audit only" note — they are retained
 *   as evidence but clearly marked.
 * - Do not render this panel in customer portal, deck, or PDF outputs.
 *
 * Viewer only — read-only, no mutations, no engine calls.
 */

import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import type {
  FloorPlanFabricCaptureV1,
  FabricBoundaryV1,
  FabricOpeningV1,
  FabricReviewStatusV1,
} from '../scanImport/contracts/sessionCaptureV2';
import { getFabricEvidenceSummary } from './scanEvidenceSelectors';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import type { ReviewStatus } from './ReviewStatusBadge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toReviewStatus(s: FabricReviewStatusV1 | undefined): ReviewStatus {
  return s ?? 'pending';
}

function fmtM(val: number | undefined, unit = 'm'): string {
  return val !== undefined ? `${val.toFixed(2)} ${unit}` : '—';
}

const BOUNDARY_TYPE_LABELS: Record<string, string> = {
  external: 'External',
  internal: 'Internal',
  party: 'Party',
  unknown: 'Unknown',
};

const OPENING_TYPE_LABELS: Record<string, string> = {
  door: 'Door',
  window: 'Window',
  patio: 'Patio door',
  rooflight: 'Rooflight',
  open_arch: 'Open arch',
};

function boundaryTypeLabel(type: string): string {
  return BOUNDARY_TYPE_LABELS[type] ?? type;
}

function openingTypeLabel(type: string): string {
  return OPENING_TYPE_LABELS[type] ?? type;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AuditOnlyNote() {
  return (
    <span
      style={{
        fontSize: '0.65rem',
        fontStyle: 'italic',
        color: '#6b7280',
        marginLeft: '0.25rem',
      }}
    >
      audit only
    </span>
  );
}

function BoundaryRow({ boundary }: { boundary: FabricBoundaryV1 }) {
  const status = toReviewStatus(boundary.reviewStatus);
  return (
    <div
      data-testid={`fabric-boundary-row-${boundary.boundaryId}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        padding: '0.4rem 0.6rem',
        borderBottom: '1px solid #f1f5f9',
        flexWrap: 'wrap',
        fontSize: '0.8rem',
      }}
    >
      <span style={{ minWidth: 80, fontWeight: 600, color: '#1e293b', flexShrink: 0 }}>
        {boundaryTypeLabel(boundary.type)}
      </span>
      <span style={{ color: '#475569', minWidth: 70, flexShrink: 0 }}>
        {fmtM(boundary.lengthM)} × {fmtM(boundary.heightM)}
      </span>
      {boundary.material && (
        <span style={{ color: '#64748b', flex: 1 }}>{boundary.material}</span>
      )}
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', marginLeft: 'auto' }}>
        <ReviewStatusBadge status={status} />
        {status === 'rejected' && <AuditOnlyNote />}
      </div>
    </div>
  );
}

function OpeningRow({ opening }: { opening: FabricOpeningV1 }) {
  const status = toReviewStatus(opening.reviewStatus);
  return (
    <div
      data-testid={`fabric-opening-row-${opening.openingId}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        padding: '0.4rem 0.6rem',
        borderBottom: '1px solid #f1f5f9',
        flexWrap: 'wrap',
        fontSize: '0.8rem',
      }}
    >
      <span style={{ minWidth: 80, fontWeight: 600, color: '#1e293b', flexShrink: 0 }}>
        {openingTypeLabel(opening.type)}
      </span>
      <span style={{ color: '#475569', minWidth: 70, flexShrink: 0 }}>
        {fmtM(opening.widthM, 'm')} × {fmtM(opening.heightM, 'm')}
      </span>
      {opening.material && (
        <span style={{ color: '#64748b', flex: 1 }}>{opening.material}</span>
      )}
      {opening.linkedBoundaryId && (
        <span
          style={{
            fontSize: '0.68rem',
            padding: '0.05rem 0.35rem',
            borderRadius: 3,
            background: '#f0f9ff',
            color: '#0369a1',
            border: '1px solid #bae6fd',
          }}
        >
          ↔ {opening.linkedBoundaryId}
        </span>
      )}
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', marginLeft: 'auto' }}>
        <ReviewStatusBadge status={status} />
        {status === 'rejected' && <AuditOnlyNote />}
      </div>
    </div>
  );
}

function RoomFabricCard({ fabric, index }: { fabric: FloorPlanFabricCaptureV1; index: number }) {
  const roomLabel = fabric.roomName ?? fabric.roomId ?? `Room ${index + 1}`;
  const boundaries = fabric.boundaries ?? [];
  const openings = fabric.openings ?? [];

  return (
    <div
      data-testid={`fabric-room-card-${fabric.roomId ?? index}`}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        marginBottom: '0.75rem',
        overflow: 'hidden',
      }}
    >
      {/* Room header */}
      <div
        style={{
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '0.45rem 0.7rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          fontSize: '0.82rem',
        }}
      >
        <span style={{ fontWeight: 700, color: '#1e293b' }}>{roomLabel}</span>
        {fabric.floorAreaM2 !== undefined && (
          <span style={{ color: '#64748b' }}>Floor: {fmtM(fabric.floorAreaM2, 'm²')}</span>
        )}
        {fabric.ceilingHeightM !== undefined && (
          <span style={{ color: '#64748b' }}>Ceiling: {fmtM(fabric.ceilingHeightM)}</span>
        )}
        {fabric.perimeterM !== undefined && (
          <span style={{ color: '#64748b' }}>Perimeter: {fmtM(fabric.perimeterM)}</span>
        )}
      </div>

      {/* Boundaries */}
      {boundaries.length > 0 && (
        <div>
          <div
            style={{
              padding: '0.25rem 0.6rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: '#f1f5f9',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            Boundaries ({boundaries.length})
          </div>
          {boundaries.map((b) => (
            <BoundaryRow key={b.boundaryId} boundary={b} />
          ))}
        </div>
      )}

      {/* Openings */}
      {openings.length > 0 && (
        <div>
          <div
            style={{
              padding: '0.25rem 0.6rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: '#f1f5f9',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            Openings ({openings.length})
          </div>
          {openings.map((o) => (
            <OpeningRow key={o.openingId} opening={o} />
          ))}
        </div>
      )}

      {boundaries.length === 0 && openings.length === 0 && (
        <p
          style={{
            margin: 0,
            padding: '0.6rem',
            fontSize: '0.78rem',
            color: '#94a3b8',
            fontStyle: 'italic',
          }}
        >
          No boundaries or openings recorded for this room.
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ScanFabricEvidencePanelProps {
  capture: SessionCaptureV2;
}

export function ScanFabricEvidencePanel({ capture }: ScanFabricEvidencePanelProps) {
  const rooms = getFabricEvidenceSummary(capture);

  if (rooms.length === 0) {
    return (
      <p
        data-testid="scan-fabric-evidence-empty"
        style={{
          margin: 0,
          fontSize: '0.8rem',
          color: '#94a3b8',
          fontStyle: 'italic',
        }}
      >
        No fabric data received from Scan.
      </p>
    );
  }

  return (
    <div data-testid="scan-fabric-evidence-panel">
      {rooms.map((fabric, i) => (
        <RoomFabricCard key={fabric.roomId ?? i} fabric={fabric} index={i} />
      ))}
    </div>
  );
}
