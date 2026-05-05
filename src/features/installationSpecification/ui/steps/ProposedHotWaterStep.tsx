/**
 * ProposedHotWaterStep.tsx
 *
 * Step 6 of the Installation Specification: "What hot-water arrangement are you proposing?"
 *
 * Only shown when the proposed heat source is NOT a combi or storage combi.
 * - combi_boiler:  sets hotWater = instantaneous_from_combi (skips this step)
 * - storage_combi: sets hotWater = integrated_store (skips this step)
 * - system_boiler: requires cylinder selection
 * - regular_boiler: requires cylinder selection
 * - heat_pump: shows heat-pump cylinder options
 *
 * Important: "retain existing cylinder" is a valid choice.
 * "Unvented discharge route" scope is only generated when unvented/Mixergy is selected.
 */

import { SpecificationSystemTile } from '../components/SpecificationSystemTile';
import type { UiProposedHeatSourceLabel, UiProposedHotWaterLabel } from '../installationSpecificationUiTypes';

// Heat pump cylinders are unvented (mains-pressure) appliances, so both
// the standard unvented and the dedicated HP cylinder share the same image.
const UNVENTED_CYLINDER_IMAGE = '/images/systems/unvented-cylinder.svg';

interface ProposedHotWaterTileDefinition {
  value: UiProposedHotWaterLabel;
  title: string;
  subtitle: string;
  imageSrc: string | null;
  /** Only show for these proposed heat sources. Absent = show for all. */
  onlyFor?: UiProposedHeatSourceLabel[];
  /** Hide for these proposed heat sources. */
  hideFor?: UiProposedHeatSourceLabel[];
}

const PROPOSED_HOT_WATER_TILES: ProposedHotWaterTileDefinition[] = [
  {
    value:    'retain_existing',
    title:    'Retain existing cylinder',
    subtitle: 'Keep the current cylinder — verify compatibility with proposed heat source',
    imageSrc: null,
    hideFor:  ['heat_pump'],
  },
  {
    value:    'vented_cylinder',
    title:    'Replace with vented cylinder',
    subtitle: 'Open-vented mains-fed storage — gravity or pumped',
    imageSrc: '/images/systems/vented-cylinder.svg',
    hideFor:  ['heat_pump'],
  },
  {
    value:    'unvented_cylinder',
    title:    'Replace with unvented cylinder',
    subtitle: 'Mains-pressure stored hot water — G3 appliance',
    imageSrc: UNVENTED_CYLINDER_IMAGE,
    hideFor:  ['heat_pump'],
  },
  {
    value:    'mixergy_or_stratified',
    title:    'Mixergy / stratified cylinder',
    subtitle: 'Stratified storage with active zone control — discharge route required',
    imageSrc: null,
    hideFor:  ['heat_pump'],
  },
  {
    value:    'thermal_store',
    title:    'Thermal store',
    subtitle: 'Stored heat with mains hot-water via heat exchanger',
    imageSrc: null,
    hideFor:  ['heat_pump'],
  },
  {
    value:    'heat_pump_cylinder',
    title:    'Heat pump cylinder',
    subtitle: 'Dedicated heat-pump-rated cylinder with coil and immersion',
    imageSrc: UNVENTED_CYLINDER_IMAGE,
    onlyFor:  ['heat_pump'],
  },
  {
    value:    'no_stored_hot_water',
    title:    'No stored hot water',
    subtitle: 'Heating circuit only — no hot-water storage on this job',
    imageSrc: null,
    hideFor:  ['heat_pump'],
  },
];

export interface ProposedHotWaterStepProps {
  /** The proposed heat source — used to filter visible tiles. */
  proposedHeatSource: UiProposedHeatSourceLabel;
  /** Currently selected proposed hot-water tile, or null. */
  selected: UiProposedHotWaterLabel | null;
  /** Called when the surveyor selects a tile. */
  onSelect: (value: UiProposedHotWaterLabel) => void;
}

export function ProposedHotWaterStep({
  proposedHeatSource,
  selected,
  onSelect,
}: ProposedHotWaterStepProps) {
  const visibleTiles = PROPOSED_HOT_WATER_TILES.filter((t) => {
    if (t.onlyFor && !t.onlyFor.includes(proposedHeatSource)) return false;
    if (t.hideFor && t.hideFor.includes(proposedHeatSource)) return false;
    return true;
  });

  return (
    <>
      <h2 className="qp-step-heading">What hot-water arrangement are you proposing?</h2>
      <p className="qp-step-subheading">
        Select the proposed hot-water storage or arrangement. This determines the cylinder
        and discharge scope.
      </p>
      <div className="spec-sys-tile-grid">
        {visibleTiles.map(({ value, title, subtitle, imageSrc }) => (
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
