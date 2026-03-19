import { describe, it, expect } from 'vitest';
import {
  computeSpaceRankingAdjustments,
  deriveSpaceTradeOffTag,
  computeDisruptionRankingAdjustments,
  deriveDisruptionTradeOffTag,
} from '../buildRecommendationRanking';
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
};

describe('computeSpaceRankingAdjustments', () => {
  it('returns empty array when spacePriority is low', () => {
    const result = computeSpaceRankingAdjustments('combi', {
      ...baseInput,
      preferences: { spacePriority: 'low' },
    });
    expect(result).toHaveLength(0);
  });

  it('returns empty array when preferences is absent', () => {
    const result = computeSpaceRankingAdjustments('combi', baseInput);
    expect(result).toHaveLength(0);
  });

  it('penalises stored_unvented when spacePriority is high', () => {
    const result = computeSpaceRankingAdjustments('stored_unvented', {
      ...baseInput,
      preferences: { spacePriority: 'high' },
    });
    const penalty = result.find(a => a.id === 'space_pref.high_stored');
    expect(penalty).toBeDefined();
    expect(penalty!.delta).toBe(-15);
  });

  it('penalises stored_vented by half when spacePriority is medium', () => {
    const result = computeSpaceRankingAdjustments('stored_vented', {
      ...baseInput,
      preferences: { spacePriority: 'medium' },
    });
    const penalty = result.find(a => a.id === 'space_pref.medium_stored');
    expect(penalty).toBeDefined();
    expect(penalty!.delta).toBe(-8); // Math.round(15 * 0.5) = 8
  });

  it('boosts combi when spacePriority is high and demand is low', () => {
    const result = computeSpaceRankingAdjustments('combi', {
      ...baseInput,
      occupancyCount: 2,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      preferences: { spacePriority: 'high' },
    });
    const boost = result.find(a => a.id === 'space_pref.combi_boost');
    expect(boost).toBeDefined();
    expect(boost!.delta).toBe(12);
  });

  it('applies high-demand override penalty to combi when occupancy >= 4', () => {
    const result = computeSpaceRankingAdjustments('combi', {
      ...baseInput,
      occupancyCount: 4,
      bathroomCount: 1,
      preferences: { spacePriority: 'high' },
    });
    const override = result.find(a => a.id === 'space_pref.high_demand_override');
    expect(override).toBeDefined();
    expect(override!.delta).toBe(-20);
  });

  it('applies low-flow override penalty to combi when mains flow < 2.5 L/min', () => {
    const result = computeSpaceRankingAdjustments('combi', {
      ...baseInput,
      mains: { flowRateLpm: 2.0 },
      preferences: { spacePriority: 'high' },
    });
    const override = result.find(a => a.id === 'space_pref.low_flow_override');
    expect(override).toBeDefined();
    expect(override!.delta).toBe(-25);
  });

  it('does not apply combi boost or penalty to ashp', () => {
    const result = computeSpaceRankingAdjustments('ashp', {
      ...baseInput,
      preferences: { spacePriority: 'high' },
    });
    expect(result.some(a => a.id === 'space_pref.combi_boost')).toBe(false);
    // ashp IS stored — should get the stored penalty
    expect(result.some(a => a.id === 'space_pref.high_stored')).toBe(true);
  });
});

describe('deriveSpaceTradeOffTag', () => {
  it('returns null when spacePriority is low', () => {
    const tag = deriveSpaceTradeOffTag('combi', {
      ...baseInput,
      preferences: { spacePriority: 'low' },
    });
    expect(tag).toBeNull();
  });

  it('returns null when preferences absent', () => {
    expect(deriveSpaceTradeOffTag('combi', baseInput)).toBeNull();
  });

  it('returns space constrained tag for combi with high spacePriority', () => {
    const tag = deriveSpaceTradeOffTag('combi', {
      ...baseInput,
      preferences: { spacePriority: 'high' },
    });
    expect(tag).toBe('Space constrained — combi preferred');
  });

  it('returns high demand tag for stored system even with high spacePriority when occupancy >= 4', () => {
    const tag = deriveSpaceTradeOffTag('stored', {
      ...baseInput,
      occupancyCount: 4,
      preferences: { spacePriority: 'high' },
    });
    expect(tag).toBe('High demand — stored hot water required despite space impact');
  });

  it('returns space constrained tag for combi with medium spacePriority', () => {
    const tag = deriveSpaceTradeOffTag('combi', {
      ...baseInput,
      preferences: { spacePriority: 'medium' },
    });
    expect(tag).toBe('Space constrained — combi preferred');
  });
});

describe('computeDisruptionRankingAdjustments', () => {
  it('returns empty array when disruptionTolerance is medium (default)', () => {
    const result = computeDisruptionRankingAdjustments('ashp', {
      ...baseInput,
      preferences: { disruptionTolerance: 'medium' },
    });
    expect(result).toHaveLength(0);
  });

  it('returns empty array when preferences is absent', () => {
    const result = computeDisruptionRankingAdjustments('ashp', baseInput);
    expect(result).toHaveLength(0);
  });

  it('penalises ashp when disruptionTolerance is low', () => {
    const result = computeDisruptionRankingAdjustments('ashp', {
      ...baseInput,
      preferences: { disruptionTolerance: 'low' },
    });
    const penalty = result.find(a => a.id === 'disruption_pref.low_upgrade');
    expect(penalty).toBeDefined();
    expect(penalty!.delta).toBe(-12);
  });

  it('penalises system_unvented when disruptionTolerance is low', () => {
    const result = computeDisruptionRankingAdjustments('system_unvented', {
      ...baseInput,
      preferences: { disruptionTolerance: 'low' },
    });
    const penalty = result.find(a => a.id === 'disruption_pref.low_upgrade');
    expect(penalty).toBeDefined();
    expect(penalty!.delta).toBe(-12);
  });

  it('boosts ashp when disruptionTolerance is high', () => {
    const result = computeDisruptionRankingAdjustments('ashp', {
      ...baseInput,
      preferences: { disruptionTolerance: 'high' },
    });
    const boost = result.find(a => a.id === 'disruption_pref.high_upgrade');
    expect(boost).toBeDefined();
    expect(boost!.delta).toBe(8);
  });

  it('does not affect combi', () => {
    const result = computeDisruptionRankingAdjustments('combi', {
      ...baseInput,
      preferences: { disruptionTolerance: 'low' },
    });
    expect(result).toHaveLength(0);
  });

  it('does not affect stored_vented', () => {
    const result = computeDisruptionRankingAdjustments('stored_vented', {
      ...baseInput,
      preferences: { disruptionTolerance: 'low' },
    });
    expect(result).toHaveLength(0);
  });
});

