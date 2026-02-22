import { describe, it, expect } from 'vitest';
import { runMixergyVolumetricsModule } from '../modules/MixergyVolumetricsModule';

describe('MixergyVolumetricsModule', () => {
  it('returns 150L Mixergy equivalent to 210L conventional', () => {
    const result = runMixergyVolumetricsModule();
    expect(result.mixergyLitres).toBe(150);
    expect(result.equivalentConventionalLitres).toBe(210);
  });

  it('calculates ~29-30% footprint saving', () => {
    const result = runMixergyVolumetricsModule();
    expect(result.footprintSavingPct).toBeGreaterThanOrEqual(28);
    expect(result.footprintSavingPct).toBeLessThanOrEqual(31);
  });

  it('reports at least 5% COP multiplier for heat pump pairing', () => {
    const result = runMixergyVolumetricsModule();
    expect(result.heatPumpCopMultiplierPct).toBeGreaterThanOrEqual(5);
  });
});
