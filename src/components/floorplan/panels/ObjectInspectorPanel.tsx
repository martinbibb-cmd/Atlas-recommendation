/**
 * ObjectInspectorPanel — inspector for FloorObjects (non-HVAC fixtures).
 *
 * Shows type, label, dimensions, room and wall assignment, and provenance.
 * All editable fields delegate to `onUpdate`.
 *
 * PR17: quick actions row (Delete, Duplicate, Focus, Rotate stub),
 *       inline label rename in header, 200 ms confirmation flash.
 */

import { useRef, useState, useCallback } from 'react';
import type { FloorObject, FloorObjectType, Room, Wall } from '../propertyPlan.types';
import { FLOOR_OBJECT_TYPE_LABELS, FLOOR_OBJECT_TYPE_EMOJI } from '../propertyPlan.types';
import {
  provenanceToLayoutConfidence,
  LAYOUT_CONFIDENCE_LABELS,
} from '../../../features/floorplan/provenanceToLayoutConfidence';

interface Props {
  object: FloorObject;
  rooms: Room[];
  walls: Wall[];
  onUpdate: (patch: Partial<Omit<FloorObject, 'id' | 'floorId' | 'provenance'>>) => void;
  onDelete: () => void;
  /** Duplicate this object (PR17 quick action). */
  onDuplicate?: () => void;
  /** Centre the canvas view on this object (PR17 quick action). */
  onFocus?: () => void;
}

export default function ObjectInspectorPanel({
  object,
  rooms,
  walls,
  onUpdate,
  onDelete,
  onDuplicate,
  onFocus,
}: Props) {
  const confidence = object.provenance ? provenanceToLayoutConfidence(object.provenance) : null;

  // ── Inline label rename ────────────────────────────────────────────────
  const [editingLabel, setEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel] = useState(object.label ?? '');
  const pendingLabelCancelRef = useRef(false);

  // ── Confirmation flash — incremented on each committed heading-level edit ──
  const [flashKey, setFlashKey] = useState(0);

  function triggerFlash() {
    setFlashKey((k) => k + 1);
  }

  const commitLabel = useCallback(() => {
    if (pendingLabelCancelRef.current) {
      pendingLabelCancelRef.current = false;
      return;
    }
    onUpdate({ label: draftLabel.trim() || undefined });
    setEditingLabel(false);
    triggerFlash();
  }, [draftLabel, onUpdate]);

  function cancelLabel() {
    pendingLabelCancelRef.current = false;
    setDraftLabel(object.label ?? '');
    setEditingLabel(false);
  }

  function handleLabelKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitLabel(); }
    if (e.key === 'Escape') cancelLabel();
  }

  return (
    <div className="fpb__inspector-body">
      <div className="fpb__inspector-heading">
        <span className="fpb__inspector-heading-main">
          <span>{FLOOR_OBJECT_TYPE_EMOJI[object.type]}</span>
          <span className="fpb__inspector-type">{FLOOR_OBJECT_TYPE_LABELS[object.type]}</span>
          {/* Inline label rename — click to edit */}
          {editingLabel ? (
            <span className="fpb__label-edit-wrap">
              <input
                className="fpb__label-edit-input"
                type="text"
                value={draftLabel}
                autoFocus
                onChange={(e) => setDraftLabel(e.target.value)}
                onKeyDown={handleLabelKeyDown}
                onBlur={commitLabel}
                aria-label="Edit object label"
              />
              <button
                className="fpb__action-btn fpb__wall-length-cancel"
                style={{ padding: '2px 6px', fontSize: 11 }}
                onPointerDown={() => { pendingLabelCancelRef.current = true; }}
                onClick={cancelLabel}
                title="Cancel rename"
              >
                ✕
              </button>
            </span>
          ) : (
            <button
              className="fpb__inspector-label-btn"
              title="Click to rename"
              onClick={() => { setDraftLabel(object.label ?? ''); setEditingLabel(true); }}
            >
              {object.label
                ? object.label
                : <span className="fpb__inspector-label-empty">+ label</span>
              }
              <span className="fpb__inspector-label-edit-icon">✎</span>
            </button>
          )}
          {confidence && (
            <span className="fpb__confidence-badge fpb__confidence-badge--inline">
              {LAYOUT_CONFIDENCE_LABELS[confidence]}
            </span>
          )}
        </span>
        <button className="fpb__delete-btn" onClick={onDelete} title="Delete object">✕</button>
      </div>

      {/* Quick actions row — PR17 */}
      <div key={flashKey} className={`fpb__quick-actions${flashKey > 0 ? ' fpb__quick-actions--flash' : ''}`}>
        <button className="fpb__quick-btn fpb__quick-btn--danger" onClick={onDelete} title="Delete">
          🗑
        </button>
        {onDuplicate && (
          <button className="fpb__quick-btn" onClick={onDuplicate} title="Duplicate">
            ⧉
          </button>
        )}
        <button className="fpb__quick-btn fpb__quick-btn--stub" title="Rotate (coming soon)" disabled>
          ↻
        </button>
        {onFocus && (
          <button className="fpb__quick-btn" onClick={onFocus} title="Centre view on object">
            🎯
          </button>
        )}
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

      {/* Provenance — shown in heading */}
    </div>
  );
}
