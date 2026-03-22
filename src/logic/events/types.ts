/**
 * types.ts
 *
 * Core type definitions for the deterministic Typical Day Event Generator.
 *
 * These types describe the event stream that the simulator will later run
 * against to classify outcomes (PR 3).
 */

import type { HouseholdComposition } from '../../engine/schema/EngineInputV2_3';
import type { DemandPresetId } from '../../engine/schema/OccupancyPreset';
import type {
  DaytimeOccupancyPattern,
  BathUsePattern,
} from '../../lib/occupancy/deriveProfileFromHouseholdComposition';

// ─── Event type catalogue ─────────────────────────────────────────────────────

/**
 * The class of demand event occurring in a typical day schedule.
 *
 *   shower           — sustained hot-water draw from shower outlet
 *   bath             — large stored-volume draw to fill or top up a bath
 *   kitchen_draw     — washing-up or moderate hot tap use at the kitchen
 *   tap_draw         — brief low-volume hand-wash or point-of-use hot tap use
 *   heating_recovery — boiler fires to recover space-heating temperature
 *   heating_active   — sustained space-heating period (target temp maintained)
 *   heating_setback  — space-heating turned off or set to frost protection
 */
export type DayEventType =
  | 'shower'
  | 'bath'
  | 'kitchen_draw'
  | 'tap_draw'
  | 'heating_recovery'
  | 'heating_active'
  | 'heating_setback';

/**
 * Relative demand intensity of a single event.
 * Used by PR 3 to modulate penalty scores and conflict weighting.
 */
export type DayEventIntensity = 'low' | 'medium' | 'high';

// ─── Core event ───────────────────────────────────────────────────────────────

/**
 * A single demand event within a 24-hour typical day schedule.
 *
 * startMinute is measured from midnight (0 = 00:00, 60 = 01:00, 720 = 12:00).
 * canConflict flags events that, if overlapping with another canConflict event,
 * will create a simultaneous-demand condition (important for combi sizing).
 */
export interface DayEvent {
  /** Stable identifier unique within the schedule (e.g. "shower_0", "bath_0"). */
  id: string;
  type: DayEventType;
  /** Minutes from midnight at which this event begins. */
  startMinute: number;
  durationMinutes: number;
  intensity: DayEventIntensity;

  // ── Classifier flags (consumed by PR 3 outcome engine) ──────────────────────
  /** True when the event draws domestic hot water from the system. */
  hotWaterDraw: boolean;
  /** True when the event relates to space-heating demand. */
  heatingRelated: boolean;
  /**
   * True when this event, if concurrent with another canConflict event, will
   * expose simultaneous-demand weaknesses (e.g. a combi mid-shower).
   */
  canConflict: boolean;

  /** Freeform tags for grouping, filtering, and future feature flags. */
  tags: string[];
}

// ─── Schedule output ──────────────────────────────────────────────────────────

/**
 * Summary counts for quick display and debugging.
 * Mirrors what the UI "Typical day for your home" summary block shows.
 */
export interface TypicalDayScheduleSummary {
  showerCount: number;
  bathCount: number;
  kitchenDrawCount: number;
  shortTapDrawCount: number;
  heatingWindows: number;
}

/**
 * A complete deterministic 24-hour schedule derived from a household profile.
 *
 * events is sorted ascending by startMinute.
 * derivedPresetId and derivationReason are carried through from the PR 1
 * derivation layer so callers do not need to re-derive the preset.
 */
export interface TypicalDaySchedule {
  /** The DemandPresetId that was used to shape event timing and density. */
  derivedPresetId: DemandPresetId;
  /** Human-readable explanation of why this preset was selected (from PR 1). */
  derivationReason: string;
  /** Total occupant count driving the schedule. */
  occupancyCount: number;
  /** All events sorted ascending by startMinute. */
  events: DayEvent[];
  /** High-level summary counts for display and debugging. */
  summary: TypicalDayScheduleSummary;
}

// ─── Generator inputs ─────────────────────────────────────────────────────────

/**
 * Complete input contract for generateTypicalDaySchedule.
 *
 * Typically assembled from:
 *   - the HouseholdProfileDerivation returned by deriveProfileFromHouseholdComposition
 *   - the raw survey answers (householdComposition, daytimeOccupancy, bathUse)
 */
export interface GenerateTypicalDayScheduleInputs {
  /** Preset id from the PR 1 derivation layer. */
  derivedPresetId: DemandPresetId;
  /** Explanation string from the PR 1 derivation layer. */
  derivationReason: string;
  /** Full age-band headcounts from the survey lifestyle card. */
  householdComposition: HouseholdComposition;
  /** Weekday daytime occupancy pattern. */
  daytimeOccupancy: DaytimeOccupancyPattern;
  /** Bath use frequency band. */
  bathUse: BathUsePattern;
}
