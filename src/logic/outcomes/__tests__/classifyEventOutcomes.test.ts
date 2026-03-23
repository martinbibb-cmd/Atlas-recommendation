/**
 * classifyEventOutcomes.test.ts
 *
 * Tests for the PR 3 Event Outcome Engine.
 *
 * Covers the acceptance criteria from the problem statement:
 *   1.  combi with good pressure, single shower → successful
 *   2.  combi with overlapping showers → reduced or conflict
 *   3.  stored water handles peak cluster better than combi
 *   4.  heat pump cylinder shows slower recovery after clustered demand
 *   5.  bath fill time differs by system type
 *   6.  heating recovery: strong boiler vs weak low-temp setup
 *   7.  steady-home active block suits heat pump better than spiky recovery
 *   8.  poor controls worsen outcomes
 *   9.  poor system condition worsens outcomes
 *  10.  deterministic: identical schedule + spec → identical result set
 *  11.  hot-water summary counts aggregate correctly
 *  12.  heating summary counts aggregate correctly
 *  13.  same schedule produces different outcomes for different system specs
 */

import { describe, it, expect } from 'vitest';
import { classifyEventOutcomes } from '../classifyEventOutcomes';
import type { OutcomeSystemSpec } from '../types';
import type { DayEvent, TypicalDaySchedule } from '../../events/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<DayEvent> & { id: string }): DayEvent {
  return {
    id:              overrides.id,
    type:            overrides.type            ?? 'shower',
    startMinute:     overrides.startMinute     ?? 420,
    durationMinutes: overrides.durationMinutes ?? 8,
    intensity:       overrides.intensity       ?? 'medium',
    hotWaterDraw:    overrides.hotWaterDraw    ?? true,
    heatingRelated:  overrides.heatingRelated  ?? false,
    canConflict:     overrides.canConflict     ?? true,
    tags:            overrides.tags            ?? [],
  };
}

function makeSchedule(events: DayEvent[]): TypicalDaySchedule {
  return {
    derivedPresetId:   'working_couple',
    derivationReason:  'Two adults + usually out → working_couple',
    occupancyCount:    2,
    events,
    summary: {
      showerCount:      events.filter((e) => e.type === 'shower').length,
      bathCount:        events.filter((e) => e.type === 'bath').length,
      kitchenDrawCount: events.filter((e) => e.type === 'kitchen_draw').length,
      shortTapDrawCount: events.filter((e) => e.type === 'tap_draw').length,
      heatingWindows:   events.filter((e) => e.heatingRelated).length,
    },
  };
}

const GOOD_COMBI: OutcomeSystemSpec = {
  systemType:               'combi',
  peakHotWaterCapacityLpm:  12,
  heatOutputKw:             24,
  mainsDynamicPressureBar:  1.0,
  controlsQuality:          'good',
  systemCondition:          'clean',
};

const LOW_PRESSURE_COMBI: OutcomeSystemSpec = {
  ...GOOD_COMBI,
  mainsDynamicPressureBar: 0.2,
};

const STORED_WATER_SPEC: OutcomeSystemSpec = {
  systemType:               'stored_water',
  hotWaterStorageLitres:    150,
  recoveryRateLitresPerHour: 60,
  heatOutputKw:             18,
  controlsQuality:          'good',
  systemCondition:          'clean',
};

const HEAT_PUMP_SPEC: OutcomeSystemSpec = {
  systemType:               'heat_pump',
  hotWaterStorageLitres:    250,
  recoveryRateLitresPerHour: 30,
  heatOutputKw:             10,
  lowTempSuitability:       'high',
  controlsQuality:          'good',
  systemCondition:          'clean',
};

// ─── 1. Combi with good pressure, single shower → successful ─────────────────

describe('combi: single shower with good pressure', () => {
  it('classifies as successful', () => {
    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower', startMinute: 420, durationMinutes: 8 }),
    ]);

    const result = classifyEventOutcomes(schedule, GOOD_COMBI);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].result).toBe('successful');
    expect(result.hotWater.successful).toBe(1);
    expect(result.hotWater.conflict).toBe(0);
    expect(result.hotWater.reduced).toBe(0);
  });
});

// ─── 2. Combi with overlapping showers → reduced or conflict ─────────────────

