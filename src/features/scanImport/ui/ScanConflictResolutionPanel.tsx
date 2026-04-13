/**
 * ScanConflictResolutionPanel.tsx
 *
 * Presents a side-by-side conflict resolution UI when an imported scan bundle
 * contains room dimensions that differ from values already entered manually in
 * the Atlas floor plan.
 *
 * Each conflict row shows:
 *   - Room name and type
 *   - The manually-entered area (m²)
 *   - The LiDAR-derived area from the scan (m²)
 *   - A "Keep manual" / "Use scan" radio choice per room
 *
 * Design rules:
 *   - Never silently override a manually-entered value.
 *   - The surveyor must confirm each conflicting room explicitly.
 *   - Non-conflicting rooms are imported automatically without prompting.
 *   - Provenance is set to 'scanned' on rooms where the scan value wins, and
 *     left as 'entered_manually' on rooms where the manual value is kept.
 */

import { useState, useCallback } from 'react';
import type { CanonicalFloorPlanDraft } from '../importer/scanMapper';
import type { Room } from '../../../components/floorplan/propertyPlan.types';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The area-conflict tolerance: differences smaller than this are ignored (m²). */
const AREA_CONFLICT_THRESHOLD_M2 = 0.25;

/**
 * A single room-level area conflict.
 *
 * existingRoom  — the Room already present in the Atlas floor plan (manual data)
 * scannedAreaM2 — the area derived from the LiDAR scan (m²)
 * scannedRoomId — the scan-side room id for cross-reference
 */
export interface ScanRoomConflict {
  existingRoom: Room;
  existingAreaM2: number;
  scannedAreaM2: number;
  scannedRoomId: string;
}

/** Resolution choice for a single conflicting room. */
export type ConflictResolution = 'keep_manual' | 'use_scan';

/** A map from existing-room id to the chosen resolution. */
export type ConflictResolutionMap = Map<string, ConflictResolution>;

// ─── Conflict detection ───────────────────────────────────────────────────────

/**
 * Detects area conflicts between rooms in the incoming scan draft and rooms
 * that already exist in the active Atlas floor plan.
 *
 * Matching strategy: rooms are matched by name (case-insensitive) within the
 * same floor. A conflict is raised when the areas differ by more than
 * `AREA_CONFLICT_THRESHOLD_M2` (0.25 m²).
 *
 * @param draft         - The CanonicalFloorPlanDraft produced by importScanBundle.
 * @param existingRooms - Rooms already present in the active Atlas floor plan.
 * @param gridUnitsPerMetre - Canvas-unit to metre conversion factor (default 24).
 */
export function detectScanConflicts(
  draft: CanonicalFloorPlanDraft,
  existingRooms: Room[],
  gridUnitsPerMetre = 24,
): ScanRoomConflict[] {
  const conflicts: ScanRoomConflict[] = [];

  for (const floor of draft.floors) {
    for (const scannedRoom of floor.rooms) {
      // Use areaM2 if available; otherwise derive from canvas dimensions.
      const scannedAreaM2: number =
        scannedRoom.areaM2 ??
        (scannedRoom.width / gridUnitsPerMetre) * (scannedRoom.height / gridUnitsPerMetre);

      // Find a matching existing room by name (case-insensitive).
      const match = existingRooms.find(
        r => r.name.trim().toLowerCase() === scannedRoom.name.trim().toLowerCase(),
      );
      if (match == null) continue;

      // Derive the existing room's area.
      const existingAreaM2: number =
        match.areaM2 ??
        (match.width / gridUnitsPerMetre) * (match.height / gridUnitsPerMetre);

      if (Math.abs(scannedAreaM2 - existingAreaM2) > AREA_CONFLICT_THRESHOLD_M2) {
        conflicts.push({
          existingRoom: match,
          existingAreaM2,
          scannedAreaM2,
          scannedRoomId: scannedRoom.id,
        });
      }
    }
  }

  return conflicts;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  conflicts: ScanRoomConflict[];
  /** Called with the final resolution choices when the engineer clicks Confirm. */
  onConfirm: (resolutions: ConflictResolutionMap) => void;
  /** Called when the engineer clicks Cancel (aborts the import). */
  onCancel: () => void;
}

