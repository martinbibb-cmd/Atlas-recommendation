/**
 * Tests for DayProfileV1 → timeline pipeline.
 *
 * Verifies:
 *  - dayProfileToTimelineEvents converts DhwEventV1 to Timeline24hEvent correctly.
 *  - dayProfileToHourlyDemandKw computes demand from heatingBands + dhwEvents.
 *  - dayProfile in EngineInputV2_3 routes through the engine and produces timeline output.
 *  - dayProfile takes priority over dayProgram when both are provided.
 *  - Mixergy standing loss is lower than conventional stored.
 */
import { describe, it, expect } from 'vitest';
import {
  dayProfileToTimelineEvents,
  dayProfileToHourlyDemandKw,
} from '../modules/ProgramToTimelineModule';
import type { DayProfileV1 } from '../../contracts/EngineInputV2_3';
import { runEngine } from '../Engine';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import { simulateSystemDay } from '../daypainter/SimulateSystemDay';
import { buildDefaultDayModel } from '../daypainter/BuildDayModel';

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

// ── Empty profile ─────────────────────────────────────────────────────────────

const EMPTY_PROFILE: DayProfileV1 = {
  heatingBands: [],
  dhwHeatBands: [],
  dhwEvents: [],
};

// ── dayProfileToTimelineEvents ────────────────────────────────────────────────

describe('dayProfileToTimelineEvents', () => {
  it('empty dhwEvents produces no timeline events', () => {
    expect(dayProfileToTimelineEvents(EMPTY_PROFILE)).toHaveLength(0);
  });

  it('shower at 07:10 for 10 min creates a sink event spanning startMin–endMin', () => {
    const profile: DayProfileV1 = {
      ...EMPTY_PROFILE,
      dhwEvents: [
        { startMin: 7 * 60 + 10, durationMin: 10, kind: 'taps', profile: 'mixer10' },
      ],
    };
    const events = dayProfileToTimelineEvents(profile);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('sink');
    expect(events[0].startMin).toBe(430);
    expect(events[0].endMin).toBe(440);
  });

  it('rainfall16 profile maps to intensity "high" (≥ 6 L/min)', () => {
    const profile: DayProfileV1 = {
      ...EMPTY_PROFILE,
      dhwEvents: [
        { startMin: 480, durationMin: 5, kind: 'taps', profile: 'rainfall16' },
      ],
    };
    const events = dayProfileToTimelineEvents(profile);
    expect(events[0].intensity).toBe('high');
  });

  it('mixer10 profile maps to intensity "high" (10 L/min ≥ 6)', () => {
    const profile: DayProfileV1 = {
      ...EMPTY_PROFILE,
      dhwEvents: [
        { startMin: 480, durationMin: 5, kind: 'taps', profile: 'mixer10' },
      ],
    };
    const events = dayProfileToTimelineEvents(profile);
    expect(events[0].intensity).toBe('high');
  });

  it('multiple dhwEvents each produce a separate timeline event', () => {
    const profile: DayProfileV1 = {
      ...EMPTY_PROFILE,
      dhwEvents: [
        { startMin: 420, durationMin: 10, kind: 'taps', profile: 'mixer10' },
        { startMin: 1140, durationMin: 15, kind: 'taps', profile: 'mixer12' },
      ],
    };
    const events = dayProfileToTimelineEvents(profile);
    expect(events).toHaveLength(2);
  });
});

// ── dayProfileToHourlyDemandKw ────────────────────────────────────────────────

