/**
 * ObjectLibraryPanel — palette of fixtures the surveyor can place on the
 * floor plan, grouped by category.
 *
 * PR19: objects are now grouped into Heating / Hot water / Bathroom & fixtures /
 * Building services / Other.  Boiler, cylinder, and radiator are shown first
 * and prominently as they are the most common survey objects.
 *
 * Clicking an item invokes `onSelect` with the chosen type.  The caller
 * enters place mode so the user can click the canvas to position the object.
 */

import type { FloorObjectType } from '../propertyPlan.types';
import { LIBRARY_GROUPS, OBJECT_TEMPLATES } from '../../../features/floorplan/objectTemplates';

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

      {LIBRARY_GROUPS.map((group) => (
        <div key={group.id}>
          <div className="fpb__wall-detail-section-title" style={{ marginTop: 10 }}>
            {group.label}
          </div>
          <div className="fpb__wall-detail-add-row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {group.types.map((type) => {
              const tpl = OBJECT_TEMPLATES[type];
              return (
                <button
                  key={type}
                  className="fpb__sheet-option fpb__sheet-option--compact"
                  onClick={() => onSelect(type)}
                  title={`Insert ${tpl.label}`}
                >
                  <span>{tpl.emoji}</span>
                  {tpl.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
