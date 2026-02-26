import { describe, it, expect } from 'vitest';
import { runHeatPumpRegimeModuleV1 } from '../modules/HeatPumpRegimeModule';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

const baseInput: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
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
  preferCombi: true,
};

describe('HeatPumpRegimeModuleV1', () => {
  it('defaults to 50°C flow and poor SPF when no retrofit input provided', () => {
    const result = runHeatPumpRegimeModuleV1(baseInput);
    expect(result.designFlowTempBand).toBe(50);
    expect(result.spfBand).toBe('poor');
  });

  it('returns 50°C flow and poor SPF when emitterUpgradeAppetite is none', () => {
    const result = runHeatPumpRegimeModuleV1({
      ...baseInput,
      retrofit: { emitterUpgradeAppetite: 'none' },
    });
    expect(result.designFlowTempBand).toBe(50);
    expect(result.spfBand).toBe('poor');
  });

  it('returns 45°C flow and ok SPF when emitterUpgradeAppetite is some', () => {
    const result = runHeatPumpRegimeModuleV1({
      ...baseInput,
      retrofit: { emitterUpgradeAppetite: 'some' },
    });
    expect(result.designFlowTempBand).toBe(45);
    expect(result.spfBand).toBe('ok');
  });

  it('returns 35°C flow and good SPF when emitterUpgradeAppetite is full_job', () => {
    const result = runHeatPumpRegimeModuleV1({
      ...baseInput,
      retrofit: { emitterUpgradeAppetite: 'full_job' },
    });
    expect(result.designFlowTempBand).toBe(35);
    expect(result.spfBand).toBe('good');
  });

  it('emits regime-flow-temp-elevated and regime-cop-penalty flags for none appetite', () => {
    const result = runHeatPumpRegimeModuleV1(baseInput);
    const ids = result.flags.map(f => f.id);
    expect(ids).toContain('regime-flow-temp-elevated');
    expect(ids).toContain('regime-cop-penalty');
  });

  it('emits regime-full-job-unlocks-low-temp info flag for none appetite', () => {
    const result = runHeatPumpRegimeModuleV1(baseInput);
    const ids = result.flags.map(f => f.id);
    expect(ids).toContain('regime-full-job-unlocks-low-temp');
  });

  it('emits regime-cop-penalty and regime-full-job-unlocks-low-temp info flags for some appetite', () => {
    const result = runHeatPumpRegimeModuleV1({
      ...baseInput,
      retrofit: { emitterUpgradeAppetite: 'some' },
    });
    const ids = result.flags.map(f => f.id);
    expect(ids).toContain('regime-cop-penalty');
    expect(ids).toContain('regime-full-job-unlocks-low-temp');
    expect(ids).not.toContain('regime-flow-temp-elevated');
  });

  it('emits no flags for full_job appetite', () => {
    const result = runHeatPumpRegimeModuleV1({
      ...baseInput,
      retrofit: { emitterUpgradeAppetite: 'full_job' },
    });
    expect(result.flags).toHaveLength(0);
  });

  it('includes physics explainer in assumptions', () => {
    const result = runHeatPumpRegimeModuleV1(baseInput);
    expect(result.assumptions.some(a => a.includes('SPF'))).toBe(true);
    expect(result.assumptions.some(a => a.includes('COP'))).toBe(true);
  });

  it('none appetite flags have warn severity for elevated flow and cop penalty', () => {
    const result = runHeatPumpRegimeModuleV1(baseInput);
    const elevatedFlag = result.flags.find(f => f.id === 'regime-flow-temp-elevated');
    const copFlag = result.flags.find(f => f.id === 'regime-cop-penalty');
    expect(elevatedFlag?.severity).toBe('warn');
    expect(copFlag?.severity).toBe('warn');
  });

  it('some appetite cop-penalty flag has info severity', () => {
    const result = runHeatPumpRegimeModuleV1({
      ...baseInput,
      retrofit: { emitterUpgradeAppetite: 'some' },
    });
    const copFlag = result.flags.find(f => f.id === 'regime-cop-penalty');
    expect(copFlag?.severity).toBe('info');
  });
});

// ─── Bilinear COP curve ───────────────────────────────────────────────────────

import { computeAshpCop } from '../modules/HeatPumpRegimeModule';

describe('computeAshpCop – bilinear model', () => {
  it('returns REF_COP ≈ 4.1 at reference conditions (+7°C outdoor, 35°C flow)', () => {
    expect(computeAshpCop(7, 35)).toBeCloseTo(4.1, 1);
  });

  it('COP drops as flow temperature increases (higher flow → worse COP)', () => {
    expect(computeAshpCop(7, 50)).toBeLessThan(computeAshpCop(7, 35));
    expect(computeAshpCop(7, 45)).toBeLessThan(computeAshpCop(7, 35));
  });

  it('COP increases as outdoor temperature rises', () => {
    expect(computeAshpCop(15, 35)).toBeGreaterThan(computeAshpCop(7, 35));
    expect(computeAshpCop(7, 35)).toBeGreaterThan(computeAshpCop(-3, 35));
  });

  it('COP at +7°C outdoor / 50°C flow is approximately 3.05 (fast-fit midpoint)', () => {
    expect(computeAshpCop(7, 50)).toBeCloseTo(3.05, 1);
  });

  it('COP is always within credible physical range [1.5, 5.0]', () => {
    const extremes = [
      computeAshpCop(-10, 70),  // extreme cold + very high flow
      computeAshpCop(20, 20),   // very warm + very low flow
    ];
    extremes.forEach(cop => {
      expect(cop).toBeGreaterThanOrEqual(1.5);
      expect(cop).toBeLessThanOrEqual(5.0);
    });
  });
});

describe('HeatPumpRegimeModuleV1 – bilinear COP estimates', () => {
  it('designCopEstimate is present in the result', () => {
    const result = runHeatPumpRegimeModuleV1(baseInput);
    expect(typeof result.designCopEstimate).toBe('number');
  });

  it('coldMorningCopEstimate is present in the result', () => {
    const result = runHeatPumpRegimeModuleV1(baseInput);
    expect(typeof result.coldMorningCopEstimate).toBe('number');
  });

  it('full_job (35°C) has higher designCopEstimate than fast_fit (50°C)', () => {
    const fullJob = runHeatPumpRegimeModuleV1({
      ...baseInput,
      retrofit: { emitterUpgradeAppetite: 'full_job' },
    });
    const noUpgrade = runHeatPumpRegimeModuleV1({
      ...baseInput,
      retrofit: { emitterUpgradeAppetite: 'none' },
    });
    expect(fullJob.designCopEstimate).toBeGreaterThan(noUpgrade.designCopEstimate);
  });

  it('coldMorningCopEstimate is lower than designCopEstimate (cold penalty)', () => {
    const result = runHeatPumpRegimeModuleV1({
      ...baseInput,
      retrofit: { emitterUpgradeAppetite: 'full_job' },
    });
    expect(result.coldMorningCopEstimate).toBeLessThan(result.designCopEstimate);
  });

  it('assumptions array mentions the affine COP plane model', () => {
    const result = runHeatPumpRegimeModuleV1(baseInput);
    expect(result.assumptions.some(a => a.toLowerCase().includes('affine'))).toBe(true);
  });
});
