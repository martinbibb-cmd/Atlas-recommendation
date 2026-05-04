/**
 * CurrentSystemStep.tsx
 *
 * Step 1 of the Installation Specification: "What system do you have now?"
 *
 * Renders a visual tile grid for all recognised system families.
 * "Unknown" is NOT shown as a normal tile — surveyors who cannot identify
 * the existing system must use the exception action at the bottom of the
 * step, which requires a note before the step can be advanced.
 *
 * Exception path: "Cannot confirm — needs technical review"
 *   - Requires a note before the step can be advanced.
 *   - Sets the internal system to 'unknown' and marks the specification
 *     confidence as needs_verification.
 */

import { useState } from 'react';
import { SpecificationSystemTile } from '../components/SpecificationSystemTile';
import type { UiCurrentSystemLabel } from '../installationSpecificationUiTypes';

type KnownSystemLabel = Exclude<UiCurrentSystemLabel, 'unknown'>;

interface SystemTileDefinition {
  value: KnownSystemLabel;
  title: string;
  subtitle: string;
  imageSrc: string | null;
}

const CURRENT_SYSTEM_TILES: SystemTileDefinition[] = [
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
    value:    'storage_combi',
    title:    'Storage combi',
    subtitle: 'On-demand boiler with built-in store',
    imageSrc: '/images/systems/Combination.PNG',
  },
  {
    value:    'thermal_store',
    title:    'Thermal store',
    subtitle: 'Stored heat with mains hot water',
    imageSrc: '/images/systems/System-components.JPG',
  },
  {
    value:    'heat_pump',
    title:    'Heat pump',
    subtitle: 'Low-temperature heat source',
    imageSrc: '/images/systems/ASHP.PNG',
  },
  {
    value:    'warm_air',
    title:    'Warm air',
    subtitle: 'Ducted warm-air system',
    imageSrc: null,
  },
];

export interface CurrentSystemStepProps {
  /** Currently selected tile value, or null when nothing is selected. */
  selected: UiCurrentSystemLabel | null;
  /** Note for the exception path — required when selected === 'unknown'. */
  exceptionNote: string;
  /** Called when the surveyor selects a normal system tile. */
  onSelect: (value: UiCurrentSystemLabel) => void;
  /** Called when the exception-path note changes. */
  onExceptionNoteChange: (note: string) => void;
  /** Called when the surveyor cancels the exception path. */
  onClearSelection: () => void;
}

export function CurrentSystemStep({
  selected,
  exceptionNote,
  onSelect,
  onExceptionNoteChange,
  onClearSelection,
}: CurrentSystemStepProps) {
  const [showException, setShowException] = useState(selected === 'unknown');

  function handleTileClick(value: KnownSystemLabel) {
    setShowException(false);
    onSelect(value);
  }

  function handleExceptionClick() {
    setShowException(true);
    onSelect('unknown');
  }

  function handleExceptionCancel() {
    setShowException(false);
    onClearSelection();
  }

  return (
    <>
      <h2 className="qp-step-heading">What system do you have now?</h2>
      <p className="qp-step-subheading">
        Select the type that best describes the existing heating system.
      </p>
      <div className="spec-sys-tile-grid">
        {CURRENT_SYSTEM_TILES.map(({ value, title, subtitle, imageSrc }) => (
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

      {/* Exception path — not a normal system tile */}
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
            placeholder="Describe why the system cannot be confirmed…"
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
