/**
 * DrawOffCard — single outlet status card for the Draw-Off Workbench.
 *
 * Shows cold supply, hot supply, and delivered temperature/flow for one
 * outlet archetype, plus a status chip and a one-line behavioural note.
 *
 * An optional `onFocus` callback renders a Focus button that opens the
 * full inspection view for this outlet.
 */

import type { DrawOffViewModel, DrawOffStatus } from './drawOffTypes'

// ─── Status chip ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<DrawOffStatus, string> = {
  inactive:     'Inactive',
  cold:         'Cold / inactive',
  stable:       'Stable',
  flow_limited: 'Flow-limited',
  temp_limited: 'Temp-limited',
  starved:      'Starved',
}

const STATUS_MOD: Record<DrawOffStatus, string> = {
  inactive:     'draw-off-card__chip--inactive',
  cold:         'draw-off-card__chip--cold',
  stable:       'draw-off-card__chip--stable',
  flow_limited: 'draw-off-card__chip--flow-limited',
  temp_limited: 'draw-off-card__chip--temp-limited',
  starved:      'draw-off-card__chip--starved',
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

  const isInactive = status === 'inactive' || status === 'cold'

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
        <div className="draw-off-card__row draw-off-card__row--cold">
          <dt className="draw-off-card__row-label">Cold in</dt>
          <dd className="draw-off-card__row-value">
            {coldSupplyTempC}°C
            <span className="draw-off-card__row-flow">· {coldSupplyFlowLpm} L/min</span>
          </dd>
        </div>
        <div className="draw-off-card__row draw-off-card__row--hot">
          <dt className="draw-off-card__row-label">Hot in</dt>
          <dd className="draw-off-card__row-value">
            {isInactive ? <span className="draw-off-card__row-na">No draw</span> : `${hotSupplyTempC}°C`}
            {!isInactive && (
              <span className="draw-off-card__row-flow">· {hotSupplyAvailableFlowLpm} L/min avail.</span>
            )}
          </dd>
        </div>
        <div className="draw-off-card__row draw-off-card__row--delivered">
          <dt className="draw-off-card__row-label">Delivered</dt>
          <dd className="draw-off-card__row-value">
            {isInactive
              ? <span className="draw-off-card__row-na">{status === 'cold' ? 'Cold / inactive' : 'Inactive'}</span>
              : `${deliveredTempC}°C`}
            {!isInactive && (
              <span className="draw-off-card__row-flow">· {deliveredFlowLpm} L/min</span>
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
