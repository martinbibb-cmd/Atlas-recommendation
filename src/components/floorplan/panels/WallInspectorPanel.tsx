/**
 * WallInspectorPanel — shows wall details when a wall is selected.
 *
 * The wall length is shown as an inline editable field so the surveyor can
 * type the measured value without opening a modal.  Kind and thickness are
 * also editable.  Applying the length edit calls `onUpdateLength` which
 * delegates to `updateWallMeasurement` in the feature module.
 */

import { useState } from 'react';
import type { Wall, WallKind } from '../propertyPlan.types';

const GRID = 24;

interface Props {
  wall: Wall;
  onUpdate: (patch: Partial<Wall>) => void;
  onUpdateLength: (newLengthM: number) => void;
  onDelete: () => void;
}

export default function WallInspectorPanel({ wall, onUpdate, onUpdateLength, onDelete }: Props) {
  const lengthM = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) / GRID;
  const [editingLength, setEditingLength] = useState(false);
  const [draftLength, setDraftLength] = useState(lengthM.toFixed(2));

  function commitLength() {
    const v = parseFloat(draftLength);
    if (!isNaN(v) && v > 0) {
      onUpdateLength(v);
    }
    setEditingLength(false);
  }

  function handleLengthKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitLength();
    if (e.key === 'Escape') {
      setDraftLength(lengthM.toFixed(2));
      setEditingLength(false);
    }
  }

  return (
    <div className="fpb__inspector-body">
      <div className="fpb__inspector-heading">
        <span>Wall</span>
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
              min={0.5}
              step={0.1}
              value={draftLength}
              autoFocus
              onChange={(e) => setDraftLength(e.target.value)}
              onKeyDown={handleLengthKeyDown}
              onBlur={commitLength}
              style={{ width: 70 }}
            />
            <button className="fpb__action-btn" style={{ marginLeft: 4 }} onClick={commitLength}>✓</button>
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

      {/* Provenance badge — informational only */}
      {wall.provenance && (
        <div className="fpb__field fpb__field--static">
          <span>Source</span>
          <span className="fpb__provenance-badge">
            {wall.provenance.source === 'manual' ? '✎ manual' : wall.provenance.source}
            {wall.provenance.reviewStatus === 'corrected' ? ' · confirmed' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
