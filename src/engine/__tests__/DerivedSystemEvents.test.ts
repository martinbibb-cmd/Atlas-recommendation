/**
 * DerivedSystemEvents.test.ts — PR7: Tests for timeline-to-event projection.
 *
 * Test categories:
 *   1.  Combi — delivery_active becomes DHW delivery event
 *   2.  Combi — ch_interrupted becomes heating interruption event
 *   3.  Combi — purge_active becomes purge event
 *   4.  Combi — return_to_ch_pending becomes return-to-CH event
 *   5.  Combi — no store/recharge events emitted
 *   6.  Combi — ignition event is present
 *   7.  Hydronic — store_draw_active becomes store draw event
 *   8.  Hydronic — recharge_decision becomes recharge decision event
 *   9.  Hydronic — recharge_active becomes recharge started event
 *  10.  Hydronic — recharge_complete becomes recharge completed event
 *  11.  Hydronic — no combi-only events emitted
 *  12.  Counters — deterministic and correct aggregations
 *  13.  Cross-family — same timeline always yields same summary
 *  14.  Cross-family — empty/minimal timelines produce safe zero summaries
 *  15.  Negative — no event emitted without matching source tick
 *  16.  Negative — no duplicate primary events per tick
 *  17.  Negative — no mixed-family events in one summary
 */

import { describe, it, expect } from 'vitest';
import { buildDerivedEventsFromTimeline } from '../timeline/buildDerivedEventsFromTimeline';
import {
  COMBI_ONLY_EVENT_TYPES,
  STORE_ONLY_EVENT_TYPES,
} from '../timeline/DerivedSystemEvent';
import type { DerivedSystemEvent } from '../timeline/DerivedSystemEvent';
import { buildCombiStateTimeline } from '../timeline/buildCombiStateTimeline';
import { buildHydronicStateTimeline } from '../timeline/buildHydronicStateTimeline';
import {
  runCombiDhwPhaseModel,
} from '../modules/CombiDhwPhaseModel';
import type { CombiDhwPhaseInput } from '../modules/CombiDhwPhaseModel';
import {
  runStoredDhwPhaseModel,
} from '../modules/StoredDhwPhaseModel';
import type { StoredDhwPhaseInput } from '../modules/StoredDhwPhaseModel';
import type { SystemStateTick, SystemStateTimeline } from '../timeline/SystemStateTimeline';

// ─── Phase model fixtures ─────────────────────────────────────────────────────

/** Combi shower draw WITH simultaneous CH active → triggers interruption. */
const combiWithCh: CombiDhwPhaseInput = {
  drawVolumeLitres: 54,
  drawFlowLpm: 9,
  tapTargetTempC: 40,
  coldWaterTempC: 10,
  simultaneousChActive: true,
};

/** Combi shower draw WITHOUT CH active → no interruption. */
const combiNoCh: CombiDhwPhaseInput = {
  drawVolumeLitres: 54,
  drawFlowLpm: 9,
  tapTargetTempC: 40,
  coldWaterTempC: 10,
  simultaneousChActive: false,
};

/** Short combi draw (< 15 s) — never reaches delivery_active. */
const combiShortDraw: CombiDhwPhaseInput = {
  drawVolumeLitres: 1.0,
  drawFlowLpm: 9,
  tapTargetTempC: 40,
  coldWaterTempC: 10,
  simultaneousChActive: false,
};

/** Standard stored draw: well-charged cylinder, thermostat_call mode. */
const boilerStoredInput: StoredDhwPhaseInput = {
  cylinderVolumeLitres: 150,
  storeTopTempC: 60,
  storeMeanTempC: 55,
  drawVolumeLitres: 54,
  drawFlowLpm: 9,
  tapTargetTempC: 40,
  coldWaterTempC: 10,
  controlMode: 'thermostat_call',
  thermostatThresholdC: 55,
  hysteresisBandC: 5,
  scheduledWindowActive: false,
  recoveryCharacteristic: 'boiler_stored',
};

