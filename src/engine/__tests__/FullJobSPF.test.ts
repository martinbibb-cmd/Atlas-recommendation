import { describe, it, expect } from 'vitest';
import { runFullJobSPF } from '../modules/FullJobSPF';
import type { FullJobSPFInput } from '../schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const fullJobInput: FullJobSPFInput = {
  installationVariant: 'full_job',
  heatLossWatts: 8000,
  annualGasSpendGbp: 1200,
};

const fastFitInput: FullJobSPFInput = {
  installationVariant: 'fast_fit',
  heatLossWatts: 8000,
  annualGasSpendGbp: 1200,
};

describe('FullJobSPF – Full Job variant', () => {
  it('returns designFlowTempC of 35 for full_job', () => {
    const result = runFullJobSPF(fullJobInput);
    expect(result.designFlowTempC).toBe(35);
  });

  it('returns SPF range [3.8, 4.4] for full_job', () => {
    const result = runFullJobSPF(fullJobInput);
    expect(result.spfRange).toEqual([3.8, 4.4]);
  });

  it('SPF midpoint is correct for full_job', () => {
    const result = runFullJobSPF(fullJobInput);
    expect(result.spfMidpoint).toBeCloseTo((3.8 + 4.4) / 2, 2);
  });

  it('spfDeltaVsAlternative is 0 when full_job is already selected', () => {
    const result = runFullJobSPF(fullJobInput);
    expect(result.spfDeltaVsAlternative).toBe(0);
  });

  it('annualSavingGbp is null for full_job (already the best variant)', () => {
    const result = runFullJobSPF(fullJobInput);
    expect(result.annualSavingGbp).toBeNull();
  });
});

describe('FullJobSPF – Fast Fit variant', () => {
  it('returns designFlowTempC of 50 for fast_fit', () => {
    const result = runFullJobSPF(fastFitInput);
    expect(result.designFlowTempC).toBe(50);
  });

  it('returns SPF range [2.9, 3.1] for fast_fit', () => {
    const result = runFullJobSPF(fastFitInput);
    expect(result.spfRange).toEqual([2.9, 3.1]);
  });

  it('SPF midpoint is lower for fast_fit than full_job', () => {
    const fullResult = runFullJobSPF(fullJobInput);
    const fastResult = runFullJobSPF(fastFitInput);
    expect(fastResult.spfMidpoint).toBeLessThan(fullResult.spfMidpoint);
  });

  it('spfDeltaVsAlternative is positive for fast_fit', () => {
    const result = runFullJobSPF(fastFitInput);
    expect(result.spfDeltaVsAlternative).toBeGreaterThan(0);
  });

  it('spfDeltaVsAlternative equals full_job midpoint minus fast_fit midpoint', () => {
    const result = runFullJobSPF(fastFitInput);
    const fullJobMidpoint = (3.8 + 4.4) / 2;
    const fastFitMidpoint = (2.9 + 3.1) / 2;
    expect(result.spfDeltaVsAlternative).toBeCloseTo(fullJobMidpoint - fastFitMidpoint, 2);
  });
});

describe('FullJobSPF – Annual saving', () => {
  it('annualSavingGbp is positive for fast_fit with gas spend provided', () => {
    const result = runFullJobSPF(fastFitInput);
    expect(result.annualSavingGbp).not.toBeNull();
    expect(result.annualSavingGbp!).toBeGreaterThan(0);
  });

  it('annualSavingGbp is null for fast_fit when no gas spend is provided', () => {
    const result = runFullJobSPF({ installationVariant: 'fast_fit', heatLossWatts: 8000 });
    expect(result.annualSavingGbp).toBeNull();
  });

  it('higher gas spend produces a larger annual saving', () => {
    const low = runFullJobSPF({ ...fastFitInput, annualGasSpendGbp: 800 });
    const high = runFullJobSPF({ ...fastFitInput, annualGasSpendGbp: 2000 });
    expect(high.annualSavingGbp!).toBeGreaterThan(low.annualSavingGbp!);
  });
});

describe('FullJobSPF – notes', () => {
  it('includes British Gas "Full Job" language in full_job notes', () => {
    const result = runFullJobSPF(fullJobInput);
    expect(result.notes.some(n => n.includes('Full Job'))).toBe(true);
  });

  it('includes visual trace saving note for full_job when gas spend provided', () => {
    const result = runFullJobSPF(fullJobInput);
    expect(result.notes.some(n => n.includes('Visual Trace'))).toBe(true);
  });

  it('visual trace note is absent for full_job when no gas spend provided', () => {
    const result = runFullJobSPF({ installationVariant: 'full_job', heatLossWatts: 8000 });
    expect(result.notes.some(n => n.includes('Visual Trace'))).toBe(false);
  });

  it('includes Octopus "Cosy" / SPF penalty language in fast_fit notes', () => {
    const result = runFullJobSPF(fastFitInput);
    expect(result.notes.some(n => n.includes('SPF'))).toBe(true);
  });

  it('notes array is non-empty for both variants', () => {
    expect(runFullJobSPF(fullJobInput).notes.length).toBeGreaterThan(0);
    expect(runFullJobSPF(fastFitInput).notes.length).toBeGreaterThan(0);
  });

  it('includes annual saving in notes for fast_fit when gas spend provided', () => {
    const result = runFullJobSPF(fastFitInput);
    expect(result.notes.some(n => n.includes('Annual Saving'))).toBe(true);
  });
});

describe('FullJobSPF – output structure', () => {
  it('installationVariant is echoed back correctly', () => {
    expect(runFullJobSPF(fullJobInput).installationVariant).toBe('full_job');
    expect(runFullJobSPF(fastFitInput).installationVariant).toBe('fast_fit');
  });

  it('spfRange is always a 2-element tuple [min, max]', () => {
    const r1 = runFullJobSPF(fullJobInput);
    const r2 = runFullJobSPF(fastFitInput);
    expect(r1.spfRange).toHaveLength(2);
    expect(r2.spfRange).toHaveLength(2);
    expect(r1.spfRange[0]).toBeLessThan(r1.spfRange[1]);
    expect(r2.spfRange[0]).toBeLessThan(r2.spfRange[1]);
  });
});
