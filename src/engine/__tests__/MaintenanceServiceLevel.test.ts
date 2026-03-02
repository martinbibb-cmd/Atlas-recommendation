/**
 * Tests for maintenance.serviceLevelPct wiring in Engine.ts.
 *
 * A service level of 0 leaves efficiency decay unchanged.
 * A service level of 50 halves the decay.
 * A service level of 100 eliminates the decay entirely.
 */
import { describe, it, expect } from 'vitest';
import { runEngine } from '../Engine';
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
  preferCombi: true,
  // Use an older system so there is measurable decay to work with
  systemAgeYears: 10,
  hasMagneticFilter: false,
};

describe('maintenance.serviceLevelPct', () => {
  it('serviceLevelPct absent → no change to tenYearEfficiencyDecayPct', () => {
    const base = runEngine(baseInput);
    const explicit0 = runEngine({ ...baseInput, maintenance: { serviceLevelPct: 0 } });
    expect(explicit0.normalizer.tenYearEfficiencyDecayPct)
      .toBeCloseTo(base.normalizer.tenYearEfficiencyDecayPct, 5);
  });

  it('serviceLevelPct = 100 → decay is reduced to zero', () => {
    const result = runEngine({ ...baseInput, maintenance: { serviceLevelPct: 100 } });
    expect(result.normalizer.tenYearEfficiencyDecayPct).toBeCloseTo(0, 5);
  });

  it('serviceLevelPct = 50 → decay is halved', () => {
    const baseline = runEngine(baseInput);
    const half = runEngine({ ...baseInput, maintenance: { serviceLevelPct: 50 } });
    expect(half.normalizer.tenYearEfficiencyDecayPct)
      .toBeCloseTo(baseline.normalizer.tenYearEfficiencyDecayPct * 0.5, 5);
  });

  it('higher serviceLevelPct always yields lower or equal decay', () => {
    const r0   = runEngine({ ...baseInput, maintenance: { serviceLevelPct: 0   } });
    const r33  = runEngine({ ...baseInput, maintenance: { serviceLevelPct: 33  } });
    const r66  = runEngine({ ...baseInput, maintenance: { serviceLevelPct: 66  } });
    const r100 = runEngine({ ...baseInput, maintenance: { serviceLevelPct: 100 } });
    expect(r33.normalizer.tenYearEfficiencyDecayPct).toBeLessThanOrEqual(r0.normalizer.tenYearEfficiencyDecayPct);
    expect(r66.normalizer.tenYearEfficiencyDecayPct).toBeLessThanOrEqual(r33.normalizer.tenYearEfficiencyDecayPct);
    expect(r100.normalizer.tenYearEfficiencyDecayPct).toBeLessThanOrEqual(r66.normalizer.tenYearEfficiencyDecayPct);
  });
});
