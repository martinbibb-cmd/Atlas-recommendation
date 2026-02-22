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
  it('applies a primary sludge tax for legacy topology without a magnetic filter', () => {
    const result = runSludgeVsScaleModule(legacyNoFilter);
    expect(result.primarySludgeTaxPct).toBeGreaterThanOrEqual(7);
    expect(result.primarySludgeTaxPct).toBeLessThanOrEqual(15);
  });

  it('does not apply a primary sludge tax for two-pipe topology', () => {
    const result = runSludgeVsScaleModule(twoPipeClean);
    expect(result.primarySludgeTaxPct).toBe(0);
  });

  it('does not apply a primary sludge tax when a magnetic filter is present on legacy topology', () => {
    const result = runSludgeVsScaleModule({ ...legacyNoFilter, hasMagneticFilter: true });
    expect(result.primarySludgeTaxPct).toBe(0);
  });

  it('DHW scale penalty is higher in hard water than soft water', () => {
    const hardResult = runSludgeVsScaleModule(legacyNoFilter);
    const softResult = runSludgeVsScaleModule({ ...legacyNoFilter, waterHardnessCategory: 'soft' });
    expect(hardResult.dhwScalePenaltyPct).toBeGreaterThan(softResult.dhwScalePenaltyPct);
  });

  it('applies 11% DHW penalty at exactly 1.6 mm scale threshold', () => {
    // hard water grows ~0.13 mm/year → 1.6 mm at ~12.3 years; use very_hard at 8 years
    // very_hard: 0.20 mm/yr × 8 = 1.6 mm
    const result = runSludgeVsScaleModule({
      ...legacyNoFilter,
      waterHardnessCategory: 'very_hard',
      systemAgeYears: 8,
    });
    expect(result.dhwScalePenaltyPct).toBeGreaterThanOrEqual(11);
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

  it('microbore topology also triggers sludge tax without filter', () => {
    const result = runSludgeVsScaleModule({
      ...legacyNoFilter,
      pipingTopology: 'microbore',
    });
    expect(result.primarySludgeTaxPct).toBeGreaterThan(0);
  });
});
