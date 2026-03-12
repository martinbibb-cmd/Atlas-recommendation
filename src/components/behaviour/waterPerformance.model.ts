/**
 * waterPerformance.model.ts
 *
 * Presentation-only helpers for WaterPerformanceGauge.
 *
 * Responsibilities:
 *   - clamp values to gauge range
 *   - derive display band / tone from measured value
 *   - produce standard marker sets for flow and pressure gauges
 *   - generate short descriptive notes
 *
 * No new water physics. No engine coupling. Display mapping only.
 */

export type WaterTone = 'default' | 'warning' | 'danger' | 'success'

export interface WaterMarker {
  value: number
  label: string
  tone?: WaterTone
}

// ─── Clamping ─────────────────────────────────────────────────────────────────

/** Clamp a value within [min, max]. Returns null when input is null. */
export function clampValue(v: number | null, min: number, max: number): number | null {
  if (v === null) return null
  return Math.min(Math.max(v, min), max)
}

// ─── Tone derivation ──────────────────────────────────────────────────────────

/**
 * Returns tone for a domestic hot water flow rate (L/min).
 *
 *  < 6  L/min → danger  (below stored HW minimum threshold)
 *  < 10 L/min → warning (marginal for comfort)
 *  ≥ 10 L/min → success
 */
export function flowTone(flowLpm: number | null): WaterTone {
  if (flowLpm === null) return 'default'
  if (flowLpm < 6) return 'danger'
  if (flowLpm < 10) return 'warning'
  return 'success'
}

/**
 * Returns tone for dynamic (working) pressure (bar).
 *
 *  < 0.7 bar → danger  (below operating minimum)
 *  < 1.0 bar → warning (below stored HW feed threshold)
 *  ≥ 1.0 bar → success
 */
export function pressureTone(bar: number | null): WaterTone {
  if (bar === null) return 'default'
  if (bar < 0.7) return 'danger'
  if (bar < 1.0) return 'warning'
  return 'success'
}

// ─── Standard marker sets ─────────────────────────────────────────────────────

/** Standard threshold markers for a domestic flow rate gauge (0–25 L/min). */
export const FLOW_MARKERS: WaterMarker[] = [
  { value: 6,  label: 'Stored HW min',      tone: 'warning' },
  { value: 10, label: 'Combi comfort band', tone: 'success' },
]

/** Standard threshold markers for a dynamic pressure gauge (0–3 bar). */
export const PRESSURE_MARKERS: WaterMarker[] = [
  { value: 0.7, label: 'Operating minimum',   tone: 'danger'  },
  { value: 1.0, label: 'Stored HW threshold', tone: 'warning' },
]

// ─── Short notes ──────────────────────────────────────────────────────────────

/** One-line note describing the measured flow reading. */
export function flowNote(flowLpm: number | null): string {
  if (flowLpm === null) return '—'
  if (flowLpm < 6)  return 'Below stored hot water minimum threshold.'
  if (flowLpm < 10) return 'Marginal — adequate for low-demand outlets only.'
  if (flowLpm < 16) return 'Comfortable — suitable for simultaneous outlets.'
  return 'High flow — exceeds typical domestic demand.'
}

/** One-line note describing the measured dynamic pressure reading. */
export function pressureNote(bar: number | null): string {
  if (bar === null) return '—'
  if (bar < 0.7) return 'Below minimum operating pressure.'
  if (bar < 1.0) return 'Below stored hot water feed threshold.'
  return 'Adequate dynamic pressure for mains-fed supply.'
}