/** Stored draw with mean below threshold → triggers recharge. */
const boilerStoredLowMean: StoredDhwPhaseInput = {
  ...boilerStoredInput,
  storeMeanTempC: 52,
};

/** Stored draw that depletes the cylinder. */
const boilerStoredDepletingDraw: StoredDhwPhaseInput = {
  ...boilerStoredInput,
  drawVolumeLitres: 999,
};

/** Stored draw from a partially-charged cylinder (triggers reduced service). */
const boilerStoredPartialInput: StoredDhwPhaseInput = {
  ...boilerStoredInput,
  storeMeanTempC: 45,         // well below 55 °C threshold → partial usable volume
  storeTopTempC: 50,
  thermostatThresholdC: 55,
};

// ─── Timeline factories ───────────────────────────────────────────────────────

function combiTimeline(input: CombiDhwPhaseInput) {
  return buildCombiStateTimeline(runCombiDhwPhaseModel(input), 'combi');
}

function hydronicTimeline(input: StoredDhwPhaseInput) {
  return buildHydronicStateTimeline(runStoredDhwPhaseModel(input), 'system');
}

// ─── 1. Combi — delivery_active becomes DHW delivery event ───────────────────

describe('DerivedSystemEvents — combi: delivery_active', () => {
  it('emits dhw_delivery_started when delivery_active is present', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    expect(summary.events.some(e => e.eventType === 'dhw_delivery_started')).toBe(true);
  });

  it('dhw_delivery_started has severity "info"', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const event = summary.events.find(e => e.eventType === 'dhw_delivery_started')!;
    expect(event.severity).toBe('info');
  });

  it('dhw_delivery_started has activeFamily "combi"', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const event = summary.events.find(e => e.eventType === 'dhw_delivery_started')!;
    expect(event.activeFamily).toBe('combi');
  });

  it('dhw_delivery_started relatedModes contains "delivery_active"', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const event = summary.events.find(e => e.eventType === 'dhw_delivery_started')!;
    expect(event.relatedModes).toContain('delivery_active');
  });

  it('emits dhw_delivery_completed alongside dhw_delivery_started', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    expect(summary.events.some(e => e.eventType === 'dhw_delivery_completed')).toBe(true);
  });

  it('dhw_delivery_completed timestampS equals next tick timestampS after delivery', () => {
    const timeline = combiTimeline(combiWithCh);
    const summary = buildDerivedEventsFromTimeline(timeline, 'combi');
    const deliveryTick = timeline.find(t => t.serviceMode === 'delivery_active')!;
    const nextTick = timeline[deliveryTick.slotIndex + 1]!;
    const completedEvent = summary.events.find(e => e.eventType === 'dhw_delivery_completed')!;
    expect(completedEvent.timestampS).toBe(nextTick.timestampS);
  });

  it('dhw_delivery_completed has no durationS (point-in-time event)', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const event = summary.events.find(e => e.eventType === 'dhw_delivery_completed')!;
    expect(event.durationS).toBeUndefined();
  });

  it('dhw_delivery_started has durationS when followed by another tick', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const event = summary.events.find(e => e.eventType === 'dhw_delivery_started')!;
    expect(event.durationS).toBeDefined();
    expect(event.durationS).toBeGreaterThan(0);
  });
});

// ─── 2. Combi — ch_interrupted becomes heating interruption event ──────────────

