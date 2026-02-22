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

  // ── V3 additions – WB longevity boost ────────────────────────────────────────

  it('returns 0 wbLongevityBoostPct when no softener is fitted', () => {
    const result = runCombiStressModule({ ...baseInput, hasSoftener: false });
    expect(result.wbLongevityBoostPct).toBe(0);
  });

  it('returns 0 wbLongevityBoostPct for softener + stainless steel (V3 field)', () => {
    const result = runCombiStressModule({
      ...baseInput,
      hasSoftener: true,
      heatExchangerMaterial: 'stainless_steel',
    });
    expect(result.wbLongevityBoostPct).toBe(0);
  });

  it('returns 15% wbLongevityBoostPct for softener + Al-Si (V3 heatExchangerMaterial field)', () => {
    const result = runCombiStressModule({
      ...baseInput,
      hasSoftener: true,
      heatExchangerMaterial: 'Al-Si',
    });
    expect(result.wbLongevityBoostPct).toBe(15);
  });

  it('returns 15% wbLongevityBoostPct for softener + al_si (V2 preferredMetallurgy field)', () => {
    const result = runCombiStressModule({
      ...baseInput,
      hasSoftener: true,
      preferredMetallurgy: 'al_si',
    });
    expect(result.wbLongevityBoostPct).toBe(15);
  });

  it('returns 0 wbLongevityBoostPct for Al-Si without a softener', () => {
    const result = runCombiStressModule({
      ...baseInput,
      hasSoftener: false,
      heatExchangerMaterial: 'Al-Si',
    });
    expect(result.wbLongevityBoostPct).toBe(0);
  });
});
