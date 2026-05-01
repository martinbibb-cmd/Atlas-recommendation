/**
 * ScanPipeRouteList.tsx
 *
 * Engineer-facing list of pipe-route pins captured in a SessionCaptureV2.
 *
 * Pipe routes are object pins with objectType === 'pipe_route'.  They are
 * surfaced separately from other object pins because they represent spatial
 * routing evidence rather than discrete installed objects.
 *
 * Each row shows the optional label, room association, linked photo count,
 * LiDAR provenance, and a derived review status.
 *
 * Viewer only — read-only, no mutations, no engine calls.
 */

import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import {
  selectPipeRoutes,
  selectPhotosByPin,
  isLidarInferred,
  deriveEntityConfidence,
} from './scanEvidenceSelectors';
import type { ObjectPinV2 } from './scanEvidenceSelectors';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import { ProvenanceBadge } from './ProvenanceBadge';
import { AnchorConfidenceBadge } from './AnchorConfidenceBadge';

// ─── Route row ────────────────────────────────────────────────────────────────

function PipeRouteRow({
  route,
  capture,
  index,
}: {
  route: ObjectPinV2;
  capture: SessionCaptureV2;
  index: number;
}) {
  const lidar = isLidarInferred(route);
  const reviewStatus = lidar ? 'pending' : 'confirmed';
  const confidence = deriveEntityConfidence(capture, route.pinId);
  const linkedPhotos = selectPhotosByPin(capture, route.pinId);

  return (
    <div
      data-testid={`scan-pipe-route-row-${route.pinId}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.55rem 0.75rem',
        borderBottom: '1px solid #f1f5f9',
        flexWrap: 'wrap',
      }}
    >
      {/* Route number */}
      <span style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        color: '#64748b',
        minWidth: 24,
        flexShrink: 0,
      }}>
        #{index + 1}
      </span>

      {/* Label or fallback */}
      <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
        {route.label ?? `Pipe route ${route.pinId}`}
      </span>

      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Room */}
        {route.roomId && (
          <span style={{
            fontSize: '0.68rem',
            padding: '0.05rem 0.4rem',
            borderRadius: 3,
            background: '#f0f9ff',
            color: '#0369a1',
            border: '1px solid #bae6fd',
          }}>
            {route.roomId}
          </span>
        )}

        {/* Photo count */}
        {linkedPhotos.length > 0 && (
          <span style={{
            fontSize: '0.68rem',
            padding: '0.05rem 0.4rem',
            borderRadius: 3,
            background: '#f8fafc',
            color: '#64748b',
            border: '1px solid #e2e8f0',
          }}>
            📷 {linkedPhotos.length}
          </span>
        )}

        <ProvenanceBadge isLidarInferred={lidar} />
        <ReviewStatusBadge status={reviewStatus} />
        <AnchorConfidenceBadge tier={confidence} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ScanPipeRouteListProps {
  capture: SessionCaptureV2;
}

export function ScanPipeRouteList({ capture }: ScanPipeRouteListProps) {
  const routes = selectPipeRoutes(capture);

  if (routes.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
        No pipe routes captured.
      </p>
    );
  }

  return (
    <div
      data-testid="scan-pipe-route-list"
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {routes.map((route, i) => (
        <PipeRouteRow key={route.pinId} route={route} capture={capture} index={i} />
      ))}
    </div>
  );
}
