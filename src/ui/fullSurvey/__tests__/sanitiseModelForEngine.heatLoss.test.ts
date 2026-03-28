/**
 * sanitiseModelForEngine.heatLoss.test.ts
 *
 * Tests for the canonical heat-loss sync and roof/solar bridge in sanitiseModelForEngine.
 *
 * fullSurvey.heatLoss.estimatedPeakHeatLossW is the authoritative source
 * for heat loss.  When it is present it must always win over the root
 * heatLossWatts field, regardless of what value the root field already holds.
 *
 * fullSurvey.heatLoss roof fields (roofType, roofOrientation, shadingLevel,
 * pvStatus, batteryStatus) are bridged to the engine root fields so that
 * PvAssessmentModule and FutureEnergyOpportunitiesModule see the correct values.
 *
 * Covers:
 *   1. surveyHeatLossW overrides the default 8000 root value
 *   2. surveyHeatLossW overrides a non-default root value (stale saved draft)
 *   3. When surveyHeatLossW is null, root heatLossWatts is left unchanged
 *   4. When fullSurvey.heatLoss is absent, root heatLossWatts is left unchanged
 *   5. Roof orientation bridge: compass shorthand ('S') → engine format ('south')
 *   6. Roof orientation bridge: NE/NW map to 'north' (conservative; not in engine schema)
 *   7. Roof type bridge: 'hipped' and 'dormer' map to 'pitched'
 *   8. Shading bridge: 'little_or_none' → 'low', 'some' → 'medium', 'heavy' → 'high'
 *   9. pvStatus and batteryStatus pass through unchanged
 *  10. Explicit root roof fields are never overwritten by the bridge
 *  11. 'unknown' values are mapped to engine 'unknown' (not left undefined)
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

// ─── Roof / solar bridge tests ────────────────────────────────────────────────

import type { HeatLossState } from '../../../features/survey/heatLoss/heatLossTypes';

/** Default HeatLossState — all unknown/none. Pass only the field under test as an override. */
const DEFAULT_HEAT_LOSS: HeatLossState = {
  estimatedPeakHeatLossW: null,
  heatLossConfidence: 'unknown',
  roofType: 'unknown',
  roofOrientation: 'unknown',
  shadingLevel: 'unknown',
  pvStatus: 'none',
  batteryStatus: 'none',
};

/** Build a model with the given HeatLossState override merged over the defaults. */
function makeModelWithRoof(heatLoss: Partial<HeatLossState> = {}): FullSurveyModelV1 {
  return {
    ...BASE,
    fullSurvey: { heatLoss: { ...DEFAULT_HEAT_LOSS, ...heatLoss } },
  };
}

describe('sanitiseModelForEngine — roof / solar bridge from fullSurvey.heatLoss', () => {
  it('bridges S → south for roofOrientation', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ roofOrientation: 'S' })).roofOrientation).toBe('south');
  });

  it('bridges SE → south_east for roofOrientation', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ roofOrientation: 'SE' })).roofOrientation).toBe('south_east');
  });

  it('bridges SW → south_west for roofOrientation', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ roofOrientation: 'SW' })).roofOrientation).toBe('south_west');
  });

  it('bridges N → north for roofOrientation', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ roofOrientation: 'N' })).roofOrientation).toBe('north');
  });

  it('bridges NE → north (conservative; no north_east in engine schema)', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ roofOrientation: 'NE' })).roofOrientation).toBe('north');
  });

  it('bridges NW → north (conservative; no north_west in engine schema)', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ roofOrientation: 'NW' })).roofOrientation).toBe('north');
  });

  it('bridges E → east and W → west for roofOrientation', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ roofOrientation: 'E' })).roofOrientation).toBe('east');
    expect(sanitiseModelForEngine(makeModelWithRoof({ roofOrientation: 'W' })).roofOrientation).toBe('west');
  });

  it('bridges unknown roofOrientation → unknown (not undefined)', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ roofOrientation: 'unknown' })).roofOrientation).toBe('unknown');
  });

  it('bridges pitched roofType → pitched', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ roofType: 'pitched' })).roofType).toBe('pitched');
  });

  it('bridges hipped roofType → pitched (hipped is a form of pitched roof)', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ roofType: 'hipped' })).roofType).toBe('pitched');
  });

  it('bridges dormer roofType → pitched (dormer sits on a pitched roof)', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ roofType: 'dormer' })).roofType).toBe('pitched');
  });

  it('bridges flat roofType → flat', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ roofType: 'flat' })).roofType).toBe('flat');
  });

  it('bridges little_or_none shading → low solarShading', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ shadingLevel: 'little_or_none' })).solarShading).toBe('low');
  });

  it('bridges some shading → medium solarShading', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ shadingLevel: 'some' })).solarShading).toBe('medium');
  });

  it('bridges heavy shading → high solarShading', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ shadingLevel: 'heavy' })).solarShading).toBe('high');
  });

  it('bridges pvStatus through unchanged', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ pvStatus: 'existing' })).pvStatus).toBe('existing');
  });

  it('bridges batteryStatus through unchanged', () => {
    expect(sanitiseModelForEngine(makeModelWithRoof({ batteryStatus: 'planned' })).batteryStatus).toBe('planned');
  });

  it('does NOT overwrite an explicit root roofOrientation with the bridge value', () => {
    const model: FullSurveyModelV1 = {
      ...makeModelWithRoof({ roofOrientation: 'N' }),
      roofOrientation: 'south',  // explicit root value — must win
    };
    expect(sanitiseModelForEngine(model).roofOrientation).toBe('south');
  });

  it('does NOT overwrite an explicit root roofType with the bridge value', () => {
    const model: FullSurveyModelV1 = {
      ...makeModelWithRoof({ roofType: 'hipped' }),
      roofType: 'flat',  // explicit root value — must win
    };
    expect(sanitiseModelForEngine(model).roofType).toBe('flat');
  });

  it('does NOT overwrite explicit root solarShading with the bridge value', () => {
    const model: FullSurveyModelV1 = {
      ...makeModelWithRoof({ shadingLevel: 'heavy' }),
      solarShading: 'low',  // explicit root value — must win
    };
    expect(sanitiseModelForEngine(model).solarShading).toBe('low');
  });
});
