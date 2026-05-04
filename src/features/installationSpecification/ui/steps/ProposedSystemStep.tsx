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
 */

import { SpecificationSystemTile } from '../components/SpecificationSystemTile';
import type { UiCurrentSystemLabel, UiProposedSystemLabel } from '../installationSpecificationUiTypes';

interface SystemTileDefinition {
  value: Exclude<UiProposedSystemLabel, 'unknown'>;
  title: string;
  subtitle: string;
  imageSrc: string | null;
}

const PROPOSED_SYSTEM_TILES: SystemTileDefinition[] = [
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
   * The surveyor's current-system selection — used to show a context hint.
   * Optional; hint is suppressed when absent.
   */
  currentSystemLabel?: UiCurrentSystemLabel | null;
  /** Called when the surveyor taps a tile. */
  onSelect: (value: UiProposedSystemLabel) => void;
}

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
      <div className="spec-sys-tile-grid">
        {PROPOSED_SYSTEM_TILES.map(({ value, title, subtitle, imageSrc }) => {
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
              onClick={() => onSelect(value)}
            />
          );
        })}
      </div>
    </>
  );
}
