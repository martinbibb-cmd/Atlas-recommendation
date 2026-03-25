/**
 * PvAssessmentModule.test.ts
 *
 * Regression tests proving that materially different PV configurations produce
 * materially different outputs from runPvAssessmentModule.
 *
 * The acceptance test from the problem statement:
 *   "High-PV-potential homes with poor demand alignment gain more value from
 *    storage-aware systems than low-PV-potential homes."
 */

import { describe, it, expect } from 'vitest';
import { runPvAssessmentModule } from '../modules/PvAssessmentModule';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

/** South-facing, low shading, pitched roof — best-case PV candidate. */
const southFacingLowShade: Partial<EngineInputV2_3> = {
  roofType: 'pitched',
  roofOrientation: 'south',
  solarShading: 'low',
  occupancySignature: 'steady_home',
  dhwTankType: 'standard',
  preferCombi: false,
};

/** North-facing roof — poor PV candidate. */
const northFacingInput: Partial<EngineInputV2_3> = {
  roofType: 'pitched',
  roofOrientation: 'north',
  solarShading: 'low',
  occupancySignature: 'professional',
};

/** South-facing, heavy shading. */
const southHeavyShade: Partial<EngineInputV2_3> = {
  roofType: 'pitched',
  roofOrientation: 'south',
  solarShading: 'high',
  occupancySignature: 'professional',
};

/** South-facing, professional absence pattern, no storage — poor alignment. */
const southAbsentNoStorage: Partial<EngineInputV2_3> = {
  roofType: 'pitched',
  roofOrientation: 'south',
  solarShading: 'low',
  occupancySignature: 'professional',
  preferCombi: true,
};

/** South-facing, daytime home, Mixergy cylinder — best alignment. */
const southMixergyHome: Partial<EngineInputV2_3> = {
  roofType: 'pitched',
  roofOrientation: 'south',
  solarShading: 'low',
  occupancySignature: 'steady_home',
  dhwTankType: 'mixergy',
  preferCombi: false,
};

