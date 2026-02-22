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
});
