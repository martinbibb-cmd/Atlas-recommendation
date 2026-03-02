import { describe, it, expect } from 'vitest';
import { runSolarBoostModule } from '../modules/SolarBoostModule';
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
  preferCombi: false,
  dhwTankType: 'mixergy',
};

describe('runSolarBoostModule — disabled', () => {
  it('returns disabled result when solarBoost is absent', () => {
    const result = runSolarBoostModule(baseInput);
    expect(result.enabled).toBe(false);
    expect(result.totalSolarInputKwh).toBe(0);
    expect(result.boilerDemandReductionKwh).toBe(0);
    expect(result.source).toBe('none');
  });

  it('returns disabled result when solarBoost.enabled is false', () => {
    const result = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: false, source: 'PV_diverter' },
    });
    expect(result.enabled).toBe(false);
    expect(result.totalSolarInputKwh).toBe(0);
  });

  it('disabled result has 24 zero-kW hourly entries', () => {
    const result = runSolarBoostModule(baseInput);
    expect(result.hourlyProfile).toHaveLength(24);
    for (const h of result.hourlyProfile) {
      expect(h.solarHeatKw).toBe(0);
    }
  });
});

describe('runSolarBoostModule — enabled: PV_diverter', () => {
  it('returns enabled result for PV_diverter', () => {
    const result = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter' },
    });
    expect(result.enabled).toBe(true);
    expect(result.source).toBe('PV_diverter');
  });

  it('produces positive total solar input for PV_diverter', () => {
    const result = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter' },
    });
    expect(result.totalSolarInputKwh).toBeGreaterThan(0);
  });

  it('solar input matches boiler demand reduction (1:1 displacement)', () => {
    const result = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter' },
    });
    expect(result.boilerDemandReductionKwh).toBe(result.totalSolarInputKwh);
  });

  it('hourly profile has 24 entries', () => {
    const result = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter' },
    });
    expect(result.hourlyProfile).toHaveLength(24);
  });

  it('solar heat is zero outside the solar window (shoulder default: 9–16)', () => {
    const result = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter', profilePreset: 'shoulder' },
    });
    for (const h of result.hourlyProfile) {
      if (h.hour < 9 || h.hour > 16) {
        expect(h.solarHeatKw).toBe(0);
      }
    }
  });

  it('solar heat is non-zero during shoulder window (9–16)', () => {
    const result = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter', profilePreset: 'shoulder' },
    });
    const windowHours = result.hourlyProfile.filter(h => h.hour >= 9 && h.hour <= 16);
    const totalWindow = windowHours.reduce((s, h) => s + h.solarHeatKw, 0);
    expect(totalWindow).toBeGreaterThan(0);
  });
});

describe('runSolarBoostModule — enabled: solar_thermal', () => {
  it('solar_thermal produces lower power than PV_diverter by default', () => {
    const pvResult = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter', profilePreset: 'summer' },
    });
    const stResult = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'solar_thermal', profilePreset: 'summer' },
    });
    expect(stResult.totalSolarInputKwh).toBeLessThan(pvResult.totalSolarInputKwh);
  });
});

describe('runSolarBoostModule — preset comparison', () => {
  it('summer preset produces more energy than winter preset', () => {
    const summer = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter', profilePreset: 'summer' },
    });
    const winter = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter', profilePreset: 'winter' },
    });
    expect(summer.totalSolarInputKwh).toBeGreaterThan(winter.totalSolarInputKwh);
  });

  it('shoulder preset produces more energy than winter but less than summer', () => {
    const summer = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter', profilePreset: 'summer' },
    });
    const shoulder = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter', profilePreset: 'shoulder' },
    });
    const winter = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter', profilePreset: 'winter' },
    });
    expect(shoulder.totalSolarInputKwh).toBeGreaterThan(winter.totalSolarInputKwh);
    expect(shoulder.totalSolarInputKwh).toBeLessThan(summer.totalSolarInputKwh);
  });

  it('winter preset: solar window is 10–14', () => {
    const result = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter', profilePreset: 'winter' },
    });
    for (const h of result.hourlyProfile) {
      if (h.hour < 10 || h.hour > 14) {
        expect(h.solarHeatKw).toBe(0);
      }
    }
  });
});

describe('runSolarBoostModule — custom powerKw override', () => {
  it('custom powerKw produces proportionally different output', () => {
    const default_ = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter', profilePreset: 'summer' },
    });
    const custom = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter', powerKw: 5, profilePreset: 'summer' },
    });
    expect(custom.totalSolarInputKwh).toBeGreaterThan(default_.totalSolarInputKwh);
  });
});

describe('runSolarBoostModule — notes', () => {
  it('enabled result includes notes', () => {
    const result = runSolarBoostModule({
      ...baseInput,
      solarBoost: { enabled: true, source: 'PV_diverter' },
    });
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it('disabled result includes notes', () => {
    const result = runSolarBoostModule(baseInput);
    expect(result.notes.length).toBeGreaterThan(0);
  });
});
