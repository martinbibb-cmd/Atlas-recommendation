/**
 * EventButtonsRow.tsx — Row of event buttons for the daily-use simulator.
 *
 * Renders one button per simulated event. The active event is highlighted.
 *
 * Rules:
 *   - Pure presenter — no recommendation logic.
 *   - Active state managed by the parent (DailyUseSimulatorPanel).
 */

import type { DailyUseEventType, DailyUseSimulationStep } from '../../contracts/DailyUseSimulation';
import './EventButtonsRow.css';

// ─── Event icon map ───────────────────────────────────────────────────────────

const EVENT_ICON: Record<DailyUseEventType, string> = {
  shower:        '🚿',
  second_shower: '🚿🚿',
  bath:          '🛁',
  sink:          '🚰',
  heating_boost: '🔥',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  steps: DailyUseSimulationStep[];
  activeEventType: DailyUseEventType;
  onSelect: (eventType: DailyUseEventType) => void;
}

export function EventButtonsRow({ steps, activeEventType, onSelect }: Props) {
  return (
    <div
      className="event-buttons-row"
      role="group"
      aria-label="Simulate a household event"
    >
      {steps.map((step) => (
        <button
          key={step.eventType}
          type="button"
          className={`event-buttons-row__btn${step.eventType === activeEventType ? ' event-buttons-row__btn--active' : ''}`}
          aria-pressed={step.eventType === activeEventType}
          onClick={() => onSelect(step.eventType)}
        >
          <span className="event-buttons-row__icon" aria-hidden="true">
            {EVENT_ICON[step.eventType]}
          </span>
          <span className="event-buttons-row__label">{step.label}</span>
        </button>
      ))}
    </div>
  );
}
