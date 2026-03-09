import { describe, it, expect } from 'vitest';
import { runCondensingStateModule, CONDENSING_RETURN_THRESHOLD_C } from '../modules/CondensingStateModule';
import type { CondensingStateInput } from '../schema/EngineInputV2_3';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function input(overrides: Partial<CondensingStateInput> & { flowTempC: number }): CondensingStateInput {
  return { deltaTc: 20, ...overrides };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CondensingStateModule — zone classification', () => {
  it('condensing zone when full-load return is below 55 °C (70 °C flow, ΔT 20 °C → return 50 °C)', () => {
    const result = runCondensingStateModule(input({ flowTempC: 70 }));
    expect(result.zone).toBe('condensing');
    expect(result.fullLoadReturnC).toBe(50);
  });

  it('condensing zone for heat-pump full-job flow temperature (37 °C → return 17 °C)', () => {
    const result = runCondensingStateModule(input({ flowTempC: 37 }));
    expect(result.zone).toBe('condensing');
  });

  it('condensing zone for high-temp-retrofit heat-pump flow (50 °C → return 30 °C)', () => {
    const result = runCondensingStateModule(input({ flowTempC: 50 }));
    expect(result.zone).toBe('condensing');
  });

  it('borderline zone when full-load return equals the 55 °C threshold (75 °C flow, ΔT 20 °C → return 55 °C)', () => {
    const result = runCondensingStateModule(input({ flowTempC: 75 }));
    expect(result.zone).toBe('borderline');
    expect(result.fullLoadReturnC).toBe(55);
  });

  it('borderline zone for 80 °C flow (return 60 °C — within 55–65 °C band)', () => {
    const result = runCondensingStateModule(input({ flowTempC: 80 }));
    expect(result.zone).toBe('borderline');
    expect(result.fullLoadReturnC).toBe(60);
  });

  it('borderline zone for 85 °C flow (return 65 °C — upper edge of band)', () => {
    const result = runCondensingStateModule(input({ flowTempC: 85 }));
    expect(result.zone).toBe('borderline');
    expect(result.fullLoadReturnC).toBe(65);
  });

  it('non_condensing zone when full-load return exceeds 65 °C (90 °C flow, ΔT 20 °C → return 70 °C)', () => {
    const result = runCondensingStateModule(input({ flowTempC: 90 }));
    expect(result.zone).toBe('non_condensing');
    expect(result.fullLoadReturnC).toBe(70);
  });

  it('non_condensing zone for a very old high-temp system (100 °C flow → return 80 °C)', () => {
    const result = runCondensingStateModule(input({ flowTempC: 100 }));
    expect(result.zone).toBe('non_condensing');
  });
});

describe('CondensingStateModule — measured return temperature', () => {
  it('uses provided returnTempC instead of estimating from flow − ΔT', () => {
    // 90 °C flow normally gives 70 °C return → non_condensing,
    // but a one-pipe cascade may produce a different measured return.
    const result = runCondensingStateModule(input({ flowTempC: 90, returnTempC: 45 }));
    expect(result.fullLoadReturnC).toBe(45);
    expect(result.zone).toBe('condensing');
  });

  it('reflects measured return in drivers string', () => {
    const result = runCondensingStateModule(input({ flowTempC: 90, returnTempC: 45 }));
    expect(result.drivers.some(d => d.includes('measured/simulated'))).toBe(true);
  });

  it('marks return as estimated when returnTempC is not provided', () => {
    const result = runCondensingStateModule(input({ flowTempC: 70 }));
    expect(result.drivers.some(d => d.includes('estimated'))).toBe(true);
  });
});

