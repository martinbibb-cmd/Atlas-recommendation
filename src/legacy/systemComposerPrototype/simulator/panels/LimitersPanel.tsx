/**
 * LimitersPanel — live physics constraints detected by the simulator.
 *
 * Architecture:
 *   SimulatorDashboard → useLimiterPlayback(diagramState) → LimiterDisplayState
 *   LimitersPanel({ state }) → render
 *
 * Shows up to 3 active limiters with severity colour coding.
 * When all constraints are satisfied the panel shows a clear status.
 */

import type { LimiterDisplayState, Limiter, LimiterSeverity } from '../useLimiterPlayback'

interface LimitersPanelProps {
  state: LimiterDisplayState
}

const SEVERITY_CONFIG: Record<LimiterSeverity, { cssClass: string; icon: string }> = {
  info:     { cssClass: 'limiter-card--info',     icon: 'ℹ' },
  warning:  { cssClass: 'limiter-card--warning',  icon: '⚠' },
  critical: { cssClass: 'limiter-card--critical', icon: '⛔' },
}

function LimiterCard({ limiter }: { limiter: Limiter }) {
  const { cssClass, icon } = SEVERITY_CONFIG[limiter.severity]
  return (
    <div className={`limiter-card ${cssClass}`}>
      <div className="limiter-card__header">
        <span className="limiter-card__icon" aria-hidden="true">{icon}</span>
        <span className="limiter-card__title">{limiter.title}</span>
      </div>
      <p className="limiter-card__explanation">{limiter.explanation}</p>
      {limiter.suggestedFix && (
        <p className="limiter-card__fix">→ {limiter.suggestedFix}</p>
      )}
    </div>
  )
}

export default function LimitersPanel({ state }: LimitersPanelProps) {
  if (state.activeLimiters.length === 0) {
    return (
      <div className="limiters-panel limiters-panel--clear">
        <span className="limiters-panel__clear-icon" aria-hidden="true">✓</span>
        <span className="limiters-panel__clear-text">No active limiters</span>
      </div>
    )
  }

  return (
    <div className="limiters-panel">
      {state.activeLimiters.map(limiter => (
        <LimiterCard key={limiter.id} limiter={limiter} />
      ))}
    </div>
  )
}