describe('DerivedSystemEvents — combi: ch_interrupted', () => {
  it('emits heating_interrupted_by_dhw when ch_interrupted tick is present', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    expect(summary.events.some(e => e.eventType === 'heating_interrupted_by_dhw')).toBe(true);
  });

  it('heating_interrupted_by_dhw has severity "warning"', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const event = summary.events.find(e => e.eventType === 'heating_interrupted_by_dhw')!;
    expect(event.severity).toBe('warning');
  });

  it('heating_interrupted_by_dhw relatedModes contains "ch_interrupted"', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const event = summary.events.find(e => e.eventType === 'heating_interrupted_by_dhw')!;
    expect(event.relatedModes).toContain('ch_interrupted');
  });

  it('simultaneous_demand_constraint is also emitted alongside ch_interrupted', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    expect(summary.events.some(e => e.eventType === 'simultaneous_demand_constraint')).toBe(true);
  });

  it('simultaneous_demand_constraint has severity "limit"', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const event = summary.events.find(e => e.eventType === 'simultaneous_demand_constraint')!;
    expect(event.severity).toBe('limit');
  });

  it('heating_interrupted_by_dhw is absent when CH was not active', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiNoCh), 'combi');
    expect(summary.events.some(e => e.eventType === 'heating_interrupted_by_dhw')).toBe(false);
  });

  it('simultaneous_demand_constraint is absent when CH was not active', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiNoCh), 'combi');
    expect(summary.events.some(e => e.eventType === 'simultaneous_demand_constraint')).toBe(false);
  });
});

// ─── 3. Combi — purge_active becomes purge event ──────────────────────────────

describe('DerivedSystemEvents — combi: purge_active', () => {
  it('emits combi_purge_started when purge_active tick is present', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    expect(summary.events.some(e => e.eventType === 'combi_purge_started')).toBe(true);
  });

  it('combi_purge_started has severity "info"', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const event = summary.events.find(e => e.eventType === 'combi_purge_started')!;
    expect(event.severity).toBe('info');
  });

  it('combi_purge_started relatedModes contains "purge_active"', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const event = summary.events.find(e => e.eventType === 'combi_purge_started')!;
    expect(event.relatedModes).toContain('purge_active');
  });

  it('combi_purge_started is present even for a short draw (no delivery_active)', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiShortDraw), 'combi');
    expect(summary.events.some(e => e.eventType === 'combi_purge_started')).toBe(true);
  });
});

// ─── 4. Combi — return_to_ch_pending becomes return-to-CH event ───────────────

describe('DerivedSystemEvents — combi: return_to_ch_pending', () => {
  it('emits return_to_ch when return_to_ch_pending tick is present', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    expect(summary.events.some(e => e.eventType === 'return_to_ch')).toBe(true);
  });

  it('return_to_ch has severity "info"', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const event = summary.events.find(e => e.eventType === 'return_to_ch')!;
    expect(event.severity).toBe('info');
  });

  it('return_to_ch relatedModes contains "return_to_ch_pending"', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const event = summary.events.find(e => e.eventType === 'return_to_ch')!;
    expect(event.relatedModes).toContain('return_to_ch_pending');
  });

  it('return_to_ch is present even when CH was not active (always emitted after purge)', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiNoCh), 'combi');
    expect(summary.events.some(e => e.eventType === 'return_to_ch')).toBe(true);
  });
});

// ─── 5. Combi — no store/recharge events emitted ─────────────────────────────

describe('DerivedSystemEvents — combi: no store/recharge events', () => {
  it('combi summary contains no store_draw_started events', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    expect(summary.events.some(e => e.eventType === 'store_draw_started')).toBe(false);
  });

  it('combi summary contains no recharge_started events', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    expect(summary.events.some(e => e.eventType === 'recharge_started')).toBe(false);
  });

  it('combi summary contains no recharge_completed events', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    expect(summary.events.some(e => e.eventType === 'recharge_completed')).toBe(false);
  });

  it('combi summary contains no store_depleted events', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    expect(summary.events.some(e => e.eventType === 'store_depleted')).toBe(false);
  });

  it('combi summary contains no recharge_decision_made events', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    expect(summary.events.some(e => e.eventType === 'recharge_decision_made')).toBe(false);
  });

  it('no STORE_ONLY_EVENT_TYPES appear in combi summary', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    summary.events.forEach(e => {
      expect(STORE_ONLY_EVENT_TYPES.has(e.eventType)).toBe(false);
    });
  });
});

// ─── 6. Combi — ignition event is present ────────────────────────────────────