function run(partial: Partial<EngineInputV2_3>) {
  return runPvAssessmentModule(partial as EngineInputV2_3);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runPvAssessmentModule', () => {

  // ─── pvSuitability ─────────────────────────────────────────────────────────

  it('south-facing, low shading → good pvSuitability', () => {
    expect(run(southFacingLowShade).pvSuitability).toBe('good');
  });

  it('north-facing → limited pvSuitability', () => {
    expect(run(northFacingInput).pvSuitability).toBe('limited');
  });

  it('south-facing with heavy shading → limited pvSuitability', () => {
    expect(run(southHeavyShade).pvSuitability).toBe('limited');
  });

  it('east-facing → fair pvSuitability', () => {
    const input: Partial<EngineInputV2_3> = {
      roofType: 'pitched', roofOrientation: 'east', solarShading: 'low',
      occupancySignature: 'professional',
    };
    expect(run(input).pvSuitability).toBe('fair');
  });

  it('flat roof → fair pvSuitability (feasible but sub-optimal)', () => {
    const input: Partial<EngineInputV2_3> = {
      roofType: 'flat', solarShading: 'low',
      occupancySignature: 'professional',
    };
    expect(run(input).pvSuitability).toBe('fair');
  });

  it('unknown orientation → limited pvSuitability', () => {
    const input: Partial<EngineInputV2_3> = {
      roofType: 'pitched', roofOrientation: 'unknown', solarShading: 'unknown',
      occupancySignature: 'professional',
    };
    expect(run(input).pvSuitability).toBe('limited');
  });

  // ─── pvGenerationTimingProfile ─────────────────────────────────────────────

  it('south-facing → peak_daytime generation profile', () => {
    expect(run(southFacingLowShade).pvGenerationTimingProfile).toBe('peak_daytime');
  });

  it('east-facing → spread generation profile', () => {
    const input: Partial<EngineInputV2_3> = {
      roofOrientation: 'east', solarShading: 'low', occupancySignature: 'professional',
    };
    expect(run(input).pvGenerationTimingProfile).toBe('spread');
  });

  it('north-facing → limited_season generation profile', () => {
    expect(run(northFacingInput).pvGenerationTimingProfile).toBe('limited_season');
  });

  it('heavy shading → limited_season generation profile', () => {
    expect(run(southHeavyShade).pvGenerationTimingProfile).toBe('limited_season');
  });

  // ─── energyDemandAlignment ─────────────────────────────────────────────────

  it('south-facing + daytime home + stored water → aligned', () => {
    expect(run(southFacingLowShade).energyDemandAlignment).toBe('aligned');
  });

  it('south-facing + Mixergy cylinder → aligned (regardless of occupancy)', () => {
    expect(run(southMixergyHome).energyDemandAlignment).toBe('aligned');
  });

  it('south-facing + absent + no storage → poorly_aligned', () => {
    expect(run(southAbsentNoStorage).energyDemandAlignment).toBe('poorly_aligned');
  });

  it('south-facing + absent + stored cylinder → partly_aligned', () => {
    const input: Partial<EngineInputV2_3> = {
      roofOrientation: 'south', solarShading: 'low',
      occupancySignature: 'professional',
      dhwTankType: 'standard',
      preferCombi: false,
    };
    expect(run(input).energyDemandAlignment).toBe('partly_aligned');
  });

  it('limited generation → at most partly_aligned even with storage', () => {
    const input: Partial<EngineInputV2_3> = {
      roofOrientation: 'north', solarShading: 'low',
      occupancySignature: 'steady_home',
      dhwTankType: 'standard', preferCombi: false,
    };
    // Limited season + stored → partly_aligned
    expect(run(input).energyDemandAlignment).toBe('partly_aligned');
  });

  // ─── solarStorageOpportunity ───────────────────────────────────────────────

  it('good suitability + aligned → high storage opportunity', () => {
    expect(run(southMixergyHome).solarStorageOpportunity).toBe('high');
  });

  it('good suitability + poorly aligned → low storage opportunity', () => {
    expect(run(southAbsentNoStorage).solarStorageOpportunity).toBe('low');
  });

  it('limited suitability + no stored water → low storage opportunity', () => {
    expect(run(northFacingInput).solarStorageOpportunity).toBe('low');
  });

  it('good suitability + partly aligned + stored water → medium storage opportunity', () => {
    const input: Partial<EngineInputV2_3> = {
      roofOrientation: 'south', solarShading: 'low',
      occupancySignature: 'professional',
      dhwTankType: 'standard', preferCombi: false,
    };
    // south + absent + stored → partly_aligned → medium
    expect(run(input).solarStorageOpportunity).toBe('medium');
  });

  // ─── Key acceptance test ───────────────────────────────────────────────────

  it('high-PV home with poor demand alignment gains less storage value than one with good alignment', () => {
    const poorAlignment = run(southAbsentNoStorage);   // combi-only, away
    const goodAlignment = run(southMixergyHome);        // Mixergy, home
    const suitabilityOrder = { good: 2, fair: 1, limited: 0 };
    const opportunityOrder = { high: 2, medium: 1, low: 0 };

    // Both homes have same (good) PV suitability
    expect(suitabilityOrder[poorAlignment.pvSuitability]).toBe(suitabilityOrder[goodAlignment.pvSuitability]);

    // But good-alignment home has higher storage capture opportunity
    expect(opportunityOrder[goodAlignment.solarStorageOpportunity])
      .toBeGreaterThan(opportunityOrder[poorAlignment.solarStorageOpportunity]);
  });

  // ─── hasExistingPv ─────────────────────────────────────────────────────────

  it('hasExistingPv is false when solarBoost is absent', () => {
    expect(run(southFacingLowShade).hasExistingPv).toBe(false);
  });

  it('hasExistingPv is true when solarBoost.enabled is true', () => {
    const input: Partial<EngineInputV2_3> = {
      ...southFacingLowShade,
      solarBoost: { enabled: true, source: 'PV_diverter' },
    };
    expect(run(input).hasExistingPv).toBe(true);
  });

  it('hasExistingPv is false when solarBoost.enabled is false', () => {
    const input: Partial<EngineInputV2_3> = {
      ...southFacingLowShade,
      solarBoost: { enabled: false, source: 'PV_diverter' },
    };
    expect(run(input).hasExistingPv).toBe(false);
  });

  // ─── solarNarrativeSignals ─────────────────────────────────────────────────

  it('produces at least one narrative signal for any input', () => {
    expect(run(southFacingLowShade).solarNarrativeSignals.length).toBeGreaterThan(0);
    expect(run(northFacingInput).solarNarrativeSignals.length).toBeGreaterThan(0);
  });

  it('north-facing narrative mentions poor PV suitability', () => {
    const signals = run(northFacingInput).solarNarrativeSignals;
    const hasMention = signals.some(s => s.toLowerCase().includes('north'));
    expect(hasMention).toBe(true);
  });

  it('Mixergy narrative mentions active solar stratification', () => {
    const signals = run(southMixergyHome).solarNarrativeSignals;
    const hasMixergy = signals.some(s => s.toLowerCase().includes('mixergy'));
    expect(hasMixergy).toBe(true);
  });

  it('good PV + high opportunity narrative mentions this home is well positioned', () => {
    const signals = run(southMixergyHome).solarNarrativeSignals;
    const hasPositive = signals.some(s => s.toLowerCase().includes('well positioned'));
    expect(hasPositive).toBe(true);
  });

  // ─── Legacy houseFrontFacing fallback ─────────────────────────────────────

  it('falls back to houseFrontFacing when roofOrientation is absent', () => {
    const northFront: Partial<EngineInputV2_3> = {
      roofType: 'pitched', solarShading: 'low',
      // @ts-expect-error houseFrontFacing is a legacy field not in current typings
      houseFrontFacing: 'north', // north-front → south-facing rear
      occupancySignature: 'professional',
    };
    // north-facing front → south_likely rear per legacy mapping
    const result = run(northFront);
    expect(result.pvSuitability).toBe('good');
  });
});
