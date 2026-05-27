/**
 * DailyEfficiencySummaryPanel — one daily summary number and one explanation line.
 *
 * Shows:
 *   - "Estimated daily operating efficiency: 88%" (boilers)
 *   - "Estimated daily COP: 3.7" (heat pumps)
 *   - One short explanation line
 *
 * Architecture:
 *   SimulatorDashboard
 *     → computeDailyEfficiencySummary(systemInputs, systemChoice, emitterState)
 *     → DailyEfficiencySummaryState
 *     → DailyEfficiencySummaryPanel({ state })
 *
 * The panel is purely presentational: it never re-derives physics truth.
 * computeDailyEfficiencySummary is the single mapping layer.
 */

import type { DailyEfficiencySummaryState } from '../useDailyEfficiencySummary'

interface DailyEfficiencySummaryPanelProps {
  state: DailyEfficiencySummaryState
}

function summaryToneClass(state: DailyEfficiencySummaryState): string {
  if (state.systemKind === 'heat_pump') {
    const cop = state.dailyCop ?? 0
    if (cop >= 3.5) return 'good'
    if (cop >= 2.8) return 'warning'
    return 'poor'
  }
  const eff = state.dailyEfficiencyPct ?? 0
  if (eff >= 88) return 'good'
  if (eff >= 80) return 'warning'
  return 'poor'
}

export default function DailyEfficiencySummaryPanel({
  state,
}: DailyEfficiencySummaryPanelProps) {
  const toneClass = summaryToneClass(state)

  return (
    <div
      className={`daily-summary daily-summary--${toneClass}`}
      role="region"
      aria-label="Daily efficiency summary"
      data-testid="daily-efficiency-summary"
    >
      <div className="daily-summary__main">
        <span className="daily-summary__label">{state.summaryLabel}</span>
        <span className={`daily-summary__value daily-summary__value--${toneClass}`}>
          {state.summaryValue}
        </span>
        {state.seasonContext && (
          <span className="daily-summary__season-badge" aria-label={`Scenario: ${state.seasonContext}`}>
            {state.seasonContext}
          </span>
        )}
      </div>
      <p className="daily-summary__explanation">{state.explanationLine}</p>
    </div>
  )
}
