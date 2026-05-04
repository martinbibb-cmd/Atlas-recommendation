/**
 * ProposedSystemStep.tsx
 *
 * Step 2 of the Installation Specification: "What system are you proposing?"
 *
 * Shows the same set of recommendable systems.  When `seedFamily` is provided
 * the matching tile is pre-selected and marked with an "Atlas Pick" badge,
 * indicating the choice was seeded from the Atlas recommendation.
 *
 * The engineer may override the pre-selection to record a quote variant.
 * This does NOT change the underlying recommendation decision.
 */

import { SpecificationStepTile } from '../SpecificationStepTile';
import type { UiCurrentSystemLabel, UiProposedSystemLabel } from '../installationSpecificationUiTypes';

interface TileDefinition {
  label: string;
  icon: string;
  value: UiProposedSystemLabel;
}

const PROPOSED_SYSTEM_TILES: TileDefinition[] = [
  { label: 'Combi',               icon: '🔥', value: 'combi' },
  { label: 'System boiler',       icon: '🏠', value: 'system_boiler' },
  { label: 'Regular / open vent', icon: '💧', value: 'regular_open_vent' },
  { label: 'Heat pump',           icon: '♻️', value: 'heat_pump' },
  { label: 'Unknown',             icon: '❓', value: 'unknown' },
];

export interface ProposedSystemStepProps {
  /** Currently selected tile value, or null when nothing is selected. */
  selected: UiProposedSystemLabel | null;
  /**
   * Tile value pre-seeded from the Atlas recommendation, if available.
   * When set, the matching tile shows an "Atlas Pick" badge on first render.
   * Does not prevent the engineer from selecting a different tile.
   */
  seedValue?: UiProposedSystemLabel | null;
  /**
   * The engineer's current-system selection — used to show a context hint.
   * Optional; hint is suppressed when absent.
   */
  currentSystemLabel?: UiCurrentSystemLabel | null;
  /** Called when the engineer taps a tile. */
  onSelect: (value: UiProposedSystemLabel) => void;
}

/** Human-readable display label for a current-system tile value. */
const CURRENT_SYSTEM_DISPLAY: Record<UiCurrentSystemLabel, string> = {
  combi:             'Combi',
  system_boiler:     'System boiler',
  regular_open_vent: 'Regular / open vent',
  storage_combi:     'Storage combi',
  thermal_store:     'Thermal store',
  heat_pump:         'Heat pump',
  warm_air:          'Warm air',
  unknown:           'the existing system',
};

export function ProposedSystemStep({
  selected,
  seedValue,
  currentSystemLabel,
  onSelect,
}: ProposedSystemStepProps) {
  const contextLabel =
    currentSystemLabel != null
      ? CURRENT_SYSTEM_DISPLAY[currentSystemLabel]
      : null;

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
      <div className="qp-tile-grid">
        {PROPOSED_SYSTEM_TILES.map(({ label, icon, value }) => {
          const isAtlasPick = seedValue != null && value === seedValue;
          return (
            <SpecificationStepTile
              key={value}
              icon={icon}
              label={label}
              selected={selected === value}
              badge={isAtlasPick ? 'Atlas Pick' : undefined}
              onClick={() => onSelect(value)}
            />
          );
        })}
      </div>
    </>
  );
}
