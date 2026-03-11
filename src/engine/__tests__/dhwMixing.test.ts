import { describe, it, expect } from 'vitest';
import {
  computeTapMixing,
  computeUsableVolumeFactor,
  defaultStoreTempForRegime,
  DEFAULT_COLD_WATER_TEMP_C,
  DEFAULT_TAP_TARGET_TEMP_C,
  DEFAULT_STORED_BOILER_STORE_TEMP_C,
  DEFAULT_ASHP_STORE_TEMP_C,
  DEFAULT_MIXED_FLOW_LPM,
  BOILER_CYLINDER_STORE_TEMP_C,
  HEAT_PUMP_CYLINDER_STORE_TEMP_C,
  BOILER_CYLINDER_USABLE_VOLUME_FACTOR,
  HEAT_PUMP_CYLINDER_USABLE_VOLUME_FACTOR,
} from '../utils/dhwMixing';

describe('computeTapMixing — defaults', () => {
  it('applies default cold/tap/flow values when not provided', () => {
    const result = computeTapMixing({ storeTempC: DEFAULT_STORED_BOILER_STORE_TEMP_C });
    expect(result.coldWaterTempC).toBe(DEFAULT_COLD_WATER_TEMP_C);
    expect(result.tapTargetTempC).toBe(DEFAULT_TAP_TARGET_TEMP_C);
    expect(result.mixedFlowLpm).toBe(DEFAULT_MIXED_FLOW_LPM);
  });

  it('exposes the DEFAULT_ASHP_STORE_TEMP_C constant at 50 °C', () => {
    expect(DEFAULT_ASHP_STORE_TEMP_C).toBe(50);
  });

  it('exposes the DEFAULT_STORED_BOILER_STORE_TEMP_C constant at 55 °C', () => {
    expect(DEFAULT_STORED_BOILER_STORE_TEMP_C).toBe(55);
  });
});

describe('computeTapMixing — mixing ratio formula', () => {
  /**
   * Reference numbers from the problem statement:
   *   Ttap = 37 °C, Tcold = 10 °C
   *
   *   Case A — 60 °C store: f_hot = 27/50 = 0.54
   *   Case B — 50 °C store: f_hot = 27/40 = 0.675
   */

  it('Case A: 60 °C store → f_hot ≈ 0.54 (10 L/min, 37 °C tap, 10 °C cold)', () => {
    const result = computeTapMixing({
      storeTempC: 60,
      tapTargetTempC: 37,
      coldWaterTempC: 10,
      mixedFlowLpm: 10,
    });
    expect(result.hotFraction).toBeCloseTo(0.54, 2);
    expect(result.hotLpm).toBeCloseTo(5.4, 1);
    expect(result.coldLpm).toBeCloseTo(4.6, 1);
    expect(result.insufficientStoreTemp).toBe(false);
  });

  it('Case B: 50 °C store → f_hot ≈ 0.675 (10 L/min, 37 °C tap, 10 °C cold)', () => {
    const result = computeTapMixing({
      storeTempC: 50,
      tapTargetTempC: 37,
      coldWaterTempC: 10,
      mixedFlowLpm: 10,
    });
    expect(result.hotFraction).toBeCloseTo(0.675, 3);
    expect(result.hotLpm).toBeCloseTo(6.75, 2);
    expect(result.coldLpm).toBeCloseTo(3.25, 2);
    expect(result.insufficientStoreTemp).toBe(false);
  });

  it('lower store temp → higher hot fraction and higher hot L/min than hotter store', () => {
    const hot60 = computeTapMixing({ storeTempC: 60, tapTargetTempC: 37, coldWaterTempC: 10, mixedFlowLpm: 10 });
    const hot50 = computeTapMixing({ storeTempC: 50, tapTargetTempC: 37, coldWaterTempC: 10, mixedFlowLpm: 10 });
    expect(hot50.hotFraction).toBeGreaterThan(hot60.hotFraction);
    expect(hot50.hotLpm).toBeGreaterThan(hot60.hotLpm);
    expect(hot50.coldLpm).toBeLessThan(hot60.coldLpm);
  });

  it('hotLpm + coldLpm equals mixedFlowLpm', () => {
    const result = computeTapMixing({ storeTempC: 55, tapTargetTempC: 40, coldWaterTempC: 10, mixedFlowLpm: 12 });
    expect(result.hotLpm + result.coldLpm).toBeCloseTo(12, 2);
  });
});

