/**
 * ControlsStep.tsx
 *
 * Controls selection step for the Atlas Installation Specification.
 *
 * Captures the heating and hot-water controls to be included in the
 * installation pack.  Controls are not an afterthought — they affect
 * comfort, efficiency, compliance, and customer perception.
 *
 * Design rules:
 *   - Shows controls grouped by category (heating / hot water / smart).
 *   - Each control item has a reason string.
 *   - Pre-selects sensible defaults based on the proposed system type.
 *   - Does not collect current-system data (read from canonical survey).
 *   - Does not alter recommendation decisions.
 */

import { useState } from 'react';
import type { UiProposedHeatSourceLabel, UiProposedHotWaterLabel } from '../installationSpecificationUiTypes';

// ─── Control item types ───────────────────────────────────────────────────────

export type ControlItemId =
  | 'basic_programmer'
  | 'smart_thermostat'
  | 'weather_compensation'
  | 'load_compensation'
  | 'opentherm'
  | 'room_thermostat'
  | 'cylinder_thermostat'
  | 'two_channel_programmer'
  | 'trvs'
  | 'smart_trvs'
  | 'zoning'
  | 'wiring_centre'
  | 'app_handover';

export interface ControlItem {
  id: ControlItemId;
  label: string;
  reason: string;
  category: 'heating' | 'hot_water' | 'smart';
  /** Whether this control is included by default for the selected pack. */
  defaultIncluded: boolean;
}

export interface ControlsSelection {
  /** Set of control item IDs selected by the surveyor. */
  selectedIds: Set<ControlItemId>;
}

// ─── Default control set builder ─────────────────────────────────────────────

const ALL_CONTROLS: ControlItem[] = [
  {
    id: 'basic_programmer',
    label: 'Programmable room thermostat',
    reason: 'A time-programmable room thermostat is required to meet boiler efficiency and building regulations requirements.',
    category: 'heating',
    defaultIncluded: true,
  },
  {
    id: 'room_thermostat',
    label: 'Room thermostat',
    reason: 'A room thermostat provides zone control and helps the boiler respond to actual room temperature rather than just a timer.',
    category: 'heating',
    defaultIncluded: true,
  },
  {
    id: 'smart_thermostat',
    label: 'Smart thermostat',
    reason: 'A smart thermostat allows remote control and scheduling, improving comfort and reducing energy use.',
    category: 'smart',
    defaultIncluded: false,
  },
  {
    id: 'weather_compensation',
    label: 'Weather compensation',
    reason: 'Weather compensation adjusts flow temperature based on outdoor conditions, improving boiler efficiency at lower loads.',
    category: 'heating',
    defaultIncluded: false,
  },
  {
    id: 'load_compensation',
    label: 'Load compensation',
    reason: 'Load compensation modulates the boiler output based on indoor temperature demand, reducing cycling and improving efficiency.',
    category: 'heating',
    defaultIncluded: false,
  },
  {
    id: 'opentherm',
    label: 'OpenTherm connection',
    reason: 'OpenTherm enables modulating communication between the thermostat and a compatible boiler, unlocking full efficiency benefits.',
    category: 'heating',
    defaultIncluded: false,
  },
  {
    id: 'cylinder_thermostat',
    label: 'Cylinder thermostat',
    reason: 'A cylinder thermostat controls stored hot-water temperature to prevent overheating and energy waste.',
    category: 'hot_water',
    defaultIncluded: false,
  },
  {
    id: 'two_channel_programmer',
    label: 'Two-channel programmer',
    reason: 'A two-channel programmer controls heating and hot water independently on separate schedules.',
    category: 'hot_water',
    defaultIncluded: false,
  },
  {
    id: 'trvs',
    label: 'Thermostatic radiator valves (TRVs)',
    reason: 'TRVs allow individual radiator temperature control, reducing energy use in unoccupied rooms.',
    category: 'heating',
    defaultIncluded: false,
  },
  {
    id: 'smart_trvs',
    label: 'Smart TRVs',
    reason: 'Smart TRVs enable room-by-room scheduling and remote control, improving comfort and energy efficiency.',
    category: 'smart',
    defaultIncluded: false,
  },
  {
    id: 'zoning',
    label: 'Zoning (multi-zone control)',
    reason: 'Zoning allows separate temperature control for different areas of the property, improving comfort and reducing energy use.',
    category: 'heating',
    defaultIncluded: false,
  },
  {
    id: 'wiring_centre',
    label: 'Wiring centre / system controller',
    reason: 'A wiring centre is required when multiple heating zones, motorised valves, and controls need coordinated wiring.',
    category: 'heating',
    defaultIncluded: false,
  },
  {
    id: 'app_handover',
    label: 'App setup and customer handover',
    reason: 'App setup and customer handover ensures the customer can use and manage their new controls effectively.',
    category: 'smart',
    defaultIncluded: true,
  },
];

