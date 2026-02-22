import { describe, it, expect } from 'vitest';
import { runCombiStressModule } from '../modules/CombiStressModule';

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

describe('CombiStressModule', () => {
  it('always applies 600 kWh/year SAP purge penalty', () => {
    const result = runCombiStressModule(baseInput);
    expect(result.annualPurgeLossKwh).toBe(600);
  });

  it('returns short draw efficiency below 30%', () => {
    const result = runCombiStressModule(baseInput);
    expect(result.shortDrawEfficiencyPct).toBeLessThan(30);
  });

  it('flags compromised condensing when return temp > 55°C', () => {
    const result = runCombiStressModule({ ...baseInput, returnWaterTemp: 60 });
    expect(result.isCondensingCompromised).toBe(true);
    expect(result.condensingEfficiencyPct).toBeLessThan(100);
  });

  it('does not flag condensing compromise when return temp <= 55°C', () => {
    const result = runCombiStressModule({ ...baseInput, returnWaterTemp: 50 });
    expect(result.isCondensingCompromised).toBe(false);
    expect(result.condensingEfficiencyPct).toBe(100);
  });

  it('total penalty includes purge loss and condensing penalty', () => {
    const result = runCombiStressModule({ ...baseInput, returnWaterTemp: 60 });
    expect(result.totalPenaltyKwh).toBeGreaterThan(600);
  });
});
