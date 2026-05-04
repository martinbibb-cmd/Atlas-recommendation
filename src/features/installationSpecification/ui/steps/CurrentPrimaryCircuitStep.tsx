/**
 * CurrentPrimaryCircuitStep.tsx
 *
 * Step 4 of the Installation Specification: "What is the current primary circuit type?"
 *
 * Only shown when the current heat source is a boiler type (combi, regular, system,
 * storage combi, back boiler).
 *
 * Important: open-vented primary circuit ≠ vented cylinder.
 * Regular boiler does not automatically mean open-vented primary.
 * System boiler does not automatically mean sealed primary.
 * Atlas records these as separate independent selections.
 */

import { SpecificationSystemTile } from '../components/SpecificationSystemTile';
import type { UiCurrentPrimaryCircuitLabel } from '../installationSpecificationUiTypes';

interface PrimaryCircuitTileDefinition {
  value: UiCurrentPrimaryCircuitLabel;
  title: string;
  subtitle: string;
}

const PRIMARY_CIRCUIT_TILES: PrimaryCircuitTileDefinition[] = [
  {
    value:    'open_vented_primary',
    title:    'Open vented primary',
    subtitle: 'Feed and expansion tank in loft — gravity-filled open-vented circuit',
  },
  {
    value:    'sealed_primary',
    title:    'Sealed primary',
    subtitle: 'Pressurised system with expansion vessel — no feed and expansion tank',
  },
  {
    value:    'needs_technical_review',
    title:    'Cannot confirm — needs technical review',
    subtitle: 'Primary circuit type is unclear or mixed — requires engineer assessment',
  },
];

export interface CurrentPrimaryCircuitStepProps {
  /** Currently selected primary-circuit tile, or null when nothing is selected. */
  selected: UiCurrentPrimaryCircuitLabel | null;
  /** Called when the surveyor selects a tile. */
  onSelect: (value: UiCurrentPrimaryCircuitLabel) => void;
}

export function CurrentPrimaryCircuitStep({ selected, onSelect }: CurrentPrimaryCircuitStepProps) {
  return (
    <>
      <h2 className="qp-step-heading">What is the current primary circuit?</h2>
      <p className="qp-step-subheading">
        Select the primary heating circuit type. This is independent of the cylinder type.
      </p>
      <div className="spec-sys-tile-grid">
        {PRIMARY_CIRCUIT_TILES.map(({ value, title, subtitle }) => (
          <SpecificationSystemTile
            key={value}
            value={value}
            title={title}
            subtitle={subtitle}
            imageSrc={null}
            selected={selected === value}
            onClick={() => onSelect(value)}
          />
        ))}
      </div>
    </>
  );
}