describe('dayProfileToHourlyDemandKw', () => {
  it('returns exactly 24 values', () => {
    expect(dayProfileToHourlyDemandKw(EMPTY_PROFILE, 8)).toHaveLength(24);
  });

  it('all-zero profile (no bands, no events) produces zero demand', () => {
    const result = dayProfileToHourlyDemandKw(EMPTY_PROFILE, 8);
    result.forEach(v => expect(v).toBe(0));
  });

  it('comfort band covering hour 8 produces full heat-loss demand at that hour', () => {
    const profile: DayProfileV1 = {
      ...EMPTY_PROFILE,
      heatingBands: [{ startMin: 8 * 60, endMin: 9 * 60, targetC: 21 }],
    };
    const result = dayProfileToHourlyDemandKw(profile, 8);
    // Hour 8: all 4 sample points inside the band → fraction ≈ 1.0
    expect(result[8]).toBeCloseTo(8, 1);
  });

  it('DHW event adds heat demand on top of space-heat demand', () => {
    const profile: DayProfileV1 = {
      ...EMPTY_PROFILE,
      heatingBands: [{ startMin: 7 * 60, endMin: 8 * 60, targetC: 21 }],
      dhwEvents: [
        { startMin: 7 * 60 + 10, durationMin: 10, kind: 'taps', profile: 'mixer10' },
      ],
    };
    const result = dayProfileToHourlyDemandKw(profile, 8);
    // Hour 7: 8 kW space-heat + DHW contribution
    expect(result[7]).toBeGreaterThan(8);
  });

  it('rainfall16 event produces higher DHW demand than mixer10 event of same duration', () => {
    const makeProfile = (p: DayProfileV1['dhwEvents'][0]['profile']): DayProfileV1 => ({
      ...EMPTY_PROFILE,
      dhwEvents: [{ startMin: 7 * 60, durationMin: 15, kind: 'taps', profile: p }],
    });
    const rainfallResult = dayProfileToHourlyDemandKw(makeProfile('rainfall16'), 8);
    const mixerResult = dayProfileToHourlyDemandKw(makeProfile('mixer10'), 8);
    expect(rainfallResult[7]).toBeGreaterThan(mixerResult[7]);
  });
});

// ── Engine integration: dayProfile in EngineInputV2_3 ────────────────────────

describe('Engine integration: dayProfile takes priority over dayProgram', () => {
  it('engine runs without error when dayProfile is provided', () => {
    const profile: DayProfileV1 = {
      heatingBands: [{ startMin: 360, endMin: 540, targetC: 21 }],
      dhwHeatBands: [{ startMin: 360, endMin: 480, on: true }],
      dhwEvents: [{ startMin: 430, durationMin: 10, kind: 'taps', profile: 'mixer10' }],
    };
    expect(() => runEngine({ ...BASE_INPUT, dayProfile: profile })).not.toThrow();
  });

  it('dayProfile DHW event at 07:10 creates a timeline event at that time', () => {
    const profile: DayProfileV1 = {
      heatingBands: [],
      dhwHeatBands: [],
      dhwEvents: [{ startMin: 430, durationMin: 10, kind: 'taps', profile: 'mixer10' }],
    };
    const out = runEngine({ ...BASE_INPUT, dayProfile: profile });
    const timelineVisual = out.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    expect(timelineVisual).toBeDefined();
    const tl = timelineVisual?.data;
    expect(tl?.events?.some((e: { startMin: number }) => e.startMin === 430)).toBe(true);
  });

  it('dayProfile takes priority over dayProgram — different event sets produce different timelines', () => {
    // dayProgram has event at 22:00 (1320 min)
    const dayProgram = {
      heatIntent: Array(24).fill(0) as number[],
      dhwLpm: Array(24).fill(0) as number[],
      coldLpm: Array(24).fill(0) as number[],
    };
    dayProgram.dhwLpm[22] = 3;

    // dayProfile has event at 07:10 (430 min) only
    const dayProfile: DayProfileV1 = {
      heatingBands: [],
      dhwHeatBands: [],
      dhwEvents: [{ startMin: 430, durationMin: 10, kind: 'taps', profile: 'mixer10' }],
    };

    const out = runEngine({ ...BASE_INPUT, dayProfile, dayProgram });
    const tl = out.engineOutput.visuals?.find(v => v.type === 'timeline_24h')?.data;

    // dayProfile wins → event at 430 min exists, event at 1320 min does not
    expect(tl?.events?.some((e: { startMin: number }) => e.startMin === 430)).toBe(true);
    expect(tl?.events?.some((e: { startMin: number }) => e.startMin === 1320)).toBe(false);
  });

  it('heatingBands in dayProfile drive demandHeatKw — a full-day band produces non-zero demand', () => {
    const profileWithBands: DayProfileV1 = {
      heatingBands: [{ startMin: 0, endMin: 1440, targetC: 21 }], // all-day comfort band
      dhwHeatBands: [],
      dhwEvents: [],
    };

    const withBands = runEngine({ ...BASE_INPUT, dayProfile: profileWithBands });
    const tlWith = withBands.engineOutput.visuals?.find(v => v.type === 'timeline_24h')?.data;

    // All-day comfort band should produce significant heat demand across all 96 time points
    const maxWithBands = Math.max(0, ...(tlWith?.demandHeatKw ?? []));
    const minWithBands = Math.min(...(tlWith?.demandHeatKw ?? []));

    // All-day comfort band → demand should be non-zero and fairly consistent (no zero hours)
    expect(maxWithBands).toBeGreaterThan(1);   // at least 1 kW from an 8 kW heat-loss house
    expect(minWithBands).toBeGreaterThan(0);   // no zero-demand slots in an all-day band
  });

  it('heatingBands with higher targetC produce higher demandHeatKw than lower targetC', () => {
    const makeProfile = (targetC: number): DayProfileV1 => ({
      heatingBands: [{ startMin: 480, endMin: 540, targetC }], // 08:00–09:00 only
      dhwHeatBands: [],
      dhwEvents: [],
    });

    const outHigh = runEngine({ ...BASE_INPUT, dayProfile: makeProfile(21) });
    const outLow  = runEngine({ ...BASE_INPUT, dayProfile: makeProfile(16) });

    const tlHigh = outHigh.engineOutput.visuals?.find(v => v.type === 'timeline_24h')?.data;
    const tlLow  = outLow.engineOutput.visuals?.find(v => v.type === 'timeline_24h')?.data;

    const peakHigh = Math.max(0, ...(tlHigh?.demandHeatKw ?? []));
    const peakLow  = Math.max(0, ...(tlLow?.demandHeatKw ?? []));

    expect(peakHigh).toBeGreaterThan(peakLow);
  });
});