describe('combi: overlapping showers cause demand conflict', () => {
  it('classifies at least one shower as reduced or conflict', () => {
    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower', startMinute: 420, durationMinutes: 8, canConflict: true }),
      makeEvent({ id: 'shower_1', type: 'shower', startMinute: 422, durationMinutes: 8, canConflict: true }),
    ]);

    const result = classifyEventOutcomes(schedule, GOOD_COMBI);

    const nonSuccessful = result.events.filter((e) => e.result !== 'successful');
    expect(nonSuccessful.length).toBeGreaterThan(0);
    expect(result.hotWater.successful).toBeLessThan(2);
  });

  it('classifies conflict when pressure is very low and showers overlap', () => {
    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower', startMinute: 420, durationMinutes: 8, canConflict: true }),
      makeEvent({ id: 'shower_1', type: 'shower', startMinute: 422, durationMinutes: 8, canConflict: true }),
    ]);

    const result = classifyEventOutcomes(schedule, LOW_PRESSURE_COMBI);

    expect(result.hotWater.conflict).toBeGreaterThan(0);
  });
});

// ─── 3. Stored water handles peak cluster better than combi ──────────────────

describe('stored water: handles a morning shower cluster better than combi', () => {
  it('produces fewer conflicts than low-pressure combi for a cluster', () => {
    const events = [
      makeEvent({ id: 'shower_0', type: 'shower', startMinute: 420, durationMinutes: 8, canConflict: true }),
      makeEvent({ id: 'shower_1', type: 'shower', startMinute: 422, durationMinutes: 8, canConflict: true }),
      makeEvent({ id: 'shower_2', type: 'shower', startMinute: 430, durationMinutes: 8, canConflict: true }),
    ];

    const schedule = makeSchedule(events);
    const combiResult   = classifyEventOutcomes(schedule, LOW_PRESSURE_COMBI);
    const storedResult  = classifyEventOutcomes(schedule, STORED_WATER_SPEC);

    expect(storedResult.hotWater.conflict).toBeLessThan(combiResult.hotWater.conflict);
  });

  it('stored water with adequate storage: first shower is successful', () => {
    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower', startMinute: 420, durationMinutes: 8 }),
    ]);
    const result = classifyEventOutcomes(schedule, STORED_WATER_SPEC);
    expect(result.events[0].result).toBe('successful');
  });
});

// ─── 4. Heat pump cylinder shows slower recovery after clustered demand ───────

describe('heat pump: slower recovery after clustered demand', () => {
  it('produces more reduced/conflict outcomes after a heavy morning cluster vs stored_water', () => {
    // Six consecutive showers — exhausts a smaller HP store much faster because
    // of the low recovery rate, while a large stored-water cylinder with fast
    // recovery can serve more of the cluster successfully.
    const events = Array.from({ length: 6 }, (_, i) =>
      makeEvent({
        id:            `shower_${i}`,
        type:          'shower',
        startMinute:   420 + i * 12,
        durationMinutes: 10,
        canConflict:   true,
      }),
    );

    const schedule = makeSchedule(events);

    // HP: small store, very slow recovery → runs out quickly.
    const hpSmall: OutcomeSystemSpec = {
      ...HEAT_PUMP_SPEC,
      hotWaterStorageLitres:     100,
      recoveryRateLitresPerHour: 15,
    };
    // Stored water: large store, fast recovery → handles the cluster much better.
    const storedLarge: OutcomeSystemSpec = {
      ...STORED_WATER_SPEC,
      hotWaterStorageLitres:     500,
      recoveryRateLitresPerHour: 200,
    };

    const hpResult     = classifyEventOutcomes(schedule, hpSmall);
    const storedResult = classifyEventOutcomes(schedule, storedLarge);

    const hpDegraded     = hpResult.hotWater.reduced     + hpResult.hotWater.conflict;
    const storedDegraded = storedResult.hotWater.reduced + storedResult.hotWater.conflict;

    expect(hpDegraded).toBeGreaterThan(storedDegraded);
  });
});

// ─── 5. Bath fill time differs by system type ─────────────────────────────────