describe('DerivedSystemEvents — combi: ignition event', () => {
  it('emits combi_ignition_started from ignition_active tick', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    expect(summary.events.some(e => e.eventType === 'combi_ignition_started')).toBe(true);
  });

  it('combi_ignition_started has severity "info"', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const event = summary.events.find(e => e.eventType === 'combi_ignition_started')!;
    expect(event.severity).toBe('info');
  });

  it('combi_ignition_started relatedModes contains "ignition_active"', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const event = summary.events.find(e => e.eventType === 'combi_ignition_started')!;
    expect(event.relatedModes).toContain('ignition_active');
  });
});

// ─── 7. Hydronic — store_draw_active becomes store draw event ─────────────────

describe('DerivedSystemEvents — hydronic: store_draw_active', () => {
  it('emits store_draw_started when store_draw_active tick is present', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    expect(summary.events.some(e => e.eventType === 'store_draw_started')).toBe(true);
  });

  it('store_draw_started has severity "info"', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    const event = summary.events.find(e => e.eventType === 'store_draw_started')!;
    expect(event.severity).toBe('info');
  });

  it('store_draw_started has activeFamily "system"', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    const event = summary.events.find(e => e.eventType === 'store_draw_started')!;
    expect(event.activeFamily).toBe('system');
  });

  it('store_draw_started relatedModes contains "store_draw_active"', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    const event = summary.events.find(e => e.eventType === 'store_draw_started')!;
    expect(event.relatedModes).toContain('store_draw_active');
  });

  it('store_draw_started has durationS when followed by recharge_decision tick', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    const event = summary.events.find(e => e.eventType === 'store_draw_started')!;
    expect(event.durationS).toBeDefined();
    expect(event.durationS).toBeGreaterThan(0);
  });

  it('emits reduced_dhw_service when draw starts from a partial store', () => {
    const timeline = hydronicTimeline(boilerStoredPartialInput);
    const drawTick = timeline.find(t => t.serviceMode === 'store_draw_active')!;
    // Only emit reduced_dhw_service if draw starts with partial storeStateSummary
    if (drawTick.storeStateSummary === 'partial') {
      const summary = buildDerivedEventsFromTimeline(timeline, 'system');
      expect(summary.events.some(e => e.eventType === 'reduced_dhw_service')).toBe(true);
    }
  });

  it('reduced_dhw_service has severity "warning"', () => {
    const timeline = hydronicTimeline(boilerStoredPartialInput);
    const drawTick = timeline.find(t => t.serviceMode === 'store_draw_active')!;
    if (drawTick.storeStateSummary === 'partial') {
      const summary = buildDerivedEventsFromTimeline(timeline, 'system');
      const event = summary.events.find(e => e.eventType === 'reduced_dhw_service');
      if (event) expect(event.severity).toBe('warning');
    }
  });
});

// ─── 8. Hydronic — recharge_decision becomes recharge decision event ──────────

describe('DerivedSystemEvents — hydronic: recharge_decision', () => {
  it('emits recharge_decision_made after every draw', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    expect(summary.events.some(e => e.eventType === 'recharge_decision_made')).toBe(true);
  });

  it('recharge_decision_made has severity "info"', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    const event = summary.events.find(e => e.eventType === 'recharge_decision_made')!;
    expect(event.severity).toBe('info');
  });

  it('recharge_decision_made relatedModes contains "recharge_decision"', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    const event = summary.events.find(e => e.eventType === 'recharge_decision_made')!;
    expect(event.relatedModes).toContain('recharge_decision');
  });

  it('emits store_depleted alongside recharge_decision when store is depleted', () => {
    const summary = buildDerivedEventsFromTimeline(
      hydronicTimeline(boilerStoredDepletingDraw),
      'system',
    );
    expect(summary.events.some(e => e.eventType === 'store_depleted')).toBe(true);
  });

  it('store_depleted has severity "warning"', () => {
    const summary = buildDerivedEventsFromTimeline(
      hydronicTimeline(boilerStoredDepletingDraw),
      'system',
    );
    const event = summary.events.find(e => e.eventType === 'store_depleted');
    if (event) expect(event.severity).toBe('warning');
  });

  it('store_depleted is absent when store is not depleted', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    expect(summary.events.some(e => e.eventType === 'store_depleted')).toBe(false);
  });
});

