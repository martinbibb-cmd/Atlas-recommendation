/**
 * generateTypicalDaySchedule.test.ts
 *
 * Tests for the deterministic Typical Day Event Generator.
 *
 * Covers the acceptance criteria from the problem statement:
 *   1.  working couple produces morning/evening peaks
 *   2.  retired couple produces daytime heating active block
 *   3.  teenagers increase shower count
 *   4.  toddlers increase bath events
 *   5.  someone-usually-home increases midday draws
 *   6.  irregular pattern offsets at least some events out of standard peaks
 *   7.  larger household increases total event count
 *   8.  events are sorted by startMinute
 *   9.  same input always gives same output (determinism)
 *  10.  schedule includes both hot-water and heating events
 *  11.  shower / bath / tap counts vary sensibly by household composition
 *  12.  daytime pattern affects heating windows
 *  13.  event list metadata is correct (hotWaterDraw, heatingRelated, canConflict)
 *  14.  summary counts match event list
 */
import { describe, it, expect } from 'vitest';
import { generateTypicalDaySchedule } from '../generateTypicalDaySchedule';
import type {
  GenerateTypicalDayScheduleInputs,
  DayEvent,
} from '../types';
import type { HouseholdComposition } from '../../../engine/schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_COMPOSITION: HouseholdComposition = {
  adultCount: 0,
  childCount0to4: 0,
  childCount5to10: 0,
  childCount11to17: 0,
  youngAdultCount18to25AtHome: 0,
};

function compose(overrides: Partial<HouseholdComposition> = {}): HouseholdComposition {
  return { ...EMPTY_COMPOSITION, ...overrides };
}

function inputs(
  overrides: Partial<GenerateTypicalDayScheduleInputs> & {
    householdComposition?: HouseholdComposition;
  } = {},
): GenerateTypicalDayScheduleInputs {
  return {
    derivedPresetId: 'working_couple',
    derivationReason: 'Two adults + usually out → working_couple',
    householdComposition: compose({ adultCount: 2 }),
    daytimeOccupancy: 'usually_out',
    bathUse: 'rare',
    ...overrides,
  };
}

// ─── 1. Working couple — morning / evening peaks ──────────────────────────────

describe('working couple produces morning and evening peaks', () => {
  it('generates shower events in the morning', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({ daytimeOccupancy: 'usually_out' }),
    );
    const morningShowers = schedule.events.filter(
      (e) => e.type === 'shower' && e.startMinute < 720, // before noon
    );
    expect(morningShowers.length).toBeGreaterThan(0);
  });

  it('generates kitchen draw events in the evening', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({ daytimeOccupancy: 'usually_out' }),
    );
    const eveningDraws = schedule.events.filter(
      (e) => (e.type === 'kitchen_draw' || e.type === 'tap_draw') && e.startMinute >= 960,
    );
    expect(eveningDraws.length).toBeGreaterThan(0);
  });

  it('has a morning recovery and evening recovery heating window', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({ daytimeOccupancy: 'usually_out' }),
    );
    const recoveries = schedule.events.filter((e) => e.type === 'heating_recovery');
    expect(recoveries.length).toBeGreaterThanOrEqual(2);
    const morningRecovery = recoveries.find((e) => e.startMinute < 720);
    const eveningRecovery = recoveries.find((e) => e.startMinute >= 720);
    expect(morningRecovery).toBeDefined();
    expect(eveningRecovery).toBeDefined();
  });

  it('has a daytime setback heating window', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({ daytimeOccupancy: 'usually_out' }),
    );
    const setbacks = schedule.events.filter((e) => e.type === 'heating_setback');
    expect(setbacks.length).toBeGreaterThan(0);
  });
});

// ─── 2. Retired couple — daytime active heating block ─────────────────────────

