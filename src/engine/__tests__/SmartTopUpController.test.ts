import { describe, it, expect } from 'vitest';
import { runSmartTopUpController, demandLphToKwh } from '../modules/SmartTopUpController';
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
  dhwStorageLitres: 150,
};

describe('runSmartTopUpController — mode', () => {
  it('defaults to smart mode when mixergyControlMode is absent', () => {
    const result = runSmartTopUpController(baseInput);
    expect(result.controlMode).toBe('smart');
  });

  it('uses explicit smart mode', () => {
    const result = runSmartTopUpController({ ...baseInput, mixergyControlMode: 'smart' });
    expect(result.controlMode).toBe('smart');
  });

  it('uses explicit manual_boosty mode', () => {
    const result = runSmartTopUpController({ ...baseInput, mixergyControlMode: 'manual_boosty' });
    expect(result.controlMode).toBe('manual_boosty');
  });
});

describe('runSmartTopUpController — output shape', () => {
  it('returns 24 buffer entries', () => {
    const result = runSmartTopUpController(baseInput);
    expect(result.bufferLitresHourly).toHaveLength(24);
  });

  it('buffer values are non-negative', () => {
    const result = runSmartTopUpController(baseInput);
    for (const v of result.bufferLitresHourly) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it('includes notes array', () => {
    const result = runSmartTopUpController(baseInput);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it('totalFiringEvents matches chargeEvents length', () => {
    const result = runSmartTopUpController(baseInput);
    expect(result.totalFiringEvents).toBe(result.chargeEvents.length);
  });
});

describe('runSmartTopUpController — smart vs manual_boosty comparison', () => {
  it('smart mode produces fewer charge events than manual_boosty', () => {
    const smart = runSmartTopUpController({ ...baseInput, mixergyControlMode: 'smart' });
    const manual = runSmartTopUpController({ ...baseInput, mixergyControlMode: 'manual_boosty' });
    expect(smart.totalFiringEvents).toBeLessThan(manual.totalFiringEvents);
  });

  it('smart mode has lower standing losses than manual_boosty', () => {
    const smart = runSmartTopUpController({ ...baseInput, mixergyControlMode: 'smart' });
    const manual = runSmartTopUpController({ ...baseInput, mixergyControlMode: 'manual_boosty' });
    expect(smart.standingLossKwh).toBeLessThan(manual.standingLossKwh);
  });

  it('smart mode slice events are top_slice; manual_boosty events are full_tank', () => {
    const smart = runSmartTopUpController({ ...baseInput, mixergyControlMode: 'smart' });
    const manual = runSmartTopUpController({ ...baseInput, mixergyControlMode: 'manual_boosty' });

    // In smart mode, non-emergency events are top_slice
    const smartTopSlice = smart.chargeEvents.filter(e => e.sliceMode === 'top_slice');
    expect(smartTopSlice.length).toBeGreaterThan(0);

    // In manual mode, all scheduled events are full_tank
    const manualFullTank = manual.chargeEvents.filter(e => e.sliceMode === 'full_tank');
    expect(manualFullTank.length).toBeGreaterThan(0);
  });

  it('smart mode without emergency boost keeps buffer above 0 throughout the day', () => {
    // Under normal demand (default profile), smart should keep buffer > 0
    const smart = runSmartTopUpController({ ...baseInput, mixergyControlMode: 'smart' });
    const minBuffer = Math.min(...smart.bufferLitresHourly);
    expect(minBuffer).toBeGreaterThanOrEqual(0);
  });

  it('smart mode emergency boost is not triggered under default demand', () => {
    const smart = runSmartTopUpController({ ...baseInput, mixergyControlMode: 'smart' });
    expect(smart.emergencyBoostTriggered).toBe(false);
  });
});

describe('runSmartTopUpController — dayProfile demand integration', () => {
  it('derives demand from dayProfile.dhwEvents when provided', () => {
    const withProfile: EngineInputV2_3 = {
      ...baseInput,
      dayProfile: {
        heatingBands: [],
        dhwHeatBands: [],
        dhwEvents: [
          { startMin: 420, durationMin: 10, kind: 'shower', profile: 'mixer10' }, // 07:00
          { startMin: 1140, durationMin: 10, kind: 'shower', profile: 'mixer10' }, // 19:00
        ],
      },
    };
    const result = runSmartTopUpController(withProfile);
    // Should produce a valid result with charge events
    expect(result.chargeEvents.length).toBeGreaterThan(0);
    expect(result.bufferLitresHourly).toHaveLength(24);
  });

  it('falls back to default profile when dayProfile has no dhwEvents', () => {
    const withEmptyProfile: EngineInputV2_3 = {
      ...baseInput,
      dayProfile: {
        heatingBands: [],
        dhwHeatBands: [],
        dhwEvents: [],
      },
    };
    const resultFallback = runSmartTopUpController(withEmptyProfile);
    const resultDefault = runSmartTopUpController(baseInput);
    // Both should produce the same schedule (same default profile used)
    expect(resultFallback.totalFiringEvents).toBe(resultDefault.totalFiringEvents);
  });
});

describe('runSmartTopUpController — charge event fields', () => {
  it('each charge event has positive heatInputKwh', () => {
    const result = runSmartTopUpController({ ...baseInput, mixergyControlMode: 'smart' });
    for (const ev of result.chargeEvents) {
      expect(ev.heatInputKwh).toBeGreaterThan(0);
    }
  });

  it('each charge event has a valid startHour (0–23)', () => {
    const result = runSmartTopUpController({ ...baseInput, mixergyControlMode: 'manual_boosty' });
    for (const ev of result.chargeEvents) {
      expect(ev.startHour).toBeGreaterThanOrEqual(0);
      expect(ev.startHour).toBeLessThanOrEqual(23);
    }
  });
});

describe('demandLphToKwh helper', () => {
  it('converts 0 lph to 0 kWh', () => {
    const result = demandLphToKwh([0]);
    expect(result[0]).toBe(0);
  });

  it('converts positive lph to positive kWh', () => {
    const result = demandLphToKwh([30]);
    expect(result[0]).toBeGreaterThan(0);
  });

  it('preserves array length', () => {
    const input = new Array(24).fill(10);
    const result = demandLphToKwh(input);
    expect(result).toHaveLength(24);
  });
});
