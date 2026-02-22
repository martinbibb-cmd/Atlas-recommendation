import { describe, it, expect } from 'vitest';
import { normalizeInput } from '../normalizer/Normalizer';

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

describe('Normalizer', () => {
  it('classifies SW postcode as hard water', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'SW1A 1AA' });
    expect(['hard', 'very_hard']).toContain(result.waterHardnessCategory);
  });

  it('calculates system volume from radiator count', () => {
    const result = normalizeInput({ ...baseInput, radiatorCount: 12 });
    expect(result.systemVolumeL).toBe(120);
  });

  it('blocks vented system for loft conversion', () => {
    const result = normalizeInput({ ...baseInput, hasLoftConversion: true });
    expect(result.canUseVentedSystem).toBe(false);
  });

  it('allows vented system without loft conversion', () => {
    const result = normalizeInput({ ...baseInput, hasLoftConversion: false });
    expect(result.canUseVentedSystem).toBe(true);
  });

  it('returns higher scale Rf for hard water', () => {
    const hardResult = normalizeInput({ ...baseInput, postcode: 'SW1A 1AA' });
    const softResult = normalizeInput({ ...baseInput, postcode: 'G1 1AA' });
    expect(hardResult.scaleRf).toBeGreaterThan(softResult.scaleRf);
  });

  // ── V3 additions ────────────────────────────────────────────────────────────

  it('sets scalingScaffoldCoefficient to 10.0 for a London (E) postcode', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'E1 6RF' });
    expect(result.scalingScaffoldCoefficient).toBe(10.0);
  });

  it('sets scalingScaffoldCoefficient to 10.0 for an Essex (SS) postcode', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'SS1 1AA' });
    expect(result.scalingScaffoldCoefficient).toBe(10.0);
  });

  it('sets scalingScaffoldCoefficient to 10.0 for an inner London (EC) postcode', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'EC1A 1BB' });
    expect(result.scalingScaffoldCoefficient).toBe(10.0);
  });

  it('sets scalingScaffoldCoefficient to 1.0 for a non-high-silica postcode', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'G1 1AA' });
    expect(result.scalingScaffoldCoefficient).toBe(1.0);
  });

  it('uses 6 L/kW proxy for system volume when radiatorCount is 0', () => {
    // 10 kW boiler → 6 × 10 = 60 L
    const result = normalizeInput({ ...baseInput, radiatorCount: 0, heatLossWatts: 10000 });
    expect(result.systemVolumeL).toBeCloseTo(60, 0);
  });

  it('uses radiator count when it is greater than zero', () => {
    const result = normalizeInput({ ...baseInput, radiatorCount: 8 });
    expect(result.systemVolumeL).toBe(80);
  });
});
