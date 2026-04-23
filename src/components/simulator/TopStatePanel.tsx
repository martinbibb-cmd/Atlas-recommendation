/**
 * TopStatePanel.tsx — Shows the current heat-source and supply state during
 * a simulated daily-use event.
 *
 * Renders four indicators:
 *   1. Heat source state badge
 *   2. Flow temperature (when derivable)
 *   3. Cold mains status
 *   4. Cylinder charge bar (when applicable)
 *
 * Rules:
 *   - Pure presenter — all values come from DailyUseTopPanel.
 *   - No recommendation logic.
 *   - No Math.random().
 */

import type { DailyUseTopPanel } from '../../contracts/DailyUseSimulation';
import './TopStatePanel.css';

// ─── Heat-source state ────────────────────────────────────────────────────────

const HEAT_STATE_LABEL: Record<DailyUseTopPanel['heatSourceState'], string> = {
  idle:       'Idle',
  heating:    'Heating',
  hot_water:  'Hot water running',
  recovering: 'Recovering',
};

const HEAT_STATE_MODIFIER: Record<DailyUseTopPanel['heatSourceState'], string> = {
  idle:       'idle',
  heating:    'heating',
  hot_water:  'hot-water',
  recovering: 'recovering',
};

// ─── Cold mains status ────────────────────────────────────────────────────────

const MAINS_LABEL: Record<DailyUseTopPanel['coldMainsStatus'], string> = {
  strong:  'Strong',
  reduced: 'Slightly reduced',
  limited: 'Limited',
  unknown: 'Unknown',
};

const MAINS_MODIFIER: Record<DailyUseTopPanel['coldMainsStatus'], string> = {
  strong:  'strong',
  reduced: 'reduced',
  limited: 'limited',
  unknown: 'unknown',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  topPanel: DailyUseTopPanel;
}

export function TopStatePanel({ topPanel }: Props) {
  const {
    heatSourceState,
    flowTempC,
    coldMainsStatus,
    cylinderChargePercent,
  } = topPanel;

  return (
    <div className="top-state-panel" role="region" aria-label="System state">

      {/* Heat source state */}
      <div
        className={`top-state-panel__badge top-state-panel__badge--${HEAT_STATE_MODIFIER[heatSourceState]}`}
        role="status"
        aria-label={`Heat source: ${HEAT_STATE_LABEL[heatSourceState]}`}
      >
        <span className="top-state-panel__badge-dot" aria-hidden="true" />
        <span className="top-state-panel__badge-label">
          {HEAT_STATE_LABEL[heatSourceState]}
        </span>
      </div>

      {/* Indicators row */}
      <div className="top-state-panel__indicators">

        {/* Flow temperature */}
        {flowTempC !== undefined && (
          <div className="top-state-panel__indicator">
            <span className="top-state-panel__indicator-label">Flow temp</span>
            <span className="top-state-panel__indicator-value">{flowTempC} °C</span>
          </div>
        )}

        {/* Cold mains */}
        <div className="top-state-panel__indicator">
          <span className="top-state-panel__indicator-label">Cold mains</span>
          <span
            className={`top-state-panel__indicator-value top-state-panel__indicator-value--${MAINS_MODIFIER[coldMainsStatus]}`}
          >
            {MAINS_LABEL[coldMainsStatus]}
          </span>
        </div>

        {/* Cylinder charge */}
        {cylinderChargePercent !== undefined && (
          <div className="top-state-panel__indicator top-state-panel__indicator--cylinder">
            <span className="top-state-panel__indicator-label">Cylinder charge</span>
            <span className="top-state-panel__indicator-value">
              {cylinderChargePercent}%
            </span>
            <div
              className="top-state-panel__cylinder-bar"
              role="progressbar"
              aria-valuenow={cylinderChargePercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Cylinder charge: ${cylinderChargePercent}%`}
            >
              <div
                className={`top-state-panel__cylinder-fill${cylinderChargePercent < 25 ? ' top-state-panel__cylinder-fill--low' : ''}`}
                style={{ width: `${cylinderChargePercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
