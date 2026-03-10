/**
 * DayTimelinePanel — 24-hour timeline strip showing current simulated time,
 * sunrise, sunset, moonrise, and moonset.
 *
 * Architecture:
 *   SimulatorDashboard (simHour from useSystemDiagramPlayback)
 *     → computeDayTimeline(simHour) → DayTimelineState
 *     → DayTimelinePanel({ state })
 *
 * The strip is purely presentational: all values are pre-computed by
 * computeDayTimeline().  No Math.random(), no live astronomy calculations.
 *
 * Layout:
 *   - Horizontal bar: 00:00 → 24:00
 *   - Night/day gradient background (dark at night, light blue during day)
 *   - Absolute-positioned markers for sunrise, sunset, moonrise, moonset
 *   - Vertical needle at the current simulated hour
 *   - Hour labels at 0, 6, 12, 18, 24
 */

import type { DayTimelineState } from '../useDayTimeline'

interface DayTimelinePanelProps {
  state: DayTimelineState
}

/** Convert an hour (0–23) to a percentage position along the bar (0–100). */
function hourToPercent(hour: number): number {
  return (hour / 24) * 100
}

export default function DayTimelinePanel({ state }: DayTimelinePanelProps) {
  const {
    simHour,
    simTimeLabel,
    isDaytime,
    sunriseHour,
    sunsetHour,
    moonriseHour,
    moonsetHour,
  } = state

  const needlePct = hourToPercent(simHour)
  const sunrisePct = hourToPercent(sunriseHour)
  const sunsetPct = hourToPercent(sunsetHour)
  const moonrisePct = hourToPercent(moonriseHour)
  const moonsetPct = hourToPercent(moonsetHour)

  return (
    <div
      className="day-timeline"
      role="region"
      aria-label="24-hour day timeline"
      data-testid="day-timeline"
    >
      {/* Sim time label + day/night indicator */}
      <div className="day-timeline__header">
        <span className="day-timeline__time" aria-label={`Simulated time: ${simTimeLabel}`}>
          {isDaytime ? '☀' : '🌙'} {simTimeLabel}
        </span>
        <span className="day-timeline__markers-hint" aria-hidden="true">
          ☀ {String(sunriseHour).padStart(2, '0')}:00 &nbsp;
          ☀ {String(sunsetHour).padStart(2, '0')}:00 &nbsp;
          🌙 {String(moonriseHour).padStart(2, '0')}:00 &nbsp;
          🌙 {String(moonsetHour).padStart(2, '0')}:00
        </span>
      </div>

      {/* Timeline bar */}
      <div className="day-timeline__bar-wrap" role="presentation">
        <div className="day-timeline__bar">
          {/* Daytime highlight band */}
          <div
            className="day-timeline__dayband"
            style={{
              left: `${sunrisePct}%`,
              width: `${sunsetPct - sunrisePct}%`,
            }}
            aria-hidden="true"
          />

          {/* Sunrise marker */}
          <div
            className="day-timeline__marker day-timeline__marker--sunrise"
            style={{ left: `${sunrisePct}%` }}
            title={`Sunrise ${String(sunriseHour).padStart(2, '0')}:00`}
            aria-label={`Sunrise at ${String(sunriseHour).padStart(2, '0')}:00`}
          >
            <span aria-hidden="true">☀</span>
          </div>

          {/* Sunset marker */}
          <div
            className="day-timeline__marker day-timeline__marker--sunset"
            style={{ left: `${sunsetPct}%` }}
            title={`Sunset ${String(sunsetHour).padStart(2, '0')}:00`}
            aria-label={`Sunset at ${String(sunsetHour).padStart(2, '0')}:00`}
          >
            <span aria-hidden="true">☀</span>
          </div>

          {/* Moonrise marker */}
          <div
            className="day-timeline__marker day-timeline__marker--moonrise"
            style={{ left: `${moonrisePct}%` }}
            title={`Moonrise ${String(moonriseHour).padStart(2, '0')}:00`}
            aria-label={`Moonrise at ${String(moonriseHour).padStart(2, '0')}:00`}
          >
            <span aria-hidden="true">🌙</span>
          </div>

          {/* Moonset marker */}
          <div
            className="day-timeline__marker day-timeline__marker--moonset"
            style={{ left: `${moonsetPct}%` }}
            title={`Moonset ${String(moonsetHour).padStart(2, '0')}:00`}
            aria-label={`Moonset at ${String(moonsetHour).padStart(2, '0')}:00`}
          >
            <span aria-hidden="true">🌙</span>
          </div>

          {/* Current time needle */}
          <div
            className="day-timeline__needle"
            style={{ left: `${needlePct}%` }}
            aria-hidden="true"
          />
        </div>

        {/* Hour labels */}
        <div className="day-timeline__labels" aria-hidden="true">
          {[0, 6, 12, 18, 24].map(h => (
            <span
              key={h}
              className="day-timeline__label"
              style={{ left: `${hourToPercent(h === 24 ? 23.9 : h)}%` }}
            >
              {h === 0 ? '00:00' : h === 24 ? '24:00' : `${String(h).padStart(2, '0')}:00`}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
