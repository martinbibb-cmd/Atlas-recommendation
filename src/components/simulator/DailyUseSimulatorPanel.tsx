/**
 * DailyUseSimulatorPanel.tsx — Interactive daily-use simulator for the
 * recommended scenario.
 *
 * Layout:
 *   1. Title + sub-heading
 *   2. TopStatePanel     — heat source state, mains, cylinder charge
 *   3. EventButtonsRow   — tap an event to simulate it
 *   4. ReactionCards     — outcome cards for the active event
 *
 * State:
 *   activeEventType — which step is currently displayed (defaults to 'shower')
 *
 * Rules:
 *   - No recommendation logic lives here.
 *   - All content comes from the DailyUseSimulation model built by the engine.
 *   - No Math.random().
 */

import { useState } from 'react';
import type { DailyUseSimulation, DailyUseEventType } from '../../contracts/DailyUseSimulation';
import { TopStatePanel } from './TopStatePanel';
import { EventButtonsRow } from './EventButtonsRow';
import { ReactionCards } from './ReactionCards';
import './DailyUseSimulatorPanel.css';

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  simulation: DailyUseSimulation;
}

export function DailyUseSimulatorPanel({ simulation }: Props) {
  const firstStep = simulation.steps[0];
  const [activeEventType, setActiveEventType] = useState<DailyUseEventType>(
    firstStep?.eventType ?? 'shower',
  );

  const activeStep = simulation.steps.find((s) => s.eventType === activeEventType);

  if (!firstStep || !activeStep) {
    return (
      <p className="daily-use-simulator-panel__empty">
        No simulation steps available.
      </p>
    );
  }

  return (
    <section
      className="daily-use-simulator-panel"
      aria-label={simulation.title}
      data-testid="daily-use-simulator-panel"
    >
      {/* Title */}
      <h3 className="daily-use-simulator-panel__title">{simulation.title}</h3>
      <p className="daily-use-simulator-panel__hint">
        Tap an event to see how your recommended system responds.
      </p>

      {/* Top state panel */}
      <TopStatePanel topPanel={activeStep.topPanel} />

      {/* Event buttons */}
      <EventButtonsRow
        steps={simulation.steps}
        activeEventType={activeEventType}
        onSelect={setActiveEventType}
      />

      {/* Reaction cards */}
      <div className="daily-use-simulator-panel__reactions">
        <ReactionCards reactions={activeStep.reactions} />
      </div>
    </section>
  );
}