describe('retired couple produces daytime active heating block', () => {
  it('has a heating_active event during the day', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({
        derivedPresetId: 'retired_couple',
        derivationReason: 'Two adults + usually someone home → retired_couple',
        daytimeOccupancy: 'usually_home',
      }),
    );
    const activePeriods = schedule.events.filter((e) => e.type === 'heating_active');
    expect(activePeriods.length).toBeGreaterThan(0);
    // Daytime active block should start in the morning and cover most of the day
    const daytimeActive = activePeriods.find(
      (e) => e.startMinute >= 360 && e.startMinute < 720,
    );
    expect(daytimeActive).toBeDefined();
    expect(daytimeActive!.durationMinutes).toBeGreaterThanOrEqual(240); // at least 4 h
  });

  it('does NOT have a long daytime setback like an out-household', () => {
    const outSchedule = generateTypicalDaySchedule(inputs({ daytimeOccupancy: 'usually_out' }));
    const homeSchedule = generateTypicalDaySchedule(inputs({ daytimeOccupancy: 'usually_home' }));
    const outSetbacks = outSchedule.events.filter((e) => e.type === 'heating_setback');
    const homeSetbacks = homeSchedule.events.filter((e) => e.type === 'heating_setback');
    expect(outSetbacks.length).toBeGreaterThan(homeSetbacks.length);
  });
});

// ─── 3. Teenagers increase shower count ───────────────────────────────────────

describe('teenagers increase shower count', () => {
  it('household with 2 teenagers has more showers than the same without', () => {
    const withTeens = generateTypicalDaySchedule(
      inputs({
        derivedPresetId: 'family_teenagers',
        derivationReason: 'Teenagers present → family_teenagers',
        householdComposition: compose({ adultCount: 2, childCount11to17: 2 }),
        daytimeOccupancy: 'usually_out',
        bathUse: 'rare',
      }),
    );
    const withoutTeens = generateTypicalDaySchedule(
      inputs({
        householdComposition: compose({ adultCount: 2 }),
        daytimeOccupancy: 'usually_out',
        bathUse: 'rare',
      }),
    );
    expect(withTeens.summary.showerCount).toBeGreaterThan(withoutTeens.summary.showerCount);
  });

  it('each teenager contributes exactly one shower event', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({
        derivedPresetId: 'family_teenagers',
        derivationReason: 'Teenagers present → family_teenagers',
        householdComposition: compose({ adultCount: 2, childCount11to17: 3 }),
        daytimeOccupancy: 'usually_out',
      }),
    );
    const teenShowers = schedule.events.filter(
      (e) => e.type === 'shower' && e.tags.includes('teenager'),
    );
    expect(teenShowers.length).toBe(3);
  });

  it('teenager showers are in the evening cluster', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({
        derivedPresetId: 'family_teenagers',
        derivationReason: 'Teenagers present → family_teenagers',
        householdComposition: compose({ adultCount: 2, childCount11to17: 1 }),
        daytimeOccupancy: 'usually_out',
      }),
    );
    const teenShowers = schedule.events.filter(
      (e) => e.type === 'shower' && e.tags.includes('teenager'),
    );
    expect(teenShowers.every((e) => e.startMinute >= 720)).toBe(true); // after noon
  });
});

// ─── 4. Toddlers increase bath events ─────────────────────────────────────────

describe('toddlers increase bath events', () => {
  it('one toddler produces at least one bath event', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({
        derivedPresetId: 'family_young_children',
        derivationReason: 'Young children present → family_young_children',
        householdComposition: compose({ adultCount: 2, childCount0to4: 1 }),
        daytimeOccupancy: 'usually_out',
        bathUse: 'rare',
      }),
    );
    expect(schedule.summary.bathCount).toBeGreaterThan(0);
  });

  it('toddler bath events are tagged with "toddler"', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({
        derivedPresetId: 'family_young_children',
        derivationReason: 'Young children present → family_young_children',
        householdComposition: compose({ adultCount: 2, childCount0to4: 1 }),
        daytimeOccupancy: 'usually_out',
        bathUse: 'rare',
      }),
    );
    const toddlerBaths = schedule.events.filter(
      (e) => e.type === 'bath' && e.tags.includes('toddler'),
    );
    expect(toddlerBaths.length).toBeGreaterThan(0);
  });

  it('two toddlers produce more bath events than a household without toddlers with rare bathUse', () => {
    const withToddlers = generateTypicalDaySchedule(
      inputs({
        householdComposition: compose({ adultCount: 2, childCount0to4: 2 }),
        bathUse: 'rare',
      }),
    );
    const withoutToddlers = generateTypicalDaySchedule(
      inputs({
        householdComposition: compose({ adultCount: 2 }),
        bathUse: 'rare',
      }),
    );
    expect(withToddlers.summary.bathCount).toBeGreaterThan(withoutToddlers.summary.bathCount);
  });

  it('toddler baths are at bath-cluster time (start minute >= 1200)', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({
        householdComposition: compose({ adultCount: 2, childCount0to4: 1 }),
        bathUse: 'rare',
      }),
    );
    const toddlerBaths = schedule.events.filter(
      (e) => e.type === 'bath' && e.tags.includes('toddler'),
    );
    expect(toddlerBaths.every((e) => e.startMinute >= 1200)).toBe(true);
  });
});

