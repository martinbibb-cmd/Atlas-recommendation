/**
 * performance.ts
 *
 * Type definitions for the Performance Enablers feature.
 *
 * Performance enablers describe the conditions that must be true for a
 * recommended heating system to operate at its rated efficiency.  They are
 * derived from existing survey / engine-result data — no new engine
 * calculations are introduced.
 *
 * Status language used in UI copy:
 *   ok      → "OK"
 *   warning → "Needs attention"
 *   missing → "Not confirmed"
 */

/** Three-state classification for a performance enabler. */
export type PerformanceEnablerStatus = 'ok' | 'warning' | 'missing';

/** Thematic grouping for panel filtering / future sectioning. */
export type PerformanceEnablerCategory =
  | 'hydraulic'
  | 'combustion'
  | 'emitters'
  | 'controls'
  | 'system_health'
  | 'dhw';

/** A single performance enabler record. */
export interface PerformanceEnabler {
  /** Unique machine-readable identifier (e.g. 'gas_supply'). */
  id: string;
  /** Short human-readable label shown as the row heading. */
  label: string;
  /** Status derived from available survey / engine data. */
  status: PerformanceEnablerStatus;
  /** One-line detail text explaining the status. */
  detail: string;
  /** Thematic category — optional; used for future grouping / filtering. */
  category?: PerformanceEnablerCategory;
}
