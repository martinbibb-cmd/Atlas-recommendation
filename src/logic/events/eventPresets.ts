/**
 * eventPresets.ts
 *
 * Named timing constants and per-event-type preset configurations for the
 * deterministic Typical Day Event Generator.
 *
 * All values here are named and intentional — no ghost maths.
 * Changing a number here changes it everywhere; there are no magic literals
 * buried in the generator.
 */

import type { DayEventIntensity } from './types';

// ─── Hot-water draw durations (minutes) ──────────────────────────────────────

export const SHOWER_DURATION_ADULT_MIN        = 8;
export const SHOWER_DURATION_CHILD_5TO10_MIN  = 5;
export const SHOWER_DURATION_TEENAGER_MIN     = 12;
export const SHOWER_DURATION_YOUNG_ADULT_MIN  = 10;

export const BATH_DURATION_MIN                = 20;

export const KITCHEN_DRAW_DURATION_MIN        = 4;
export const TAP_DRAW_DURATION_MIN            = 1;

// ─── Heating window durations (minutes) ──────────────────────────────────────

/** Short morning warm-up before occupants leave. */
export const HEATING_MORNING_RECOVERY_DURATION_MIN = 60;

/** Sustained heating block for households who are home all day. */
export const HEATING_DAYTIME_ACTIVE_DURATION_MIN   = 480; // 8 h

/** Daytime setback window for households who are out. */
export const HEATING_DAYTIME_SETBACK_DURATION_MIN  = 480; // 8 h

/** Evening recovery / comfort period. */
export const HEATING_EVENING_RECOVERY_DURATION_MIN = 180; // 3 h

// ─── Standard timing anchors (minutes from midnight) ─────────────────────────

/** 06:00 — early morning start for working households. */
export const MORNING_EARLY_MIN   = 360;
/** 07:00 — standard morning start. */
export const MORNING_STANDARD_MIN = 420;
/** 07:30 — slightly later morning start. */
export const MORNING_LATE_MIN    = 450;
/** 08:00 — late morning (home workers, shift workers with late start). */
export const MORNING_OFFSET_MIN  = 480;

/** 10:00 — mid-morning (shift workers, irregular schedules). */
export const MIDMORNING_MIN      = 600;

/** 12:30 — midday kitchen draw cluster. */
export const MIDDAY_MIN          = 750;

/** 17:00 — early evening start for working couple. */
export const EVENING_EARLY_MIN   = 1020;
/** 18:00 — standard evening peak. */
export const EVENING_STANDARD_MIN = 1080;
/** 19:00 — later evening peak. */
export const EVENING_LATE_MIN    = 1140;
/** 20:00 — extended evening peak (bath, teenagers). */
export const EVENING_EXTENDED_MIN = 1200;
/** 21:00 — bath cluster anchor (toddler bedtime and bath-heavy households). */
export const BATH_CLUSTER_MIN    = 1260;
/** 22:00 — irregular / shift-worker late peak. */
export const LATE_PEAK_MIN       = 1320;

// ─── Morning shower offsets within a cluster (minutes) ───────────────────────

/**
 * When multiple occupants shower in the morning, each subsequent shower is
 * staggered by this many minutes to model realistic sequential use.
 */
export const SHOWER_STAGGER_MIN = 15;

// ─── Kitchen / tap draw cluster definitions ───────────────────────────────────

/**
 * Minute-from-midnight offsets within a morning kitchen cluster.
 * First draw is at the anchor; subsequent draws are at these offsets.
 */
export const MORNING_KITCHEN_CLUSTER_OFFSETS_MIN = [0, 5, 20];
export const MORNING_TAP_CLUSTER_OFFSETS_MIN      = [2, 12, 35, 50];

/** Midday cluster (present only when someone is usually home). */
export const MIDDAY_KITCHEN_CLUSTER_OFFSETS_MIN  = [0, 15];
export const MIDDAY_TAP_CLUSTER_OFFSETS_MIN       = [5, 25];

export const EVENING_KITCHEN_CLUSTER_OFFSETS_MIN = [0, 10, 30];
export const EVENING_TAP_CLUSTER_OFFSETS_MIN      = [3, 20, 45, 60];

// ─── Intensity rules ─────────────────────────────────────────────────────────

/** Intensity assigned to adult showers. */
export const SHOWER_INTENSITY_ADULT: DayEventIntensity     = 'high';
/** Intensity for teenager showers (high flow, long duration). */
export const SHOWER_INTENSITY_TEENAGER: DayEventIntensity  = 'high';
/** Intensity for child 5–10 showers (shorter, lower flow). */
export const SHOWER_INTENSITY_CHILD: DayEventIntensity     = 'medium';
/** Intensity for young adult showers. */
export const SHOWER_INTENSITY_YOUNG_ADULT: DayEventIntensity = 'high';

export const BATH_INTENSITY: DayEventIntensity             = 'high';
export const KITCHEN_DRAW_INTENSITY: DayEventIntensity     = 'medium';
export const TAP_DRAW_INTENSITY: DayEventIntensity         = 'low';

export const HEATING_RECOVERY_INTENSITY: DayEventIntensity = 'high';
export const HEATING_ACTIVE_INTENSITY: DayEventIntensity   = 'medium';
export const HEATING_SETBACK_INTENSITY: DayEventIntensity  = 'low';

// ─── Extra draw counts from household size ────────────────────────────────────

/**
 * Number of additional kitchen draws added per additional occupant above 2,
 * spread across the day clusters.
 */
export const KITCHEN_DRAWS_PER_EXTRA_OCCUPANT = 1;

/**
 * Number of additional tap draws added per additional occupant above 2.
 */
export const TAP_DRAWS_PER_EXTRA_OCCUPANT = 2;

// ─── Stagger and offset constants ─────────────────────────────────────────────

/** Minutes between consecutive toddler bath events in the same evening cluster. */
export const TODDLER_BATH_STAGGER_MIN = 10;

/** Minutes between consecutive adult bath events. */
export const ADULT_BATH_STAGGER_MIN = 15;

/** Minutes between extra kitchen draw events for larger households. */
export const KITCHEN_EXTRA_STAGGER_MIN = 8;

/** Minutes between extra tap draw events for larger households. */
export const TAP_EXTRA_STAGGER_MIN = 10;

/**
 * Offset from MORNING_EARLY_MIN for the irregular-schedule morning recovery.
 * Gives a 06:30 start (MORNING_EARLY_MIN + 30).
 */
export const IRREGULAR_MORNING_OFFSET_MIN = 30;

/**
 * Offset from MIDMORNING_MIN (10:00) for the irregular-schedule midday
 * active heating window.  Gives an 11:30 start (MIDMORNING_MIN + 90).
 */
export const IRREGULAR_MIDDAY_HEATING_OFFSET_MIN = 90;

/** Duration of the partial daytime setback window for irregular schedules (4 h). */
export const HEATING_PARTIAL_SETBACK_DURATION_MIN = 240;

/** Duration of the mid-day active heating window for irregular schedules (2 h). */
export const HEATING_MIDDAY_ACTIVE_DURATION_MIN = 120;
