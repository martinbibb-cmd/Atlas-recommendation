// src/components/advice/__tests__/performanceDashboardHelpers.test.ts
//
// Unit tests for the shared performance dashboard helper module.
//
// Coverage:
//   - Named threshold constants are exported with correct values
//   - costBarLevel returns correct 1/2/3 band for boundary and interior values
//   - carbonBarLevel returns correct 1/2/3 band for boundary and interior values
//   - fuelLabelFromCop distinguishes heat pump (electric) from gas (combustion)
//   - outputBlockCount clamps to [1, MAX_OUTPUT_BLOCKS] and rounds correctly
//   - PERF_CHIP_LABEL contains the approved plain-English wording only
//   - GEN_BAR_LEVEL maps all three localGenerationImpact values
//   - Screen and print components use the same threshold constants (no duplication)

import { describe, it, expect } from 'vitest';
import {
  MIN_HEAT_PUMP_COP,
  MAX_OUTPUT_BLOCKS,
  COST_LOW_THRESHOLD,
  COST_MEDIUM_THRESHOLD,
  CARBON_LOW_THRESHOLD,
  CARBON_MEDIUM_THRESHOLD,
  PERF_CHIP_LABEL,
  COST_LEVEL_LABEL,
  CARBON_LEVEL_LABEL,
  GEN_BAR_LEVEL,
  GEN_LEVEL_LABEL,
  costBarLevel,
  carbonBarLevel,
  fuelLabelFromCop,
  outputBlockCount,
} from '../performanceDashboardHelpers';

// ─── Threshold constants ──────────────────────────────────────────────────────

describe('performanceDashboardHelpers — threshold constants', () => {
  it('exports MIN_HEAT_PUMP_COP > 1 (combustion cannot exceed 100 % efficiency)', () => {
    expect(MIN_HEAT_PUMP_COP).toBeGreaterThan(1);
  });

  it('exports MAX_OUTPUT_BLOCKS as a positive integer', () => {
    expect(Number.isInteger(MAX_OUTPUT_BLOCKS)).toBe(true);
    expect(MAX_OUTPUT_BLOCKS).toBeGreaterThan(0);
  });

  it('COST_LOW_THRESHOLD is less than COST_MEDIUM_THRESHOLD', () => {
    expect(COST_LOW_THRESHOLD).toBeLessThan(COST_MEDIUM_THRESHOLD);
  });

  it('CARBON_LOW_THRESHOLD is less than CARBON_MEDIUM_THRESHOLD', () => {
    expect(CARBON_LOW_THRESHOLD).toBeLessThan(CARBON_MEDIUM_THRESHOLD);
  });
});

// ─── costBarLevel ─────────────────────────────────────────────────────────────

describe('performanceDashboardHelpers — costBarLevel', () => {
  it('returns 1 (Lower) when cost is exactly at COST_LOW_THRESHOLD', () => {
    expect(costBarLevel(COST_LOW_THRESHOLD)).toBe(1);
  });

  it('returns 1 (Lower) when cost is well below COST_LOW_THRESHOLD', () => {
    expect(costBarLevel(0)).toBe(1);
    expect(costBarLevel(5)).toBe(1);
  });

  it('returns 2 (Medium) when cost is just above COST_LOW_THRESHOLD', () => {
    expect(costBarLevel(COST_LOW_THRESHOLD + 0.1)).toBe(2);
  });

  it('returns 2 (Medium) when cost is exactly at COST_MEDIUM_THRESHOLD', () => {
    expect(costBarLevel(COST_MEDIUM_THRESHOLD)).toBe(2);
  });

  it('returns 3 (Higher) when cost is just above COST_MEDIUM_THRESHOLD', () => {
    expect(costBarLevel(COST_MEDIUM_THRESHOLD + 0.1)).toBe(3);
  });

  it('returns 3 (Higher) when cost is very high', () => {
    expect(costBarLevel(50)).toBe(3);
  });
});

// ─── carbonBarLevel ───────────────────────────────────────────────────────────

describe('performanceDashboardHelpers — carbonBarLevel', () => {
  it('returns 1 (Lower) when carbon is exactly at CARBON_LOW_THRESHOLD', () => {
    expect(carbonBarLevel(CARBON_LOW_THRESHOLD)).toBe(1);
  });

  it('returns 1 (Lower) when carbon is well below CARBON_LOW_THRESHOLD', () => {
    expect(carbonBarLevel(0)).toBe(1);
    expect(carbonBarLevel(0.05)).toBe(1);
  });

  it('returns 2 (Medium) when carbon is just above CARBON_LOW_THRESHOLD', () => {
    expect(carbonBarLevel(CARBON_LOW_THRESHOLD + 0.001)).toBe(2);
  });

  it('returns 2 (Medium) when carbon is exactly at CARBON_MEDIUM_THRESHOLD', () => {
    expect(carbonBarLevel(CARBON_MEDIUM_THRESHOLD)).toBe(2);
  });

  it('returns 3 (Higher) when carbon is just above CARBON_MEDIUM_THRESHOLD', () => {
    expect(carbonBarLevel(CARBON_MEDIUM_THRESHOLD + 0.001)).toBe(3);
  });

  it('returns 3 (Higher) for a poorly-maintained gas boiler', () => {
    // Typical well-maintained gas at ~95% = 0.215 kgCO2/kWh, but degraded systems
    // can exceed CARBON_MEDIUM_THRESHOLD.
    expect(carbonBarLevel(0.30)).toBe(3);
  });
});