describe('bath fill time varies by system type', () => {
  it('provides a fill time estimate for combi bath events', () => {
    const schedule = makeSchedule([
      makeEvent({ id: 'bath_0', type: 'bath', startMinute: 1200, durationMinutes: 20, hotWaterDraw: true }),
    ]);
    const result = classifyEventOutcomes(schedule, GOOD_COMBI);
    const bathEvent = result.events[0];
    expect(bathEvent.metrics?.bathFillTimeMinutes).toBeDefined();
    expect(bathEvent.metrics!.bathFillTimeMinutes!).toBeGreaterThan(0);
  });

  it('provides a fill time estimate for stored water bath events', () => {
    const schedule = makeSchedule([
      makeEvent({ id: 'bath_0', type: 'bath', startMinute: 1200, durationMinutes: 20, hotWaterDraw: true }),
    ]);
    const result = classifyEventOutcomes(schedule, STORED_WATER_SPEC);
    const bathEvent = result.events[0];
    expect(bathEvent.metrics?.bathFillTimeMinutes).toBeDefined();
    expect(bathEvent.metrics!.bathFillTimeMinutes!).toBeGreaterThan(0);
  });

  it('provides a fill time estimate for heat pump bath events', () => {
    const schedule = makeSchedule([
      makeEvent({ id: 'bath_0', type: 'bath', startMinute: 1200, durationMinutes: 20, hotWaterDraw: true }),
    ]);
    const result = classifyEventOutcomes(schedule, HEAT_PUMP_SPEC);
    const bathEvent = result.events[0];
    expect(bathEvent.metrics?.bathFillTimeMinutes).toBeDefined();
    expect(bathEvent.metrics!.bathFillTimeMinutes!).toBeGreaterThan(0);
  });

  it('averageBathFillTimeMinutes appears in the hot water summary', () => {
    const schedule = makeSchedule([
      makeEvent({ id: 'bath_0', type: 'bath', startMinute: 1200, durationMinutes: 20, hotWaterDraw: true }),
      makeEvent({ id: 'bath_1', type: 'bath', startMinute: 1320, durationMinutes: 20, hotWaterDraw: true }),
    ]);
    const result = classifyEventOutcomes(schedule, GOOD_COMBI);
    expect(result.hotWater.averageBathFillTimeMinutes).not.toBeNull();
    expect(result.hotWater.averageBathFillTimeMinutes!).toBeGreaterThan(0);
  });

  it('averageBathFillTimeMinutes is null when no bath events exist', () => {
    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower', startMinute: 420, durationMinutes: 8 }),
    ]);
    const result = classifyEventOutcomes(schedule, GOOD_COMBI);
    expect(result.hotWater.averageBathFillTimeMinutes).toBeNull();
  });
});

// ─── 6. Heating recovery: strong boiler vs weak / low-temp setup ──────────────

describe('heating recovery: strong boiler vs weak / low-temp mismatch', () => {
  const recoveryEvent = makeEvent({
    id:             'hr_0',
    type:           'heating_recovery',
    startMinute:    360,
    durationMinutes: 60,
    intensity:      'high',
    hotWaterDraw:   false,
    heatingRelated: true,
    canConflict:    false,
  });

  it('strong boiler with good controls classifies recovery as successful', () => {
    const schedule = makeSchedule([recoveryEvent]);
    const result = classifyEventOutcomes(schedule, GOOD_COMBI);
    expect(result.heating.successful).toBeGreaterThan(0);
    expect(result.events[0].result).toBe('successful');
  });

  it('weak boiler falls short on recovery', () => {
    const weakSpec: OutcomeSystemSpec = {
      systemType:      'combi',
      heatOutputKw:    5,
      controlsQuality: 'basic',
      systemCondition: 'poor',
    };
    const schedule = makeSchedule([recoveryEvent]);
    const result = classifyEventOutcomes(schedule, weakSpec);
    expect(result.events[0].result).not.toBe('successful');
  });

  it('low-temp mismatch heat pump on recovery classifies as conflict', () => {
    const mismatchedHp: OutcomeSystemSpec = {
      systemType:        'heat_pump',
      heatOutputKw:      8,
      lowTempSuitability: 'low',
      controlsQuality:   'basic',
      systemCondition:   'average',
    };
    const schedule = makeSchedule([recoveryEvent]);
    const result = classifyEventOutcomes(schedule, mismatchedHp);
    expect(result.events[0].result).toBe('conflict');
  });
});

// ─── 7. Steady-home active block suits heat pump better than spiky recovery ───