describe('computeTapMixing — kW_tap formula', () => {
  it('kW_tap = 0.0697 × Fmixed × (Ttap − Tcold)', () => {
    const result = computeTapMixing({
      storeTempC: 60,
      tapTargetTempC: 40,
      coldWaterTempC: 10,
      mixedFlowLpm: 10,
    });
    // 0.0697 × 10 × (40 − 10) = 0.0697 × 10 × 30 = 20.91
    expect(result.kwTap).toBeCloseTo(20.91, 2);
  });

  it('kW_tap is the same for 60 °C and 50 °C stores (energy to user is store-independent)', () => {
    const params = { tapTargetTempC: 37, coldWaterTempC: 10, mixedFlowLpm: 10 };
    const r60 = computeTapMixing({ storeTempC: 60, ...params });
    const r50 = computeTapMixing({ storeTempC: 50, ...params });
    expect(r60.kwTap).toBeCloseTo(r50.kwTap, 3);
  });
});

describe('computeTapMixing — edge cases', () => {
  it('storeTempC exactly equal to tapTargetTempC → insufficientStoreTemp, hotFraction = 1', () => {
    const result = computeTapMixing({
      storeTempC: 40,
      tapTargetTempC: 40,
      coldWaterTempC: 10,
      mixedFlowLpm: 10,
    });
    expect(result.insufficientStoreTemp).toBe(true);
    expect(result.hotFraction).toBe(1);
    expect(result.coldLpm).toBeCloseTo(0, 3);
    expect(result.hotLpm).toBeCloseTo(10, 3);
  });

  it('storeTempC below tapTargetTempC → insufficientStoreTemp, hotFraction = 1', () => {
    const result = computeTapMixing({
      storeTempC: 35,
      tapTargetTempC: 40,
      coldWaterTempC: 10,
    });
    expect(result.insufficientStoreTemp).toBe(true);
    expect(result.hotFraction).toBe(1);
  });

  it('hotFraction is clamped to ≤ 1', () => {
    // Negative cold/hot spread — pathological input
    const result = computeTapMixing({
      storeTempC: 60,
      tapTargetTempC: 60,
      coldWaterTempC: 10,
      mixedFlowLpm: 10,
    });
    expect(result.hotFraction).toBeLessThanOrEqual(1);
  });

  it('hotFraction is clamped to ≥ 0', () => {
    const result = computeTapMixing({
      storeTempC: 60,
      tapTargetTempC: 5,  // below cold — unphysical but should not crash
      coldWaterTempC: 10,
      mixedFlowLpm: 10,
    });
    expect(result.hotFraction).toBeGreaterThanOrEqual(0);
  });
});

// ─── Storage regime constants ─────────────────────────────────────────────────

describe('storage regime constants', () => {
  it('BOILER_CYLINDER_STORE_TEMP_C is 60 °C', () => {
    expect(BOILER_CYLINDER_STORE_TEMP_C).toBe(60);
  });

  it('HEAT_PUMP_CYLINDER_STORE_TEMP_C is 50 °C', () => {
    expect(HEAT_PUMP_CYLINDER_STORE_TEMP_C).toBe(50);
  });

  it('BOILER_CYLINDER_USABLE_VOLUME_FACTOR is 1.0', () => {
    expect(BOILER_CYLINDER_USABLE_VOLUME_FACTOR).toBe(1.0);
  });

  it('HEAT_PUMP_CYLINDER_USABLE_VOLUME_FACTOR is 0.75', () => {
    expect(HEAT_PUMP_CYLINDER_USABLE_VOLUME_FACTOR).toBe(0.75);
  });

  it('HP factor is less than boiler factor', () => {
    expect(HEAT_PUMP_CYLINDER_USABLE_VOLUME_FACTOR).toBeLessThan(BOILER_CYLINDER_USABLE_VOLUME_FACTOR);
  });
});