/**
 * Returns the default selected controls for a given proposed system.
 */
function getDefaultControlIds(
  proposedHeatSource: UiProposedHeatSourceLabel | null,
  proposedHotWater: UiProposedHotWaterLabel | null,
): Set<ControlItemId> {
  const ids = new Set<ControlItemId>();

  // Always include basic programmer and app handover
  ids.add('basic_programmer');
  ids.add('room_thermostat');
  ids.add('app_handover');

  // Cylinder controls — only when there is a stored hot-water arrangement
  if (
    proposedHotWater != null &&
    proposedHotWater !== 'no_stored_hot_water' &&
    proposedHeatSource !== 'combi_boiler' &&
    proposedHeatSource !== 'storage_combi'
  ) {
    ids.add('cylinder_thermostat');
    ids.add('two_channel_programmer');
  }

  return ids;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ControlsStepProps {
  /** The proposed heat source (determines which controls are relevant). */
  proposedHeatSource: UiProposedHeatSourceLabel | null;
  /** The proposed hot-water arrangement (determines cylinder controls). */
  proposedHotWater: UiProposedHotWaterLabel | null;
  /** Current controls selection. */
  selection: ControlsSelection;
  /** Called when the surveyor changes the controls selection. */
  onSelectionChange: (selection: ControlsSelection) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ControlsStep({
  proposedHeatSource,
  proposedHotWater,
  selection,
  onSelectionChange,
}: ControlsStepProps) {
  const hasCylinder =
    proposedHotWater != null &&
    proposedHotWater !== 'no_stored_hot_water' &&
    proposedHeatSource !== 'combi_boiler' &&
    proposedHeatSource !== 'storage_combi';

  // Filter controls by relevance to proposed system
  const visibleControls = ALL_CONTROLS.filter((control) => {
    if (control.category === 'hot_water' && !hasCylinder) return false;
    return true;
  });

  const categories: Array<{ key: 'heating' | 'hot_water' | 'smart'; label: string }> = [
    { key: 'heating',   label: 'Heating controls' },
    { key: 'hot_water', label: 'Hot water controls' },
    { key: 'smart',     label: 'Smart controls' },
  ];

  function toggleControl(id: ControlItemId) {
    const next = new Set(selection.selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange({ selectedIds: next });
  }

  return (
    <>
      <h2 className="qp-step-heading">Controls</h2>
      <p className="qp-step-subheading">
        Select the controls to include in this installation pack.
        Each item shows why it is recommended for this system.
      </p>

      {categories.map(({ key, label }) => {
        const categoryControls = visibleControls.filter((c) => c.category === key);
        if (categoryControls.length === 0) return null;

        return (
          <section key={key} className="controls-step__group" data-testid={`controls-group-${key}`}>
            <h3 className="controls-step__group-heading">{label}</h3>
            <ul className="controls-step__list">
              {categoryControls.map((control) => {
                const checked = selection.selectedIds.has(control.id);
                return (
                  <li key={control.id} className="controls-step__item">
                    <label className="controls-step__item-label">
                      <input
                        type="checkbox"
                        className="controls-step__checkbox"
                        checked={checked}
                        onChange={() => toggleControl(control.id)}
                        data-testid={`control-${control.id}`}
                        aria-label={control.label}
                      />
                      <span className="controls-step__item-name">{control.label}</span>
                    </label>
                    <p className="controls-step__item-reason">{control.reason}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { getDefaultControlIds };
