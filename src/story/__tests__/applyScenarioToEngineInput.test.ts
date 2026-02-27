import { describe, it, expect } from 'vitest';
import {
  deriveConservativeFlowLpm,
  controlsCyclingPenaltyPct,
  sludgeDerateByCleanlinessStatus,
  deriveOldBoilerConfidence,
  applyCombiSwitchInputs,
  applyOldBoilerRealityInputs,
  applyScenarioToEngineInput,
} from '../applyScenarioToEngineInput';
import type { CombiSwitchInputs, OldBoilerRealityInputs } from '../scenarioRegistry';
import { ERP_TO_NOMINAL_PCT } from '../../engine/utils/efficiency';

// ── deriveConservativeFlowLpm ─────────────────────────────────────────────────

describe('deriveConservativeFlowLpm', () => {
  it('returns low base for low demand', () => {
    expect(deriveConservativeFlowLpm(2, 'low')).toBe(8);
  });

  it('returns medium base for medium demand', () => {
    expect(deriveConservativeFlowLpm(2, 'medium')).toBe(12);
  });

  it('returns high base for high demand with small household', () => {
    expect(deriveConservativeFlowLpm(3, 'high')).toBe(16);
  });

  it('caps result for high occupancy (>=5) with medium demand', () => {
    const result = deriveConservativeFlowLpm(5, 'medium');
    expect(result).toBeLessThanOrEqual(10);
  });

  it('caps result for high occupancy (>=5) with high demand', () => {
    const result = deriveConservativeFlowLpm(6, 'high');
    expect(result).toBeLessThanOrEqual(10);
  });
});

// ── controlsCyclingPenaltyPct ─────────────────────────────────────────────────

