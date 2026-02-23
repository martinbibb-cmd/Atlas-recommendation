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
