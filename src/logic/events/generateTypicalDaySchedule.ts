/**
 * generateTypicalDaySchedule.ts
 *
 * Deterministic Typical Day Event Generator.
 *
 * Turns a derived household profile (from PR 1) into a believable 24-hour
 * schedule of hot-water draw events and heating demand windows that the
 * simulator can later run against to classify outcomes (PR 3).
 *
 * Design rules:
 *   - For identical inputs the output is always identical (no randomness).
 *   - All timing and intensity values come from named constants in eventPresets.ts.
 *   - Heating windows and draw clusters are driven by daytimeOccupancy, not
 *     by a separate "schedule template" lookup, keeping the logic in one place.
 *   - Each event carries enough metadata (hotWaterDraw, heatingRelated,
 *     canConflict, tags) for PR 3 to classify outcomes without touching this layer.
 */

import type {
  DayEvent,
  DayEventIntensity,
  DayEventType,
  GenerateTypicalDayScheduleInputs,
  TypicalDaySchedule,
  TypicalDayScheduleSummary,
} from './types';
import type { HouseholdComposition } from '../../engine/schema/EngineInputV2_3';
import type { DaytimeOccupancyPattern, BathUsePattern } from '../../lib/occupancy/deriveProfileFromHouseholdComposition';

import * as P from './eventPresets';

// ─── Internal builder helpers ─────────────────────────────────────────────────

/** Running counter used to assign stable unique IDs within a schedule build. */
let _idCounter = 0;

function nextId(type: DayEventType): string {
  return `${type}_${_idCounter++}`;
}

function makeHotWaterEvent(
  type: 'shower' | 'bath' | 'kitchen_draw' | 'tap_draw',
  startMinute: number,
  durationMinutes: number,
  intensity: DayEventIntensity,
  tags: string[],
): DayEvent {
  return {
    id: nextId(type),
    type,
    startMinute,
    durationMinutes,
    intensity,
    hotWaterDraw: true,
    heatingRelated: false,
    canConflict: type === 'shower' || type === 'bath',
    tags,
  };
}

function makeHeatingEvent(
  type: 'heating_recovery' | 'heating_active' | 'heating_setback',
  startMinute: number,
  durationMinutes: number,
  intensity: DayEventIntensity,
  tags: string[],
): DayEvent {
  return {
    id: nextId(type),
    type,
    startMinute,
    durationMinutes,
    intensity,
    hotWaterDraw: false,
    heatingRelated: true,
    canConflict: false,
    tags,
  };
}

// ─── 1. Shower events ─────────────────────────────────────────────────────────

/**
 * Build shower events for a single occupant cohort.
 *
 * @param count       Number of occupants in this cohort.
 * @param baseMinute  Minute-from-midnight anchor for the first shower.
 * @param duration    Duration in minutes per shower.
 * @param intensity   Intensity assigned to each shower.
 * @param cohortTag   Tag identifying the occupant type (e.g. 'adult', 'teenager').
 * @param peakTag     Tag identifying the timing cluster (e.g. 'morning_peak').
 */
function buildShowerCohortEvents(
  count: number,
  baseMinute: number,
  duration: number,
  intensity: DayEventIntensity,
  cohortTag: string,
  peakTag: string,
): DayEvent[] {
  const events: DayEvent[] = [];
  for (let i = 0; i < count; i++) {
    events.push(
      makeHotWaterEvent(
        'shower',
        baseMinute + i * P.SHOWER_STAGGER_MIN,
        duration,
        intensity,
        ['shower', cohortTag, peakTag],
      ),
    );
  }
  return events;
}

/**
 * Derive all shower events for a day from household composition and occupancy
 * pattern.
 *
 * Rules (deterministic):
 *   - adults          → 1 shower each; morning for usually_out, spread for
 *                       usually_home, offset for irregular
 *   - teenagers 11–17 → 1 shower each; primarily evening (later schedules)
 *   - children 5–10   → 1 shower each; evening
 *   - young adults    → 1 shower each; later morning / evening split
 *   - children 0–4    → no shower events (bath instead)
 */
