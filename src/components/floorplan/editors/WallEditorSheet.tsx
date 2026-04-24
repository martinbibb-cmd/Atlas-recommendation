/**
 * WallEditorSheet — bottom sheet editor opened by double-tapping a wall.
 *
 * Displays all openings on the selected wall and allows the surveyor to:
 *   • add door, window
 *   • edit each opening's offset from corner (offsetM) and width (widthM)
 *   • delete an opening
 *
 * Also shows quick-add buttons for wall-mounted components (radiator, boiler,
 * cylinder) which place a PlacementNode near the wall midpoint.
 *
 * All mutations delegate to callbacks so this component remains pure UI.
 * The persistence path is: callbacks → FloorPlanBuilder.updatePlan →
 * localStorage autosave → same plan consumed by engineer handoff.
 */

import { useState } from 'react';
import type { Wall, Opening, OpeningType } from '../propertyPlan.types';
import type { PartKind } from '../../../explainers/lego/builder/types';

const GRID = 24;
const DEFAULT_DOOR_WIDTH_M   = 0.9;
const DEFAULT_WINDOW_WIDTH_M = 1.2;

interface Props {
  wall: Wall;
  wallIndex: number;
  totalWalls: number;
  openings: Opening[];
  onAddOpening: (type: OpeningType, offsetM: number, widthM: number) => void;
  onUpdateOpening: (id: string, patch: Partial<Pick<Opening, 'offsetM' | 'widthM' | 'type'>>) => void;
  onDeleteOpening: (id: string) => void;
  onAddComponent: (kind: PartKind, x: number, y: number) => void;
  onNavigate: (delta: -1 | 1) => void;
  onClose: () => void;
}

interface OpeningRowProps {
  opening: Opening;
  wallLenM: number;
  onUpdate: (patch: Partial<Pick<Opening, 'offsetM' | 'widthM' | 'type'>>) => void;
  onDelete: () => void;
}

function OpeningRow({ opening, wallLenM, onUpdate, onDelete }: OpeningRowProps) {
  const [draftOffset, setDraftOffset] = useState(opening.offsetM.toFixed(2));
  const [draftWidth, setDraftWidth]   = useState(opening.widthM.toFixed(2));

  function commitOffset() {
    const v = parseFloat(draftOffset);
    if (!isNaN(v) && v >= 0 && v < wallLenM) onUpdate({ offsetM: v });
    else setDraftOffset(opening.offsetM.toFixed(2));
  }

  function commitWidth() {
    const v = parseFloat(draftWidth);
    if (!isNaN(v) && v > 0) onUpdate({ widthM: v });
    else setDraftWidth(opening.widthM.toFixed(2));
  }

  return (
    <div className="fpb__wall-detail-opening-row" style={{ flexWrap: 'wrap', rowGap: 4 }}>
      {/* Type picker */}
      <select
        value={opening.type}
        onChange={(e) => onUpdate({ type: e.target.value as OpeningType })}
        style={{ marginRight: 6 }}
        aria-label="Opening type"
      >
        <option value="door">🚪 Door</option>
        <option value="window">🪟 Window</option>
      </select>

      {/* Offset from corner */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 6 }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>offset</span>
        <input
          type="number"
          min={0}
          step={0.05}
          value={draftOffset}
          onChange={(e) => setDraftOffset(e.target.value)}
          onBlur={commitOffset}
          onKeyDown={(e) => e.key === 'Enter' && commitOffset()}
          style={{ width: 60 }}
          aria-label="Offset from corner (m)"
        />
        <span style={{ fontSize: 11, color: '#64748b' }}>m</span>
      </label>

      {/* Width */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 6 }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>width</span>
        <input
          type="number"
          min={0.1}
          step={0.05}
          value={draftWidth}
          onChange={(e) => setDraftWidth(e.target.value)}
          onBlur={commitWidth}
          onKeyDown={(e) => e.key === 'Enter' && commitWidth()}
          style={{ width: 60 }}
          aria-label="Opening width (m)"
        />
        <span style={{ fontSize: 11, color: '#64748b' }}>m</span>
      </label>

      <button
        className="fpb__action-pill fpb__action-pill--danger"
        onClick={onDelete}
        title="Remove opening"
        style={{ marginLeft: 'auto' }}
      >
        ✕
      </button>
    </div>
  );
}

