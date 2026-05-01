/**
 * ScanObjectPinList.tsx
 *
 * Engineer-facing list of object pins captured in a SessionCaptureV2.
 *
 * Excludes pipe-route pins (objectType === 'pipe_route') — those are
 * rendered by ScanPipeRouteList.
 *
 * Each row shows the pin type, optional label, room association, linked photo
 * count, LiDAR provenance, and a derived review status.
 *
 * Viewer only — read-only, no mutations, no engine calls.
 */

import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import {
  selectObjectPins,
  selectPhotosByPin,
  isLidarInferred,
  deriveEntityConfidence,
} from './scanEvidenceSelectors';
import type { ObjectPinV2 } from './scanEvidenceSelectors';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import { ProvenanceBadge } from './ProvenanceBadge';
import { AnchorConfidenceBadge } from './AnchorConfidenceBadge';

// ─── Display labels ───────────────────────────────────────────────────────────

const OBJECT_TYPE_LABELS: Record<string, string> = {
  boiler: 'Boiler',
  cylinder: 'Cylinder',
  radiator: 'Radiator',
  gas_meter: 'Gas Meter',
  flue: 'Flue',
  sink: 'Sink',
  bath: 'Bath',
  shower: 'Shower',
  thermostat: 'Thermostat',
  pipe: 'Pipe',
  consumer_unit: 'Consumer Unit',
  other: 'Other',
};

function objectTypeLabel(type: string): string {
  return OBJECT_TYPE_LABELS[type] ?? type;
}

// ─── Pin row ──────────────────────────────────────────────────────────────────

function PinRow({
  pin,
  capture,
}: {
  pin: ObjectPinV2;
  capture: SessionCaptureV2;
}) {
  const lidar = isLidarInferred(pin);
  const reviewStatus = lidar ? 'pending' : 'confirmed';
  const confidence = deriveEntityConfidence(capture, pin.pinId);
  const linkedPhotos = selectPhotosByPin(capture, pin.pinId);

  return (
    <div
      data-testid={`scan-object-pin-row-${pin.pinId}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        padding: '0.55rem 0.75rem',
        borderBottom: '1px solid #f1f5f9',
        flexWrap: 'wrap',
      }}
    >
      {/* Type label */}
      <span style={{
        minWidth: 110,
        fontSize: '0.85rem',
        fontWeight: 600,
        color: '#1e293b',
        flexShrink: 0,
      }}>
        {objectTypeLabel(pin.objectType)}
      </span>

      {/* Optional label */}
      {pin.label && (
        <span style={{ fontSize: '0.82rem', color: '#374151', flex: 1 }}>
          {pin.label}
        </span>
      )}

      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
        {/* Room */}
        {pin.roomId && (
          <span style={{
            fontSize: '0.68rem',
            padding: '0.05rem 0.4rem',
            borderRadius: 3,
            background: '#f0f9ff',
            color: '#0369a1',
            border: '1px solid #bae6fd',
          }}>
            {pin.roomId}
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

export interface ScanObjectPinListProps {
  capture: SessionCaptureV2;
}

export function ScanObjectPinList({ capture }: ScanObjectPinListProps) {
  const pins = selectObjectPins(capture);

  if (pins.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
        No object pins captured.
      </p>
    );
  }

  return (
    <div
      data-testid="scan-object-pin-list"
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {pins.map((pin) => (
        <PinRow key={pin.pinId} pin={pin} capture={capture} />
      ))}
    </div>
  );
}
