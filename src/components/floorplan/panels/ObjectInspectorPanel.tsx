/**
 * ObjectInspectorPanel — inspector for FloorObjects (non-HVAC fixtures).
 *
 * Shows type, label, dimensions, room and wall assignment, and provenance.
 * All editable fields delegate to `onUpdate`.
 */

import type { FloorObject, FloorObjectType, Room, Wall } from '../propertyPlan.types';
import { FLOOR_OBJECT_TYPE_LABELS, FLOOR_OBJECT_TYPE_EMOJI } from '../propertyPlan.types';

interface Props {
  object: FloorObject;
  rooms: Room[];
  walls: Wall[];
  onUpdate: (patch: Partial<Omit<FloorObject, 'id' | 'floorId' | 'provenance'>>) => void;
  onDelete: () => void;
}

export default function ObjectInspectorPanel({ object, rooms, walls, onUpdate, onDelete }: Props) {
  return (
    <div className="fpb__inspector-body">
      <div className="fpb__inspector-heading">
        <span>
          {FLOOR_OBJECT_TYPE_EMOJI[object.type]} {FLOOR_OBJECT_TYPE_LABELS[object.type]}
        </span>
        <button className="fpb__delete-btn" onClick={onDelete} title="Delete object">✕</button>
      </div>

      {/* Type */}
      <label className="fpb__field">
        <span>Type</span>
        <select
          value={object.type}
          onChange={(e) => onUpdate({ type: e.target.value as FloorObjectType })}
        >
          {(Object.keys(FLOOR_OBJECT_TYPE_LABELS) as FloorObjectType[]).map((t) => (
            <option key={t} value={t}>
              {FLOOR_OBJECT_TYPE_EMOJI[t]} {FLOOR_OBJECT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      {/* Label */}
      <label className="fpb__field">
        <span>Label</span>
        <input
          type="text"
          placeholder="e.g. Kitchen sink"
          value={object.label ?? ''}
          onChange={(e) => onUpdate({ label: e.target.value || undefined })}
        />
      </label>

      {/* Width */}
      <label className="fpb__field">
        <span>Width (m)</span>
        <input
          type="number"
          min={0}
          step={0.05}
          value={object.widthM ?? ''}
          onChange={(e) => onUpdate({ widthM: e.target.value ? Number(e.target.value) : undefined })}
        />
      </label>

      {/* Height (depth from wall) */}
      <label className="fpb__field">
        <span>Depth (m)</span>
        <input
          type="number"
          min={0}
          step={0.05}
          value={object.heightM ?? ''}
          onChange={(e) => onUpdate({ heightM: e.target.value ? Number(e.target.value) : undefined })}
        />
      </label>

      {/* Room assignment */}
      <label className="fpb__field">
        <span>Room</span>
        <select
          value={object.roomId ?? ''}
          onChange={(e) => onUpdate({ roomId: e.target.value || undefined })}
        >
          <option value="">— no room —</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>

      {/* Wall assignment */}
      <label className="fpb__field">
        <span>Wall</span>
        <select
          value={object.wallId ?? ''}
          onChange={(e) => onUpdate({ wallId: e.target.value || undefined })}
        >
          <option value="">— no wall —</option>
          {walls.map((w, i) => (
            <option key={w.id} value={w.id}>
              Wall {i + 1} ({w.kind})
            </option>
          ))}
        </select>
      </label>

      {/* Provenance */}
      {object.provenance && (
        <div className="fpb__field fpb__field--static">
          <span>Source</span>
          <span className="fpb__provenance-badge">
            {object.provenance.source === 'manual' ? '✎ manual' : object.provenance.source}
            {object.provenance.reviewStatus === 'corrected' ? ' · confirmed' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