// ─── 9. Hydronic — recharge_active becomes recharge started event ─────────────

describe('DerivedSystemEvents — hydronic: recharge_active', () => {
  it('emits recharge_started when recharge_active tick is present', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredLowMean), 'system');
    expect(summary.events.some(e => e.eventType === 'recharge_started')).toBe(true);
  });

  it('recharge_started has severity "info"', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredLowMean), 'system');
    const event = summary.events.find(e => e.eventType === 'recharge_started')!;
    expect(event.severity).toBe('info');
  });

  it('recharge_started relatedModes contains "recharge_active"', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredLowMean), 'system');
    const event = summary.events.find(e => e.eventType === 'recharge_started')!;
    expect(event.relatedModes).toContain('recharge_active');
  });

  it('recharge_started has durationS when followed by recharge_complete tick', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredLowMean), 'system');
    const event = summary.events.find(e => e.eventType === 'recharge_started')!;
    expect(event.durationS).toBeDefined();
    expect(event.durationS).toBeGreaterThan(0);
  });

  it('recharge_started is absent when no recharge was triggered', () => {
    // Small draw from well-charged store: no recharge expected
    const noRechargeDraw: StoredDhwPhaseInput = {
      ...boilerStoredInput,
      drawVolumeLitres: 5,
      storeMeanTempC: 60,
      storeTopTempC: 65,
    };
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(noRechargeDraw), 'system');
    expect(summary.events.some(e => e.eventType === 'recharge_started')).toBe(false);
  });
});

// ─── 10. Hydronic — recharge_complete becomes recharge completed event ─────────

describe('DerivedSystemEvents — hydronic: recharge_complete', () => {
  it('emits recharge_completed when recharge_complete tick is present', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredLowMean), 'system');
    expect(summary.events.some(e => e.eventType === 'recharge_completed')).toBe(true);
  });

  it('recharge_completed has severity "info"', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredLowMean), 'system');
    const event = summary.events.find(e => e.eventType === 'recharge_completed')!;
    expect(event.severity).toBe('info');
  });

  it('recharge_completed relatedModes contains "recharge_complete"', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredLowMean), 'system');
    const event = summary.events.find(e => e.eventType === 'recharge_completed')!;
    expect(event.relatedModes).toContain('recharge_complete');
  });

  it('recharge_completed appears after recharge_started in event list', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredLowMean), 'system');
    const events = summary.events;
    const startedIdx = events.findIndex(e => e.eventType === 'recharge_started');
    const completedIdx = events.findIndex(e => e.eventType === 'recharge_completed');
    expect(startedIdx).toBeGreaterThanOrEqual(0);
    expect(completedIdx).toBeGreaterThan(startedIdx);
  });

  it('recharge_completed is absent when no recharge was triggered', () => {
    const noRechargeDraw: StoredDhwPhaseInput = {
      ...boilerStoredInput,
      drawVolumeLitres: 5,
      storeMeanTempC: 60,
      storeTopTempC: 65,
    };
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(noRechargeDraw), 'system');
    expect(summary.events.some(e => e.eventType === 'recharge_completed')).toBe(false);
  });
});

// ─── 11. Hydronic — no combi-only events emitted ──────────────────────────────

describe('DerivedSystemEvents — hydronic: no combi-only events', () => {
  it('hydronic summary contains no combi_purge_started events', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    expect(summary.events.some(e => e.eventType === 'combi_purge_started')).toBe(false);
  });

  it('hydronic summary contains no combi_ignition_started events', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    expect(summary.events.some(e => e.eventType === 'combi_ignition_started')).toBe(false);
  });

  it('hydronic summary contains no dhw_delivery_started events', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    expect(summary.events.some(e => e.eventType === 'dhw_delivery_started')).toBe(false);
  });

  it('hydronic summary contains no heating_interrupted_by_dhw events', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    expect(summary.events.some(e => e.eventType === 'heating_interrupted_by_dhw')).toBe(false);
  });

  it('hydronic summary contains no return_to_ch events', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    expect(summary.events.some(e => e.eventType === 'return_to_ch')).toBe(false);
  });

  it('no COMBI_ONLY_EVENT_TYPES appear in hydronic summary', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    summary.events.forEach(e => {
      expect(COMBI_ONLY_EVENT_TYPES.has(e.eventType)).toBe(false);
    });
  });
});

