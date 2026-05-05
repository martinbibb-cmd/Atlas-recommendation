/**
 * CurrentSystemStep.tsx
 *
 * Step 1 of the Installation Specification: "What is currently installed?"
 *
 * Three-tile existence check:
 *   - Existing wet heating system
 *   - No existing wet heating system
 *   - Partial / abandoned system
 *
 * "None / no wet heating" is a first-class visible tile — not hidden behind an
 * exception path.  This handles first-install, blank-property, and
 * electric-only setups.
 *
 * Surveyor exception path "Cannot confirm — needs technical review" is only
 * available when the surveyor cannot identify any of the three states.
 */

import { useState } from 'react';
import { SpecificationSystemTile } from '../components/SpecificationSystemTile';
import type { UiExistenceLabel } from '../installationSpecificationUiTypes';

interface ExistenceTileDefinition {
  value: UiExistenceLabel;
  title: string;
  subtitle: string;
  imageSrc: string | null;
}

const EXISTENCE_TILES: ExistenceTileDefinition[] = [
  {
    value:    'has_wet_heating',
    title:    'Existing wet heating system',
    subtitle: 'Boiler, heat pump, or similar — connected to radiators or underfloor',
    imageSrc: '/images/systems/system-components.svg',
  },
  {
    value:    'no_wet_heating',
    title:    'No existing wet heating system',
    subtitle: 'First install, electric-only, or blank property — no wet circuit',
    imageSrc: null,
  },
  {
    value:    'partial_abandoned',
    title:    'Partial or abandoned system',
    subtitle: 'Incomplete or decommissioned wet heating — scope requires clarification',
    imageSrc: null,
  },
];

export interface CurrentSystemStepProps {
  /** Currently selected existence tile value, or null when nothing is selected. */
  selected: UiExistenceLabel | null;
  /** Note for the exception path — required when exception is open. */
  exceptionNote: string;
  /** Called when the surveyor selects an existence tile. */
  onSelect: (value: UiExistenceLabel) => void;
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
  const [showException, setShowException] = useState(false);

  function handleTileClick(value: UiExistenceLabel) {
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
      <h2 className="qp-step-heading">What is currently installed?</h2>
      <p className="qp-step-subheading">
        Select the option that best describes the existing installation.
      </p>
      <div className="spec-sys-tile-grid">
        {EXISTENCE_TILES.map(({ value, title, subtitle, imageSrc }) => (
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

      {/* Exception path — not a normal existence tile */}
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
            placeholder="Describe why the installation cannot be confirmed…"
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