describe('controlsCyclingPenaltyPct', () => {
  it('weather_comp has zero penalty', () => {
    expect(controlsCyclingPenaltyPct('weather_comp')).toBe(0);
  });

  it('basic_stat has the highest penalty', () => {
    expect(controlsCyclingPenaltyPct('basic_stat')).toBeGreaterThan(
      controlsCyclingPenaltyPct('prog_stat')
    );
    expect(controlsCyclingPenaltyPct('prog_stat')).toBeGreaterThan(
      controlsCyclingPenaltyPct('modulating')
    );
  });

  it('penalties are non-negative', () => {
    const types: OldBoilerRealityInputs['controlsType'][] = [
      'basic_stat', 'prog_stat', 'modulating', 'weather_comp',
    ];
    for (const t of types) {
      expect(controlsCyclingPenaltyPct(t)).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── sludgeDerateByCleanlinessStatus ──────────────────────────────────────────

describe('sludgeDerateByCleanlinessStatus', () => {
  it('clean has zero derate', () => {
    expect(sludgeDerateByCleanlinessStatus('clean')).toBe(0);
  });

  it('heavy_contamination has the highest derate', () => {
    expect(sludgeDerateByCleanlinessStatus('heavy_contamination')).toBeGreaterThan(
      sludgeDerateByCleanlinessStatus('some_contamination')
    );
  });

  it('unknown is treated conservatively (same as some_contamination)', () => {
    expect(sludgeDerateByCleanlinessStatus('unknown')).toBe(
      sludgeDerateByCleanlinessStatus('some_contamination')
    );
  });
});

// ── deriveOldBoilerConfidence ─────────────────────────────────────────────────

describe('deriveOldBoilerConfidence', () => {
  const baseInputs: OldBoilerRealityInputs = {
    boilerAgeYears: 10,
    manufacturedBand: 'A',
    manufacturedSedbukPctKnown: false,
    manufacturedSedbukPct: 90,
    controlsType: 'basic_stat',
    systemCleanliness: 'unknown',
    filterPresent: 'unknown',
  };

  it('high confidence when sedbukPctKnown + age + cleanliness + filter all known', () => {
    const inputs: OldBoilerRealityInputs = {
      ...baseInputs,
      manufacturedSedbukPctKnown: true,
      boilerAgeYears: 12,
      systemCleanliness: 'clean',
      filterPresent: 'yes',
    };
    expect(deriveOldBoilerConfidence(inputs)).toBe('high');
  });

  it('low confidence when all unknowns', () => {
    const inputs: OldBoilerRealityInputs = {
      ...baseInputs,
      boilerAgeYears: 0,
      manufacturedSedbukPctKnown: false,
      systemCleanliness: 'unknown',
      filterPresent: 'unknown',
    };
    expect(deriveOldBoilerConfidence(inputs)).toBe('low');
  });

  it('medium confidence with partial knowledge', () => {
    const inputs: OldBoilerRealityInputs = {
      ...baseInputs,
      boilerAgeYears: 8,
      systemCleanliness: 'unknown',
      filterPresent: 'unknown',
    };
    // age known = 1 known, everything else unknown
    expect(deriveOldBoilerConfidence(inputs)).toBe('medium');
  });
});

// ── applyCombiSwitchInputs ────────────────────────────────────────────────────

describe('applyCombiSwitchInputs', () => {
  const base: CombiSwitchInputs = {
    occupancyCount: 2,
    bathroomCount: 1,
    simultaneousUse: 'rare',
    mainsFlowLpmKnown: false,
    mainsFlowLpm: 12,
    hotWaterDemand: 'medium',
    storedType: 'unvented',
  };

  it('derives conservative flow when mainsFlowLpmKnown is false', () => {
    const result = applyCombiSwitchInputs({ ...base, mainsFlowLpmKnown: false, hotWaterDemand: 'low' });
    // Conservative flow for low demand, 2 people
    expect(result.mainsDynamicFlowLpm).toBe(deriveConservativeFlowLpm(2, 'low'));
  });

  it('uses exact flow when mainsFlowLpmKnown is true', () => {
    const result = applyCombiSwitchInputs({ ...base, mainsFlowLpmKnown: true, mainsFlowLpm: 18 });
    expect(result.mainsDynamicFlowLpm).toBe(18);
  });

  it('sets peakConcurrentOutlets=2 for often simultaneous use', () => {
    const result = applyCombiSwitchInputs({ ...base, simultaneousUse: 'often', bathroomCount: 2 });
    expect(result.peakConcurrentOutlets).toBe(2);
  });

  it('sets peakConcurrentOutlets=1 for rare simultaneous use with single bathroom', () => {
    const result = applyCombiSwitchInputs({ ...base, simultaneousUse: 'rare', bathroomCount: 1 });
    expect(result.peakConcurrentOutlets).toBe(1);
  });

  it('sets highOccupancy=true for 5+ occupants', () => {
    const result = applyCombiSwitchInputs({ ...base, occupancyCount: 5 });
    expect(result.highOccupancy).toBe(true);
  });

  it('sets highOccupancy=false for <5 occupants', () => {
    const result = applyCombiSwitchInputs({ ...base, occupancyCount: 3 });
    expect(result.highOccupancy).toBe(false);
  });

  it('storedType vented sets coldWaterSource to loft_tank', () => {
    const result = applyCombiSwitchInputs({ ...base, storedType: 'vented' });
    expect(result.coldWaterSource).toBe('loft_tank');
  });

  it('storedType unvented sets coldWaterSource to mains_true', () => {
    const result = applyCombiSwitchInputs({ ...base, storedType: 'unvented' });
    expect(result.coldWaterSource).toBe('mains_true');
  });
});

// ── applyOldBoilerRealityInputs ───────────────────────────────────────────────

describe('applyOldBoilerRealityInputs', () => {
  const base: OldBoilerRealityInputs = {
    boilerAgeYears: 10,
    manufacturedBand: 'B',
    manufacturedSedbukPctKnown: false,
    manufacturedSedbukPct: 88,
    controlsType: 'basic_stat',
    systemCleanliness: 'unknown',
    filterPresent: 'unknown',
  };

  it('uses band midpoint when sedbukPctKnown is false', () => {
    const result = applyOldBoilerRealityInputs({ ...base, manufacturedBand: 'C', manufacturedSedbukPctKnown: false });
    expect(result.currentBoilerSedbukPct).toBe(ERP_TO_NOMINAL_PCT['C']);
  });

  it('uses explicit sedbukPct when known', () => {
    const result = applyOldBoilerRealityInputs({ ...base, manufacturedSedbukPctKnown: true, manufacturedSedbukPct: 85 });
    expect(result.currentBoilerSedbukPct).toBe(85);
  });

  it('sets boiler age in currentSystem', () => {
    const result = applyOldBoilerRealityInputs({ ...base, boilerAgeYears: 15 });
    expect(result.currentSystem?.boiler?.ageYears).toBe(15);
    expect(result.currentBoilerAgeYears).toBe(15);
  });

  it('sets hasMagneticFilter=true when filterPresent is yes', () => {
    const result = applyOldBoilerRealityInputs({ ...base, filterPresent: 'yes' });
    expect(result.hasMagneticFilter).toBe(true);
  });

  it('sets hasMagneticFilter=false when filterPresent is no or unknown', () => {
    expect(applyOldBoilerRealityInputs({ ...base, filterPresent: 'no' }).hasMagneticFilter).toBe(false);
    expect(applyOldBoilerRealityInputs({ ...base, filterPresent: 'unknown' }).hasMagneticFilter).toBe(false);
  });

  it('band mapping is stable at A boundary', () => {
    const result = applyOldBoilerRealityInputs({ ...base, manufacturedBand: 'A', manufacturedSedbukPctKnown: false });
    expect(result.currentBoilerSedbukPct).toBe(ERP_TO_NOMINAL_PCT['A']);
  });

  it('band mapping is stable at G boundary', () => {
    const result = applyOldBoilerRealityInputs({ ...base, manufacturedBand: 'G', manufacturedSedbukPctKnown: false });
    expect(result.currentBoilerSedbukPct).toBe(ERP_TO_NOMINAL_PCT['G']);
  });
});

// ── applyScenarioToEngineInput (unified) ──────────────────────────────────────

describe('applyScenarioToEngineInput', () => {
  const combiBase: CombiSwitchInputs = {
    occupancyCount: 2,
    bathroomCount: 1,
    simultaneousUse: 'rare',
    mainsFlowLpmKnown: false,
    mainsFlowLpm: 12,
    hotWaterDemand: 'medium',
    storedType: 'unvented',
  };

  it('combi_switch storedType vented → compareContext.systemBWaterArchetype === open_vented', () => {
    const { compareContext } = applyScenarioToEngineInput('combi_switch', { ...combiBase, storedType: 'vented' });
    expect(compareContext.systemBWaterArchetype).toBe('open_vented');
  });

  it('combi_switch storedType unvented → compareContext.systemBWaterArchetype === unvented', () => {
    const { compareContext } = applyScenarioToEngineInput('combi_switch', { ...combiBase, storedType: 'unvented' });
    expect(compareContext.systemBWaterArchetype).toBe('unvented');
  });

  it('combi_switch storedType vented → systemB archetype is stored_vented', () => {
    const { compareContext } = applyScenarioToEngineInput('combi_switch', { ...combiBase, storedType: 'vented' });
    expect(compareContext.systemB).toBe('stored_vented');
  });

  it('combi_switch storedType unvented → systemB archetype is stored_unvented', () => {
    const { compareContext } = applyScenarioToEngineInput('combi_switch', { ...combiBase, storedType: 'unvented' });
    expect(compareContext.systemB).toBe('stored_unvented');
  });

  it('combi_switch systemA is always combi', () => {
    const { compareContext } = applyScenarioToEngineInput('combi_switch', combiBase);
    expect(compareContext.systemA).toBe('combi');
  });

  it('combi_switch unknown mains flow → derived engineInput value within expected range', () => {
    const { engineInput } = applyScenarioToEngineInput('combi_switch', {
      ...combiBase,
      mainsFlowLpmKnown: false,
      hotWaterDemand: 'medium',
      occupancyCount: 2,
    });
    // Conservative derived flow for 2 people, medium demand should be 12 L/min
    expect(engineInput.mainsDynamicFlowLpm).toBeGreaterThanOrEqual(6);
    expect(engineInput.mainsDynamicFlowLpm).toBeLessThanOrEqual(20);
    expect(engineInput.mainsDynamicFlowLpm).toBe(deriveConservativeFlowLpm(2, 'medium'));
  });

  it('old_boiler_reality returns compare context with systemA=combi, systemB=combi', () => {
    const oldBoilerBase: OldBoilerRealityInputs = {
      boilerAgeYears: 10,
      manufacturedBand: 'A',
      manufacturedSedbukPctKnown: false,
      manufacturedSedbukPct: 90,
      controlsType: 'basic_stat',
      systemCleanliness: 'unknown',
      filterPresent: 'unknown',
    };
    const { compareContext } = applyScenarioToEngineInput('old_boiler_reality', oldBoilerBase);
    expect(compareContext.systemA).toBe('combi');
    expect(compareContext.systemB).toBe('combi');
    expect(compareContext.systemBWaterArchetype).toBeUndefined();
  });
});