// ─── 5. Someone-usually-home increases midday draws ───────────────────────────

describe('someone-usually-home increases midday draws', () => {
  it('usually_home has more total events than usually_out for same composition', () => {
    const homeSchedule = generateTypicalDaySchedule(inputs({ daytimeOccupancy: 'usually_home' }));
    const outSchedule  = generateTypicalDaySchedule(inputs({ daytimeOccupancy: 'usually_out' }));
    expect(homeSchedule.events.length).toBeGreaterThan(outSchedule.events.length);
  });

  it('usually_home has midday draw events (between 10:00 and 15:00)', () => {
    const schedule = generateTypicalDaySchedule(inputs({ daytimeOccupancy: 'usually_home' }));
    const middayDraws = schedule.events.filter(
      (e) =>
        (e.type === 'kitchen_draw' || e.type === 'tap_draw') &&
        e.startMinute >= 600 && e.startMinute < 900,
    );
    expect(middayDraws.length).toBeGreaterThan(0);
  });

  it('usually_out has no midday draw cluster', () => {
    const schedule = generateTypicalDaySchedule(inputs({ daytimeOccupancy: 'usually_out' }));
    const middayDraws = schedule.events.filter(
      (e) =>
        (e.type === 'kitchen_draw' || e.type === 'tap_draw') &&
        e.startMinute >= 720 && e.startMinute < 900,
    );
    expect(middayDraws.length).toBe(0);
  });
});

// ─── 6. Irregular pattern offsets events ──────────────────────────────────────