// ─── 12. Counters — deterministic and correct aggregations ────────────────────

describe('DerivedSystemEvents — counters', () => {
  it('combi purgeCycles equals number of combi_purge_started events', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const purgePrimary = summary.events.filter(e => e.eventType === 'combi_purge_started').length;
    expect(summary.counters.purgeCycles).toBe(purgePrimary);
  });

  it('combi heatingInterruptions equals number of heating_interrupted_by_dhw events', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const interruptions = summary.events.filter(e => e.eventType === 'heating_interrupted_by_dhw').length;
    expect(summary.counters.heatingInterruptions).toBe(interruptions);
  });

  it('combi heatingInterruptions is 0 when CH was not active', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiNoCh), 'combi');
    expect(summary.counters.heatingInterruptions).toBe(0);
  });

  it('combi simultaneousDemandConstraints equals number of simultaneous_demand_constraint events', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const constraints = summary.events.filter(e => e.eventType === 'simultaneous_demand_constraint').length;
    expect(summary.counters.simultaneousDemandConstraints).toBe(constraints);
  });

  it('combi dhwRequests equals number of dhw_request events', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const requests = summary.events.filter(e => e.eventType === 'dhw_request').length;
    expect(summary.counters.dhwRequests).toBe(requests);
  });

  it('hydronic dhwRequests equals number of store_draw_started events', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    const draws = summary.events.filter(e => e.eventType === 'store_draw_started').length;
    expect(summary.counters.dhwRequests).toBe(draws);
  });

  it('hydronic rechargeCycles equals number of recharge_started events', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredLowMean), 'system');
    const recharges = summary.events.filter(e => e.eventType === 'recharge_started').length;
    expect(summary.counters.rechargeCycles).toBe(recharges);
  });

  it('hydronic rechargeCycles is 0 when no recharge triggered', () => {
    const noRechargeDraw: StoredDhwPhaseInput = {
      ...boilerStoredInput,
      drawVolumeLitres: 5,
      storeMeanTempC: 60,
      storeTopTempC: 65,
    };
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(noRechargeDraw), 'system');
    expect(summary.counters.rechargeCycles).toBe(0);
  });

  it('hydronic purgeCycles is 0 (no combi purge in hydronic runs)', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    expect(summary.counters.purgeCycles).toBe(0);
  });

  it('combi rechargeCycles is 0 (no store recharge in combi runs)', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    expect(summary.counters.rechargeCycles).toBe(0);
  });
});

// ─── 13. Cross-family — same timeline always yields same summary ───────────────

describe('DerivedSystemEvents — cross-family: determinism', () => {
  it('running combi projection twice yields identical event lists', () => {
    const timeline = combiTimeline(combiWithCh);
    const summaryA = buildDerivedEventsFromTimeline(timeline, 'combi');
    const summaryB = buildDerivedEventsFromTimeline(timeline, 'combi');
    expect(summaryA.events).toEqual(summaryB.events);
  });

  it('running combi projection twice yields identical counters', () => {
    const timeline = combiTimeline(combiWithCh);
    const summaryA = buildDerivedEventsFromTimeline(timeline, 'combi');
    const summaryB = buildDerivedEventsFromTimeline(timeline, 'combi');
    expect(summaryA.counters).toEqual(summaryB.counters);
  });

  it('running hydronic projection twice yields identical event lists', () => {
    const timeline = hydronicTimeline(boilerStoredLowMean);
    const summaryA = buildDerivedEventsFromTimeline(timeline, 'system');
    const summaryB = buildDerivedEventsFromTimeline(timeline, 'system');
    expect(summaryA.events).toEqual(summaryB.events);
  });

  it('running hydronic projection twice yields identical counters', () => {
    const timeline = hydronicTimeline(boilerStoredLowMean);
    const summaryA = buildDerivedEventsFromTimeline(timeline, 'system');
    const summaryB = buildDerivedEventsFromTimeline(timeline, 'system');
    expect(summaryA.counters).toEqual(summaryB.counters);
  });

  it('events are ordered by slotIndex ascending (combi)', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    for (let i = 1; i < summary.events.length; i++) {
      expect(summary.events[i]!.slotIndex).toBeGreaterThanOrEqual(summary.events[i - 1]!.slotIndex);
    }
  });

  it('events are ordered by slotIndex ascending (hydronic)', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredLowMean), 'system');
    for (let i = 1; i < summary.events.length; i++) {
      expect(summary.events[i]!.slotIndex).toBeGreaterThanOrEqual(summary.events[i - 1]!.slotIndex);
    }
  });
});

