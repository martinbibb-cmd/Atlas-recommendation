// src/explainers/lego/simulator/useDayTimeline.ts
//
// Display adapter: derives DayTimelineState from the current simulated hour.
//
// Architecture:
//   SimulatorDashboard (simHour from useSystemDiagramPlayback)
//     → computeDayTimeline(simHour)
//     → DayTimelineState
//     → DayTimelinePanel({ state })
//
// Astronomy values are fixed UK winter reference constants (January, 51.5°N London).
// This keeps the output deterministic and explainable — no Math.random(), no
// live astronomical calculations.

// ─── Fixed UK winter astronomy (January 15, latitude 51.5°N) ─────────────────

/** Sunrise hour (integer, 24-hour clock). UK winter reference. */
export const SUNRISE_HOUR = 8

/** Sunset hour (integer, 24-hour clock). UK winter reference. */
export const SUNSET_HOUR = 16

/**
 * Moonrise hour (integer, 24-hour clock).
 * Approximate waxing gibbous moon position for UK winter reference.
 */
export const MOONRISE_HOUR = 22

/**
 * Moonset hour (integer, 24-hour clock).
 * Approximate waxing gibbous moon position for UK winter reference.
 */
export const MOONSET_HOUR = 10

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * All display-relevant state the DayTimelinePanel needs to render a live
 * 24-hour timeline strip.
 *
 * Values are entirely deterministic — derived from the simHour integer and the
 * fixed UK winter astronomy constants above.
 */
export type DayTimelineState = {
  /** Current simulated hour (0–23). */
  simHour: number
  /** Human-readable label for the current simulated time, e.g. "07:00". */
  simTimeLabel: string
  /** Whether the current sim time falls between sunrise and sunset. */
  isDaytime: boolean
  /** Sunrise hour (fixed constant). */
  sunriseHour: number
  /** Sunset hour (fixed constant). */
  sunsetHour: number
  /** Moonrise hour (fixed constant). */
  moonriseHour: number
  /** Moonset hour (fixed constant). */
  moonsetHour: number
}

// ─── Public function ──────────────────────────────────────────────────────────

/**
 * Compute DayTimelineState for the given simulated hour.
 *
 * Called as a pure function (no React state) so it can be unit-tested directly.
 *
 * @param simHour Integer 0–23 representing the simulated hour of day.
 */
export function computeDayTimeline(simHour: number): DayTimelineState {
  const hour = Math.max(0, Math.min(23, Math.round(simHour)))
  return {
    simHour: hour,
    simTimeLabel: `${String(hour).padStart(2, '0')}:00`,
    isDaytime: hour >= SUNRISE_HOUR && hour < SUNSET_HOUR,
    sunriseHour: SUNRISE_HOUR,
    sunsetHour: SUNSET_HOUR,
    moonriseHour: MOONRISE_HOUR,
    moonsetHour: MOONSET_HOUR,
  }
}
