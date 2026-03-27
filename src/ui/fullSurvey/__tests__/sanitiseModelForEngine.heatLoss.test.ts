/**
 * sanitiseModelForEngine.heatLoss.test.ts
 *
 * Tests for the canonical heat-loss sync in sanitiseModelForEngine.
 *
 * fullSurvey.heatLoss.estimatedPeakHeatLossW is the authoritative source
 * for heat loss.  When it is present it must always win over the root
 * heatLossWatts field, regardless of what value the root field already holds.
 *
 * Covers:
 *   1. surveyHeatLossW overrides the default 8000 root value
 *   2. surveyHeatLossW overrides a non-default root value (stale saved draft)
 *   3. When surveyHeatLossW is null, root heatLossWatts is left unchanged
 *   4. When fullSurvey.heatLoss is absent, root heatLossWatts is left unchanged
 */

import { describe, it, expect } from 'vitest';
import { sanitiseModelForEngine } from '../sanitiseModelForEngine';
import type { FullSurveyModelV1 } from '../FullSurveyModelV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sanitiseModelForEngine — heat-loss canonical sync', () => {
  it('overrides default 8000 root heatLossWatts with surveyHeatLossW', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      heatLossWatts: 8000,
      fullSurvey: {
        heatLoss: {
          estimatedPeakHeatLossW: 12500,
          heatLossConfidence: 'estimated',
          roofType: 'pitched',
          roofOrientation: 'S',
          shadingLevel: 'little_or_none',
          pvStatus: 'none',
          batteryStatus: 'none',
        },
      },
    };

    const result = sanitiseModelForEngine(model);
    expect(result.heatLossWatts).toBe(12500);
  });

  it('overrides a non-default stale root heatLossWatts with surveyHeatLossW', () => {
    // Simulates a saved draft where root field was set in a previous session to
    // a different value than the canvas-derived result.
    const model: FullSurveyModelV1 = {
      ...BASE,
      heatLossWatts: 7500,
      fullSurvey: {
        heatLoss: {
          estimatedPeakHeatLossW: 11000,
          heatLossConfidence: 'estimated',
          roofType: 'flat',
          roofOrientation: 'unknown',
          shadingLevel: 'unknown',
          pvStatus: 'none',
          batteryStatus: 'none',
        },
      },
    };

    const result = sanitiseModelForEngine(model);
    expect(result.heatLossWatts).toBe(11000);
  });

  it('leaves root heatLossWatts unchanged when surveyHeatLossW is null', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      heatLossWatts: 9000,
      fullSurvey: {
        heatLoss: {
          estimatedPeakHeatLossW: null,
          heatLossConfidence: 'unknown',
          roofType: 'unknown',
          roofOrientation: 'unknown',
          shadingLevel: 'unknown',
          pvStatus: 'none',
          batteryStatus: 'none',
        },
      },
    };

    const result = sanitiseModelForEngine(model);
    expect(result.heatLossWatts).toBe(9000);
  });

  it('leaves root heatLossWatts unchanged when fullSurvey.heatLoss is absent', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      heatLossWatts: 6000,
    };

    const result = sanitiseModelForEngine(model);
    expect(result.heatLossWatts).toBe(6000);
  });
});