describe('irregular pattern offsets at least some events out of standard peaks', () => {
  it('irregular schedule has at least one shower outside 07:00–08:00 window', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({
        derivedPresetId: 'shift_worker',
        derivationReason: 'Two adults + irregular schedule → shift_worker',
        daytimeOccupancy: 'irregular',
      }),
    );
    const offsetShowers = schedule.events.filter(
      (e) => e.type === 'shower' && (e.startMinute < 420 || e.startMinute > 480),
    );
    expect(offsetShowers.length).toBeGreaterThan(0);
  });

  it('irregular schedule includes split heating windows', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({ daytimeOccupancy: 'irregular' }),
    );
    const heatingEvents = schedule.events.filter((e) => e.heatingRelated);
    // Irregular should have at least 3 heating events (two recoveries + setback/active)
    expect(heatingEvents.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── 7. Larger household increases total event count ──────────────────────────

describe('larger household generates more total events', () => {
  it('4-person household has more events than 2-person household', () => {
    const large = generateTypicalDaySchedule(
      inputs({
        householdComposition: compose({ adultCount: 2, childCount11to17: 2 }),
        derivedPresetId: 'family_teenagers',
        derivationReason: 'Teenagers present → family_teenagers',
      }),
    );
    const small = generateTypicalDaySchedule(inputs());
    expect(large.events.length).toBeGreaterThan(small.events.length);
  });

  it('6-person household has more events than 4-person household', () => {
    const six = generateTypicalDaySchedule(
      inputs({ householdComposition: compose({ adultCount: 4, childCount11to17: 2 }) }),
    );
    const four = generateTypicalDaySchedule(
      inputs({ householdComposition: compose({ adultCount: 2, childCount11to17: 2 }) }),
    );
    expect(six.events.length).toBeGreaterThan(four.events.length);
  });
});

// ─── 8. Events are sorted by startMinute ──────────────────────────────────────

describe('events are sorted ascending by startMinute', () => {
  const scenarios: Array<[string, GenerateTypicalDayScheduleInputs]> = [
    ['working couple', inputs()],
    [
      'family with teenagers',
      inputs({
        derivedPresetId: 'family_teenagers',
        derivationReason: 'Teenagers present → family_teenagers',
        householdComposition: compose({ adultCount: 2, childCount11to17: 2 }),
        bathUse: 'rare',
      }),
    ],
    [
      'irregular schedule',
      inputs({ daytimeOccupancy: 'irregular', derivedPresetId: 'shift_worker', derivationReason: 'shift' }),
    ],
    [
      'retired couple',
      inputs({
        derivedPresetId: 'retired_couple',
        derivationReason: 'Two adults + usually home → retired_couple',
        daytimeOccupancy: 'usually_home',
      }),
    ],
  ];

  for (const [label, input] of scenarios) {
    it(`${label} → events sorted`, () => {
      const schedule = generateTypicalDaySchedule(input);
      for (let i = 1; i < schedule.events.length; i++) {
        expect(schedule.events[i].startMinute).toBeGreaterThanOrEqual(
          schedule.events[i - 1].startMinute,
        );
      }
    });
  }
});

// ─── 9. Deterministic repeatability ───────────────────────────────────────────

describe('deterministic — same input always produces same output', () => {
  it('working couple produces identical schedules on repeated calls', () => {
    const input = inputs();
    const a = generateTypicalDaySchedule(input);
    const b = generateTypicalDaySchedule(input);
    expect(a.events.length).toBe(b.events.length);
    for (let i = 0; i < a.events.length; i++) {
      expect(a.events[i].type).toBe(b.events[i].type);
      expect(a.events[i].startMinute).toBe(b.events[i].startMinute);
      expect(a.events[i].durationMinutes).toBe(b.events[i].durationMinutes);
      expect(a.events[i].intensity).toBe(b.events[i].intensity);
    }
  });

  it('family with toddlers produces identical schedules on repeated calls', () => {
    const input = inputs({
      householdComposition: compose({ adultCount: 2, childCount0to4: 1 }),
      bathUse: 'frequent',
    });
    const a = generateTypicalDaySchedule(input);
    const b = generateTypicalDaySchedule(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('summary counts are identical on repeated calls', () => {
    const input = inputs({
      derivedPresetId: 'family_teenagers',
      derivationReason: 'Teenagers present → family_teenagers',
      householdComposition: compose({ adultCount: 2, childCount11to17: 2 }),
    });
    const a = generateTypicalDaySchedule(input);
    const b = generateTypicalDaySchedule(input);
    expect(a.summary).toEqual(b.summary);
  });
});

// ─── 10. Schedule includes both hot-water and heating events ──────────────────

describe('schedule always includes both hot-water and heating events', () => {
  const allInputs: Array<[string, GenerateTypicalDayScheduleInputs]> = [
    ['working couple', inputs({ daytimeOccupancy: 'usually_out' })],
    ['retired couple', inputs({ derivedPresetId: 'retired_couple', derivationReason: 'r', daytimeOccupancy: 'usually_home' })],
    ['shift worker', inputs({ derivedPresetId: 'shift_worker', derivationReason: 's', daytimeOccupancy: 'irregular' })],
  ];

  for (const [label, input] of allInputs) {
    it(`${label} has both hot-water and heating events`, () => {
      const schedule = generateTypicalDaySchedule(input);
      const hasHotWater  = schedule.events.some((e) => e.hotWaterDraw);
      const hasHeating   = schedule.events.some((e) => e.heatingRelated);
      expect(hasHotWater).toBe(true);
      expect(hasHeating).toBe(true);
    });
  }
});

// ─── 11. Event metadata is correct ────────────────────────────────────────────

describe('event metadata flags are correct', () => {
  it('shower events have hotWaterDraw=true, heatingRelated=false, canConflict=true', () => {
    const schedule = generateTypicalDaySchedule(inputs());
    const showers = schedule.events.filter((e) => e.type === 'shower');
    expect(showers.length).toBeGreaterThan(0);
    for (const s of showers) {
      expect(s.hotWaterDraw).toBe(true);
      expect(s.heatingRelated).toBe(false);
      expect(s.canConflict).toBe(true);
    }
  });

  it('bath events have hotWaterDraw=true, heatingRelated=false, canConflict=true', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({
        householdComposition: compose({ adultCount: 2, childCount0to4: 1 }),
        bathUse: 'frequent',
      }),
    );
    const baths = schedule.events.filter((e) => e.type === 'bath');
    expect(baths.length).toBeGreaterThan(0);
    for (const b of baths) {
      expect(b.hotWaterDraw).toBe(true);
      expect(b.heatingRelated).toBe(false);
      expect(b.canConflict).toBe(true);
    }
  });

  it('heating events have heatingRelated=true, hotWaterDraw=false, canConflict=false', () => {
    const schedule = generateTypicalDaySchedule(inputs());
    const heating = schedule.events.filter((e) => e.heatingRelated);
    expect(heating.length).toBeGreaterThan(0);
    for (const h of heating) {
      expect(h.hotWaterDraw).toBe(false);
      expect(h.heatingRelated).toBe(true);
      expect(h.canConflict).toBe(false);
    }
  });

  it('kitchen_draw and tap_draw have hotWaterDraw=true, canConflict=false', () => {
    const schedule = generateTypicalDaySchedule(inputs());
    const draws = schedule.events.filter(
      (e) => e.type === 'kitchen_draw' || e.type === 'tap_draw',
    );
    expect(draws.length).toBeGreaterThan(0);
    for (const d of draws) {
      expect(d.hotWaterDraw).toBe(true);
      expect(d.canConflict).toBe(false);
    }
  });

  it('all events have a non-empty id string', () => {
    const schedule = generateTypicalDaySchedule(inputs());
    for (const e of schedule.events) {
      expect(typeof e.id).toBe('string');
      expect(e.id.length).toBeGreaterThan(0);
    }
  });

  it('all events have a non-empty tags array', () => {
    const schedule = generateTypicalDaySchedule(inputs());
    for (const e of schedule.events) {
      expect(Array.isArray(e.tags)).toBe(true);
      expect(e.tags.length).toBeGreaterThan(0);
    }
  });

  it('all events have durationMinutes > 0', () => {
    const schedule = generateTypicalDaySchedule(inputs());
    for (const e of schedule.events) {
      expect(e.durationMinutes).toBeGreaterThan(0);
    }
  });
});

// ─── 12. Daytime pattern affects heating windows ──────────────────────────────

describe('daytime occupancy affects heating window types', () => {
  it('usually_out → has heating_setback, no heating_active', () => {
    const schedule = generateTypicalDaySchedule(inputs({ daytimeOccupancy: 'usually_out' }));
    expect(schedule.events.some((e) => e.type === 'heating_setback')).toBe(true);
    expect(schedule.events.some((e) => e.type === 'heating_active')).toBe(false);
  });

  it('usually_home → has heating_active, no heating_setback', () => {
    const schedule = generateTypicalDaySchedule(inputs({ daytimeOccupancy: 'usually_home' }));
    expect(schedule.events.some((e) => e.type === 'heating_active')).toBe(true);
    expect(schedule.events.some((e) => e.type === 'heating_setback')).toBe(false);
  });

  it('irregular → has both heating_active and heating_setback (split windows)', () => {
    const schedule = generateTypicalDaySchedule(inputs({ daytimeOccupancy: 'irregular' }));
    expect(schedule.events.some((e) => e.type === 'heating_active')).toBe(true);
    expect(schedule.events.some((e) => e.type === 'heating_setback')).toBe(true);
  });
});

// ─── 13. Summary counts match event list ──────────────────────────────────────

describe('summary counts accurately reflect the event list', () => {
  const testInputs: GenerateTypicalDayScheduleInputs[] = [
    inputs(),
    inputs({ daytimeOccupancy: 'usually_home' }),
    inputs({ daytimeOccupancy: 'irregular' }),
    inputs({
      derivedPresetId: 'family_teenagers',
      derivationReason: 'Teenagers present → family_teenagers',
      householdComposition: compose({ adultCount: 2, childCount11to17: 1, childCount0to4: 1 }),
      bathUse: 'frequent',
    }),
  ];

  for (const input of testInputs) {
    it(`summary matches event list for preset=${input.derivedPresetId}`, () => {
      const schedule = generateTypicalDaySchedule(input);
      const countType = (type: string) =>
        schedule.events.filter((e) => e.type === type).length;
      const heatingCount = schedule.events.filter(
        (e) => e.type === 'heating_recovery' || e.type === 'heating_active' || e.type === 'heating_setback',
      ).length;

      expect(schedule.summary.showerCount).toBe(countType('shower'));
      expect(schedule.summary.bathCount).toBe(countType('bath'));
      expect(schedule.summary.kitchenDrawCount).toBe(countType('kitchen_draw'));
      expect(schedule.summary.shortTapDrawCount).toBe(countType('tap_draw'));
      expect(schedule.summary.heatingWindows).toBe(heatingCount);
    });
  }
});

// ─── 14. carry-through fields ─────────────────────────────────────────────────

describe('carry-through fields are preserved', () => {
  it('derivedPresetId and derivationReason are passed through unchanged', () => {
    const input = inputs({
      derivedPresetId: 'family_teenagers',
      derivationReason: 'Teenagers present → family_teenagers',
    });
    const schedule = generateTypicalDaySchedule(input);
    expect(schedule.derivedPresetId).toBe('family_teenagers');
    expect(schedule.derivationReason).toBe('Teenagers present → family_teenagers');
  });

  it('occupancyCount is correct', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({ householdComposition: compose({ adultCount: 2, childCount11to17: 1 }) }),
    );
    expect(schedule.occupancyCount).toBe(3);
  });
});

