import { describe, it, expect } from 'vitest';
import { runMixergyLegacyModule } from '../modules/MixergyLegacyModule';
import type { MixergyLegacyInput } from '../schema/EngineInputV2_3';

const bgFullIntegration: MixergyLegacyInput = {
  hasIotIntegration: true,
  installerNetwork: 'british_gas',
  dhwStorageLitres: 200,
};

const independentNoIot: MixergyLegacyInput = {
  hasIotIntegration: false,
  installerNetwork: 'independent',
  dhwStorageLitres: 150,
};

const independentWithIot: MixergyLegacyInput = {
  hasIotIntegration: true,
  installerNetwork: 'independent',
  dhwStorageLitres: 150,
};

describe('MixergyLegacyModule', () => {
  it('activates BG exclusivity for british_gas network with sufficient tank size', () => {
    const result = runMixergyLegacyModule(bgFullIntegration);
    expect(result.bgExclusivityActive).toBe(true);
  });

  it('does NOT activate BG exclusivity for independent installer', () => {
    const result = runMixergyLegacyModule(independentNoIot);
    expect(result.bgExclusivityActive).toBe(false);
  });

  it('does NOT activate BG exclusivity when tank is below 150L minimum', () => {
    const result = runMixergyLegacyModule({
      ...bgFullIntegration,
      dhwStorageLitres: 100,
    });
    expect(result.bgExclusivityActive).toBe(false);
  });

  it('returns full IoT tier for BG installer with IoT integration', () => {
    const result = runMixergyLegacyModule(bgFullIntegration);
    expect(result.iotTier).toBe('full');
  });

  it('returns basic IoT tier for independent installer with IoT integration', () => {
    const result = runMixergyLegacyModule(independentWithIot);
    expect(result.iotTier).toBe('basic');
  });

  it('returns none IoT tier when no IoT integration is present', () => {
    const result = runMixergyLegacyModule(independentNoIot);
    expect(result.iotTier).toBe('none');
  });

  it('estimates a positive annual saving in kWh', () => {
    const result = runMixergyLegacyModule(bgFullIntegration);
    expect(result.estimatedAnnualSavingKwh).toBeGreaterThan(0);
  });

  it('larger tanks produce a higher annual saving estimate', () => {
    const smallTank = runMixergyLegacyModule({ ...independentNoIot, dhwStorageLitres: 100 });
    const largeTank = runMixergyLegacyModule({ ...independentNoIot, dhwStorageLitres: 300 });
    expect(largeTank.estimatedAnnualSavingKwh).toBeGreaterThan(smallTank.estimatedAnnualSavingKwh);
  });

  it('returns a non-empty notes array', () => {
    expect(runMixergyLegacyModule(bgFullIntegration).notes.length).toBeGreaterThan(0);
    expect(runMixergyLegacyModule(independentNoIot).notes.length).toBeGreaterThan(0);
  });
});