// ── Mixergy standing loss vs conventional ─────────────────────────────────────

describe('Mixergy standing loss is lower than conventional stored', () => {
  const dayModel = buildDefaultDayModel();
  const params = { dayModel, heatLossWatts: 8000, tauHours: 8 };

  it('mixergy_open_vented has lower total cylinder loss than open_vented', () => {
    const conventional = simulateSystemDay({ ...params, systemType: 'open_vented' });
    const mixergy = simulateSystemDay({ ...params, systemType: 'mixergy_open_vented' });

    const totalConventional = conventional.reduce((s, p) => s + (p.cylinderLossKw ?? 0), 0);
    const totalMixergy = mixergy.reduce((s, p) => s + (p.cylinderLossKw ?? 0), 0);

    expect(totalMixergy).toBeLessThan(totalConventional);
  });

  it('mixergy_unvented has lower total cylinder loss than unvented', () => {
    const conventional = simulateSystemDay({ ...params, systemType: 'unvented' });
    const mixergy = simulateSystemDay({ ...params, systemType: 'mixergy_unvented' });

    const totalConventional = conventional.reduce((s, p) => s + (p.cylinderLossKw ?? 0), 0);
    const totalMixergy = mixergy.reduce((s, p) => s + (p.cylinderLossKw ?? 0), 0);

    expect(totalMixergy).toBeLessThan(totalConventional);
  });

  it('Mixergy standing loss ratio is consistent with the 21% gas saving field data', () => {
    // Mixergy cylinderLossKw = 0.05 vs conventional 0.08 = 37.5% reduction
    // This exceeds the 21% target (which applies to total energy, not just standing loss)
    const conventional = simulateSystemDay({ ...params, systemType: 'open_vented' });
    const mixergy = simulateSystemDay({ ...params, systemType: 'mixergy_open_vented' });

    const avgConventional = conventional.reduce((s, p) => s + (p.cylinderLossKw ?? 0), 0) / conventional.length;
    const avgMixergy = mixergy.reduce((s, p) => s + (p.cylinderLossKw ?? 0), 0) / mixergy.length;

    // Mixergy loss should be > 15% lower than conventional (conservative)
    const reduction = 1 - avgMixergy / avgConventional;
    expect(reduction).toBeGreaterThan(0.15);
  });

  it('combi has zero cylinder standing loss (no cylinder)', () => {
    const combi = simulateSystemDay({ ...params, systemType: 'combi' });
    const totalLoss = combi.reduce((s, p) => s + (p.cylinderLossKw ?? 0), 0);
    expect(totalLoss).toBe(0);
  });
});