function buildShowerEvents(
  composition: HouseholdComposition,
  daytimeOccupancy: DaytimeOccupancyPattern,
): DayEvent[] {
  const events: DayEvent[] = [];

  const {
    adultCount,
    childCount5to10,
    childCount11to17,
    youngAdultCount18to25AtHome,
  } = composition;

  // ── Adults ──────────────────────────────────────────────────────────────────
  if (adultCount > 0) {
    if (daytimeOccupancy === 'usually_out') {
      // Strong morning peak — all adults shower before leaving
      events.push(
        ...buildShowerCohortEvents(
          adultCount,
          P.MORNING_STANDARD_MIN,
          P.SHOWER_DURATION_ADULT_MIN,
          P.SHOWER_INTENSITY_ADULT,
          'adult',
          'morning_peak',
        ),
      );
    } else if (daytimeOccupancy === 'usually_home') {
      // Spread: first adult showers in the morning, remaining later in the day
      events.push(
        ...buildShowerCohortEvents(
          1,
          P.MORNING_LATE_MIN,
          P.SHOWER_DURATION_ADULT_MIN,
          P.SHOWER_INTENSITY_ADULT,
          'adult',
          'morning_peak',
        ),
      );
      if (adultCount > 1) {
        events.push(
          ...buildShowerCohortEvents(
            adultCount - 1,
            P.MIDMORNING_MIN,
            P.SHOWER_DURATION_ADULT_MIN,
            P.SHOWER_INTENSITY_ADULT,
            'adult',
            'midmorning',
          ),
        );
      }
    } else {
      // irregular — offset one shower outside the standard morning peak
      events.push(
        ...buildShowerCohortEvents(
          1,
          P.MIDMORNING_MIN,
          P.SHOWER_DURATION_ADULT_MIN,
          P.SHOWER_INTENSITY_ADULT,
          'adult',
          'offset_peak',
        ),
      );
      if (adultCount > 1) {
        events.push(
          ...buildShowerCohortEvents(
            adultCount - 1,
            P.EVENING_LATE_MIN,
            P.SHOWER_DURATION_ADULT_MIN,
            P.SHOWER_INTENSITY_ADULT,
            'adult',
            'evening_peak',
          ),
        );
      }
    }
  }

  // ── Teenagers (11–17) — primarily evening ──────────────────────────────────
  if (childCount11to17 > 0) {
    const teenAnchor =
      daytimeOccupancy === 'irregular'
        ? P.LATE_PEAK_MIN
        : P.EVENING_EXTENDED_MIN;
    events.push(
      ...buildShowerCohortEvents(
        childCount11to17,
        teenAnchor,
        P.SHOWER_DURATION_TEENAGER_MIN,
        P.SHOWER_INTENSITY_TEENAGER,
        'teenager',
        'evening_peak',
      ),
    );
  }

  // ── Children 5–10 — evening ────────────────────────────────────────────────
  if (childCount5to10 > 0) {
    events.push(
      ...buildShowerCohortEvents(
        childCount5to10,
        P.EVENING_LATE_MIN,
        P.SHOWER_DURATION_CHILD_5TO10_MIN,
        P.SHOWER_INTENSITY_CHILD,
        'child_5to10',
        'evening_peak',
      ),
    );
  }

  // ── Young adults (18–25 at home) — later morning ──────────────────────────
  if (youngAdultCount18to25AtHome > 0) {
    const youngAdultAnchor =
      daytimeOccupancy === 'usually_out'
        ? P.MORNING_OFFSET_MIN
        : P.MIDMORNING_MIN;
    events.push(
      ...buildShowerCohortEvents(
        youngAdultCount18to25AtHome,
        youngAdultAnchor,
        P.SHOWER_DURATION_YOUNG_ADULT_MIN,
        P.SHOWER_INTENSITY_YOUNG_ADULT,
        'young_adult',
        daytimeOccupancy === 'usually_out' ? 'morning_peak' : 'midmorning',
      ),
    );
  }

  return events;
}

// ─── 2. Bath events ───────────────────────────────────────────────────────────

/**
 * Derive bath events.
 *
 * Rules:
 *   - rare          → 0 baths
 *   - sometimes     → 1 bath (evening) if no toddlers, otherwise 0 adult baths
 *   - frequent      → 1 bath (evening)
 *   - toddlers present (childCount0to4 > 0) → 1 bath event per toddler at
 *     bedtime, regardless of bathUse (nightly routine)
 *
 * Timing: always evening / bedtime.
 */
