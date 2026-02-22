import { describe, it, expect } from 'vitest';
import { runLifestyleSimulationModule } from '../modules/LifestyleSimulationModule';

const baseInput = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium' as const,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional' as const,
  highOccupancy: false,
  preferCombi: true,
};

describe('LifestyleSimulationModule', () => {
  it('returns 24 hours of data', () => {
    const result = runLifestyleSimulationModule(baseInput);
    expect(result.hourlyData).toHaveLength(24);
  });

  it('recommends boiler for professional signature', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'professional' });
    expect(result.recommendedSystem).toBe('boiler');
  });

  it('recommends ASHP for steady home signature', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'steady_home' });
    expect(result.recommendedSystem).toBe('ashp');
  });

  it('recommends stored water for shift worker signature', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'shift_worker' });
    expect(result.recommendedSystem).toBe('stored_water');
  });

  it('has higher demand during peak hours for professional', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'professional' });
    const morningPeak = result.hourlyData[7].demandKw;  // 7am
    const awayTime = result.hourlyData[12].demandKw;    // 12pm (away)
    expect(morningPeak).toBeGreaterThan(awayTime);
  });
});
