/**
 * ProposedSystemStep.tsx
 *
 * Step 5 of the Installation Specification: "What heat source are you proposing?"
 *
 * Shows proposed heat-source tiles. When `seedValue` is provided the matching
 * tile is pre-selected and marked with an "Atlas selected" badge.
 *
 * ASHP gate: when the current heat source is a heat pump, gas boiler families
 * are hidden. Switching from heat pump back to gas requires a technical-review
 * exception with a mandatory reason note.
 *
 * This step captures the proposed heat source only.
 * Hot-water/cylinder arrangement is captured in ProposedHotWaterStep.
 */

import { useState } from 'react';
import { SpecificationSystemTile } from '../components/SpecificationSystemTile';
import {
  isGasBoilerProposedHeatSource,
} from '../installationSpecificationUiTypes';
import type { UiCurrentHeatSourceLabel, UiProposedHeatSourceLabel } from '../installationSpecificationUiTypes';

interface HeatSourceTileDefinition {
  value: Exclude<UiProposedHeatSourceLabel, 'other_approved'>;
  title: string;
  subtitle: string;
  imageSrc: string | null;
}

// Uses isGasBoilerProposedHeatSource() from installationSpecificationUiTypes for ASHP gate.

/** All normal proposed heat-source tiles. */
const ALL_PROPOSED_TILES: HeatSourceTileDefinition[] = [
  {
    value:    'combi_boiler',
    title:    'Combination boiler',
    subtitle: 'On-demand hot water — no cylinder required',
    imageSrc: '/images/systems/Combination.PNG',
  },
  {
    value:    'system_boiler',
    title:    'System boiler',
    subtitle: 'Sealed primary — cylinder required',
    imageSrc: '/images/systems/system-boiler.PNG',
  },
  {
    value:    'regular_boiler',
    title:    'Regular boiler',
    subtitle: 'Open-vented primary — cylinder and tanks required',
    imageSrc: '/images/systems/open-vented-schematic.JPG',
  },
  {
    value:    'heat_pump',
    title:    'Heat pump',
    subtitle: 'Low-temperature heat source — cylinder required',
    imageSrc: '/images/systems/ASHP.PNG',
  },
];

/** Human-readable label for current heat source context hint. */
const CURRENT_HEAT_SOURCE_DISPLAY: Record<UiCurrentHeatSourceLabel, string> = {
  combi_boiler:     'Combination boiler',
  regular_boiler:   'Regular boiler',
  system_boiler:    'System boiler',
  storage_combi:    'Storage combi',
  heat_pump:        'Heat pump',
  warm_air:         'Warm air unit',
  back_boiler:      'Back boiler',
  direct_electric:  'Direct electric heating',
  other_heat_source: 'Other heat source',
  none:             'no existing heat source',
};

export interface ProposedSystemStepProps {
  /** Currently selected proposed heat-source tile, or null. */
  selected: UiProposedHeatSourceLabel | null;
  /** Tile value pre-seeded from the Atlas recommendation, if available. */
  seedValue?: UiProposedHeatSourceLabel | null;
  /** The surveyor's current heat-source selection — used for context hint and ASHP gate. */
  currentHeatSource?: UiCurrentHeatSourceLabel | null;
  /** Called when the surveyor taps a tile. */
  onSelect: (value: UiProposedHeatSourceLabel) => void;
  /** Note entered when the ASHP → gas technical-review exception is open. */
  ashpExceptionNote?: string;
  /** Called when the surveyor types in the ASHP exception note field. */
  onAshpExceptionNoteChange?: (note: string) => void;
}

export function ProposedSystemStep({
  selected,
  seedValue,
  currentHeatSource,
  onSelect,
  ashpExceptionNote = '',
  onAshpExceptionNoteChange,
}: ProposedSystemStepProps) {
  const contextLabel =
    currentHeatSource != null
      ? CURRENT_HEAT_SOURCE_DISPLAY[currentHeatSource]
      : null;

  const isCurrentHeatPump = currentHeatSource === 'heat_pump';

  const [showAshpException, setShowAshpException] = useState(
    isCurrentHeatPump &&
      selected != null &&
      isGasBoilerProposedHeatSource(selected),
  );

  const normalTiles = isCurrentHeatPump
    ? ALL_PROPOSED_TILES.filter((t) => !isGasBoilerProposedHeatSource(t.value))
    : ALL_PROPOSED_TILES;

  function handleAshpExceptionOpen() {
    setShowAshpException(true);
  }

  function handleAshpExceptionClose() {
    setShowAshpException(false);
    if (selected != null && isGasBoilerProposedHeatSource(selected)) {
      onSelect('heat_pump');
    }
    onAshpExceptionNoteChange?.('');
  }

  return (
    <>
      <h2 className="qp-step-heading">What heat source are you proposing?</h2>
      <p className="qp-step-subheading">
        Choose the proposed heat source.
        {seedValue != null && ' Atlas has pre-selected its recommendation — you can override this.'}
      </p>
      {contextLabel != null && (
        <p className="qp-context-hint">
          Current heat source: <strong>{contextLabel}</strong>
        </p>
      )}

      <div className="spec-sys-tile-grid">
        {normalTiles.map(({ value, title, subtitle, imageSrc }) => {
          const isAtlasPick = seedValue != null && value === seedValue;
          return (
            <SpecificationSystemTile
              key={value}
              value={value}
              title={title}
              subtitle={subtitle}
              imageSrc={imageSrc}
              selected={selected === value}
              badge={isAtlasPick ? 'Atlas selected' : undefined}
              onClick={() => {
                setShowAshpException(false);
                onSelect(value);
              }}
            />
          );
        })}
      </div>

      {/* ASHP → gas exception path */}
      {isCurrentHeatPump && !showAshpException && (
        <button
          type="button"
          className="spec-exception-btn"
          onClick={handleAshpExceptionOpen}
          data-testid="ashp-gas-exception-btn"
        >
          Change to gas or conventional heating — technical review required
        </button>
      )}

      {isCurrentHeatPump && showAshpException && (
        <div className="spec-exception-panel" data-testid="ashp-exception-panel">
          <div className="spec-exception-panel__header">
            <span className="spec-exception-panel__warning">
              ⚠️ Technical review required
            </span>
            <button
              type="button"
              className="spec-exception-panel__cancel"
              aria-label="Cancel ASHP exception"
              onClick={handleAshpExceptionClose}
            >
              ✕
            </button>
          </div>
          <p className="spec-exception-panel__body">
            Changing from a heat pump to a gas heat source is not a normal
            specification variant. Record the reason before continuing.
          </p>
          <p className="spec-exception-panel__hint">
            A reason note is required before you can continue.
          </p>
          <textarea
            className="spec-exception-panel__note"
            placeholder="Record the reason for the gas system change…"
            value={ashpExceptionNote}
            onChange={(e) => onAshpExceptionNoteChange?.(e.target.value)}
            rows={3}
            aria-label="ASHP to gas exception note"
          />
          <div className="spec-sys-tile-grid spec-sys-tile-grid--exception">
            {ALL_PROPOSED_TILES.filter((t) => isGasBoilerProposedHeatSource(t.value)).map(
              ({ value, title, subtitle, imageSrc }) => (
                <SpecificationSystemTile
                  key={value}
                  value={value}
                  title={title}
                  subtitle={subtitle}
                  imageSrc={imageSrc}
                  selected={selected === value}
                  onClick={() => onSelect(value)}
                />
              ),
            )}
          </div>
        </div>
      )}
    </>
  );
}
