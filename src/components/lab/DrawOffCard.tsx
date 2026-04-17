/**
 * DrawOffCard — single outlet status card for the Draw-Off Workbench.
 *
 * Shows cold supply, hot supply, and delivered temperature/flow for one
 * outlet archetype, plus a status chip and a one-line behavioural note.
 *
 * Each data row includes a weir-gauge visual — a compact horizontal bar
 * showing the current value relative to a reference scale, with a vertical
 * green line at the target-performance level.
 *
 * An optional `onFocus` callback renders a Focus button that opens the
 * full inspection view for this outlet.
 */

import type { DrawOffViewModel, DrawOffStatus } from './drawOffTypes'

// ─── Weir-gauge constants ─────────────────────────────────────────────────────

/** Comfortable delivered temperature target (°C). */
const TEMP_TARGET_C      = 41
/** Upper bound of the temperature gauge scale (°C). */
const TEMP_GAUGE_MAX_C   = 55
/** Reference maximum for all flow gauges — establishes a common L/min scale. */
const FLOW_GAUGE_MAX_LPM = 15
/**
 * Target cold supply flow for the Cold in gauge (L/min).
 *
 * Represents a typical unconstrained single-outlet mains feed.  When
 * concurrent demand splits the mains budget the fill bar drops below this
 * line, making the reduction immediately visible.
 */
const COLD_SUPPLY_TARGET_LPM = 12

// ─── Weir gauge sub-component ─────────────────────────────────────────────────

/**
 * WeirGauge — compact horizontal bar gauge with a target-performance line.
 *
 * Renders a filled bar proportional to `value / max`, with a vertical green
 * line at `target / max`.  All three props are on the same linear scale so
 * rows that share `FLOW_GAUGE_MAX_LPM` as their `max` are directly comparable.
 */
function WeirGauge({
  value,
  max,
  target,
  fillColor,
  label,
}: {
  value:     number
  max:       number
  target:    number
  fillColor: string
  label:     string
}) {
  const safMax    = max > 0 ? max : 1
  const fillPct   = Math.min(100, Math.max(0, (value  / safMax) * 100))
  const targetPct = Math.min(100, Math.max(0, (target / safMax) * 100))
  return (
    <div className="weir-gauge" role="img" aria-label={label}>
      <div className="weir-gauge__track">
        <div className="weir-gauge__fill" style={{ width: `${fillPct}%`, background: fillColor }} />
      </div>
      <div className="weir-gauge__target-line" style={{ left: `${targetPct}%` }} aria-hidden="true" />
    </div>
  )
}

// ─── Status chip ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<DrawOffStatus, string> = {
  inactive:                  'Inactive',
  cold:                      'Cold / inactive',
  stable:                    'Stable draw',
  flow_limited:              'Flow-limited',
  temp_limited:              'Temp-limited',
  starved:                   'Starved',
  below_ignition_threshold:  'Flow too low to fire',
}

const STATUS_MOD: Record<DrawOffStatus, string> = {
  inactive:                  'draw-off-card__chip--inactive',
  cold:                      'draw-off-card__chip--cold',
  stable:                    'draw-off-card__chip--stable',
  flow_limited:              'draw-off-card__chip--flow-limited',
  temp_limited:              'draw-off-card__chip--temp-limited',
  starved:                   'draw-off-card__chip--starved',
  below_ignition_threshold:  'draw-off-card__chip--below-ignition',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  data: DrawOffViewModel
  onFocus?: () => void
}