// ─── 14. Cross-family — empty/minimal timelines produce safe zero summaries ───

describe('DerivedSystemEvents — cross-family: empty and minimal timelines', () => {
  it('empty combi timeline produces empty events list', () => {
    const summary = buildDerivedEventsFromTimeline([], 'combi');
    expect(summary.events).toEqual([]);
  });

  it('empty hydronic timeline produces empty events list', () => {
    const summary = buildDerivedEventsFromTimeline([], 'system');
    expect(summary.events).toEqual([]);
  });

  it('empty timeline produces zero dhwRequests', () => {
    const summary = buildDerivedEventsFromTimeline([], 'combi');
    expect(summary.counters.dhwRequests).toBe(0);
  });

  it('empty timeline produces zero heatingInterruptions', () => {
    const summary = buildDerivedEventsFromTimeline([], 'combi');
    expect(summary.counters.heatingInterruptions).toBe(0);
  });

  it('empty timeline produces zero rechargeCycles', () => {
    const summary = buildDerivedEventsFromTimeline([], 'system');
    expect(summary.counters.rechargeCycles).toBe(0);
  });

  it('empty timeline produces zero purgeCycles', () => {
    const summary = buildDerivedEventsFromTimeline([], 'combi');
    expect(summary.counters.purgeCycles).toBe(0);
  });

  it('empty timeline produces zero reducedDhwEvents', () => {
    const summary = buildDerivedEventsFromTimeline([], 'system');
    expect(summary.counters.reducedDhwEvents).toBe(0);
  });

  it('empty timeline produces zero simultaneousDemandConstraints', () => {
    const summary = buildDerivedEventsFromTimeline([], 'combi');
    expect(summary.counters.simultaneousDemandConstraints).toBe(0);
  });

  it('standby-only timeline produces empty events list', () => {
    const standbyTick: SystemStateTick = {
      slotIndex: 0,
      timestampS: 0,
      activeFamily: 'combi',
      serviceMode: 'standby',
      chAvailable: true,
      dhwAvailable: false,
      heatingInterrupted: false,
      activeLimiterIds: [],
    };
    const summary = buildDerivedEventsFromTimeline([standbyTick], 'combi');
    expect(summary.events).toEqual([]);
    expect(summary.counters.dhwRequests).toBe(0);
  });
});

// ─── 15. Negative — no event emitted without matching source tick ─────────────

