/**
 * EfficiencyPanel — live return temperature, condensing state, and penalties.
 *
 * PR5: driven by SystemDiagramDisplayState via useEfficiencyPlayback.
 * Replaces the PR1 static placeholder.
 *
 * Architecture:
 *   SimulatorDashboard → useEfficiencyPlayback(diagramState) → EfficiencyDisplayState
 *   EfficiencyPanel({ state }) → render
 *
 * The panel is a display adapter: it never re-derives efficiency truth from
 * raw systemType booleans.  useEfficiencyPlayback is the single mapping layer.
 */

import { condensingStateBadgeText } from '../../sim/condensingState'
import type { EfficiencyDisplayState } from '../useEfficiencyPlayback'

interface EfficiencyPanelProps {
  state: EfficiencyDisplayState
}

function condensingBadgeClass(state: EfficiencyDisplayState): string {
  if (!state.condensingState) return 'idle'
  switch (state.condensingState) {
    case 'condensing':     return 'condensing'
    case 'borderline':     return 'borderline'
    case 'not_condensing': return 'not-condensing'
  }
}

export default function EfficiencyPanel({ state }: EfficiencyPanelProps) {
  return (
    <div className="efficiency-panel">
      {/* Return temperature (boiler) or mode label (heat pump) */}
      {state.systemKind === 'boiler' ? (
        <div className="efficiency-metric">
          <span className="efficiency-metric__label">Return temp</span>
          <span className="efficiency-metric__value">
            {state.returnTempC !== undefined ? `${Math.round(state.returnTempC)}°C` : '— °C'}
          </span>
        </div>
      ) : (
        <div className="efficiency-metric">
          <span className="efficiency-metric__label">COP</span>
          <span className="efficiency-metric__value">
            {state.cop !== undefined ? state.cop.toFixed(1) : '—'}
          </span>
        </div>
      )}

      {/* Required flow temperature (when emitter model is active) */}
      {state.requiredFlowTempC !== undefined && (
        <div className="efficiency-metric">
          <span className="efficiency-metric__label">Flow temp required</span>
          <span className="efficiency-metric__value">
            {Math.round(state.requiredFlowTempC)}°C
          </span>
        </div>
      )}

      {/* Condensing state (boiler only) */}
      {state.systemKind === 'boiler' && (
        <div className="efficiency-metric">
          <span className="efficiency-metric__label">Condensing state</span>
          <span className={`efficiency-badge efficiency-badge--${condensingBadgeClass(state)}`}>
            {state.condensingState
              ? condensingStateBadgeText(state.condensingState)
              : 'Awaiting data'}
          </span>
        </div>
      )}

      {/* Headline status + explanatory description */}
      <div className="efficiency-metric" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <span className="efficiency-metric__label">Status</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: headlineColor(state.statusTone) }}>
          {state.headlineEfficiencyText}
        </span>
        {state.statusDescription && (
          <span style={{ fontSize: '0.72rem', color: '#718096' }}>
            {state.statusDescription}
          </span>
        )}
      </div>

      {/* Penalty summary */}
      <div className="efficiency-metric" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <span className="efficiency-metric__label">Penalties</span>
        {state.penalties.length === 0 ? (
          <span style={{ fontSize: '0.75rem', color: '#a0aec0' }}>None active</span>
        ) : (
          state.penalties.map((p, i) => (
            <span key={i} style={{ fontSize: '0.75rem', color: '#e53e3e' }}>
              ⚠ {p}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

function headlineColor(tone: EfficiencyDisplayState['statusTone']): string {
  switch (tone) {
    case 'good':    return '#276749'
    case 'warning': return '#744210'
    case 'poor':    return '#742a2a'
    case 'idle':    return '#a0aec0'
  }
}

