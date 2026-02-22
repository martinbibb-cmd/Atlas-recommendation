import { describe, it, expect } from 'vitest';
import { calcFlowRate, runHydraulicSafetyModule } from '../modules/HydraulicSafetyModule';

const baseInput = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium' as const,
  primaryPipeDiameter: 22,
  heatLossWatts: 10000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional' as const,
  highOccupancy: false,
  preferCombi: true,
};

describe('HydraulicSafetyModule', () => {
  it('calculates flow rate correctly', () => {
    const flow = calcFlowRate(19, 20);
    expect(flow).toBeCloseTo(0.227, 2);
  });

  it('flags hydraulic bottleneck for >19kW on 22mm pipe', () => {
    const result = runHydraulicSafetyModule({ ...baseInput, heatLossWatts: 20000, primaryPipeDiameter: 22 });
    expect(result.isBottleneck).toBe(true);
  });

  it('does not flag bottleneck for 15kW on 22mm pipe', () => {
    const result = runHydraulicSafetyModule({ ...baseInput, heatLossWatts: 15000, primaryPipeDiameter: 22 });
    expect(result.isBottleneck).toBe(false);
  });

  it('does not flag bottleneck for >19kW on 28mm pipe', () => {
    const result = runHydraulicSafetyModule({ ...baseInput, heatLossWatts: 20000, primaryPipeDiameter: 28 });
    expect(result.isBottleneck).toBe(false);
  });

  it('flags safety cutoff risk when pressure < 1.0 bar', () => {
    const result = runHydraulicSafetyModule({ ...baseInput, dynamicMainsPressure: 0.8 });
    expect(result.isSafetyCutoffRisk).toBe(true);
  });

  it('does not flag cutoff risk when pressure >= 1.0 bar', () => {
    const result = runHydraulicSafetyModule({ ...baseInput, dynamicMainsPressure: 1.5 });
    expect(result.isSafetyCutoffRisk).toBe(false);
  });

  it('flags ASHP requires 28mm for modest heat loss', () => {
    const result = runHydraulicSafetyModule({ ...baseInput, heatLossWatts: 8000, primaryPipeDiameter: 22 });
    expect(result.ashpRequires28mm).toBe(true);
  });
});