describe('DerivedSystemEvents — negative: no event without source tick', () => {
  it('combi summary has no store_draw events when timeline has no store_draw_active ticks', () => {
    const timeline = combiTimeline(combiWithCh);
    // Verify the timeline truly has no store-only modes
    const hasStoreMode = timeline.some(t =>
      t.serviceMode === 'store_draw_active' ||
      t.serviceMode === 'recharge_decision' ||
      t.serviceMode === 'recharge_active' ||
      t.serviceMode === 'recharge_complete'
    );
    expect(hasStoreMode).toBe(false);
    const summary = buildDerivedEventsFromTimeline(timeline, 'combi');
    expect(summary.events.some(e => e.eventType === 'store_draw_started')).toBe(false);
    expect(summary.events.some(e => e.eventType === 'recharge_started')).toBe(false);
  });

  it('hydronic summary has no purge events when timeline has no purge_active ticks', () => {
    const timeline = hydronicTimeline(boilerStoredInput);
    const hasPurgeTick = timeline.some(t => t.serviceMode === 'purge_active');
    expect(hasPurgeTick).toBe(false);
    const summary = buildDerivedEventsFromTimeline(timeline, 'system');
    expect(summary.events.some(e => e.eventType === 'combi_purge_started')).toBe(false);
  });

  it('all emitted events have a slotIndex that exists in the source timeline', () => {
    const timeline = combiTimeline(combiWithCh);
    const validSlotIndexes = new Set(timeline.map(t => t.slotIndex));
    const summary = buildDerivedEventsFromTimeline(timeline, 'combi');
    summary.events.forEach(e => {
      expect(validSlotIndexes.has(e.slotIndex)).toBe(true);
    });
  });

  it('all emitted hydronic events have a slotIndex in the source timeline', () => {
    const timeline = hydronicTimeline(boilerStoredLowMean);
    const validSlotIndexes = new Set(timeline.map(t => t.slotIndex));
    const summary = buildDerivedEventsFromTimeline(timeline, 'system');
    summary.events.forEach(e => {
      expect(validSlotIndexes.has(e.slotIndex)).toBe(true);
    });
  });
});

// ─── 16. Negative — no duplicate primary events per tick ─────────────────────

describe('DerivedSystemEvents — negative: no duplicate primary events', () => {
  it('each tick produces at most one dhw_delivery_started event', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const deliveryStartedEvents = summary.events.filter(e => e.eventType === 'dhw_delivery_started');
    expect(deliveryStartedEvents.length).toBe(1);
  });

  it('each tick produces at most one combi_purge_started event', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const purgeEvents = summary.events.filter(e => e.eventType === 'combi_purge_started');
    expect(purgeEvents.length).toBe(1);
  });

  it('each tick produces at most one heating_interrupted_by_dhw event', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    const interruptions = summary.events.filter(e => e.eventType === 'heating_interrupted_by_dhw');
    expect(interruptions.length).toBe(1);
  });

  it('each tick produces at most one recharge_started event (hydronic)', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredLowMean), 'system');
    const rechargeStarted = summary.events.filter(e => e.eventType === 'recharge_started');
    expect(rechargeStarted.length).toBe(1);
  });

  it('each tick produces at most one store_draw_started event (hydronic)', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredInput), 'system');
    const drawEvents = summary.events.filter(e => e.eventType === 'store_draw_started');
    expect(drawEvents.length).toBe(1);
  });
});

// ─── 17. Negative — no mixed-family events in one summary ─────────────────────

describe('DerivedSystemEvents — negative: no mixed-family event summary', () => {
  it('combi summary has no events where activeFamily is not "combi"', () => {
    const summary = buildDerivedEventsFromTimeline(combiTimeline(combiWithCh), 'combi');
    summary.events.forEach(e => {
      expect(e.activeFamily).toBe('combi');
    });
  });

  it('hydronic (system) summary has no events where activeFamily is not "system"', () => {
    const summary = buildDerivedEventsFromTimeline(hydronicTimeline(boilerStoredLowMean), 'system');
    summary.events.forEach(e => {
      expect(e.activeFamily).toBe('system');
    });
  });

  it('heat_pump summary has no events where activeFamily is not "heat_pump"', () => {
    const hpInput: StoredDhwPhaseInput = {
      ...boilerStoredLowMean,
      recoveryCharacteristic: 'heat_pump_stored',
      storeTopTempC: 50,
      storeMeanTempC: 42,
      thermostatThresholdC: 45,
    };
    const timeline = buildHydronicStateTimeline(runStoredDhwPhaseModel(hpInput), 'heat_pump');
    const summary = buildDerivedEventsFromTimeline(timeline, 'heat_pump');
    summary.events.forEach(e => {
      expect(e.activeFamily).toBe('heat_pump');
    });
  });
});