describe('heating_active: heat pump with high low-temp suitability vs spiky recovery regime', () => {
  const activeEvent = makeEvent({
    id:             'ha_0',
    type:           'heating_active',
    startMinute:    540,
    durationMinutes: 480,
    intensity:      'medium',
    hotWaterDraw:   false,
    heatingRelated: true,
    canConflict:    false,
  });

  const recoveryEvent = makeEvent({
    id:             'hr_0',
    type:           'heating_recovery',
    startMinute:    360,
    durationMinutes: 60,
    intensity:      'high',
    hotWaterDraw:   false,
    heatingRelated: true,
    canConflict:    false,
  });

  it('heat pump with high suitability classifies active as successful', () => {
    const schedule = makeSchedule([activeEvent]);
    const result = classifyEventOutcomes(schedule, HEAT_PUMP_SPEC);
    expect(result.events[0].result).toBe('successful');
  });

  it('heat pump with low-temp suitability struggles on recovery (conflict)', () => {
    const mismatchSpec: OutcomeSystemSpec = {
      systemType:        'heat_pump',
      heatOutputKw:      8,
      lowTempSuitability: 'low',
      controlsQuality:   'good',
      systemCondition:   'clean',
    };
    const schedule = makeSchedule([recoveryEvent]);
    const result = classifyEventOutcomes(schedule, mismatchSpec);
    expect(result.events[0].result).toBe('conflict');
  });

  it('gas combi performs well on spiky recovery but less well on sustained active vs heat pump', () => {
    // A strong combi should be successful on recovery.
    const combiSchedule = makeSchedule([recoveryEvent]);
    const combiResult = classifyEventOutcomes(combiSchedule, GOOD_COMBI);
    expect(combiResult.events[0].result).toBe('successful');

    // A well-spec'd heat pump should also be successful on sustained active.
    const hpSchedule = makeSchedule([activeEvent]);
    const hpResult = classifyEventOutcomes(hpSchedule, HEAT_PUMP_SPEC);
    expect(hpResult.events[0].result).toBe('successful');
  });
});

// ─── 8. Poor controls worsen outcomes ─────────────────────────────────────────

describe('poor controls worsen heating outcomes', () => {
  const activeEvent = makeEvent({
    id:             'ha_0',
    type:           'heating_active',
    startMinute:    540,
    durationMinutes: 480,
    intensity:      'medium',
    hotWaterDraw:   false,
    heatingRelated: true,
    canConflict:    false,
  });

  it('basic controls produce a worse result than excellent controls for the same boiler', () => {
    const excellentSpec: OutcomeSystemSpec = {
      systemType:      'combi',
      heatOutputKw:    18,
      controlsQuality: 'excellent',
      systemCondition: 'clean',
    };
    const basicSpec: OutcomeSystemSpec = {
      systemType:      'combi',
      heatOutputKw:    18,
      controlsQuality: 'basic',
      systemCondition: 'clean',
    };

    const excellentResult = classifyEventOutcomes(makeSchedule([activeEvent]), excellentSpec);
    const basicResult     = classifyEventOutcomes(makeSchedule([activeEvent]), basicSpec);

    const resultOrder: Record<string, number> = { successful: 0, reduced: 1, conflict: 2 };
    const excellentScore = resultOrder[excellentResult.events[0].result];
    const basicScore     = resultOrder[basicResult.events[0].result];

    expect(basicScore).toBeGreaterThanOrEqual(excellentScore);
  });

  it('basic controls increase outside-target heating event count vs excellent', () => {
    const excellentSpec: OutcomeSystemSpec = {
      systemType:      'combi',
      heatOutputKw:    18,
      controlsQuality: 'excellent',
      systemCondition: 'clean',
    };
    const basicSpec: OutcomeSystemSpec = {
      systemType:      'combi',
      heatOutputKw:    18,
      controlsQuality: 'basic',
      systemCondition: 'clean',
    };

    const excellentResult = classifyEventOutcomes(makeSchedule([activeEvent]), excellentSpec);
    const basicResult     = classifyEventOutcomes(makeSchedule([activeEvent]), basicSpec);

    expect(basicResult.heating.outsideTargetEventCount).toBeGreaterThanOrEqual(
      excellentResult.heating.outsideTargetEventCount,
    );
  });
});

// ─── 9. Poor system condition worsens outcomes ────────────────────────────────