// ─── 15. Bath use affects adult bath count ────────────────────────────────────

describe('bathUse setting affects adult bath events', () => {
  it('rare bathUse with no toddlers produces zero bath events', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({ householdComposition: compose({ adultCount: 2 }), bathUse: 'rare' }),
    );
    expect(schedule.summary.bathCount).toBe(0);
  });

  it('frequent bathUse produces at least one bath event', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({ householdComposition: compose({ adultCount: 2 }), bathUse: 'frequent' }),
    );
    expect(schedule.summary.bathCount).toBeGreaterThan(0);
  });

  it('sometimes bathUse (no toddlers) produces exactly one bath event', () => {
    const schedule = generateTypicalDaySchedule(
      inputs({ householdComposition: compose({ adultCount: 2 }), bathUse: 'sometimes' }),
    );
    expect(schedule.summary.bathCount).toBe(1);
  });
});

// ─── 16. Shower counts vary sensibly ──────────────────────────────────────────

describe('shower counts vary sensibly by household composition', () => {
  it('single adult has fewer showers than two adults', () => {
    const one = generateTypicalDaySchedule(inputs({ householdComposition: compose({ adultCount: 1 }) }));
    const two = generateTypicalDaySchedule(inputs({ householdComposition: compose({ adultCount: 2 }) }));
    expect(one.summary.showerCount).toBeLessThan(two.summary.showerCount);
  });

  it('young adult at home adds to shower count', () => {
    const withYoung = generateTypicalDaySchedule(
      inputs({ householdComposition: compose({ adultCount: 2, youngAdultCount18to25AtHome: 1 }) }),
    );
    const without = generateTypicalDaySchedule(
      inputs({ householdComposition: compose({ adultCount: 2 }) }),
    );
    expect(withYoung.summary.showerCount).toBeGreaterThan(without.summary.showerCount);
  });

  it('children 5–10 add shower events', () => {
    const withChild = generateTypicalDaySchedule(
      inputs({
        householdComposition: compose({ adultCount: 2, childCount5to10: 1 }),
        derivedPresetId: 'family_young_children',
        derivationReason: 'Young children present → family_young_children',
      }),
    );
    const without = generateTypicalDaySchedule(
      inputs({ householdComposition: compose({ adultCount: 2 }) }),
    );
    expect(withChild.summary.showerCount).toBeGreaterThan(without.summary.showerCount);
  });
});

// ─── 17. startMinute is within a valid day range ──────────────────────────────

describe('all event startMinutes are within a 24-hour day', () => {
  const scenarioList: GenerateTypicalDayScheduleInputs[] = [
    inputs(),
    inputs({ daytimeOccupancy: 'usually_home' }),
    inputs({ daytimeOccupancy: 'irregular' }),
    inputs({
      householdComposition: compose({ adultCount: 2, childCount11to17: 2, childCount0to4: 1 }),
      derivedPresetId: 'family_teenagers',
      derivationReason: 'Teenagers present → family_teenagers',
      bathUse: 'frequent',
    }),
  ];

  for (const input of scenarioList) {
    it(`all startMinutes in [0, 1440) for preset=${input.derivedPresetId}`, () => {
      const schedule = generateTypicalDaySchedule(input);
      for (const e of schedule.events) {
        expect(e.startMinute).toBeGreaterThanOrEqual(0);
        expect(e.startMinute).toBeLessThan(1440);
      }
    });
  }
});
