/**
 * ScanRoomList.tsx
 *
 * Engineer-facing viewer for the room scans captured in a SessionCaptureV2.
 *
 * Shows each room's label, floor index, area, and capture status alongside
 * a per-room confidence badge derived from session QA flags.
 *
 * Viewer only — read-only, no mutations, no engine calls.
 */

import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import {
  selectRooms,
  deriveEntityConfidence,
} from './scanEvidenceSelectors';
import type { RoomScanV2 } from './scanEvidenceSelectors';
import { AnchorConfidenceBadge } from './AnchorConfidenceBadge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function floorLabel(floorIndex: number | undefined): string {
  if (floorIndex === undefined) return '—';
  if (floorIndex === 0) return 'Ground floor';
  if (floorIndex === 1) return 'First floor';
  if (floorIndex === 2) return 'Second floor';
  return `Floor ${floorIndex}`;
}

// ─── Room row ─────────────────────────────────────────────────────────────────

function RoomRow({
  room,
  capture,
}: {
  room: RoomScanV2;
  capture: SessionCaptureV2;
}) {
  const confidence = deriveEntityConfidence(capture, room.roomId);
  const isComplete = room.status === 'complete';

  return (
    <div
      data-testid={`scan-room-row-${room.roomId}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        borderBottom: '1px solid #f1f5f9',
        flexWrap: 'wrap',
      }}
    >
      {/* Status indicator */}
      <span
        title={isComplete ? 'Scan complete' : 'Scan in progress'}
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: isComplete ? '#22c55e' : '#f59e0b',
          flexShrink: 0,
        }}
      />

      {/* Label + floor */}
      <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
        {room.label}
      </span>

      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
        {floorLabel(room.floorIndex)}
      </span>

      {room.areaM2 != null && (
        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
          {room.areaM2} m²
        </span>
      )}

      <AnchorConfidenceBadge tier={confidence} />

      {!isComplete && (
        <span style={{
          fontSize: '0.68rem',
          fontWeight: 600,
          padding: '0.1rem 0.4rem',
          borderRadius: 4,
          background: '#fffbeb',
          color: '#92400e',
          border: '1px solid #fcd34d',
        }}>
          Incomplete
        </span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ScanRoomListProps {
  capture: SessionCaptureV2;
}

export function ScanRoomList({ capture }: ScanRoomListProps) {
  const rooms = selectRooms(capture);

  if (rooms.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
        No room scans captured.
      </p>
    );
  }

  return (
    <div
      data-testid="scan-room-list"
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {rooms.map((room) => (
        <RoomRow key={room.roomId} room={room} capture={capture} />
      ))}
    </div>
  );
}