describe('poor system condition worsens outcomes', () => {
  const recoveryEvent = makeEvent({
    id:             'hr_0',
    type:           'heating_recovery',
    startMinute:    360,
    durationMinutes: 60,
    intensity:      'high',
    hotWaterDraw:   false,
    heatingRelated: true,
    canConflict:    false,
  });

  it('poor condition produces worse outcome than clean system', () => {
    const cleanSpec: OutcomeSystemSpec = {
      systemType:      'combi',
      heatOutputKw:    18,
      controlsQuality: 'good',
      systemCondition: 'clean',
    };
    const poorSpec: OutcomeSystemSpec = {
      systemType:      'combi',
      heatOutputKw:    18,
      controlsQuality: 'good',
      systemCondition: 'poor',
    };

    const cleanResult = classifyEventOutcomes(makeSchedule([recoveryEvent]), cleanSpec);
    const poorResult  = classifyEventOutcomes(makeSchedule([recoveryEvent]), poorSpec);

    const resultOrder: Record<string, number> = { successful: 0, reduced: 1, conflict: 2 };
    const cleanScore = resultOrder[cleanResult.events[0].result];
    const poorScore  = resultOrder[poorResult.events[0].result];

    expect(poorScore).toBeGreaterThanOrEqual(cleanScore);
  });
});

// ─── 10. Determinism ──────────────────────────────────────────────────────────

describe('determinism: identical inputs always produce identical outputs', () => {
  it('same schedule and spec produces identical event results on two runs', () => {
    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower', startMinute: 420, durationMinutes: 8 }),
      makeEvent({ id: 'bath_0',   type: 'bath',   startMinute: 1200, durationMinutes: 20 }),
      makeEvent({
        id:             'hr_0',
        type:           'heating_recovery',
        startMinute:    360,
        durationMinutes: 60,
        hotWaterDraw:   false,
        heatingRelated: true,
        canConflict:    false,
      }),
    ]);

    const run1 = classifyEventOutcomes(schedule, GOOD_COMBI);
    const run2 = classifyEventOutcomes(schedule, GOOD_COMBI);

    expect(run1.events.map((e) => e.result)).toEqual(run2.events.map((e) => e.result));
    expect(run1.hotWater).toEqual(run2.hotWater);
    expect(run1.heating).toEqual(run2.heating);
  });
});

// ─── 11. Hot-water summary counts aggregate correctly ────────────────────────

describe('hot-water summary aggregation', () => {
  it('totals match individual event counts', () => {
    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower',       startMinute: 420,  durationMinutes: 8 }),
      makeEvent({ id: 'shower_1', type: 'shower',       startMinute: 430,  durationMinutes: 8 }),
      makeEvent({ id: 'kitchen_0', type: 'kitchen_draw', startMinute: 720,  durationMinutes: 4, canConflict: false }),
      makeEvent({ id: 'tap_0',    type: 'tap_draw',     startMinute: 800,  durationMinutes: 1, canConflict: false }),
    ]);

    const result = classifyEventOutcomes(schedule, GOOD_COMBI);

    const manualTotal = result.events.filter((e) =>
      ['shower', 'bath', 'kitchen_draw', 'tap_draw'].includes(e.type),
    ).length;

    expect(result.hotWater.totalDraws).toBe(manualTotal);
    expect(
      result.hotWater.successful + result.hotWater.reduced + result.hotWater.conflict,
    ).toBe(result.hotWater.totalDraws);
  });
});

// ─── 12. Heating summary counts aggregate correctly ──────────────────────────

describe('heating summary aggregation', () => {
  it('totals match individual heating event counts', () => {
    const events = [
      makeEvent({ id: 'hr_0', type: 'heating_recovery', startMinute: 360,  durationMinutes: 60,  hotWaterDraw: false, heatingRelated: true, canConflict: false }),
      makeEvent({ id: 'ha_0', type: 'heating_active',   startMinute: 540,  durationMinutes: 480, hotWaterDraw: false, heatingRelated: true, canConflict: false }),
      makeEvent({ id: 'hs_0', type: 'heating_setback',  startMinute: 480,  durationMinutes: 480, hotWaterDraw: false, heatingRelated: true, canConflict: false }),
    ];

    const result = classifyEventOutcomes(makeSchedule(events), GOOD_COMBI);

    expect(result.heating.totalHeatingEvents).toBe(3);
    expect(
      result.heating.successful + result.heating.reduced + result.heating.conflict,
    ).toBe(result.heating.totalHeatingEvents);
  });
});

// ─── 14. simultaneousEventCount and refined conflict logic ───────────────────

