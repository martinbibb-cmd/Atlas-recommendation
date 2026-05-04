/**
 * CurrentSystemStep.tsx
 *
 * Step 1 of the Installation Specification: "What system do you have now?"
 *
 * Renders an 8-tile grid covering all system types the engineer may encounter.
 * Tile selection updates the draft's `currentSystem` family via `onSelect`.
 */

import { SpecificationStepTile } from '../SpecificationStepTile';
import type { UiCurrentSystemLabel } from '../installationSpecificationUiTypes';

interface TileDefinition {
  label: string;
  icon: string;
  value: UiCurrentSystemLabel;
}

const CURRENT_SYSTEM_TILES: TileDefinition[] = [
  { label: 'Combi',               icon: '🔥', value: 'combi' },
  { label: 'System boiler',       icon: '🏠', value: 'system_boiler' },
  { label: 'Regular / open vent', icon: '💧', value: 'regular_open_vent' },
  { label: 'Storage combi',       icon: '🛢️', value: 'storage_combi' },
  { label: 'Thermal store',       icon: '🌡️', value: 'thermal_store' },
  { label: 'Heat pump',           icon: '♻️', value: 'heat_pump' },
  { label: 'Warm air',            icon: '💨', value: 'warm_air' },
  { label: 'Unknown',             icon: '❓', value: 'unknown' },
];

export interface CurrentSystemStepProps {
  /** Currently selected tile value, or null when nothing is selected. */
  selected: UiCurrentSystemLabel | null;
  /** Called when the engineer taps a tile. */
  onSelect: (value: UiCurrentSystemLabel) => void;
}

export function CurrentSystemStep({ selected, onSelect }: CurrentSystemStepProps) {
  return (
    <>
      <h2 className="qp-step-heading">What system do you have now?</h2>
      <p className="qp-step-subheading">
        Select the type that best describes the existing heating system.
      </p>
      <div className="qp-tile-grid">
        {CURRENT_SYSTEM_TILES.map(({ label, icon, value }) => (
          <SpecificationStepTile
            key={value}
            icon={icon}
            label={label}
            selected={selected === value}
            onClick={() => onSelect(value)}
          />
        ))}
      </div>
    </>
  );
}
