/**
 * RoofOrientationPicker.tsx
 *
 * Touch-friendly 8-direction roof orientation selector.
 *
 * Renders a simple compass rose of direction chips arranged in a 3×3 grid
 * (centre cell is a roof icon).  The user taps a chip to select the direction
 * their main usable roof face points toward.
 *
 * The selected direction is visually highlighted and a one-line summary
 * is shown below the grid.
 *
 * Design principles:
 *  - No CAD / floorplan
 *  - Clear, large tap targets
 *  - Selected direction is unambiguous
 *  - Summary reads like natural English
 */

import type { CSSProperties } from 'react';
import type { RoofOrientation } from './heatLossTypes';
import { roofOrientationSummary } from './heatLossDerivations';

// ─── Props ────────────────────────────────────────────────────────────────────

interface RoofOrientationPickerProps {
  value: RoofOrientation;
  onChange: (next: RoofOrientation) => void;
}

// ─── Grid layout ──────────────────────────────────────────────────────────────

/** The 9-cell compass grid (row-major order, null = centre roof icon). */
const GRID_CELLS: (RoofOrientation | null)[] = [
  'NW', 'N',  'NE',
  'W',  null, 'E',
  'SW', 'S',  'SE',
];

/** Short display label for each direction. */
const DIR_LABEL: Record<Exclude<RoofOrientation, 'unknown'>, string> = {
  N:  'N',
  NE: 'NE',
  E:  'E',
  SE: 'SE',
  S:  'S',
  SW: 'SW',
  W:  'W',
  NW: 'NW',
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '0.35rem',
  width: '100%',
  maxWidth: '220px',
  margin: '0 auto',
};

function cellStyle(isSelected: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: '1',
    borderRadius: '8px',
    border: isSelected ? '2px solid #2b6cb0' : '1px solid #e2e8f0',
    background: isSelected ? '#ebf8ff' : '#fff',
    boxShadow: isSelected ? '0 0 0 3px rgba(66, 153, 225, 0.2)' : 'none',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: isSelected ? 700 : 500,
    color: isSelected ? '#2b6cb0' : '#4a5568',
    transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
    userSelect: 'none' as const,
    minHeight: '48px',
  };
}

const centreCellStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  aspectRatio: '1',
  borderRadius: '8px',
  background: '#f7fafc',
  border: '1px solid #e2e8f0',
  fontSize: '1.2rem',
  minHeight: '48px',
  pointerEvents: 'none',
};

const summaryStyle: CSSProperties = {
  marginTop: '0.65rem',
  textAlign: 'center',
  fontSize: '0.78rem',
  color: '#4a5568',
  minHeight: '1.1rem',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function RoofOrientationPicker({ value, onChange }: RoofOrientationPickerProps) {
  return (
    <div>
      <div style={gridStyle} role="group" aria-label="Roof orientation compass">
        {GRID_CELLS.map((dir) => {
          if (dir === null) {
            // Centre cell — roof icon, not interactive
            return (
              <div key="centre" style={centreCellStyle} aria-hidden="true">
                🏠
              </div>
            );
          }
          const isSelected = value === dir;
          return (
            <button
              key={dir}
              type="button"
              aria-label={`${dir} — ${roofOrientationSummary(dir)}`}
              aria-pressed={isSelected}
              data-testid={`roof-orientation-${dir}`}
              onClick={() => onChange(dir)}
              style={cellStyle(isSelected)}
            >
              {DIR_LABEL[dir]}
            </button>
          );
        })}
      </div>
      <p style={summaryStyle}>
        {value !== 'unknown'
          ? roofOrientationSummary(value)
          : 'Tap a direction to set the main usable roof face'}
      </p>
    </div>
  );
}