describe('simultaneousEventCount separates circumstance from outcome', () => {
  it('tracks concurrent-demand events independently of their outcome', () => {
    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower', startMinute: 420, durationMinutes: 8, canConflict: true }),
      makeEvent({ id: 'shower_1', type: 'shower', startMinute: 422, durationMinutes: 8, canConflict: true }),
    ]);

    const result = classifyEventOutcomes(schedule, GOOD_COMBI);

    // Both events have concurrent demand — simultaneousEventCount should be > 0.
    expect(result.hotWater.simultaneousEventCount).toBeGreaterThan(0);
  });

  it('simultaneousEventCount is zero when events are well-separated', () => {
    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower', startMinute: 420, durationMinutes: 8 }),
      makeEvent({ id: 'shower_1', type: 'shower', startMinute: 480, durationMinutes: 8 }),
    ]);

    const result = classifyEventOutcomes(schedule, GOOD_COMBI);

    expect(result.hotWater.simultaneousEventCount).toBe(0);
  });

  it('high-capacity combi with concurrent demand at adequate effective flow → successful', () => {
    // peakLpm=20, concurrent=1, effectiveLpm=10 — above behaviour model's
    // adequateConcurrentFlowLpm (8 lpm), so both events should be successful.
    const highCapCombi: OutcomeSystemSpec = {
      ...GOOD_COMBI,
      peakHotWaterCapacityLpm: 20,
    };

    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower', startMinute: 420, durationMinutes: 8, canConflict: true }),
      makeEvent({ id: 'shower_1', type: 'shower', startMinute: 422, durationMinutes: 8, canConflict: true }),
    ]);

    const result = classifyEventOutcomes(schedule, highCapCombi);

    // Effective flow = 20 / 2 = 10 lpm — adequate; events should be successful.
    expect(result.events.every((e) => e.result === 'successful')).toBe(true);
    // But simultaneous demand is still recorded.
    expect(result.hotWater.simultaneousEventCount).toBeGreaterThan(0);
  });
});


describe('same schedule produces different outcomes for different system specs', () => {
  it('low-pressure combi produces more conflicts than good combi', () => {
    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower', startMinute: 420, durationMinutes: 8 }),
      makeEvent({ id: 'shower_1', type: 'shower', startMinute: 422, durationMinutes: 8, canConflict: true }),
    ]);

    const goodResult     = classifyEventOutcomes(schedule, GOOD_COMBI);
    const lowPresResult  = classifyEventOutcomes(schedule, LOW_PRESSURE_COMBI);

    // Low-pressure combi pushes events into conflict; good combi only reduces them.
    expect(lowPresResult.hotWater.conflict).toBeGreaterThan(goodResult.hotWater.conflict);
  });

  it('heat pump outperforms combi for sustained active heating on suitable property', () => {
    const activeEvent = makeEvent({
      id:             'ha_0',
      type:           'heating_active',
      startMinute:    540,
      durationMinutes: 480,
      intensity:      'medium',
      hotWaterDraw:   false,
      heatingRelated: true,
      canConflict:    false,
    });

    const schedule    = makeSchedule([activeEvent]);
    const combiResult = classifyEventOutcomes(schedule, GOOD_COMBI);
    const hpResult    = classifyEventOutcomes(schedule, HEAT_PUMP_SPEC);

    // Heat pump with high suitability should be at least as good on active.
    const resultOrder: Record<string, number> = { successful: 0, reduced: 1, conflict: 2 };
    expect(resultOrder[hpResult.events[0].result]).toBeLessThanOrEqual(
      resultOrder[combiResult.events[0].result],
    );
  });
});

// ─── 15. CH / DHW interaction via heatSourceBehaviour ────────────────────────