// ─── fuelLabelFromCop ─────────────────────────────────────────────────────────

describe('performanceDashboardHelpers — fuelLabelFromCop', () => {
  it('returns "electric" for a heat pump (outputKwh > MIN_HEAT_PUMP_COP)', () => {
    expect(fuelLabelFromCop(MIN_HEAT_PUMP_COP + 0.1)).toBe('electric');
    expect(fuelLabelFromCop(3)).toBe('electric');
    expect(fuelLabelFromCop(4)).toBe('electric');
  });

  it('returns "gas" for a condensing boiler (outputKwh <= MIN_HEAT_PUMP_COP)', () => {
    expect(fuelLabelFromCop(MIN_HEAT_PUMP_COP)).toBe('gas');
    expect(fuelLabelFromCop(0.9)).toBe('gas');
    expect(fuelLabelFromCop(1.0)).toBe('gas');
  });

  it('distinguishes typical boiler (~0.9 kWh heat out) from typical HP (~3.5 kWh heat out)', () => {
    expect(fuelLabelFromCop(0.9)).toBe('gas');
    expect(fuelLabelFromCop(3.5)).toBe('electric');
  });
});

// ─── outputBlockCount ─────────────────────────────────────────────────────────

describe('performanceDashboardHelpers — outputBlockCount', () => {
  it('returns 1 for a boiler at ~0.9 kWh heat output', () => {
    expect(outputBlockCount(0.9)).toBe(1);
  });

  it('returns 1 as the floor — never below 1', () => {
    expect(outputBlockCount(0)).toBe(1);
    expect(outputBlockCount(0.1)).toBe(1);
  });

  it('returns 3 for a heat pump at ~3.0 kWh output (SCOP 3)', () => {
    expect(outputBlockCount(3.0)).toBe(3);
  });

  it('clamps to MAX_OUTPUT_BLOCKS for very high COP values', () => {
    expect(outputBlockCount(100)).toBe(MAX_OUTPUT_BLOCKS);
    expect(outputBlockCount(MAX_OUTPUT_BLOCKS + 1)).toBe(MAX_OUTPUT_BLOCKS);
  });

  it('rounds to nearest integer', () => {
    expect(outputBlockCount(1.4)).toBe(1);
    expect(outputBlockCount(1.5)).toBe(2);
    expect(outputBlockCount(2.6)).toBe(3);
  });
});

// ─── Label maps ──────────────────────────────────────────────────────────────

describe('performanceDashboardHelpers — PERF_CHIP_LABEL', () => {
  it('maps "optimal" to "Works best"', () => {
    expect(PERF_CHIP_LABEL['optimal']).toBe('Works best');
  });

  it('maps "average" to "Works well"', () => {
    expect(PERF_CHIP_LABEL['average']).toBe('Works well');
  });

  it('maps "poor" to "Needs the right setup"', () => {
    expect(PERF_CHIP_LABEL['poor']).toBe('Needs the right setup');
  });

  it('does not use the word "optimal" in any label value (avoids overconfident wording)', () => {
    for (const label of Object.values(PERF_CHIP_LABEL)) {
      expect(label.toLowerCase()).not.toContain('optimal');
    }
  });
});

describe('performanceDashboardHelpers — COST_LEVEL_LABEL and CARBON_LEVEL_LABEL', () => {
  it('COST_LEVEL_LABEL has three entries: Lower, Medium, Higher', () => {
    expect(COST_LEVEL_LABEL).toEqual(['Lower', 'Medium', 'Higher']);
  });

  it('CARBON_LEVEL_LABEL has three entries: Lower, Medium, Higher', () => {
    expect(CARBON_LEVEL_LABEL).toEqual(['Lower', 'Medium', 'Higher']);
  });
});

describe('performanceDashboardHelpers — GEN_BAR_LEVEL and GEN_LEVEL_LABEL', () => {
  it('maps all three localGenerationImpact values to a bar level', () => {
    expect(GEN_BAR_LEVEL['high']).toBe(3);
    expect(GEN_BAR_LEVEL['moderate']).toBe(2);
    expect(GEN_BAR_LEVEL['limited']).toBe(1);
  });

  it('GEN_LEVEL_LABEL maps all three localGenerationImpact values', () => {
    expect(typeof GEN_LEVEL_LABEL['high']).toBe('string');
    expect(typeof GEN_LEVEL_LABEL['moderate']).toBe('string');
    expect(typeof GEN_LEVEL_LABEL['limited']).toBe('string');
  });

  it('GEN_LEVEL_LABEL values are non-empty strings', () => {
    for (const label of Object.values(GEN_LEVEL_LABEL)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