describe('CondensingStateModule — estimated condensing fraction', () => {
  it('returns 100 % when flow temperature is at or below the condensing flow threshold (75 °C)', () => {
    const result = runCondensingStateModule(input({ flowTempC: 70 }));
    expect(result.estimatedCondensingFractionPct).toBe(100);
  });

  it('returns 100 % for design flow exactly at the condensing flow threshold (75 °C)', () => {
    const result = runCondensingStateModule(input({ flowTempC: 75 }));
    expect(result.estimatedCondensingFractionPct).toBe(100);
  });

  it('returns a value less than 100 % when flow exceeds the 75 °C condensing threshold', () => {
    const result = runCondensingStateModule(input({ flowTempC: 80 }));
    expect(result.estimatedCondensingFractionPct).toBeLessThan(100);
    expect(result.estimatedCondensingFractionPct).toBeGreaterThan(0);
  });

  it('condensing fraction decreases as flow temperature increases', () => {
    const r80 = runCondensingStateModule(input({ flowTempC: 80 }));
    const r90 = runCondensingStateModule(input({ flowTempC: 90 }));
    expect(r90.estimatedCondensingFractionPct).toBeLessThan(r80.estimatedCondensingFractionPct);
  });

  it('condensing fraction is never negative or above 100 %', () => {
    [37, 50, 70, 75, 80, 90, 100].forEach(flowTempC => {
      const result = runCondensingStateModule(input({ flowTempC }));
      expect(result.estimatedCondensingFractionPct).toBeGreaterThanOrEqual(0);
      expect(result.estimatedCondensingFractionPct).toBeLessThanOrEqual(100);
    });
  });
});

describe('CondensingStateModule — custom ΔT', () => {
  it('uses custom deltaTc to derive return temperature', () => {
    // 75 °C flow with ΔT 25 °C → return 50 °C → condensing (not borderline)
    const result = runCondensingStateModule(input({ flowTempC: 75, deltaTc: 25 }));
    expect(result.fullLoadReturnC).toBe(50);
    expect(result.zone).toBe('condensing');
  });

  it('narrow ΔT (10 °C) makes high-temp systems more likely to be non-condensing', () => {
    // 80 °C flow, ΔT 10 → return 70 °C → non_condensing
    const result = runCondensingStateModule(input({ flowTempC: 80, deltaTc: 10 }));
    expect(result.fullLoadReturnC).toBe(70);
    expect(result.zone).toBe('non_condensing');
  });
});

describe('CondensingStateModule — average load fraction', () => {
  it('accepts an explicit averageLoadFraction override', () => {
    const result = runCondensingStateModule(input({ flowTempC: 80, averageLoadFraction: 0.5 }));
    // typicalFlow = 20 + (80 − 20) × 0.5 = 50 → typicalReturn = 30 °C
    expect(result.typicalReturnC).toBeCloseTo(30, 1);
  });
});

describe('CondensingStateModule — constant values', () => {
  it('CONDENSING_RETURN_THRESHOLD_C is 55 °C', () => {
    expect(CONDENSING_RETURN_THRESHOLD_C).toBe(55);
  });

  it('condensingThresholdC echoed in result is 55 °C', () => {
    const result = runCondensingStateModule(input({ flowTempC: 70 }));
    expect(result.condensingThresholdC).toBe(55);
  });

  it('echoes the provided flowTempC in the result', () => {
    const result = runCondensingStateModule(input({ flowTempC: 73 }));
    expect(result.flowTempC).toBe(73);
  });
});

describe('CondensingStateModule — notes content', () => {
  it('condensing zone note contains ✅', () => {
    const result = runCondensingStateModule(input({ flowTempC: 70 }));
    expect(result.notes.some(n => n.startsWith('✅'))).toBe(true);
  });

  it('borderline zone note contains ⚠️', () => {
    const result = runCondensingStateModule(input({ flowTempC: 80 }));
    expect(result.notes.some(n => n.startsWith('⚠️'))).toBe(true);
  });

  it('non_condensing zone note contains 🚫', () => {
    const result = runCondensingStateModule(input({ flowTempC: 90 }));
    expect(result.notes.some(n => n.startsWith('🚫'))).toBe(true);
  });

  it('notes array is non-empty for all zones', () => {
    [70, 80, 90].forEach(flowTempC => {
      const result = runCondensingStateModule(input({ flowTempC }));
      expect(result.notes.length).toBeGreaterThan(0);
    });
  });

  it('drivers array contains flow temperature entry', () => {
    const result = runCondensingStateModule(input({ flowTempC: 70 }));
    expect(result.drivers.some(d => d.includes('Flow temperature'))).toBe(true);
  });
});
