/**
 * OccupancyPreset.test.ts
 *
 * Tests for the user-facing demand preset catalogue and mapping helpers.
 *
 * Covers:
 *   1. Preset selection — findDemandPreset / getDemandStyleLabel
 *   2. Preset-to-engine mapping — presetToEngineSignature
 *   3. Timing overrides — resolveTimingOverrides
 *   4. Default path without any overrides
 *   5. All presets drive the LifestyleSimulationModule without error
 */
import { describe, it, expect } from 'vitest';
import {
  DEMAND_PRESETS,
  findDemandPreset,
  presetToEngineSignature,
  resolveTimingOverrides,
  getDemandStyleLabel,
  type DemandPresetId,
  type DemandTimingOverrides,
} from '../../engine/schema/OccupancyPreset';
import { runLifestyleSimulationModule } from '../../engine/modules/LifestyleSimulationModule';

// ─── Shared engine base input ─────────────────────────────────────────────────

const baseEngineInput = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium' as const,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  highOccupancy: false,
  preferCombi: true,
};

// ─── 1. Preset catalogue completeness ────────────────────────────────────────

describe('DEMAND_PRESETS catalogue', () => {
  it('contains exactly 11 presets', () => {
    expect(DEMAND_PRESETS).toHaveLength(11);
  });

  it('every preset has a non-empty label, description, emoji, and demandStyleLabel', () => {
    for (const preset of DEMAND_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
      expect(preset.emoji.length).toBeGreaterThan(0);
      expect(preset.demandStyleLabel.length).toBeGreaterThan(0);
    }
  });

  it('every preset defaults object has all required timing keys', () => {
    for (const preset of DEMAND_PRESETS) {
      const d = preset.defaults;
      expect(d.firstShowerHour).toBeDefined();
      expect(d.eveningPeakHour).toBeDefined();
      expect(d.bathFrequencyPerWeek).toBeDefined();
      expect(d.kitchenHotWaterFrequency).toBeDefined();
      expect(d.daytimeOccupancy).toBeDefined();
      expect(d.simultaneousUseSeverity).toBeDefined();
    }
  });

  it('preset ids are unique', () => {
    const ids = DEMAND_PRESETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── 2. findDemandPreset ──────────────────────────────────────────────────────

describe('findDemandPreset', () => {
  it('returns the correct preset for a known id', () => {
    const preset = findDemandPreset('single_working_adult');
    expect(preset).toBeDefined();
    expect(preset!.label).toBe('Single working adult');
  });

  it('returns undefined for an unknown id', () => {
    // Cast to bypass type check — simulates unexpected runtime value
    expect(findDemandPreset('unknown_preset' as DemandPresetId)).toBeUndefined();
  });
});

// ─── 3. Preset-to-engine signature mapping ────────────────────────────────────

describe('presetToEngineSignature', () => {
  it('single_working_adult → professional', () => {
    expect(presetToEngineSignature('single_working_adult')).toBe('professional');
  });

  it('working_couple → professional', () => {
    expect(presetToEngineSignature('working_couple')).toBe('professional');
  });

  it('family_young_children → steady_home', () => {
    expect(presetToEngineSignature('family_young_children')).toBe('steady_home');
  });

  it('family_teenagers → steady_home', () => {
    expect(presetToEngineSignature('family_teenagers')).toBe('steady_home');
  });

  it('retired_couple → steady_home', () => {
    expect(presetToEngineSignature('retired_couple')).toBe('steady_home');
  });

  it('home_worker → steady_home', () => {
    expect(presetToEngineSignature('home_worker')).toBe('steady_home');
  });

  it('shift_worker → shift_worker', () => {
    expect(presetToEngineSignature('shift_worker')).toBe('shift_worker');
  });

  it('multigenerational → steady_home', () => {
    expect(presetToEngineSignature('multigenerational')).toBe('steady_home');
  });

  it('bath_heavy → steady_home', () => {
    expect(presetToEngineSignature('bath_heavy')).toBe('steady_home');
  });

  it('shower_heavy → professional', () => {
    expect(presetToEngineSignature('shower_heavy')).toBe('professional');
  });

  it('weekend_heavy → professional', () => {
    expect(presetToEngineSignature('weekend_heavy')).toBe('professional');
  });

  it('falls back to professional for an unknown id', () => {
    expect(presetToEngineSignature('unknown_preset' as DemandPresetId)).toBe('professional');
  });
});

// ─── 4. resolveTimingOverrides ────────────────────────────────────────────────

describe('resolveTimingOverrides', () => {
  it('returns preset defaults when no overrides are provided', () => {
    const resolved = resolveTimingOverrides('single_working_adult');
    expect(resolved.firstShowerHour).toBe(7);
    expect(resolved.eveningPeakHour).toBe(18);
    expect(resolved.daytimeOccupancy).toBe('absent');
    expect(resolved.simultaneousUseSeverity).toBe('low');
  });

  it('merges a single override on top of preset defaults', () => {
    const resolved = resolveTimingOverrides('single_working_adult', { firstShowerHour: 6 });
    expect(resolved.firstShowerHour).toBe(6);
    // Other fields should come from the preset default
    expect(resolved.eveningPeakHour).toBe(18);
    expect(resolved.daytimeOccupancy).toBe('absent');
  });

  it('merges multiple overrides', () => {
    const overrides: DemandTimingOverrides = {
      firstShowerHour: 5,
      eveningPeakHour: 21,
      bathFrequencyPerWeek: 7,
      daytimeOccupancy: 'partial',
    };
    const resolved = resolveTimingOverrides('working_couple', overrides);
    expect(resolved.firstShowerHour).toBe(5);
    expect(resolved.eveningPeakHour).toBe(21);
    expect(resolved.bathFrequencyPerWeek).toBe(7);
    expect(resolved.daytimeOccupancy).toBe('partial');
    // Non-overridden fields come from preset default
    expect(resolved.kitchenHotWaterFrequency).toBe('medium');
  });

  it('returns a fully-resolved object (no undefined fields)', () => {
    const resolved = resolveTimingOverrides('shift_worker');
    expect(resolved.firstShowerHour).toBeDefined();
    expect(resolved.eveningPeakHour).toBeDefined();
    expect(resolved.bathFrequencyPerWeek).toBeDefined();
    expect(resolved.kitchenHotWaterFrequency).toBeDefined();
    expect(resolved.daytimeOccupancy).toBeDefined();
    expect(resolved.simultaneousUseSeverity).toBeDefined();
  });

  it('family_young_children default bath frequency is 7 (daily)', () => {
    const resolved = resolveTimingOverrides('family_young_children');
    expect(resolved.bathFrequencyPerWeek).toBe(7);
  });

  it('multigenerational default simultaneous use is high', () => {
    const resolved = resolveTimingOverrides('multigenerational');
    expect(resolved.simultaneousUseSeverity).toBe('high');
  });
});

// ─── 5. getDemandStyleLabel ───────────────────────────────────────────────────

describe('getDemandStyleLabel', () => {
  it('returns the demandStyleLabel for a known preset', () => {
    const label = getDemandStyleLabel('family_young_children');
    expect(label).toBe('Family · High morning demand · Evening bath peak');
  });

  it('returns a non-empty string for every known preset', () => {
    for (const preset of DEMAND_PRESETS) {
      expect(getDemandStyleLabel(preset.id).length).toBeGreaterThan(0);
    }
  });

  it('falls back to the preset id for an unknown id', () => {
    const label = getDemandStyleLabel('unknown_preset' as DemandPresetId);
    expect(label).toBe('unknown_preset');
  });
});

// ─── 6. Preset → LifestyleSimulationModule integration ───────────────────────

describe('Preset → LifestyleSimulationModule demand state', () => {
  it('professional-mapped presets recommend boiler', () => {
    const professionalPresets: DemandPresetId[] = [
      'single_working_adult',
      'working_couple',
      'shower_heavy',
      'weekend_heavy',
    ];
    for (const id of professionalPresets) {
      const sig = presetToEngineSignature(id);
      const result = runLifestyleSimulationModule({ ...baseEngineInput, occupancySignature: sig });
      expect(result.recommendedSystem).toBe('boiler');
    }
  });

  it('steady_home-mapped presets recommend ASHP', () => {
    const steadyPresets: DemandPresetId[] = [
      'family_young_children',
      'family_teenagers',
      'retired_couple',
      'home_worker',
      'multigenerational',
      'bath_heavy',
    ];
    for (const id of steadyPresets) {
      const sig = presetToEngineSignature(id);
      const result = runLifestyleSimulationModule({ ...baseEngineInput, occupancySignature: sig });
      expect(result.recommendedSystem).toBe('ashp');
    }
  });

  it('shift_worker preset recommends stored water', () => {
    const sig = presetToEngineSignature('shift_worker');
    const result = runLifestyleSimulationModule({ ...baseEngineInput, occupancySignature: sig });
    expect(result.recommendedSystem).toBe('stored_water');
  });

  it('every preset produces exactly 24 hourly demand entries', () => {
    for (const preset of DEMAND_PRESETS) {
      const sig = presetToEngineSignature(preset.id);
      const result = runLifestyleSimulationModule({ ...baseEngineInput, occupancySignature: sig });
      expect(result.hourlyData).toHaveLength(24);
    }
  });
});

// ─── 7. Default (no-edit) path ────────────────────────────────────────────────

describe('Default path — single_working_adult without timing edits', () => {
  it('resolves without errors using only the preset id', () => {
    expect(() => resolveTimingOverrides('single_working_adult')).not.toThrow();
  });

  it('engine signature is professional', () => {
    expect(presetToEngineSignature('single_working_adult')).toBe('professional');
  });

  it('LifestyleSimulationModule runs cleanly on the default preset mapping', () => {
    const sig = presetToEngineSignature('single_working_adult');
    expect(() =>
      runLifestyleSimulationModule({ ...baseEngineInput, occupancySignature: sig }),
    ).not.toThrow();
  });
});
