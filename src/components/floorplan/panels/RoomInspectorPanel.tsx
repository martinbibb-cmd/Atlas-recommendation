/**
 * RoomInspectorPanel — shows room details when a room is selected.
 *
 * Displays: name, type, floor assignment, dimensions, area, wall count,
 * object count, and notes.  All fields are editable inline.
 *
 * "Wall count" and "object count" are read-only derived values — they give
 * the surveyor a quick sense of how much is captured for this room without
 * leaving the inspector.
 *
 * PR17: quick actions row (Delete, Duplicate, Focus).
 */

import type { FloorPlan, Room, RoomType, Wall, FloorObject } from '../propertyPlan.types';
import { ROOM_TYPE_LABELS, ROOM_TYPE_EMOJI } from '../propertyPlan.types';
import { roomAreaM2, GRID } from '../../../features/floorplan/geometry';
import {
  provenanceToLayoutConfidence,
  LAYOUT_CONFIDENCE_LABELS,
} from '../../../features/floorplan/provenanceToLayoutConfidence';

// Remove local GRID constant — imported from geometry module via re-export.

interface Props {
  room: Room;
  floors: FloorPlan[];
  /** All walls on the active floor — used to count walls adjacent to this room. */
  walls: Wall[];
  /** All floor objects on the active floor — used to count objects in room. */
  floorObjects: FloorObject[];
  onUpdate: (patch: Partial<Room>) => void;
  onDelete: () => void;
  /** Duplicate this room (PR17 quick action). */
  onDuplicate?: () => void;
  /** Centre the canvas view on this room (PR17 quick action). */
  onFocus?: () => void;
}

/** Count walls whose bounding box overlaps the room by at least one grid cell. */
function countAdjacentWalls(room: Room, walls: Wall[]): number {
  const margin = GRID;
  const rxMin = room.x - margin;
  const rxMax = room.x + room.width + margin;
  const ryMin = room.y - margin;
  const ryMax = room.y + room.height + margin;

  return walls.filter((w) => {
    const wxMin = Math.min(w.x1, w.x2);
    const wxMax = Math.max(w.x1, w.x2);
    const wyMin = Math.min(w.y1, w.y2);
    const wyMax = Math.max(w.y1, w.y2);
    return wxMax >= rxMin && wxMin <= rxMax && wyMax >= ryMin && wyMin <= ryMax;
  }).length;
}

/** Count floor objects assigned to this room. */
function countRoomObjects(room: Room, objects: FloorObject[]): number {
  return objects.filter((o) => o.roomId === room.id).length;
}

export default function RoomInspectorPanel({
  room,
  floors,
  walls,
  floorObjects,
  onUpdate,
  onDelete,
  onDuplicate,
  onFocus,
}: Props) {
  const wallCount = countAdjacentWalls(room, walls);
  const objectCount = countRoomObjects(room, floorObjects);
  const area = roomAreaM2(room);
  const confidence = room.provenance ? provenanceToLayoutConfidence(room.provenance) : null;

  return (
    <div className="fpb__inspector-body">
      <div className="fpb__inspector-heading">
        <span className="fpb__inspector-heading-main">
          <span>{ROOM_TYPE_EMOJI[room.roomType]}</span>
          <span className="fpb__inspector-type">{ROOM_TYPE_LABELS[room.roomType]}</span>
          {room.name && (
            <span className="fpb__inspector-label">{room.name}</span>
          )}
          {confidence && (
            <span className="fpb__confidence-badge fpb__confidence-badge--inline">
              {LAYOUT_CONFIDENCE_LABELS[confidence]}
            </span>
          )}
        </span>
        <button className="fpb__delete-btn" onClick={onDelete} title="Delete room">✕</button>
      </div>

      {/* Quick actions row — PR17 */}
      <div className="fpb__quick-actions">
        <button className="fpb__quick-btn fpb__quick-btn--danger" onClick={onDelete} title="Delete">
          🗑
        </button>
        {onDuplicate && (
          <button className="fpb__quick-btn" onClick={onDuplicate} title="Duplicate room">
            ⧉
          </button>
        )}
        {onFocus && (
          <button className="fpb__quick-btn" onClick={onFocus} title="Centre view on room">
            🎯
          </button>
        )}
      </div>

      {/* Name */}
      <label className="fpb__field">
        <span>Name</span>
        <input
          type="text"
          value={room.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </label>

      {/* Type */}
      <label className="fpb__field">
        <span>Type</span>
        <select
          value={room.roomType}
          onChange={(e) => onUpdate({ roomType: e.target.value as RoomType })}
        >
          {(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map((rt) => (
            <option key={rt} value={rt}>{ROOM_TYPE_LABELS[rt]}</option>
          ))}
        </select>
      </label>

      {/* Floor */}
      <label className="fpb__field">
        <span>Floor</span>
        <select
          value={room.floorId}
          onChange={(e) => onUpdate({ floorId: e.target.value })}
        >
          {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>

      {/* Dimensions */}
      <div className="fpb__field fpb__field--static">
        <span>Dimensions</span>
        <span>{(room.width / GRID).toFixed(1)} m × {(room.height / GRID).toFixed(1)} m</span>
      </div>

      {/* Area */}
      <div className="fpb__field fpb__field--static">
        <span>Area</span>
        <span>{area} m²</span>
      </div>

      {/* Wall count */}
      <div className="fpb__field fpb__field--static">
        <span>Adjacent walls</span>
        <span>{wallCount}</span>
      </div>

      {/* Object count */}
      <div className="fpb__field fpb__field--static">
        <span>Objects in room</span>
        <span>{objectCount}</span>
      </div>

      {/* Notes */}
      <label className="fpb__field">
        <span>Notes</span>
        <textarea
          rows={3}
          value={room.notes ?? ''}
          onChange={(e) => onUpdate({ notes: e.target.value })}
        />
      </label>
    </div>
  );
}
