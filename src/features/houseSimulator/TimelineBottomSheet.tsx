/**
 * TimelineBottomSheet — collapsible bottom sheet for the House Simulator.
 *
 * Renders:
 *   - Scenario selector (Winter weekday / Winter weekend / Mild day / Summer DHW-only)
 *   - 24-hour day timeline strip sourced from DayTimelinePanel
 *   - Draw-off controls (via DrawOffStatusPanel)
 *
 * All simulator state is passed down as props; this component contains no
 * physics logic.
 */

import type { ReactNode } from 'react';
import type { ScenarioKey } from '../../explainers/lego/simulator/scenarioTypes';
import { SCENARIO_PRESET_LIST } from '../../explainers/lego/simulator/scenarioTypes';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimelineBottomSheetProps {
  /** Whether the sheet is expanded. */
  open: boolean;
  /** Current scenario preset key. */
  scenarioKey: ScenarioKey;
  /** Called when a scenario preset button is pressed. */
  onScenarioChange: (key: ScenarioKey) => void;
  /** Called to toggle the sheet open/closed. */
  onToggle: () => void;
  /** Current simulated hour for timeline scrubber context. */
  simHour: number;
  /** Current playback mode. */
  mode: 'auto' | 'manual';
  /** Toggle playback mode. */
  onSetMode: (mode: 'auto' | 'manual') => void;
  /** Current active event labels surfaced in the summary area. */
  activeEvents: string[];
  /** Main sheet body content (timeline strip and event summary). */
  children: ReactNode;
  /** Optional advanced controls content, hidden by default. */
  advancedChildren?: ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TimelineBottomSheet({
  open,
  scenarioKey,
  onScenarioChange,
  onToggle,
  simHour,
  mode,
  onSetMode,
  activeEvents,
  children,
  advancedChildren,
}: TimelineBottomSheetProps) {
  return (
    <section
      className={`hs-bottom-sheet${open ? ' hs-bottom-sheet--open' : ''}`}
      aria-label="Timeline and scenarios"
    >
      <div className="hs-bottom-sheet__header">
        <h2 className="hs-bottom-sheet__title">Timeline and scenarios</h2>
        <button
          className="hs-action-btn hs-bottom-sheet__advanced-toggle"
          onClick={onToggle}
          aria-label={open ? 'Hide advanced controls' : 'Show advanced controls'}
          aria-expanded={open}
        >
          {open ? 'Hide advanced controls' : 'Show advanced controls'}
        </button>
      </div>

      <div className="hs-bottom-sheet__compact">
        <div
          className="hs-scenario-selector"
          role="group"
          aria-label="Day scenario"
        >
          {SCENARIO_PRESET_LIST.map(preset => (
            <button
              key={preset.key}
              className={`hs-scenario-btn${scenarioKey === preset.key ? ' hs-scenario-btn--active' : ''}`}
              onClick={() => onScenarioChange(preset.key)}
              aria-pressed={scenarioKey === preset.key}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="hs-bottom-sheet__controls">
          <div className="hs-bottom-sheet__playback" role="group" aria-label="Playback mode">
            <button
              className={`hs-scenario-btn${mode === 'auto' ? ' hs-scenario-btn--active' : ''}`}
              onClick={() => onSetMode('auto')}
              aria-pressed={mode === 'auto'}
            >
              Auto
            </button>
            <button
              className={`hs-scenario-btn${mode === 'manual' ? ' hs-scenario-btn--active' : ''}`}
              onClick={() => onSetMode('manual')}
              aria-pressed={mode === 'manual'}
            >
              Manual
            </button>
          </div>
          <label className="hs-bottom-sheet__scrubber">
            Time scrubber
            <progress max={23} value={simHour} aria-label={`Current simulated hour ${simHour}:00`} />
            <span aria-hidden="true">{String(simHour).padStart(2, '0')}:00</span>
          </label>
        </div>

        <div className="hs-bottom-sheet__events" aria-label="Active events summary">
          {activeEvents.length > 0 ? activeEvents.map(event => (
            <span key={event} className="hs-bottom-sheet__event-pill">{event}</span>
          )) : (
            <span className="hs-bottom-sheet__event-empty">No active events</span>
          )}
        </div>

        {children}
      </div>

      {open && advancedChildren != null && (
        <div className="hs-bottom-sheet__advanced" role="region" aria-label="Advanced controls">
          <div className="hs-bottom-sheet__advanced-body">
            {advancedChildren}
          </div>
        </div>
      )}
    </section>
  );
}
