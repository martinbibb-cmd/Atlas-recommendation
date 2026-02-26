import { describe, it, expect } from 'vitest';
import { runSludgeVsScaleModule } from '../modules/SludgeVsScaleModule';
import type { SludgeVsScaleInput } from '../schema/EngineInputV2_3';

const legacyNoFilter: SludgeVsScaleInput = {
  pipingTopology: 'one_pipe',
  hasMagneticFilter: false,
  waterHardnessCategory: 'hard',
  systemAgeYears: 10,
  annualGasSpendGbp: 1200,
};

const twoPipeClean: SludgeVsScaleInput = {
  pipingTopology: 'two_pipe',
  hasMagneticFilter: true,
  waterHardnessCategory: 'soft',
  systemAgeYears: 3,
};

describe('SludgeVsScaleModule', () => {
  it('applies a flow derate for legacy topology without a magnetic filter', () => {
    const result = runSludgeVsScaleModule(legacyNoFilter);
    expect(result.flowDeratePct).toBeGreaterThan(0);
    expect(result.flowDeratePct).toBeLessThanOrEqual(0.20);
  });

  it('does not apply a flow derate for two-pipe topology', () => {
    const result = runSludgeVsScaleModule(twoPipeClean);
    expect(result.flowDeratePct).toBe(0);
  });

  it('does not apply a flow derate when a magnetic filter is present on legacy topology', () => {
    const result = runSludgeVsScaleModule({ ...legacyNoFilter, hasMagneticFilter: true });
    expect(result.flowDeratePct).toBe(0);
  });

  it('cyclingLossPct is proportional to flowDeratePct (factor 0.25)', () => {
    const result = runSludgeVsScaleModule(legacyNoFilter);
    expect(result.cyclingLossPct).toBeCloseTo(result.flowDeratePct * 0.25, 3);
  });

  it('cyclingLossPct is zero when flowDeratePct is zero', () => {
    const result = runSludgeVsScaleModule(twoPipeClean);
    expect(result.cyclingLossPct).toBe(0);
  });

  it('DHW capacity derate is higher in hard water than soft water', () => {
    const hardResult = runSludgeVsScaleModule(legacyNoFilter);
    const softResult = runSludgeVsScaleModule({ ...legacyNoFilter, waterHardnessCategory: 'soft' });
    expect(hardResult.dhwCapacityDeratePct).toBeGreaterThan(softResult.dhwCapacityDeratePct);
  });

  it('dhwCapacityDeratePct is positive at 1.6 mm scale threshold (very_hard, 8 years)', () => {
    // very_hard: 0.20 mm/yr × 8 = 1.6 mm → dhwCapacityDeratePct = 1.6/3.2×0.20 = 0.10
    const result = runSludgeVsScaleModule({
      ...legacyNoFilter,
      waterHardnessCategory: 'very_hard',
      systemAgeYears: 8,
    });
    expect(result.dhwCapacityDeratePct).toBeGreaterThan(0);
    expect(result.dhwCapacityDeratePct).toBeLessThanOrEqual(0.20);
  });

  it('estimated scale thickness grows with system age', () => {
    const young = runSludgeVsScaleModule({ ...legacyNoFilter, systemAgeYears: 2 });
    const old = runSludgeVsScaleModule({ ...legacyNoFilter, systemAgeYears: 15 });
    expect(old.estimatedScaleThicknessMm).toBeGreaterThan(young.estimatedScaleThicknessMm);
  });

  it('DHW recovery latency increases with scale thickness', () => {
    const young = runSludgeVsScaleModule({ ...legacyNoFilter, systemAgeYears: 2 });
    const old = runSludgeVsScaleModule({ ...legacyNoFilter, systemAgeYears: 15 });
    expect(old.dhwRecoveryLatencyIncreaseSec).toBeGreaterThan(young.dhwRecoveryLatencyIncreaseSec);
  });

  it('calculates non-zero annual cost when gas spend is provided and penalties exist', () => {
    const result = runSludgeVsScaleModule(legacyNoFilter);
    expect(result.primarySludgeCostGbp + result.dhwScaleCostGbp).toBeGreaterThan(0);
  });

  it('annual costs are zero when no gas spend is provided', () => {
    const result = runSludgeVsScaleModule({ ...legacyNoFilter, annualGasSpendGbp: undefined });
    expect(result.primarySludgeCostGbp).toBe(0);
    expect(result.dhwScaleCostGbp).toBe(0);
  });

  it('returns notes array with at least one entry', () => {
    const result = runSludgeVsScaleModule(legacyNoFilter);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it('microbore topology also triggers flow derate without filter', () => {
    const result = runSludgeVsScaleModule({
      ...legacyNoFilter,
      pipingTopology: 'microbore',
    });
    expect(result.flowDeratePct).toBeGreaterThan(0);
  });

  it('flowDeratePct reaches maximum at 15 years on legacy topology', () => {
    const result = runSludgeVsScaleModule({ ...legacyNoFilter, systemAgeYears: 15 });
    expect(result.flowDeratePct).toBeCloseTo(0.20, 2);
  });

  it('flowDeratePct is zero at 0 years', () => {
    const result = runSludgeVsScaleModule({ ...legacyNoFilter, systemAgeYears: 0 });
    expect(result.flowDeratePct).toBe(0);
  });
});