export default function DrawOffCard({ data, onFocus }: Props) {
  const {
    label,
    icon,
    status,
    coldSupplyTempC,
    coldSupplyFlowLpm,
    hotSupplyTempC,
    hotSupplyAvailableFlowLpm,
    deliveredTempC,
    deliveredFlowLpm,
    note,
  } = data

  const isInactive = status === 'inactive' || status === 'cold' || status === 'below_ignition_threshold'

  // ── Weir-gauge fill colours ──────────────────────────────────────────────
  // Delivered temperature: green at/above target, amber within 5 °C, red below.
  const deliveredTempFill =
    deliveredTempC >= TEMP_TARGET_C           ? '#48bb78'
    : deliveredTempC >= TEMP_TARGET_C - 5     ? '#ed8936'
    : '#e53e3e'

  // Delivered flow: reflects constraint status.
  const deliveredFlowFill =
    status === 'stable'
      ? '#48bb78'
      : (status === 'flow_limited' || status === 'temp_limited')
        ? '#ed8936'
        : '#e53e3e'

  return (
    <div
      className={`draw-off-card${isInactive ? ' draw-off-card--inactive' : ''}`}
      data-testid={`draw-off-card-${data.id}`}
      aria-label={`${label} draw-off card`}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="draw-off-card__header">
        <span className="draw-off-card__icon" aria-hidden="true">{icon}</span>
        <span className="draw-off-card__label">{label}</span>
        <span
          className={`draw-off-card__chip ${STATUS_MOD[status]}`}
          aria-label={`Status: ${STATUS_LABELS[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/* ── Supply rows ────────────────────────────────────────────────────── */}
      <dl className="draw-off-card__rows">

        {/* Cold in — flow gauge: current cold supply vs single-outlet reference */}
        <div className="draw-off-card__row draw-off-card__row--cold">
          <dt className="draw-off-card__row-label">Cold in</dt>
          <dd className="draw-off-card__row-value">
            {coldSupplyTempC}°C
            <span className="draw-off-card__row-flow">· {coldSupplyFlowLpm} L/min</span>
            <WeirGauge
              value={coldSupplyFlowLpm}
              max={FLOW_GAUGE_MAX_LPM}
              target={COLD_SUPPLY_TARGET_LPM}
              fillColor="#63b3ed"
              label={`Cold supply flow: ${coldSupplyFlowLpm} L/min`}
            />
          </dd>
        </div>

        {/* Hot in — flow gauge: hot available vs cold supply capacity */}
        <div className="draw-off-card__row draw-off-card__row--hot">
          <dt className="draw-off-card__row-label">Hot in</dt>
          <dd className="draw-off-card__row-value">
            {isInactive ? <span className="draw-off-card__row-na">No draw</span> : `${hotSupplyTempC}°C`}
            {!isInactive && (
              <span className="draw-off-card__row-flow">· {hotSupplyAvailableFlowLpm} L/min avail.</span>
            )}
            {!isInactive && (
              <WeirGauge
                value={hotSupplyAvailableFlowLpm}
                max={FLOW_GAUGE_MAX_LPM}
                target={coldSupplyFlowLpm}
                fillColor="#fc8181"
                label={`Hot supply flow: ${hotSupplyAvailableFlowLpm} L/min available, target ${coldSupplyFlowLpm} L/min`}
              />
            )}
          </dd>
        </div>

        {/* Delivered — temperature gauge (target 41 °C) + flow gauge */}
        <div className="draw-off-card__row draw-off-card__row--delivered">
          <dt className="draw-off-card__row-label">Delivered</dt>
          <dd className="draw-off-card__row-value">
            {isInactive
              ? <span className="draw-off-card__row-na">{STATUS_LABELS[status]}</span>
              : `${deliveredTempC}°C`}
            {!isInactive && (
              <span className="draw-off-card__row-flow">· {deliveredFlowLpm} L/min</span>
            )}
            {!isInactive && (
              <>
                <WeirGauge
                  value={deliveredTempC}
                  max={TEMP_GAUGE_MAX_C}
                  target={TEMP_TARGET_C}
                  fillColor={deliveredTempFill}
                  label={`Delivered temperature: ${deliveredTempC}°C, target ${TEMP_TARGET_C}°C`}
                />
                <WeirGauge
                  value={deliveredFlowLpm}
                  max={FLOW_GAUGE_MAX_LPM}
                  target={hotSupplyAvailableFlowLpm}
                  fillColor={deliveredFlowFill}
                  label={`Delivered flow: ${deliveredFlowLpm} L/min, target ${hotSupplyAvailableFlowLpm} L/min`}
                />
              </>
            )}
          </dd>
        </div>

      </dl>

      {/* ── Behavioural note ───────────────────────────────────────────────── */}
      <p className="draw-off-card__note">{note}</p>

      {/* ── Focus action ───────────────────────────────────────────────────── */}
      {onFocus && (
        <button
          className="draw-off-card__focus-btn"
          onClick={onFocus}
          aria-label={`Focus: ${label}`}
        >
          Focus
        </button>
      )}
    </div>
  )
}
