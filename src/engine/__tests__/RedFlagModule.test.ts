import { describe, it, expect } from 'vitest';
import { runRedFlagModule } from '../modules/RedFlagModule';

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

describe('RedFlagModule', () => {
  it('rejects combi for 2+ bathrooms + high occupancy', () => {
    const result = runRedFlagModule({ ...baseInput, bathroomCount: 2, highOccupancy: true });
    expect(result.rejectCombi).toBe(true);
  });

  it('does not reject combi for 1 bathroom + high occupancy', () => {
    const result = runRedFlagModule({ ...baseInput, bathroomCount: 1, highOccupancy: true });
    expect(result.rejectCombi).toBe(false);
  });

  it('rejects vented system for loft conversion', () => {
    const result = runRedFlagModule({ ...baseInput, hasLoftConversion: true });
    expect(result.rejectVented).toBe(true);
  });

  it('flags ASHP for 22mm primaries with high heat loss', () => {
    const result = runRedFlagModule({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 10000 });
    expect(result.flagAshp).toBe(true);
  });

  it('does not flag ASHP for 28mm primaries', () => {
    const result = runRedFlagModule({ ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 10000 });
    expect(result.flagAshp).toBe(false);
  });

  it('rejects combi for low mains pressure', () => {
    const result = runRedFlagModule({ ...baseInput, dynamicMainsPressure: 0.7 });
    expect(result.rejectCombi).toBe(true);
  });

  it('rejectAshp is false for two-pipe topology', () => {
    const result = runRedFlagModule({ ...baseInput, pipingTopology: 'two_pipe' });
    expect(result.rejectAshp).toBe(false);
  });

  it('rejectAshp is true for one-pipe topology (Hard Fail)', () => {
    const result = runRedFlagModule({ ...baseInput, pipingTopology: 'one_pipe' });
    expect(result.rejectAshp).toBe(true);
    expect(result.flagAshp).toBe(true);
  });

  it('one-pipe topology includes hard fail message in reasons', () => {
    const result = runRedFlagModule({ ...baseInput, pipingTopology: 'one_pipe' });
    expect(result.reasons.some(r => r.includes('Hard Fail'))).toBe(true);
  });

  it('rejectAshp is false when pipingTopology is undefined', () => {
    const result = runRedFlagModule(baseInput);
    expect(result.rejectAshp).toBe(false);
  });
});
