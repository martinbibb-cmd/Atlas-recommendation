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

import { useEffect, useRef } from 'react';
import type { FloorObjectType } from '../propertyPlan.types';
import { LIBRARY_GROUPS, OBJECT_TEMPLATES } from '../../../features/floorplan/objectTemplates';

interface Props {
  onSelect: (type: FloorObjectType) => void;
  onClose: () => void;
  /**
   * PR23: When set, the matching object type button is visually highlighted
   * and scrolled into view so the surveyor can immediately act on a quick-fix
   * suggestion from the handoff preview banner.
   */
  highlightType?: FloorObjectType;
}

export default function ObjectLibraryPanel({ onSelect, onClose, highlightType }: Props) {
  const highlightRef = useRef<HTMLButtonElement | null>(null);

  // Scroll the highlighted button into view when a highlight type is set.
  useEffect(() => {
    if (highlightType && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightType]);

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
              const isHighlighted = type === highlightType;
              return (
                <button
                  key={type}
                  ref={isHighlighted ? highlightRef : undefined}
                  className={`fpb__sheet-option fpb__sheet-option--compact${isHighlighted ? ' fpb__sheet-option--highlight' : ''}`}
                  onClick={() => onSelect(type)}
                  title={`Insert ${tpl.label}`}
                  aria-current={isHighlighted ? 'true' : undefined}
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