function buildBathEvents(
  composition: HouseholdComposition,
  bathUse: BathUsePattern,
): DayEvent[] {
  const events: DayEvent[] = [];

  // Toddler nightly bath (bath cluster — one per toddler, but cap at 2 events)
  const toddlerBathCount = Math.min(composition.childCount0to4, 2);
  for (let i = 0; i < toddlerBathCount; i++) {
    events.push(
      makeHotWaterEvent(
        'bath',
        P.BATH_CLUSTER_MIN + i * P.TODDLER_BATH_STAGGER_MIN,
        P.BATH_DURATION_MIN,
        P.BATH_INTENSITY,
        ['bath', 'toddler', 'bedtime'],
      ),
    );
  }

  // Adult / household bath
  const adultBathCount = (() => {
    switch (bathUse) {
      case 'rare':      return 0;
      case 'sometimes': return composition.childCount0to4 > 0 ? 0 : 1;
      case 'frequent':  return 1;
    }
  })();

  for (let i = 0; i < adultBathCount; i++) {
    events.push(
      makeHotWaterEvent(
        'bath',
        P.EVENING_EXTENDED_MIN + i * P.ADULT_BATH_STAGGER_MIN,
        P.BATH_DURATION_MIN,
        P.BATH_INTENSITY,
        ['bath', 'adult', 'evening'],
      ),
    );
  }

  return events;
}

// ─── 3. Kitchen and tap draw events ──────────────────────────────────────────

/**
 * Build a cluster of kitchen draws at a given anchor minute.
 *
 * @param anchor   Base minute from midnight.
 * @param offsets  Per-draw offsets within the cluster.
 * @param tags     Tags to apply to each event.
 */
function buildKitchenCluster(
  anchor: number,
  offsets: readonly number[],
  tags: string[],
): DayEvent[] {
  return offsets.map((offset) =>
    makeHotWaterEvent(
      'kitchen_draw',
      anchor + offset,
      P.KITCHEN_DRAW_DURATION_MIN,
      P.KITCHEN_DRAW_INTENSITY,
      tags,
    ),
  );
}

function buildTapCluster(
  anchor: number,
  offsets: readonly number[],
  tags: string[],
): DayEvent[] {
  return offsets.map((offset) =>
    makeHotWaterEvent(
      'tap_draw',
      anchor + offset,
      P.TAP_DRAW_DURATION_MIN,
      P.TAP_DRAW_INTENSITY,
      tags,
    ),
  );
}

/**
 * Derive all kitchen and short tap draw events.
 *
 * Baseline clusters:
 *   morning  — always present
 *   midday   — present when someone is usually home (usually_home or irregular)
 *   evening  — always present
 *
 * Extra draws are added for households larger than 2 occupants, spread across
 * existing clusters.
 */
function buildDrawEvents(
  composition: HouseholdComposition,
  daytimeOccupancy: DaytimeOccupancyPattern,
): DayEvent[] {
  const events: DayEvent[] = [];

  const occupancyCount =
    Math.max(1, composition.adultCount) +
    composition.youngAdultCount18to25AtHome +
    composition.childCount0to4 +
    composition.childCount5to10 +
    composition.childCount11to17;

  // ── Morning cluster ─────────────────────────────────────────────────────────
  events.push(
    ...buildKitchenCluster(P.MORNING_STANDARD_MIN, P.MORNING_KITCHEN_CLUSTER_OFFSETS_MIN, ['kitchen', 'morning']),
    ...buildTapCluster(P.MORNING_STANDARD_MIN, P.MORNING_TAP_CLUSTER_OFFSETS_MIN, ['tap', 'morning']),
  );

  // ── Midday cluster — only if someone is home ────────────────────────────────
  if (daytimeOccupancy === 'usually_home' || daytimeOccupancy === 'irregular') {
    events.push(
      ...buildKitchenCluster(P.MIDDAY_MIN, P.MIDDAY_KITCHEN_CLUSTER_OFFSETS_MIN, ['kitchen', 'midday']),
      ...buildTapCluster(P.MIDDAY_MIN, P.MIDDAY_TAP_CLUSTER_OFFSETS_MIN, ['tap', 'midday']),
    );
  }

  // ── Evening cluster ─────────────────────────────────────────────────────────
  const eveningAnchor =
    daytimeOccupancy === 'usually_out' ? P.EVENING_STANDARD_MIN : P.EVENING_LATE_MIN;
  events.push(
    ...buildKitchenCluster(eveningAnchor, P.EVENING_KITCHEN_CLUSTER_OFFSETS_MIN, ['kitchen', 'evening']),
    ...buildTapCluster(eveningAnchor, P.EVENING_TAP_CLUSTER_OFFSETS_MIN, ['tap', 'evening']),
  );

  // ── Extra draws for larger households ──────────────────────────────────────
  const extraOccupants = Math.max(0, occupancyCount - 2);
  for (let i = 0; i < extraOccupants * P.KITCHEN_DRAWS_PER_EXTRA_OCCUPANT; i++) {
    events.push(
      makeHotWaterEvent(
        'kitchen_draw',
        P.EVENING_STANDARD_MIN + i * P.KITCHEN_EXTRA_STAGGER_MIN,
        P.KITCHEN_DRAW_DURATION_MIN,
        P.KITCHEN_DRAW_INTENSITY,
        ['kitchen', 'extra_occupant'],
      ),
    );
  }
  for (let i = 0; i < extraOccupants * P.TAP_DRAWS_PER_EXTRA_OCCUPANT; i++) {
    events.push(
      makeHotWaterEvent(
        'tap_draw',
        P.MORNING_OFFSET_MIN + i * P.TAP_EXTRA_STAGGER_MIN,
        P.TAP_DRAW_DURATION_MIN,
        P.TAP_DRAW_INTENSITY,
        ['tap', 'extra_occupant'],
      ),
    );
  }

  return events;
}

