/**
 * FlueFamilyTiles.tsx
 *
 * Visual tile picker for selecting the flue family / orientation.
 *
 * Renders one large tile per flue family.  The selected tile is highlighted
 * with the standard `qp-tile--selected` class.
 *
 * Design rules:
 *   - Pure presentational — receives `selected` and `onSelect` from the parent.
 *   - No recommendation logic — family selection is an engineer decision only.
 *   - Does not output customer-facing copy.
 */

import type { FlueFamily } from '../../model/QuoteInstallationPlanV1';

// ─── Metadata ─────────────────────────────────────────────────────────────────

interface FlueFamilyMeta {
  family:  FlueFamily;
  icon:    string;
  label:   string;
  hint:    string;
}

const FLUE_FAMILIES: FlueFamilyMeta[] = [
  {
    family: 'horizontal_rear',
    icon:   '⬅️',
    label:  'Horizontal — rear',
    hint:   'Terminal exits through the rear wall directly behind the boiler.',
  },
  {
    family: 'horizontal_side',
    icon:   '↙️',
    label:  'Horizontal — side',
    hint:   'Terminal exits through a side wall with one or more 90° bends.',
  },
  {
    family: 'vertical',
    icon:   '⬆️',
    label:  'Vertical',
    hint:   'Terminal exits vertically through the roof — no horizontal offset.',
  },
  {
    family: 'vertical_with_offsets',
    icon:   '↗️',
    label:  'Vertical with offsets',
    hint:   'Vertical exit with horizontal offset sections to clear obstacles.',
  },
  {
    family: 'plume_management',
    icon:   '💨',
    label:  'Plume management',
    hint:   'Includes a plume management kit to redirect or disperse the flue outlet.',
  },
  {
    family: 'unknown',
    icon:   '❓',
    label:  'Not yet confirmed',
    hint:   'Family will be confirmed once the site visit is complete.',
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FlueFamilyTilesProps {
  /** Currently selected family, or `null` when none is selected yet. */
  selected: FlueFamily | null;
  /** Called with the new family when a tile is pressed. */
  onSelect: (family: FlueFamily) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FlueFamilyTiles({ selected, onSelect }: FlueFamilyTilesProps) {
  return (
    <div className="qp-tile-grid" role="group" aria-label="Flue family">
      {FLUE_FAMILIES.map(({ family, icon, label, hint }) => {
        const isSelected = selected === family;
        return (
          <button
            key={family}
            type="button"
            aria-pressed={isSelected}
            aria-label={label}
            title={hint}
            className={`qp-tile${isSelected ? ' qp-tile--selected' : ''}`}
            onClick={() => onSelect(family)}
          >
            <span className="qp-tile__icon" aria-hidden="true">{icon}</span>
            <span className="qp-tile__label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
