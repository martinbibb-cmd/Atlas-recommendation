import { describe, it, expect } from 'vitest';
import { runAntiLegionellaModule } from '../modules/AntiLegionellaModule';
import type { AntiLegionellaInput } from '../schema/EngineInputV2_3';

const conventionalInput: AntiLegionellaInput = {
  dhwStorageLitres: 150,
  systemType: 'conventional',
  weeklyHighTempCycleEnabled: true,
  highTempCycleTempC: 60,
  nominalSCOP: 3.0,
};

const mixergyInput: AntiLegionellaInput = {
  dhwStorageLitres: 150,
  systemType: 'mixergy',
  weeklyHighTempCycleEnabled: true,
  highTempCycleTempC: 60,
  mixergyStratificationEnabled: true,
  nominalSCOP: 3.0,
};

describe('AntiLegionellaModule', () => {
  it('produces 52 annual cycles for weekly schedule', () => {
    const result = runAntiLegionellaModule(conventionalInput);
    expect(result.annualLegionellaCycles).toBe(52);
  });

  it('produces 0 cycles when weekly cycle is disabled', () => {
    const result = runAntiLegionellaModule({ ...conventionalInput, weeklyHighTempCycleEnabled: false });
    expect(result.annualLegionellaCycles).toBe(0);
    expect(result.annualPenaltyKwh).toBe(0);
  });

  it('effective SCOP is less than nominal when cycles are enabled', () => {
    const result = runAntiLegionellaModule(conventionalInput);
    expect(result.effectiveSCOP).toBeLessThan(conventionalInput.nominalSCOP);
  });

  it('effective SCOP equals nominal when cycles are disabled', () => {
    const result = runAntiLegionellaModule({ ...conventionalInput, weeklyHighTempCycleEnabled: false });
    expect(result.effectiveSCOP).toBeCloseTo(conventionalInput.nominalSCOP, 2);
  });

  it('SCOP penalty percentage is positive when cycles are active', () => {
    const result = runAntiLegionellaModule(conventionalInput);
    expect(result.scopPenaltyPct).toBeGreaterThan(0);
  });

  it('Mixergy stratification uses less energy per cycle than conventional', () => {
    const conventional = runAntiLegionellaModule(conventionalInput);
    const mixergy = runAntiLegionellaModule(mixergyInput);
    expect(mixergy.energyPerCycleKwh).toBeLessThan(conventional.energyPerCycleKwh);
  });

  it('Mixergy annual penalty is less than conventional', () => {
    const conventional = runAntiLegionellaModule(conventionalInput);
    const mixergy = runAntiLegionellaModule(mixergyInput);
    expect(mixergy.annualPenaltyKwh).toBeLessThan(conventional.annualPenaltyKwh);
  });

  it('Mixergy result includes mixergyBenefit object', () => {
    const result = runAntiLegionellaModule(mixergyInput);
    expect(result.mixergyBenefit).toBeDefined();
    expect(result.mixergyBenefit!.safeSterilizationPossible).toBe(true);
  });

  it('conventional result has no mixergyBenefit object', () => {
    const result = runAntiLegionellaModule(conventionalInput);
    expect(result.mixergyBenefit).toBeUndefined();
  });

  it('annual penalty is proportional to volume for conventional systems', () => {
    const small = runAntiLegionellaModule({ ...conventionalInput, dhwStorageLitres: 100 });
    const large = runAntiLegionellaModule({ ...conventionalInput, dhwStorageLitres: 200 });
    expect(large.annualPenaltyKwh).toBeGreaterThan(small.annualPenaltyKwh);
  });

  it('produces notes', () => {
    const result = runAntiLegionellaModule(conventionalInput);
    expect(result.notes.length).toBeGreaterThan(0);
  });
});