// ─── defaultStoreTempForRegime ────────────────────────────────────────────────

describe('defaultStoreTempForRegime', () => {
  it('returns BOILER_CYLINDER_STORE_TEMP_C for boiler_cylinder', () => {
    expect(defaultStoreTempForRegime('boiler_cylinder')).toBe(BOILER_CYLINDER_STORE_TEMP_C);
  });

  it('returns HEAT_PUMP_CYLINDER_STORE_TEMP_C for heat_pump_cylinder', () => {
    expect(defaultStoreTempForRegime('heat_pump_cylinder')).toBe(HEAT_PUMP_CYLINDER_STORE_TEMP_C);
  });

  it('returns undefined for instantaneous_combi (no cylinder)', () => {
    expect(defaultStoreTempForRegime('instantaneous_combi')).toBeUndefined();
  });
});

// ─── computeUsableVolumeFactor ────────────────────────────────────────────────

describe('computeUsableVolumeFactor', () => {
  /**
   * Reference: 60 °C store, 40 °C tap, 10 °C cold.
   *   usable(60) = (60−10)/(40−10) = 50/30 = 1.667
   *   usable(50) = (50−10)/(40−10) = 40/30 = 1.333
   *   factor(50 vs 60) = 1.333/1.667 ≈ 0.800
   */

  it('factor = 1.0 when storeTempC equals the reference (60 °C)', () => {
    const result = computeUsableVolumeFactor({ storeTempC: 60 });
    expect(result).toBeCloseTo(1.0, 3);
  });

  it('50 °C store → factor ≈ 0.800 relative to 60 °C reference', () => {
    const result = computeUsableVolumeFactor({ storeTempC: 50 });
    expect(result).toBeCloseTo(0.8, 2);
  });

  it('55 °C store → factor between 0.8 and 1.0', () => {
    const result = computeUsableVolumeFactor({ storeTempC: 55 });
    expect(result).toBeGreaterThan(0.8);
    expect(result).toBeLessThan(1.0);
  });

  it('hotter store → higher factor (more usable volume per litre)', () => {
    const f60 = computeUsableVolumeFactor({ storeTempC: 60 });
    const f50 = computeUsableVolumeFactor({ storeTempC: 50 });
    const f70 = computeUsableVolumeFactor({ storeTempC: 70 });
    expect(f70).toBeGreaterThan(f60);
    expect(f60).toBeGreaterThan(f50);
  });

  it('storeTempC ≤ tapTargetTempC → factor = 0 (store cannot reach tap temp)', () => {
    expect(computeUsableVolumeFactor({ storeTempC: 40 })).toBe(0);
    expect(computeUsableVolumeFactor({ storeTempC: 35 })).toBe(0);
  });

  it('respects custom tapTargetTempC and coldWaterTempC', () => {
    // 60 °C store, 37 °C tap, 10 °C cold, 60 °C ref
    // usable(60) = 50/27 = 1.852; factor vs self = 1.0
    const result = computeUsableVolumeFactor({
      storeTempC: 60,
      tapTargetTempC: 37,
      coldWaterTempC: 10,
    });
    expect(result).toBeCloseTo(1.0, 3);
  });

  it('uses custom referenceStoreTempC when provided', () => {
    // Compare 50 °C store relative to 55 °C reference
    // usable(50) = 40/30 = 1.333; usable(55) = 45/30 = 1.5; factor = 1.333/1.5 ≈ 0.889
    const result = computeUsableVolumeFactor({
      storeTempC: 50,
      referenceStoreTempC: 55,
    });
    expect(result).toBeCloseTo(40 / 45, 2);
  });

  it('result is clamped to [0, 2]', () => {
    const result = computeUsableVolumeFactor({ storeTempC: 200 });
    expect(result).toBeLessThanOrEqual(2);
  });
});