describe('deriveDisruptionTradeOffTag', () => {
  it('returns null when disruptionTolerance is medium', () => {
    const tag = deriveDisruptionTradeOffTag('heat_pump', {
      ...baseInput,
      preferences: { disruptionTolerance: 'medium' },
    });
    expect(tag).toBeNull();
  });

  it('returns null when preferences absent', () => {
    expect(deriveDisruptionTradeOffTag('heat_pump', baseInput)).toBeNull();
  });

  it('returns low disruption tag for combi with low tolerance', () => {
    const tag = deriveDisruptionTradeOffTag('combi', {
      ...baseInput,
      preferences: { disruptionTolerance: 'low' },
    });
    expect(tag).toBe('Lower-disruption path preferred due to household installation tolerance');
  });

  it('returns low disruption tag for stored with low tolerance', () => {
    const tag = deriveDisruptionTradeOffTag('stored', {
      ...baseInput,
      preferences: { disruptionTolerance: 'low' },
    });
    expect(tag).toBe('Lower-disruption path preferred due to household installation tolerance');
  });

  it('returns high disruption tag for heat_pump with high tolerance', () => {
    const tag = deriveDisruptionTradeOffTag('heat_pump', {
      ...baseInput,
      preferences: { disruptionTolerance: 'high' },
    });
    expect(tag).toBe('Heat pump remains a strong option because major upgrade works are acceptable');
  });

  it('returns null for heat_pump with low disruption tolerance', () => {
    const tag = deriveDisruptionTradeOffTag('heat_pump', {
      ...baseInput,
      preferences: { disruptionTolerance: 'low' },
    });
    expect(tag).toBeNull();
  });
});

// ─── computeMainsFlowRankingAdjustments ──────────────────────────────────────

import { computeMainsFlowRankingAdjustments } from '../buildRecommendationRanking';

describe('computeMainsFlowRankingAdjustments', () => {
  it('returns empty array for non-combi options regardless of flow', () => {
    const result = computeMainsFlowRankingAdjustments('stored_unvented', {
      ...baseInput,
      mains: { flowRateLpm: 1.0 },
      mainsDynamicFlowLpmKnown: true,
    });
    expect(result).toHaveLength(0);
  });

  it('returns empty array when no flow reading is present', () => {
    const result = computeMainsFlowRankingAdjustments('combi', baseInput);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when flow is above the ignition threshold (≥ 2.5 L/min)', () => {
    const result = computeMainsFlowRankingAdjustments('combi', {
      ...baseInput,
      mains: { flowRateLpm: 15 },
      mainsDynamicFlowLpmKnown: true,
    });
    expect(result).toHaveLength(0);
  });

  it('returns empty array when flow is exactly at the threshold (2.5 L/min)', () => {
    const result = computeMainsFlowRankingAdjustments('combi', {
      ...baseInput,
      mainsDynamicFlowLpm: 2.5,
      mainsDynamicFlowLpmKnown: true,
    });
    expect(result).toHaveLength(0);
  });

  it('applies -25 penalty to combi when mains.flowRateLpm is below threshold', () => {
    const result = computeMainsFlowRankingAdjustments('combi', {
      ...baseInput,
      mains: { flowRateLpm: 2.0 },
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('mains_flow.low_combi');
    expect(result[0].delta).toBe(-25);
  });

  it('applies -25 penalty to combi when flat mainsDynamicFlowLpm is below threshold and known', () => {
    const result = computeMainsFlowRankingAdjustments('combi', {
      ...baseInput,
      mainsDynamicFlowLpm: 1.5,
      mainsDynamicFlowLpmKnown: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].delta).toBe(-25);
  });

  it('does not apply penalty when flow is low but reading is unconfirmed (flat field, not known)', () => {
    const result = computeMainsFlowRankingAdjustments('combi', {
      ...baseInput,
      mainsDynamicFlowLpm: 1.5,
      mainsDynamicFlowLpmKnown: false,
    });
    expect(result).toHaveLength(0);
  });

  it('returns penalty label referencing ignition threshold', () => {
    const result = computeMainsFlowRankingAdjustments('combi', {
      ...baseInput,
      mains: { flowRateLpm: 1.0 },
    });
    expect(result[0].label).toContain('ignition threshold');
  });

  it('fires independently of space priority — no space priority needed', () => {
    // No preferences set at all — penalty should still fire for low confirmed flow
    const noPrefs = { ...baseInput };
    delete (noPrefs as Partial<typeof noPrefs>).preferences;
    const result = computeMainsFlowRankingAdjustments('combi', {
      ...noPrefs,
      mains: { flowRateLpm: 2.0 },
    });
    expect(result).toHaveLength(1);
    expect(result[0].delta).toBe(-25);
  });
});
