/**
 * ComparisonSummaryStrip — side-by-side physics delta between current and
 * improved simulator configurations.
 *
 * Shows key before/after metrics:
 *   - Required flow temperature
 *   - Estimated return temperature
 *   - Condensing state / COP
 *   - Active limiter count
 *
 * Architecture:
 *   SimulatorDashboard (compare mode)
 *     → ComparisonSummaryStrip({ current, improved })
 *
 * The strip is purely presentational: all values are pre-computed by the
 * emitter model, efficiency playback, and limiter hooks.
 *
 * No cost or savings logic — behaviour differences only.
 */

import type { EfficiencyDisplayState } from '../useEfficiencyPlayback'
import type { EmitterPrimaryDisplayState } from '../useEmitterPrimaryModel'
import type { LimiterDisplayState } from '../useLimiterPlayback'
import { condensingStateBadgeText } from '../../sim/condensingState'

interface ComparisonSide {
  emitter: EmitterPrimaryDisplayState
  efficiency: EfficiencyDisplayState
  limiters: LimiterDisplayState
}

interface ComparisonSummaryStripProps {
  current: ComparisonSide
  improved: ComparisonSide
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Direction = 'better' | 'worse' | 'same'

/**
 * Returns a short human-readable label for the condensing state or COP of an
 * efficiency display state. Used in the comparison summary strip.
 */
function getCondensingSummary(efficiency: EfficiencyDisplayState): string {
  if (efficiency.systemKind === 'heat_pump') {
    return `COP ${(efficiency.cop ?? 0).toFixed(1)}`
  }
  return efficiency.condensingState
    ? condensingStateBadgeText(efficiency.condensingState)
    : 'Unknown'
}

function compareNumbers(
  current: number,
  improved: number,
  lowerIsBetter: boolean,
): Direction {
  const delta = improved - current
  if (Math.abs(delta) < 0.5) return 'same'
  if (lowerIsBetter) return delta < 0 ? 'better' : 'worse'
  return delta > 0 ? 'better' : 'worse'
}

function directionIcon(d: Direction): string {
  return d === 'better' ? '↓' : d === 'worse' ? '↑' : '→'
}

function directionClass(d: Direction): string {
  return d === 'better'
    ? 'cmp-delta--better'
    : d === 'worse'
    ? 'cmp-delta--worse'
    : 'cmp-delta--same'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MetricRowProps {
  label: string
  currentVal: string
  improvedVal: string
  direction: Direction
}

function MetricRow({ label, currentVal, improvedVal, direction }: MetricRowProps) {
  return (
    <div className="cmp-metric">
      <span className="cmp-metric__label">{label}</span>
      <div className="cmp-metric__values">
        <span className="cmp-metric__current">{currentVal}</span>
        <span className={`cmp-delta ${directionClass(direction)}`} aria-label={`change: ${direction}`}>
          {directionIcon(direction)}
        </span>
        <span className={`cmp-metric__improved cmp-metric__improved--${direction}`}>{improvedVal}</span>
      </div>
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

export default function ComparisonSummaryStrip({
  current,
  improved,
}: ComparisonSummaryStripProps) {
  const flowDir   = compareNumbers(current.emitter.requiredFlowTempC,  improved.emitter.requiredFlowTempC,  true)
  const returnDir = compareNumbers(current.emitter.estimatedReturnTempC, improved.emitter.estimatedReturnTempC, true)
  const limiterDir = compareNumbers(
    current.limiters.activeLimiters.length,
    improved.limiters.activeLimiters.length,
    true,
  )

  // Condensing / COP comparison — text-based, no numeric delta
  const currentCondensing  = getCondensingSummary(current.efficiency)
  const improvedCondensing = getCondensingSummary(improved.efficiency)

  const condensingDir: Direction =
    current.efficiency.condensingState === improved.efficiency.condensingState
      ? 'same'
      : improved.efficiency.condensingState === 'condensing'
      ? 'better'
      : improved.efficiency.condensingState === 'borderline' && current.efficiency.condensingState === 'not_condensing'
      ? 'better'
      : 'worse'

  return (
    <div className="cmp-summary-strip" data-testid="comparison-summary-strip" role="region" aria-label="Comparison summary">
      <div className="cmp-summary-strip__heading">
        <span className="cmp-summary-strip__icon" aria-hidden="true">⚡</span>
        <span>Current vs Improved</span>
      </div>
      <div className="cmp-summary-strip__metrics">
        <MetricRow
          label="Flow temp required"
          currentVal={`${Math.round(current.emitter.requiredFlowTempC)}°C`}
          improvedVal={`${Math.round(improved.emitter.requiredFlowTempC)}°C`}
          direction={flowDir}
        />
        <MetricRow
          label="Estimated return temp"
          currentVal={`${Math.round(current.emitter.estimatedReturnTempC)}°C`}
          improvedVal={`${Math.round(improved.emitter.estimatedReturnTempC)}°C`}
          direction={returnDir}
        />
        <MetricRow
          label="Condensing / COP"
          currentVal={currentCondensing}
          improvedVal={improvedCondensing}
          direction={condensingDir}
        />
        <MetricRow
          label="Active limiters"
          currentVal={String(current.limiters.activeLimiters.length)}
          improvedVal={String(improved.limiters.activeLimiters.length)}
          direction={limiterDir}
        />
      </div>
    </div>
  )
}
