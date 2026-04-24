/**
 * ObjectLibraryPanel — palette of non-HVAC fixtures the surveyor can place
 * on the floor plan.
 *
 * Clicking a category item invokes `onSelect` with the chosen type.
 * The caller is then responsible for entering place mode so the user can
 * click the canvas to position the object.
 *
 * HVAC equipment (boiler, cylinder, radiator) appears here too so the
 * surveyor has a single place to insert everything — the caller decides
 * whether to create a FloorObject or a PlacementNode.
 */

import type { FloorObjectType } from '../propertyPlan.types';
import { FLOOR_OBJECT_TYPE_LABELS, FLOOR_OBJECT_TYPE_EMOJI } from '../propertyPlan.types';

const FIXTURE_TYPES: FloorObjectType[] = [
  'sink', 'bath', 'shower', 'flue', 'other',
];

const HVAC_TYPES: FloorObjectType[] = [
  'boiler', 'cylinder', 'radiator',
];

interface Props {
  onSelect: (type: FloorObjectType) => void;
  onClose: () => void;
}

export default function ObjectLibraryPanel({ onSelect, onClose }: Props) {
  return (
    <div className="fpb__inspector-body">
      <div className="fpb__inspector-heading">
        <span>Object Library</span>
        <button className="fpb__delete-btn" onClick={onClose}>✕</button>
      </div>

      {/* Fixtures */}
      <div className="fpb__wall-detail-section-title">Fixtures</div>
      <div className="fpb__wall-detail-add-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {FIXTURE_TYPES.map((type) => (
          <button
            key={type}
            className="fpb__sheet-option fpb__sheet-option--compact"
            onClick={() => onSelect(type)}
            title={`Insert ${FLOOR_OBJECT_TYPE_LABELS[type]}`}
          >
            <span>{FLOOR_OBJECT_TYPE_EMOJI[type]}</span>
            {FLOOR_OBJECT_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* HVAC objects (survey markers — not wired to lego topology) */}
      <div className="fpb__wall-detail-section-title" style={{ marginTop: 10 }}>
        HVAC survey markers
      </div>
      <div className="fpb__wall-detail-add-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {HVAC_TYPES.map((type) => (
          <button
            key={type}
            className="fpb__sheet-option fpb__sheet-option--compact"
            onClick={() => onSelect(type)}
            title={`Insert ${FLOOR_OBJECT_TYPE_LABELS[type]} survey marker`}
          >
            <span>{FLOOR_OBJECT_TYPE_EMOJI[type]}</span>
            {FLOOR_OBJECT_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
