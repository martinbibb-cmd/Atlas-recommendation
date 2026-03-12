/**
 * DrawOffFocusPanel — instrument-view content for a focused draw-off tile.
 *
 * Rendered inside the Focus overlay when a draw-off card is tapped.
 * Shows an expanded inspection layout: cold/hot/delivered metrics, status
 * chip, limiting factor, and — for combi regimes — boiler firing state.
 *
 * Boiler state labels are precise and physics-derived:
 *   Firing         — flow sustained above ignition threshold.
 *   Marginal        — flow near minimum sustained operation; burner may be
 *                     intermittent.
 *   Fails to fire  — flow below minimum ignition threshold.
 */

import type { DrawOffViewModel, DrawOffStatus, BoilerState } from './drawOffTypes'

// ─── Status chip helpers ──────────────────────────────────────────────────────

const STATUS_LABELS: Record<DrawOffStatus, string> = {
  stable:       'Stable',
  flow_limited: 'Flow-limited',
  temp_limited: 'Temp-limited',
  starved:      'Starved',
}

const STATUS_MOD: Record<DrawOffStatus, string> = {
  stable:       'draw-off-card__chip--stable',
  flow_limited: 'draw-off-card__chip--flow-limited',
  temp_limited: 'draw-off-card__chip--temp-limited',
  starved:      'draw-off-card__chip--starved',
}

// ─── Boiler state helpers ─────────────────────────────────────────────────────

const BOILER_STATE_LABELS: Record<BoilerState, string> = {
  firing:        'Firing',
  marginal:      'Marginal',
  fails_to_fire: 'Fails to fire',
}

const BOILER_STATE_MOD: Record<BoilerState, string> = {
  firing:        'focus-boiler-state__chip--firing',
  marginal:      'focus-boiler-state__chip--marginal',
  fails_to_fire: 'focus-boiler-state__chip--fails',
}

const BOILER_STATE_REASON: Record<BoilerState, string> = {
  firing:        'Flow sustained above ignition threshold. Burner stable.',
  marginal:      'Flow near minimum sustained operation threshold. Burner operation may be intermittent or unstable.',
  fails_to_fire: 'Flow below minimum ignition threshold. Insufficient DHW flow to sustain burner.',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  data: DrawOffViewModel
}

export default function DrawOffFocusPanel({ data }: Props) {
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
    limitingFactor,
    boilerState,
  } = data

  return (
    <div
      className="draw-off-focus"
      data-testid={`draw-off-focus-${data.id}`}
      aria-label={`${label} — Focus`}
    >
      {/* ── Title bar ──────────────────────────────────────────────────────── */}
      <div className="draw-off-focus__title-bar">
        <span className="draw-off-focus__icon" aria-hidden="true">{icon}</span>
        <span className="draw-off-focus__title">{label.toUpperCase()}</span>
        <span
          className={`draw-off-card__chip ${STATUS_MOD[status]}`}
          aria-label={`Status: ${STATUS_LABELS[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/* ── Metric rows ────────────────────────────────────────────────────── */}
      <dl className="draw-off-focus__rows">
        <div className="draw-off-focus__row draw-off-focus__row--cold">
          <dt className="draw-off-focus__row-label">Cold supply</dt>
          <dd className="draw-off-focus__row-value">
            <span className="draw-off-focus__temp">{coldSupplyTempC}°C</span>
            <span className="draw-off-focus__flow">· {coldSupplyFlowLpm} L/min</span>
          </dd>
        </div>
        <div className="draw-off-focus__row draw-off-focus__row--hot">
          <dt className="draw-off-focus__row-label">Hot supply</dt>
          <dd className="draw-off-focus__row-value">
            <span className="draw-off-focus__temp">{hotSupplyTempC}°C</span>
            <span className="draw-off-focus__flow">· {hotSupplyAvailableFlowLpm} L/min avail.</span>
          </dd>
        </div>
        <div className="draw-off-focus__row draw-off-focus__row--delivered">
          <dt className="draw-off-focus__row-label">Delivered</dt>
          <dd className="draw-off-focus__row-value">
            <span className="draw-off-focus__temp draw-off-focus__temp--large">{deliveredTempC}°C</span>
            <span className="draw-off-focus__flow draw-off-focus__flow--large">· {deliveredFlowLpm} L/min</span>
          </dd>
        </div>
      </dl>

      {/* ── Limiting factor ────────────────────────────────────────────────── */}
      {limitingFactor !== undefined && (
        <div className="draw-off-focus__limiting">
          <span className="draw-off-focus__limiting-label">Limiting factor</span>
          <span className="draw-off-focus__limiting-value">{limitingFactor}</span>
        </div>
      )}

      {/* ── Boiler state (combi only) ───────────────────────────────────────── */}
      {boilerState !== undefined && (
        <div className="draw-off-focus__boiler-state focus-boiler-state" data-testid="focus-boiler-state">
          <div className="focus-boiler-state__header">
            <span className="focus-boiler-state__label">Boiler state</span>
            <span
              className={`focus-boiler-state__chip ${BOILER_STATE_MOD[boilerState]}`}
              aria-label={`Boiler state: ${BOILER_STATE_LABELS[boilerState]}`}
              data-testid="boiler-state-chip"
            >
              {BOILER_STATE_LABELS[boilerState]}
            </span>
          </div>
          <p className="focus-boiler-state__reason">{BOILER_STATE_REASON[boilerState]}</p>
        </div>
      )}
    </div>
  )
}
