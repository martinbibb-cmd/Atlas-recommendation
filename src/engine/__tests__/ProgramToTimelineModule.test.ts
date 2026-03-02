/**
 * Tests for ProgramToTimelineModule.
 *
 * Verifies that:
 *  - A zero programme produces no events and zero hourly demand.
 *  - Non-zero dhwLpm hours produce sink events.
 *  - Non-zero coldLpm hours produce cold_only events.
 *  - Events span exactly one hour (60 min) per active cell.
 *  - programToHourlyDemandKw sums space-heat and DHW kW correctly.
 *  - dayProgram wired into EngineInputV2_3 propagates to TimelineBuilder output.
 */
import { describe, it, expect } from 'vitest';
import { programToTimelineEvents, programToHourlyDemandKw } from '../modules/ProgramToTimelineModule';
import { runEngine } from '../Engine';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

// ── Minimal base engine input ─────────────────────────────────────────────────

const BASE_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function zeroProgramme() {
  return {
    heatIntent: Array(24).fill(0) as number[],
    dhwLpm:     Array(24).fill(0) as number[],
    coldLpm:    Array(24).fill(0) as number[],
  };
}

// ── programToTimelineEvents ───────────────────────────────────────────────────

describe('programToTimelineEvents', () => {
  it('zero programme produces no events', () => {
    const events = programToTimelineEvents(zeroProgramme());
    expect(events).toHaveLength(0);
  });

  it('non-zero dhwLpm hour produces a sink event', () => {
    const prog = zeroProgramme();
    prog.dhwLpm[7] = 6; // 07:00 high DHW
    const events = programToTimelineEvents(prog);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('sink');
    expect(events[0].startMin).toBe(420); // 7 × 60
    expect(events[0].endMin).toBe(480);   // 8 × 60
    expect(events[0].intensity).toBe('high');
  });

  it('dhwLpm intensity mapping is correct', () => {
    const prog = zeroProgramme();
    prog.dhwLpm[6] = 1;   // low
    prog.dhwLpm[7] = 3;   // med
    prog.dhwLpm[8] = 9;   // high
    const events = programToTimelineEvents(prog);
    expect(events.find(e => e.startMin === 360)?.intensity).toBe('low');
    expect(events.find(e => e.startMin === 420)?.intensity).toBe('med');
    expect(events.find(e => e.startMin === 480)?.intensity).toBe('high');
  });

  it('non-zero coldLpm hour produces a cold_only event', () => {
    const prog = zeroProgramme();
    prog.coldLpm[9] = 3; // 09:00 cold fill
    const events = programToTimelineEvents(prog);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('cold_only');
    expect(events[0].startMin).toBe(540);
    expect(events[0].endMin).toBe(600);
  });

  it('simultaneous dhw + cold in same hour produces two events', () => {
    const prog = zeroProgramme();
    prog.dhwLpm[10] = 3;
    prog.coldLpm[10] = 2;
    const events = programToTimelineEvents(prog);
    expect(events).toHaveLength(2);
    expect(events.some(e => e.kind === 'sink')).toBe(true);
    expect(events.some(e => e.kind === 'cold_only')).toBe(true);
  });

  it('multiple active hours produce one event per active hour', () => {
    const prog = zeroProgramme();
    prog.dhwLpm[7] = 3;
    prog.dhwLpm[19] = 6;
    const events = programToTimelineEvents(prog);
    expect(events).toHaveLength(2);
  });
});

// ── programToHourlyDemandKw ───────────────────────────────────────────────────

describe('programToHourlyDemandKw', () => {
  it('all-zero programme produces 24 zeros', () => {
    const result = programToHourlyDemandKw(zeroProgramme(), 8);
    expect(result).toHaveLength(24);
    expect(result.every(v => v === 0)).toBe(true);
  });

  it('comfort intent produces heatLossKw demand', () => {
    const prog = zeroProgramme();
    prog.heatIntent[12] = 2; // comfort
    const result = programToHourlyDemandKw(prog, 8);
    expect(result[12]).toBeCloseTo(8, 1);
  });

  it('setback intent produces 40 % of heatLossKw', () => {
    const prog = zeroProgramme();
    prog.heatIntent[12] = 1; // setback
    const result = programToHourlyDemandKw(prog, 10);
    expect(result[12]).toBeCloseTo(4, 1); // 40% of 10 kW
  });

  it('DHW demand is added on top of space-heat', () => {
    const prog = zeroProgramme();
    prog.heatIntent[7] = 2; // comfort
    prog.dhwLpm[7] = 6;     // high DHW ~12.6 kW
    const result = programToHourlyDemandKw(prog, 8);
    // 8 kW space-heat + (4.186/60) * 6 * 30 ≈ 8 + 12.56 = 20.56 kW
    expect(result[7]).toBeGreaterThan(8);
    expect(result[7]).toBeCloseTo(8 + (4.186 / 60) * 6 * 30, 2);
  });

  it('returns exactly 24 elements', () => {
    const result = programToHourlyDemandKw(zeroProgramme(), 5);
    expect(result).toHaveLength(24);
  });
});

// ── Engine integration: dayProgram propagates to Timeline24hV1 ────────────────

describe('Engine integration: dayProgram in EngineInputV2_3', () => {
  it('engine runs without error when dayProgram is provided', () => {
    const prog = zeroProgramme();
    prog.dhwLpm[7] = 6;
    prog.dhwLpm[19] = 3;
    prog.heatIntent[8] = 2;
    const input: EngineInputV2_3 = { ...BASE_INPUT, dayProgram: prog };
    expect(() => runEngine(input)).not.toThrow();
  });

  it('timeline24h has events when dayProgram is provided', () => {
    const prog = zeroProgramme();
    prog.dhwLpm[7] = 6;
    const input: EngineInputV2_3 = {
      ...BASE_INPUT,
      dayProgram: prog,
      engineConfig: { timelinePair: ['current', 'on_demand'] },
    };
    const out = runEngine(input);
    const timelineVisual = out.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    expect(timelineVisual).toBeDefined();
    const tl = timelineVisual?.data;
    expect(tl?.events?.length).toBeGreaterThan(0);
  });

  it('dayProgram overrides default events — timeline events differ from default', () => {
    // Default timeline events: 07:00 sink, 19:00 bath, 20:00 dishwasher
    const defaultOut = runEngine({
      ...BASE_INPUT,
      engineConfig: { timelinePair: ['current', 'on_demand'] },
    });
    // Custom programme: single DHW draw at 22:00 only
    const prog = zeroProgramme();
    prog.dhwLpm[22] = 3;
    const customOut = runEngine({
      ...BASE_INPUT,
      dayProgram: prog,
      engineConfig: { timelinePair: ['current', 'on_demand'] },
    });

    const defaultTl = defaultOut.engineOutput.visuals?.find(v => v.type === 'timeline_24h')?.data;
    const customTl  = customOut.engineOutput.visuals?.find(v => v.type === 'timeline_24h')?.data;

    // Default has events at 07:00 (startMin=420); custom should not
    const defaultHasSevenAM = defaultTl?.events?.some((e: { startMin: number }) => e.startMin === 420);
    const customHasSevenAM  = customTl?.events?.some((e: { startMin: number }) => e.startMin === 420);
    expect(defaultHasSevenAM).toBe(true);
    expect(customHasSevenAM).toBe(false);

    // Custom should have an event at 22:00 (startMin=1320)
    const customHas22 = customTl?.events?.some((e: { startMin: number }) => e.startMin === 1320);
    expect(customHas22).toBe(true);
  });
});
