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
  /** Timeline and draw-off panels rendered as children. */
  children: ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TimelineBottomSheet({
  open,
  scenarioKey,
  onScenarioChange,
  onToggle,
  children,
}: TimelineBottomSheetProps) {
  return (
    <section
      className={`hs-bottom-sheet${open ? ' hs-bottom-sheet--open' : ''}`}
      aria-label="Timeline and scenarios"
    >
      {/* ── Sheet header ─────────────────────────────────────────────────── */}
      <div className="hs-bottom-sheet__header">
        <h2 className="hs-bottom-sheet__title">Timeline and scenarios</h2>
        <div className="hs-bottom-sheet__toolbar">
          {/* Scenario preset selector */}
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
          {/* Collapse / expand toggle */}
          <button
            className="hs-action-btn"
            onClick={onToggle}
            aria-label={open ? 'Collapse timeline' : 'Expand timeline'}
          >
            {open ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* ── Sheet body (timeline + draw-off controls) ─────────────────────── */}
      {open && (
        <div className="hs-bottom-sheet__body">
          {children}
        </div>
      )}
    </section>
  );
}
