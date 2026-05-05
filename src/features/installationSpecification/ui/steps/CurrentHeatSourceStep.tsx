/**
 * CurrentHeatSourceStep.tsx
 *
 * Step 2 of the Installation Specification: "What is the current heat source?"
 *
 * Only shown when Step 1 selected 'has_wet_heating' or 'partial_abandoned'.
 * Skipped when Step 1 is 'no_wet_heating' (no existing wet circuit).
 *
 * "None" is a valid tile for partial/first-install edge cases.
 * Exception path "Cannot confirm — needs technical review" is available for
 * genuinely unidentifiable heat sources.
 *
 * Important: This step captures the heat-source appliance only.
 * Cylinder type is captured separately in CurrentHotWaterStep.
 */

import { useState } from 'react';
import { SpecificationSystemTile } from '../components/SpecificationSystemTile';
import type { UiCurrentHeatSourceLabel } from '../installationSpecificationUiTypes';

type KnownHeatSourceLabel = Exclude<UiCurrentHeatSourceLabel, never>;

interface HeatSourceTileDefinition {
  value: KnownHeatSourceLabel;
  title: string;
  subtitle: string;
  imageSrc: string | null;
}

const CURRENT_HEAT_SOURCE_TILES: HeatSourceTileDefinition[] = [
  {
    value:    'combi_boiler',
    title:    'Combination boiler',
    subtitle: 'On-demand hot water — no cylinder',
    imageSrc: '/images/systems/combination.svg',
  },
  {
    value:    'regular_boiler',
    title:    'Regular boiler',
    subtitle: 'Heat-only boiler — requires separate cylinder and tanks',
    imageSrc: '/images/systems/open-vented-schematic.svg',
  },
  {
    value:    'system_boiler',
    title:    'System boiler',
    subtitle: 'Sealed primary — requires separate cylinder, no feed/expansion tank',
    imageSrc: '/images/systems/system-boiler.svg',
  },
  {
    value:    'storage_combi',
    title:    'Storage combi',
    subtitle: 'On-demand boiler with integrated hot-water store',
    imageSrc: '/images/systems/combination.svg',
  },
  {
    value:    'heat_pump',
    title:    'Heat pump',
    subtitle: 'Air-source or ground-source heat pump',
    imageSrc: '/images/systems/ashp.svg',
  },
  {
    value:    'warm_air',
    title:    'Warm air unit',
    subtitle: 'Ducted warm-air heating system',
    imageSrc: null,
  },
  {
    value:    'back_boiler',
    title:    'Back boiler',
    subtitle: 'Boiler fitted behind a gas fire or solid-fuel appliance',
    imageSrc: null,
  },
  {
    value:    'direct_electric',
    title:    'Direct electric',
    subtitle: 'Electric storage heaters or panel heaters — no wet circuit',
    imageSrc: null,
  },
  {
    value:    'other_heat_source',
    title:    'Other heat source',
    subtitle: 'Oil boiler, biomass, or other heat source',
    imageSrc: null,
  },
  {
    value:    'none',
    title:    'None',
    subtitle: 'No heat source identified — new installation',
    imageSrc: null,
  },
];

export interface CurrentHeatSourceStepProps {
  /** Currently selected heat-source tile value, or null when nothing is selected. */
  selected: UiCurrentHeatSourceLabel | null;
  /** Note for the exception path — required when exception is open. */
  exceptionNote: string;
  /** Called when the surveyor selects a heat-source tile. */
  onSelect: (value: UiCurrentHeatSourceLabel) => void;
  /** Called when the exception-path note changes. */
  onExceptionNoteChange: (note: string) => void;
  /** Called when the surveyor cancels the exception path. */
  onClearSelection: () => void;
}

export function CurrentHeatSourceStep({
  selected,
  exceptionNote,
  onSelect,
  onExceptionNoteChange,
  onClearSelection,
}: CurrentHeatSourceStepProps) {
  const [showException, setShowException] = useState(false);

  function handleTileClick(value: KnownHeatSourceLabel) {
    setShowException(false);
    onSelect(value);
  }

  function handleExceptionClick() {
    setShowException(true);
    onClearSelection();
  }

  function handleExceptionCancel() {
    setShowException(false);
    onClearSelection();
  }

  return (
    <>
      <h2 className="qp-step-heading">What is the current heat source?</h2>
      <p className="qp-step-subheading">
        Select the appliance that generates heat. Cylinder type is recorded separately.
      </p>
      <div className="spec-sys-tile-grid">
        {CURRENT_HEAT_SOURCE_TILES.map(({ value, title, subtitle, imageSrc }) => (
          <SpecificationSystemTile
            key={value}
            value={value}
            title={title}
            subtitle={subtitle}
            imageSrc={imageSrc}
            selected={selected === value}
            onClick={() => handleTileClick(value)}
          />
        ))}
      </div>

      {/* Exception path — not a normal heat-source tile */}
      {!showException ? (
        <button
          type="button"
          className="spec-exception-btn"
          onClick={handleExceptionClick}
        >
          Cannot confirm — needs technical review
        </button>
      ) : (
        <div className="spec-exception-panel">
          <div className="spec-exception-panel__header">
            <span className="spec-exception-panel__warning">
              ⚠️ Needs technical review
            </span>
            <button
              type="button"
              className="spec-exception-panel__cancel"
              aria-label="Cancel exception"
              onClick={handleExceptionCancel}
            >
              ✕
            </button>
          </div>
          <p className="spec-exception-panel__hint">
            A note is required before you can continue.
          </p>
          <textarea
            className="spec-exception-panel__note"
            placeholder="Describe why the heat source cannot be confirmed…"
            value={exceptionNote}
            onChange={(e) => onExceptionNoteChange(e.target.value)}
            rows={3}
            aria-label="Technical review note"
          />
        </div>
      )}
    </>
  );
}
