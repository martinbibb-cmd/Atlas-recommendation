/**
 * CurrentHotWaterStep.tsx
 *
 * Step 3 of the Installation Specification: "What is the current hot-water arrangement?"
 *
 * Only shown when the current heat source is NOT a combi or storage combi.
 * Skipped when:
 *   - current heat source is null (no_wet_heating path)
 *   - current heat source is combi_boiler or storage_combi (isCombiHeatSource)
 *   - current heat source is none / direct_electric / warm_air
 *
 * See getActiveStepIds() in InstallationSpecificationStepper.tsx for the full
 * step-skipping logic.
 */

import { SpecificationSystemTile } from '../components/SpecificationSystemTile';
import type { UiCurrentHotWaterLabel } from '../installationSpecificationUiTypes';

interface HotWaterTileDefinition {
  value: UiCurrentHotWaterLabel;
  title: string;
  subtitle: string;
  imageSrc: string | null;
}

const CURRENT_HOT_WATER_TILES: HotWaterTileDefinition[] = [
  {
    value:    'no_cylinder',
    title:    'No cylinder',
    subtitle: 'No stored hot water — heat source only',
    imageSrc: null,
  },
  {
    value:    'vented_cylinder',
    title:    'Vented cylinder',
    subtitle: 'Open-vented hot-water storage — gravity-fed or pumped',
    imageSrc: '/images/systems/vented-cylinder.PNG',
  },
  {
    value:    'unvented_cylinder',
    title:    'Unvented cylinder',
    subtitle: 'Mains-pressure stored hot water — G3 appliance',
    imageSrc: '/images/systems/unvented-cylinder.JPG',
  },
  {
    value:    'thermal_store',
    title:    'Thermal store',
    subtitle: 'Stored heat with mains hot-water supply via heat exchanger',
    imageSrc: null,
  },
  {
    value:    'mixergy_or_stratified',
    title:    'Mixergy / stratified cylinder',
    subtitle: 'Stratified storage cylinder with active zone control',
    imageSrc: null,
  },
  {
    value:    'integrated_store',
    title:    'Integrated store',
    subtitle: 'Built-in storage — typically part of a storage combi appliance',
    imageSrc: null,
  },
  {
    value:    'other_hot_water',
    title:    'Other arrangement',
    subtitle: 'Non-standard hot-water arrangement — describe in notes',
    imageSrc: null,
  },
];

export interface CurrentHotWaterStepProps {
  /** Currently selected hot-water tile, or null when nothing is selected. */
  selected: UiCurrentHotWaterLabel | null;
  /** Called when the surveyor selects a tile. */
  onSelect: (value: UiCurrentHotWaterLabel) => void;
}

export function CurrentHotWaterStep({ selected, onSelect }: CurrentHotWaterStepProps) {
  return (
    <>
      <h2 className="qp-step-heading">What is the current hot-water arrangement?</h2>
      <p className="qp-step-subheading">
        Select the cylinder or storage type. This is separate from the heat source.
      </p>
      <div className="spec-sys-tile-grid">
        {CURRENT_HOT_WATER_TILES.map(({ value, title, subtitle, imageSrc }) => (
          <SpecificationSystemTile
            key={value}
            value={value}
            title={title}
            subtitle={subtitle}
            imageSrc={imageSrc}
            selected={selected === value}
            onClick={() => onSelect(value)}
          />
        ))}
      </div>
    </>
  );
}
