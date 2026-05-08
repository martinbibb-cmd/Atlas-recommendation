import { describe, it, expect } from 'vitest';
import { sanitiseModelForEngine } from '../sanitiseModelForEngine';
import type { FullSurveyModelV1 } from '../FullSurveyModelV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

const BASE: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.0,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: true,
};

describe('sanitiseModelForEngine — mains flow reading selection', () => {
  it('prefers full-bore (0 bar) measured flow when flowReadings are present', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      mains: {
        flowReadings: {
          at2BarLpm: 3,
          at1BarLpm: 5,
          at0BarLpm: 8,
        },
      },
    };

    const result = sanitiseModelForEngine(model);
    expect(result.mainsDynamicFlowLpm).toBe(8);
    expect(result.dynamicMainsPressureBar).toBe(0);
  });

  it('falls back to retained-flow readings when full-bore reading is absent', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      mains: {
        flowReadings: {
          at2BarLpm: 3,
          at1BarLpm: 5,
        },
      },
    };

    const result = sanitiseModelForEngine(model);
    expect(result.mainsDynamicFlowLpm).toBe(5);
    expect(result.dynamicMainsPressureBar).toBe(1);
  });
});