// ─── 4. Heating window events ─────────────────────────────────────────────────

/**
 * Derive all heating window events based on daytime occupancy pattern.
 *
 * usually_out
 *   06:00 — morning recovery (1 h)
 *   07:00 — daytime setback (8 h)
 *   17:00 — evening recovery (3 h)
 *
 * usually_home
 *   07:00 — short morning recovery (1 h)
 *   08:00 — long daytime active block (8 h)
 *   18:00 — continued / evening comfort (3 h)
 *
 * irregular
 *   06:30 — early morning recovery (1 h)
 *   07:30 — partial setback (4 h) — shorter because occupancy is unpredictable
 *   11:30 — second active window (2 h)
 *   17:00 — evening recovery (3 h)
 */
function buildHeatingEvents(daytimeOccupancy: DaytimeOccupancyPattern): DayEvent[] {
  const events: DayEvent[] = [];

  if (daytimeOccupancy === 'usually_out') {
    events.push(
      makeHeatingEvent(
        'heating_recovery',
        P.MORNING_EARLY_MIN,       // 06:00
        P.HEATING_MORNING_RECOVERY_DURATION_MIN,
        P.HEATING_RECOVERY_INTENSITY,
        ['heating', 'morning_recovery'],
      ),
      makeHeatingEvent(
        'heating_setback',
        P.MORNING_STANDARD_MIN,    // 07:00
        P.HEATING_DAYTIME_SETBACK_DURATION_MIN,
        P.HEATING_SETBACK_INTENSITY,
        ['heating', 'daytime_setback'],
      ),
      makeHeatingEvent(
        'heating_recovery',
        P.EVENING_EARLY_MIN,       // 17:00
        P.HEATING_EVENING_RECOVERY_DURATION_MIN,
        P.HEATING_RECOVERY_INTENSITY,
        ['heating', 'evening_recovery'],
      ),
    );
  } else if (daytimeOccupancy === 'usually_home') {
    events.push(
      makeHeatingEvent(
        'heating_recovery',
        P.MORNING_STANDARD_MIN,    // 07:00
        P.HEATING_MORNING_RECOVERY_DURATION_MIN,
        P.HEATING_RECOVERY_INTENSITY,
        ['heating', 'morning_recovery'],
      ),
      makeHeatingEvent(
        'heating_active',
        P.MORNING_OFFSET_MIN,      // 08:00
        P.HEATING_DAYTIME_ACTIVE_DURATION_MIN,
        P.HEATING_ACTIVE_INTENSITY,
        ['heating', 'daytime_active'],
      ),
      makeHeatingEvent(
        'heating_recovery',
        P.EVENING_STANDARD_MIN,    // 18:00
        P.HEATING_EVENING_RECOVERY_DURATION_MIN,
        P.HEATING_RECOVERY_INTENSITY,
        ['heating', 'evening_recovery'],
      ),
    );
  } else {
    // irregular — split windows with offset recoveries
    events.push(
      makeHeatingEvent(
        'heating_recovery',
        P.MORNING_EARLY_MIN + P.IRREGULAR_MORNING_OFFSET_MIN,  // 06:30
        P.HEATING_MORNING_RECOVERY_DURATION_MIN,
        P.HEATING_RECOVERY_INTENSITY,
        ['heating', 'morning_recovery', 'irregular'],
      ),
      makeHeatingEvent(
        'heating_setback',
        P.MORNING_LATE_MIN,        // 07:30
        P.HEATING_PARTIAL_SETBACK_DURATION_MIN,
        P.HEATING_SETBACK_INTENSITY,
        ['heating', 'partial_setback', 'irregular'],
      ),
      makeHeatingEvent(
        'heating_active',
        P.MIDMORNING_MIN + P.IRREGULAR_MIDDAY_HEATING_OFFSET_MIN,  // 11:30
        P.HEATING_MIDDAY_ACTIVE_DURATION_MIN,
        P.HEATING_ACTIVE_INTENSITY,
        ['heating', 'midday_active', 'irregular'],
      ),
      makeHeatingEvent(
        'heating_recovery',
        P.EVENING_EARLY_MIN,       // 17:00
        P.HEATING_EVENING_RECOVERY_DURATION_MIN,
        P.HEATING_RECOVERY_INTENSITY,
        ['heating', 'evening_recovery', 'irregular'],
      ),
    );
  }

  return events;
}

