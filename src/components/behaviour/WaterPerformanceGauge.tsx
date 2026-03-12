/**
 * WaterPerformanceGauge
 *
 * Compact horizontal linear gauge for a measured flow rate or dynamic pressure
 * value.  Renders as a test-instrument reading:
 *
 *   Flow
 *   [███████████──────] 12.4 L/min
 *            ↑ threshold ticks below
 *
 * Design rules:
 *   - thin, technical, horizontal
 *   - restrained colour — tone drives fill tint only
 *   - threshold marker ticks with short labels
 *   - monospace numeric readout
 *   - compact enough for tablet layout
 */

import type { WaterMarker, WaterTone } from './waterPerformance.model'

export type WaterPerformanceGaugeProps = {
  /** Gauge title (e.g. "Flow", "Dynamic pressure"). */
  label: string
  /** Measured value.  null = no reading available. */
  value: number | null
  /** Gauge scale minimum. */
  min: number
  /** Gauge scale maximum. */
  max: number
  /** Display unit string (e.g. "L/min", "bar"). */
  unit: string
  /** Optional threshold marker ticks. */
  markers?: WaterMarker[]
  /** Fill colour band.  Defaults to 'default' (neutral). */
  tone?: WaterTone
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FILL_TONE_CLASS: Record<WaterTone, string> = {
  default: '',
  warning: ' water-gauge__fill--warning',
  danger:  ' water-gauge__fill--danger',
  success: ' water-gauge__fill--success',
}

const MARKER_TONE_CLASS: Record<WaterTone, string> = {
  default: '',
  warning: ' water-gauge__marker--warning',
  danger:  ' water-gauge__marker--danger',
  success: ' water-gauge__marker--success',
}

/** Converts a value to a percentage position on the gauge track (0–100). */
function pct(value: number, min: number, max: number): number {
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WaterPerformanceGauge({
  label,
  value,
  min,
  max,
  unit,
  markers = [],
  tone = 'default',
}: WaterPerformanceGaugeProps) {
  const fillPct      = value !== null ? pct(value, min, max) : 0
  const displayValue = value !== null ? value.toFixed(1) : '—'
  const testId       = `water-gauge-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div className="water-gauge" data-testid={testId}>

      {/* ── Header: label left, reading right ────────────────────────────── */}
      <div className="water-gauge__header">
        <span className="water-gauge__label">{label}</span>
        <span className="water-gauge__value">
          {displayValue}
          {value !== null && (
            <span className="water-gauge__unit"> {unit}</span>
          )}
        </span>
      </div>

      {/* ── Track with fill and threshold markers ─────────────────────────── */}
      <div
        className="water-gauge__track"
        role="progressbar"
        aria-valuenow={value ?? undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={label}
      >
        {/* Fill bar */}
        <div
          className={`water-gauge__fill${FILL_TONE_CLASS[tone]}`}
          style={{ width: `${fillPct}%` }}
        />

        {/* Threshold marker ticks */}
        {markers.map(m => (
          <div
            key={m.value}
            className={`water-gauge__marker${m.tone ? MARKER_TONE_CLASS[m.tone] : ''}`}
            style={{ left: `${pct(m.value, min, max)}%` }}
            title={m.label}
            aria-label={m.label}
          />
        ))}
      </div>

      {/* ── Tick labels below track ─────────────────────────────────────────── */}
      {markers.length > 0 && (
        <div className="water-gauge__ticks">
          {markers.map(m => (
            <div
              key={m.value}
              className="water-gauge__tick-label"
              style={{ left: `${pct(m.value, min, max)}%` }}
            >
              {m.label}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
