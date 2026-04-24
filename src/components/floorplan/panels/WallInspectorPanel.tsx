/**
 * WallInspectorPanel — shows wall details when a wall is selected.
 *
 * The wall length is shown as an inline editable field so the surveyor can
 * type the measured value without opening a modal.  Kind and thickness are
 * also editable.  Applying the length edit calls `onUpdateLength` which
 * delegates to `updateWallMeasurement` in the feature module.
 *
 * PR16: heading shows icon + kind label + confidence badge; invalid length
 * inputs show a friendly inline error instead of silently failing.
 */

import { useState } from 'react';
import type { Wall, WallKind } from '../propertyPlan.types';
import {
  provenanceToLayoutConfidence,
  LAYOUT_CONFIDENCE_LABELS,
} from '../../../features/floorplan/provenanceToLayoutConfidence';

const GRID = 24;
const MIN_WALL_LENGTH_M = 0.1;

interface Props {
  wall: Wall;
  onUpdate: (patch: Partial<Wall>) => void;
  onUpdateLength: (newLengthM: number) => void;
  onDelete: () => void;
}

const WALL_KIND_LABELS: Record<WallKind, string> = {
  internal: 'Internal',
  external: 'External',
};

export default function WallInspectorPanel({ wall, onUpdate, onUpdateLength, onDelete }: Props) {
  const lengthM = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) / GRID;
  const [editingLength, setEditingLength] = useState(false);
  const [draftLength, setDraftLength] = useState(lengthM.toFixed(2));
  const [lengthError, setLengthError] = useState<string | null>(null);

  const confidence = wall.provenance ? provenanceToLayoutConfidence(wall.provenance) : null;

  function validateDraft(value: string): string | null {
    const v = parseFloat(value);
    if (isNaN(v) || value.trim() === '') return 'Enter a number';
    if (v < MIN_WALL_LENGTH_M) return `Minimum wall length is ${MIN_WALL_LENGTH_M} m`;
    return null;
  }

  function commitLength() {
    const error = validateDraft(draftLength);
    if (error) {
      setLengthError(error);
      return;
    }
    setLengthError(null);
    onUpdateLength(parseFloat(draftLength));
    setEditingLength(false);
  }

  function cancelLength() {
    setDraftLength(lengthM.toFixed(2));
    setLengthError(null);
    setEditingLength(false);
  }

  function handleLengthKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitLength();
    if (e.key === 'Escape') cancelLength();
  }

  return (
    <div className="fpb__inspector-body">
      <div className="fpb__inspector-heading">
        <span className="fpb__inspector-heading-main">
          <span>🧱</span>
          <span className="fpb__inspector-type">Wall</span>
          <span className="fpb__inspector-label">{WALL_KIND_LABELS[wall.kind]}</span>
          {confidence && (
            <span className="fpb__confidence-badge fpb__confidence-badge--inline">
              {LAYOUT_CONFIDENCE_LABELS[confidence]}
            </span>
          )}
        </span>
        <button className="fpb__delete-btn" onClick={onDelete} title="Delete wall">✕</button>
      </div>

      {/* Kind */}
      <label className="fpb__field">
        <span>Kind</span>
        <select
          value={wall.kind}
          onChange={(e) => onUpdate({ kind: e.target.value as WallKind })}
        >
          <option value="internal">Internal</option>
          <option value="external">External</option>
        </select>
      </label>

      {/* Length — tap to edit inline */}
      <div className="fpb__field">
        <span>Length (m)</span>
        {editingLength ? (
          <span className="fpb__wall-length-edit">
            <input
              type="number"
              min={MIN_WALL_LENGTH_M}
              step={0.1}
              value={draftLength}
              autoFocus
              onChange={(e) => {
                setDraftLength(e.target.value);
                setLengthError(null);
              }}
              onKeyDown={handleLengthKeyDown}
              onBlur={commitLength}
              style={{ width: 70 }}
              aria-invalid={lengthError != null}
            />
            <button className="fpb__action-btn fpb__wall-length-confirm" onClick={commitLength} title="Apply">✓</button>
            <button className="fpb__action-btn fpb__wall-length-cancel" onMouseDown={(e) => { e.preventDefault(); cancelLength(); }} title="Cancel">✕</button>
            {lengthError && (
              <span className="fpb__wall-length-error" role="alert">{lengthError}</span>
            )}
          </span>
        ) : (
          <button
            className="fpb__field-value-btn"
            title="Tap to edit length"
            onClick={() => { setDraftLength(lengthM.toFixed(2)); setEditingLength(true); }}
          >
            {lengthM.toFixed(2)} m ✎
          </button>
        )}
      </div>

      {/* Thickness */}
      <label className="fpb__field">
        <span>Thickness (mm)</span>
        <input
          type="number"
          min={50}
          max={600}
          step={10}
          value={wall.thicknessMm ?? 100}
          onChange={(e) => onUpdate({ thicknessMm: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}