/** Format an area to one decimal place with the m² unit. */
function fmtArea(m2: number): string {
  return `${m2.toFixed(1)} m²`;
}

/**
 * ScanConflictResolutionPanel
 *
 * Side-by-side comparison for rooms where LiDAR and manual data differ.
 * The engineer must resolve each conflict before the import can proceed.
 */
export default function ScanConflictResolutionPanel({ conflicts, onConfirm, onCancel }: Props) {
  const [resolutions, setResolutions] = useState<ConflictResolutionMap>(
    () => new Map(conflicts.map(c => [c.existingRoom.id, 'keep_manual'])),
  );

  const setResolution = useCallback(
    (roomId: string, choice: ConflictResolution) => {
      setResolutions(prev => {
        const next = new Map(prev);
        next.set(roomId, choice);
        return next;
      });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    onConfirm(resolutions);
  }, [onConfirm, resolutions]);

  const containerStyle: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
  };

  const bannerStyle: React.CSSProperties = {
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 20,
    fontSize: 13,
    color: '#92400e',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
    marginBottom: 20,
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left' as const,
    padding: '6px 10px',
    borderBottom: '2px solid #e5e7eb',
    fontWeight: 700,
    color: '#374151',
  };

  const tdStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderBottom: '1px solid #f3f4f6',
    verticalAlign: 'middle' as const,
  };

  return (
    <div style={containerStyle}>
      <div style={bannerStyle}>
        <strong>Area conflict detected.</strong>{' '}
        The LiDAR scan recorded different room sizes to your manual entries. Choose
        which measurement to keep for each room — scan data is not applied automatically.
      </div>

      <table style={tableStyle} aria-label="Room area conflicts">
        <thead>
          <tr>
            <th style={thStyle}>Room</th>
            <th style={thStyle}>Your measurement</th>
            <th style={thStyle}>LiDAR scan</th>
            <th style={thStyle}>Keep</th>
          </tr>
        </thead>
        <tbody>
          {conflicts.map(conflict => {
            const choice = resolutions.get(conflict.existingRoom.id) ?? 'keep_manual';
            const diff = conflict.scannedAreaM2 - conflict.existingAreaM2;
            const diffLabel =
              diff > 0
                ? `+${diff.toFixed(1)} m²`
                : `${diff.toFixed(1)} m²`;

            return (
              <tr key={conflict.existingRoom.id}>
                <td style={tdStyle}>
                  <span style={{ fontWeight: 600 }}>{conflict.existingRoom.name}</span>
                </td>
                <td style={{ ...tdStyle, color: choice === 'keep_manual' ? '#1a202c' : '#9ca3af' }}>
                  {fmtArea(conflict.existingAreaM2)}
                </td>
                <td style={{ ...tdStyle, color: choice === 'use_scan' ? '#1a202c' : '#9ca3af' }}>
                  {fmtArea(conflict.scannedAreaM2)}{' '}
                  <span style={{ fontSize: 11, color: '#6b7280' }}>({diffLabel})</span>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ cursor: 'pointer', fontWeight: choice === 'keep_manual' ? 700 : 400 }}>
                      <input
                        type="radio"
                        name={`conflict-${conflict.existingRoom.id}`}
                        value="keep_manual"
                        checked={choice === 'keep_manual'}
                        onChange={() => setResolution(conflict.existingRoom.id, 'keep_manual')}
                        style={{ marginRight: 4 }}
                      />
                      Manual
                    </label>
                    <label style={{ cursor: 'pointer', fontWeight: choice === 'use_scan' ? 700 : 400 }}>
                      <input
                        type="radio"
                        name={`conflict-${conflict.existingRoom.id}`}
                        value="use_scan"
                        checked={choice === 'use_scan'}
                        onChange={() => setResolution(conflict.existingRoom.id, 'use_scan')}
                        style={{ marginRight: 4 }}
                      />
                      Scan
                    </label>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={handleConfirm}
          style={{
            padding: '9px 22px',
            fontSize: 14,
            fontWeight: 600,
            background: '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Confirm and continue
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '9px 18px',
            fontSize: 14,
            border: '1px solid #d1d5db',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Cancel import
        </button>
      </div>
    </div>
  );
}
