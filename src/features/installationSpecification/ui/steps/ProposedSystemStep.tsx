/**
 * ProposedSystemStep.tsx
 *
 * Step 2 of the Installation Specification: "What system are you proposing?"
 *
 * Shows the set of recommendable systems as large visual tiles.  When
 * `seedValue` is provided the matching tile is pre-selected and marked with
 * an "Atlas selected" badge, indicating the choice was seeded from the Atlas
 * recommendation.
 *
 * The surveyor may override the pre-selection to record a specification
 * variant. This does NOT change the underlying recommendation decision.
 *
 * "Unknown" is not shown as a normal tile — it exists only as an internal
 * fallback state (e.g. when import hydration fails).
 *
 * ASHP rule: when the current system is a heat pump, gas boiler families are
 * not shown as normal proposed choices.  Changing an ASHP property back to gas
 * heating is not a normal specification variant; it requires a technical
 * review exception with a mandatory reason note.
 */

import { useState } from 'react';
import { SpecificationSystemTile } from '../components/SpecificationSystemTile';
import type { UiCurrentSystemLabel, UiProposedSystemLabel } from '../installationSpecificationUiTypes';

interface SystemTileDefinition {
  value: Exclude<UiProposedSystemLabel, 'unknown'>;
  title: string;
  subtitle: string;
  imageSrc: string | null;
}

/** All normal proposed-system tiles. */
const ALL_PROPOSED_SYSTEM_TILES: SystemTileDefinition[] = [
  {
    value:    'combi',
    title:    'Combination boiler',
    subtitle: 'On-demand hot water',
    imageSrc: '/images/systems/Combination.PNG',
  },
  {
    value:    'system_boiler',
    title:    'System boiler + cylinder',
    subtitle: 'Stored hot water, sealed primary',
    imageSrc: '/images/systems/system-boiler.PNG',
  },
  {
    value:    'regular_open_vent',
    title:    'Regular / open vent',
    subtitle: 'Boiler, cylinder and tanks',
    imageSrc: '/images/systems/open-vented-schematic.JPG',
  },
  {
    value:    'heat_pump',
    title:    'Heat pump',
    subtitle: 'Low-temperature heat source',
    imageSrc: '/images/systems/ASHP.PNG',
  },
];

/** Gas boiler families that are not valid normal choices when current is heat_pump. */
const GAS_BOILER_VALUES = new Set<Exclude<UiProposedSystemLabel, 'unknown'>>([
  'combi',
  'system_boiler',
  'regular_open_vent',
]);

/** Human-readable display label for a current-system tile value. */
const CURRENT_SYSTEM_DISPLAY: Record<UiCurrentSystemLabel, string> = {
  combi:             'Combination boiler',
  system_boiler:     'System boiler + cylinder',
  regular_open_vent: 'Regular / open vent',
  storage_combi:     'Storage combi',
  thermal_store:     'Thermal store',
  heat_pump:         'Heat pump',
  warm_air:          'Warm air',
  unknown:           'the existing system',
};

export interface ProposedSystemStepProps {
  /** Currently selected tile value, or null when nothing is selected. */
  selected: UiProposedSystemLabel | null;
  /**
   * Tile value pre-seeded from the Atlas recommendation, if available.
   * When set, the matching tile shows an "Atlas selected" badge on first render.
   * Does not prevent the surveyor from selecting a different tile.
   */
  seedValue?: UiProposedSystemLabel | null;
  /**
   * The surveyor's current-system selection — used to show a context hint
   * and to apply the ASHP system-family gate.
   * Optional; hint is suppressed when absent.
   */
  currentSystemLabel?: UiCurrentSystemLabel | null;
  /** Called when the surveyor taps a tile. */
  onSelect: (value: UiProposedSystemLabel) => void;
  /**
   * Note entered when the ASHP → gas technical-review exception is open.
   * Managed by the parent so the stepper can gate the Next button.
   */
  ashpExceptionNote?: string;
  /**
   * Called when the surveyor types in the ASHP exception note field.
   * Managed by the parent (stepper) so canAdvance logic can check it.
   */
  onAshpExceptionNoteChange?: (note: string) => void;
}

export function ProposedSystemStep({
  selected,
  seedValue,
  currentSystemLabel,
  onSelect,
  ashpExceptionNote = '',
  onAshpExceptionNoteChange,
}: ProposedSystemStepProps) {
  const contextLabel =
    currentSystemLabel != null
      ? CURRENT_SYSTEM_DISPLAY[currentSystemLabel]
      : null;

  // ASHP gate: when the current system is a heat pump, gas boiler families are hidden.
  const isCurrentHeatPump = currentSystemLabel === 'heat_pump';

  // Exception-panel state for the ASHP → gas override.
  const [showAshpException, setShowAshpException] = useState(
    isCurrentHeatPump && selected != null && GAS_BOILER_VALUES.has(selected as Exclude<UiProposedSystemLabel, 'unknown'>),
  );

  // Tiles visible without the exception panel.
  const normalTiles = isCurrentHeatPump
    ? ALL_PROPOSED_SYSTEM_TILES.filter((t) => !GAS_BOILER_VALUES.has(t.value))
    : ALL_PROPOSED_SYSTEM_TILES;

  function handleAshpExceptionOpen() {
    setShowAshpException(true);
  }

  function handleAshpExceptionClose() {
    setShowAshpException(false);
    // If a gas system was selected via the exception, clear that selection.
    if (selected != null && GAS_BOILER_VALUES.has(selected as Exclude<UiProposedSystemLabel, 'unknown'>)) {
      onSelect('heat_pump');
    }
    onAshpExceptionNoteChange?.('');
  }

  return (
    <>
      <h2 className="qp-step-heading">What system are you proposing?</h2>
      <p className="qp-step-subheading">
        Choose the replacement system for this job.
        {seedValue != null && ' Atlas has pre-selected its recommendation — you can override this.'}
      </p>
      {contextLabel != null && (
        <p className="qp-context-hint">
          Because you chose <strong>{contextLabel}</strong>, Atlas needs the proposed system next.
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
            Changing an ASHP property back to a gas heat source is not a normal
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
          {/* Gas system tiles are only shown inside the exception panel */}
          <div className="spec-sys-tile-grid spec-sys-tile-grid--exception">
            {ALL_PROPOSED_SYSTEM_TILES.filter((t) => GAS_BOILER_VALUES.has(t.value)).map(
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