// ─── 5. Summary ───────────────────────────────────────────────────────────────

function buildSummary(events: DayEvent[]): TypicalDayScheduleSummary {
  let showerCount     = 0;
  let bathCount       = 0;
  let kitchenDrawCount = 0;
  let shortTapDrawCount = 0;
  let heatingWindows  = 0;

  for (const e of events) {
    switch (e.type) {
      case 'shower':          showerCount++;       break;
      case 'bath':            bathCount++;         break;
      case 'kitchen_draw':    kitchenDrawCount++;  break;
      case 'tap_draw':        shortTapDrawCount++; break;
      case 'heating_recovery':
      case 'heating_active':
      case 'heating_setback': heatingWindows++;    break;
    }
  }

  return { showerCount, bathCount, kitchenDrawCount, shortTapDrawCount, heatingWindows };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a deterministic 24-hour typical day schedule from a derived
 * household profile.
 *
 * For identical inputs this function always returns an identical schedule.
 * No randomness is introduced.
 *
 * The returned events list is sorted ascending by startMinute.
 *
 * @example
 *   const schedule = generateTypicalDaySchedule({
 *     derivedPresetId:    'working_couple',
 *     derivationReason:   'Two adults + usually out → working_couple',
 *     householdComposition: { adultCount: 2, childCount0to4: 0, childCount5to10: 0,
 *                              childCount11to17: 0, youngAdultCount18to25AtHome: 0 },
 *     daytimeOccupancy:   'usually_out',
 *     bathUse:            'sometimes',
 *   });
 *   // schedule.events sorted by startMinute, schedule.summary.showerCount === 2
 */
export function generateTypicalDaySchedule(
  input: GenerateTypicalDayScheduleInputs,
): TypicalDaySchedule {
  // Reset ID counter so each call produces identical IDs for identical inputs.
  _idCounter = 0;

  const {
    derivedPresetId,
    derivationReason,
    householdComposition,
    daytimeOccupancy,
    bathUse,
  } = input;

  const occupancyCount =
    Math.max(1, householdComposition.adultCount) +
    householdComposition.youngAdultCount18to25AtHome +
    householdComposition.childCount0to4 +
    householdComposition.childCount5to10 +
    householdComposition.childCount11to17;

  const allEvents: DayEvent[] = [
    ...buildShowerEvents(householdComposition, daytimeOccupancy),
    ...buildBathEvents(householdComposition, bathUse),
    ...buildDrawEvents(householdComposition, daytimeOccupancy),
    ...buildHeatingEvents(daytimeOccupancy),
  ];

  // Sort ascending by startMinute (stable: same start order preserved for same input).
  allEvents.sort((a, b) => a.startMinute - b.startMinute);

  return {
    derivedPresetId,
    derivationReason,
    occupancyCount,
    events: allEvents,
    summary: buildSummary(allEvents),
  };
}