export default function WallEditorSheet({
  wall,
  wallIndex,
  totalWalls,
  openings,
  onAddOpening,
  onUpdateOpening,
  onDeleteOpening,
  onAddComponent,
  onNavigate,
  onClose,
}: Props) {
  const wallLenM = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) / GRID;
  const midX = snapToGrid((wall.x1 + wall.x2) / 2 + GRID);
  const midY = snapToGrid((wall.y1 + wall.y2) / 2 + GRID);

  return (
    <>
      <div className="fpb__bottom-sheet-backdrop" onClick={onClose} />
      <div className="fpb__bottom-sheet fpb__bottom-sheet--wall-detail">
        {/* Header with wall navigation */}
        <div className="fpb__bottom-sheet-header">
          <button
            className="fpb__wall-nav-btn"
            onClick={() => onNavigate(-1)}
            title="Previous wall"
          >←</button>
          <span>
            Wall {wallIndex + 1} / {totalWalls}
            {' — '}{wall.kind === 'external' ? 'External' : 'Internal'}
            {' · '}{wallLenM.toFixed(2)} m
          </span>
          <button
            className="fpb__wall-nav-btn"
            onClick={() => onNavigate(1)}
            title="Next wall"
          >→</button>
          <button className="fpb__delete-btn" onClick={onClose}>✕</button>
        </div>

        <div className="fpb__wall-detail-body">
          {/* Openings section */}
          <div className="fpb__wall-detail-section-title">
            Openings ({openings.length})
          </div>

          {openings.length === 0 && (
            <div className="fpb__wall-detail-empty">
              No doors or windows on this wall yet.
            </div>
          )}

          {openings.map((op) => (
            <OpeningRow
              key={op.id}
              opening={op}
              wallLenM={wallLenM}
              onUpdate={(patch) => onUpdateOpening(op.id, patch)}
              onDelete={() => onDeleteOpening(op.id)}
            />
          ))}

          {/* Add opening buttons */}
          <div className="fpb__wall-detail-add-row" style={{ marginTop: 8 }}>
            <button
              className="fpb__sheet-option fpb__sheet-option--compact"
              onClick={() => onAddOpening('door', Math.max(0, (wallLenM - DEFAULT_DOOR_WIDTH_M) / 2), DEFAULT_DOOR_WIDTH_M)}
            >🚪 Add door</button>
            <button
              className="fpb__sheet-option fpb__sheet-option--compact"
              onClick={() => onAddOpening('window', Math.max(0, (wallLenM - DEFAULT_WINDOW_WIDTH_M) / 2), DEFAULT_WINDOW_WIDTH_M)}
            >🪟 Add window</button>
          </div>

          {/* Wall-mounted components */}
          <div className="fpb__wall-detail-section-title" style={{ marginTop: 12 }}>
            Add component near this wall
          </div>
          <div className="fpb__wall-detail-add-row">
            <button
              className="fpb__sheet-option fpb__sheet-option--compact"
              onClick={() => { onAddComponent('radiator_loop', midX, midY); onClose(); }}
            >🌡️ Radiator</button>
            <button
              className="fpb__sheet-option fpb__sheet-option--compact"
              onClick={() => { onAddComponent('heat_source_combi', midX, midY); onClose(); }}
            >🔥 Boiler</button>
            <button
              className="fpb__sheet-option fpb__sheet-option--compact"
              onClick={() => { onAddComponent('dhw_unvented_cylinder', midX, midY); onClose(); }}
            >💧 Cylinder</button>
          </div>
        </div>
      </div>
    </>
  );
}

function snapToGrid(v: number): number {
  return Math.round(v / GRID) * GRID;
}