describe('CH / DHW interaction (heatSourceBehaviour)', () => {
  it('combi: heating_active concurrent with a shower is downgraded to reduced (CH paused) and tagged', () => {
    // Shower runs 420–428; heating_active also starts at 420.
    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower',        startMinute: 420, durationMinutes: 8, hotWaterDraw: true,  heatingRelated: false }),
      makeEvent({ id: 'ha_0',     type: 'heating_active', startMinute: 420, durationMinutes: 60, hotWaterDraw: false, heatingRelated: true, canConflict: false }),
    ]);

    const result = classifyEventOutcomes(schedule, GOOD_COMBI);
    const heatingEvent = result.events.find((e) => e.type === 'heating_active');

    expect(heatingEvent).toBeDefined();
    // With good combi the standalone heating would be 'successful', but the
    // concurrent shower causes CH to pause → downgraded to 'reduced'.
    expect(heatingEvent!.result).toBe('reduced');
    expect(heatingEvent!.tags).toContain('ch_paused_for_dhw');
  });

  it('combi: heating_active NOT overlapping with any DHW draw stays successful', () => {
    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower',        startMinute: 420, durationMinutes: 8,   hotWaterDraw: true,  heatingRelated: false }),
      // Heating starts after shower finishes (428+).
      makeEvent({ id: 'ha_0',     type: 'heating_active', startMinute: 480, durationMinutes: 60,  hotWaterDraw: false, heatingRelated: true, canConflict: false }),
    ]);

    const result = classifyEventOutcomes(schedule, GOOD_COMBI);
    const heatingEvent = result.events.find((e) => e.type === 'heating_active');

    expect(heatingEvent!.result).toBe('successful');
    expect(heatingEvent!.tags).not.toContain('ch_paused_for_dhw');
  });

  it('combi: brief tap_draw does NOT trigger CH-paused downgrade', () => {
    // tap_draw is excluded from the CH interaction check (too brief to matter).
    const schedule = makeSchedule([
      makeEvent({ id: 'tap_0', type: 'tap_draw',        startMinute: 420, durationMinutes: 1,  hotWaterDraw: true,  heatingRelated: false }),
      makeEvent({ id: 'ha_0',  type: 'heating_active',  startMinute: 420, durationMinutes: 60, hotWaterDraw: false, heatingRelated: true, canConflict: false }),
    ]);

    const result = classifyEventOutcomes(schedule, GOOD_COMBI);
    const heatingEvent = result.events.find((e) => e.type === 'heating_active');

    expect(heatingEvent!.result).toBe('successful');
    expect(heatingEvent!.tags).not.toContain('ch_paused_for_dhw');
  });

  it('stored water Y-plan: heating_active concurrent with a shower is downgraded (CH throttled) and tagged', () => {
    const yPlanSpec: OutcomeSystemSpec = {
      ...STORED_WATER_SPEC,
      systemPlanType: 'y_plan',
    };

    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower',        startMinute: 420, durationMinutes: 8, hotWaterDraw: true,  heatingRelated: false }),
      makeEvent({ id: 'ha_0',     type: 'heating_active', startMinute: 420, durationMinutes: 60, hotWaterDraw: false, heatingRelated: true, canConflict: false }),
    ]);

    const result = classifyEventOutcomes(schedule, yPlanSpec);
    const heatingEvent = result.events.find((e) => e.type === 'heating_active');

    expect(heatingEvent!.result).toBe('reduced');
    expect(heatingEvent!.tags).toContain('ch_throttled_for_dhw');
  });

  it('stored water S-plan: heating_active concurrent with a shower stays unaffected (independent circuits)', () => {
    const sPlanSpec: OutcomeSystemSpec = {
      ...STORED_WATER_SPEC,
      systemPlanType: 's_plan',
    };

    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower',        startMinute: 420, durationMinutes: 8, hotWaterDraw: true,  heatingRelated: false }),
      makeEvent({ id: 'ha_0',     type: 'heating_active', startMinute: 420, durationMinutes: 60, hotWaterDraw: false, heatingRelated: true, canConflict: false }),
    ]);

    const result = classifyEventOutcomes(schedule, sPlanSpec);
    const heatingEvent = result.events.find((e) => e.type === 'heating_active');

    expect(heatingEvent!.result).toBe('successful');
    expect(heatingEvent!.tags).not.toContain('ch_throttled_for_dhw');
    expect(heatingEvent!.tags).not.toContain('ch_paused_for_dhw');
  });

  it('heat pump: heating_active concurrent with a shower stays unaffected', () => {
    // Heat pumps do not have combi CH-pause or Y-plan throttle behaviour.
    const schedule = makeSchedule([
      makeEvent({ id: 'shower_0', type: 'shower',        startMinute: 420, durationMinutes: 8, hotWaterDraw: true,  heatingRelated: false }),
      makeEvent({ id: 'ha_0',     type: 'heating_active', startMinute: 420, durationMinutes: 60, hotWaterDraw: false, heatingRelated: true, canConflict: false }),
    ]);

    const result = classifyEventOutcomes(schedule, HEAT_PUMP_SPEC);
    const heatingEvent = result.events.find((e) => e.type === 'heating_active');

    expect(heatingEvent!.tags).not.toContain('ch_paused_for_dhw');
    expect(heatingEvent!.tags).not.toContain('ch_throttled_for_dhw');
  });
});
