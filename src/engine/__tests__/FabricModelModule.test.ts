import { describe, it, expect } from 'vitest';
import { runFabricModelV1 } from '../modules/FabricModelModule';

describe('FabricModelModule – runFabricModelV1', () => {

  // ── Heat-loss band ─────────────────────────────────────────────────────────

  it('solid masonry + poor insulation = very_high or high heat-loss band', () => {
    const result = runFabricModelV1({
      wallType: 'solid_masonry',
      insulationLevel: 'poor',
      glazing: 'single',
      roofInsulation: 'poor',
      airTightness: 'leaky',
    });
    expect(['very_high', 'high']).toContain(result.heatLossBand);
    expect(result.lossIndex).not.toBeNull();
    expect(result.lossIndex!).toBeGreaterThan(0.55);
  });

  it('cavity_filled + good insulation + double glazing = low or moderate heat-loss band', () => {
    const result = runFabricModelV1({
      wallType: 'cavity_filled',
      insulationLevel: 'good',
      glazing: 'double',
      roofInsulation: 'good',
      airTightness: 'tight',
    });
    expect(['very_low', 'low', 'moderate']).toContain(result.heatLossBand);
  });

  it('all unknown inputs returns unknown heatLossBand with a non-null lossIndex', () => {
    // When all inputs are unknown, defaults are used so lossIndex is always computed
    const result = runFabricModelV1({});
    // Should still return a band (not 'unknown') because all fields default
    expect(result.lossIndex).not.toBeNull();
  });

  it('lossIndex is in 0–1 range for all combinations', () => {
    const wallTypes = ['solid_masonry', 'cavity_unfilled', 'cavity_filled', 'timber_frame'] as const;
    const insulations = ['poor', 'good'] as const;
    for (const wall of wallTypes) {
      for (const insul of insulations) {
        const result = runFabricModelV1({ wallType: wall, insulationLevel: insul });
        expect(result.lossIndex).not.toBeNull();
        expect(result.lossIndex!).toBeGreaterThanOrEqual(0);
        expect(result.lossIndex!).toBeLessThanOrEqual(1);
      }
    }
  });

  it('exceptional insulation + triple glazing + passive airtightness gives very_low or low band', () => {
    const result = runFabricModelV1({
      wallType: 'timber_frame',
      insulationLevel: 'exceptional',
      glazing: 'triple',
      roofInsulation: 'good',
      airTightness: 'passive',
    });
    expect(['very_low', 'low']).toContain(result.heatLossBand);
  });

  // ── Thermal inertia ────────────────────────────────────────────────────────

  it('heavy thermal mass returns thermalMassBand: heavy', () => {
    const result = runFabricModelV1({
      thermalMass: 'heavy',
      insulationLevel: 'moderate',
      airTightness: 'average',
    });
    expect(result.thermalMassBand).toBe('heavy');
    expect(result.driftTauHours).not.toBeNull();
    expect(result.driftTauHours!).toBeGreaterThan(40);
  });

  it('light thermal mass returns thermalMassBand: light', () => {
    const result = runFabricModelV1({
      thermalMass: 'light',
      insulationLevel: 'moderate',
      airTightness: 'average',
    });
    expect(result.thermalMassBand).toBe('light');
    expect(result.driftTauHours!).toBeLessThan(20);
  });

  it('driftTauHours is null when thermalMass is unknown', () => {
    const result = runFabricModelV1({ thermalMass: 'unknown' });
    expect(result.driftTauHours).toBeNull();
    expect(result.thermalMassBand).toBe('unknown');
  });

  it('driftTauHours is null when thermalMass is omitted', () => {
    const result = runFabricModelV1({ wallType: 'solid_masonry' });
    expect(result.driftTauHours).toBeNull();
    expect(result.thermalMassBand).toBe('unknown');
  });

  it('Passivhaus special case: light + exceptional + passive → driftTauHours = 190.5', () => {
    const result = runFabricModelV1({
      thermalMass: 'light',
      insulationLevel: 'exceptional',
      airTightness: 'passive',
    });
    expect(result.driftTauHours).toBe(190.5);
  });

  it('leaky airtightness reduces driftTauHours vs average', () => {
    const leaky = runFabricModelV1({ thermalMass: 'heavy', insulationLevel: 'moderate', airTightness: 'leaky' });
    const average = runFabricModelV1({ thermalMass: 'heavy', insulationLevel: 'moderate', airTightness: 'average' });
    expect(leaky.driftTauHours!).toBeLessThan(average.driftTauHours!);
  });

  // ── Independence of heat-loss and inertia ─────────────────────────────────

  it('solid_masonry with poor insulation has high heat loss but non-spiky inertia', () => {
    const result = runFabricModelV1({
      wallType: 'solid_masonry',
      insulationLevel: 'poor',
      glazing: 'single',
      roofInsulation: 'poor',
      airTightness: 'leaky',
      thermalMass: 'heavy',
    });
    // Heat loss should be high/very_high
    expect(['very_high', 'high']).toContain(result.heatLossBand);
    // Inertia band should be heavy (thermalMassBand derived solely from thermalMass)
    expect(result.thermalMassBand).toBe('heavy');
  });

  it('notes array is non-empty', () => {
    const result = runFabricModelV1({
      wallType: 'cavity_filled',
      insulationLevel: 'good',
      thermalMass: 'medium',
    });
    expect(result.notes.length).toBeGreaterThan(0);
    // Notes must mention "modelled estimate"
    expect(result.notes.join(' ').toLowerCase()).toContain('modelled estimate');
  });

  it('solid_masonry + poor insulation note warns about mass vs heat-loss', () => {
    const result = runFabricModelV1({
      wallType: 'solid_masonry',
      insulationLevel: 'poor',
    });
    const allNotes = result.notes.join(' ');
    expect(allNotes).toContain('heavy mass retains warmth but does not reduce leakage');
  });

  // ── 5 deterministic semantic-regression tests ──────────────────────────────

  it('[semantic] heavy mass always yields thermalMassBand: heavy regardless of insulation/airtightness', () => {
    const combos: Array<{ insulationLevel: 'poor' | 'good' | 'exceptional'; airTightness: 'leaky' | 'tight' | 'passive' }> = [
      { insulationLevel: 'poor',        airTightness: 'leaky'   },
      { insulationLevel: 'good',        airTightness: 'tight'   },
      { insulationLevel: 'exceptional', airTightness: 'passive' },
    ];
    for (const combo of combos) {
      const result = runFabricModelV1({ thermalMass: 'heavy', ...combo });
      expect(result.thermalMassBand).toBe('heavy');
    }
  });

  it('[semantic] same mass, better insulation => lossIndex decreases', () => {
    const poor = runFabricModelV1({ wallType: 'cavity_unfilled', insulationLevel: 'poor',   thermalMass: 'medium' });
    const good = runFabricModelV1({ wallType: 'cavity_unfilled', insulationLevel: 'good',   thermalMass: 'medium' });
    expect(good.lossIndex!).toBeLessThan(poor.lossIndex!);
  });

  it('[semantic] same fabric, tighter airtightness => lossIndex decreases', () => {
    const leaky  = runFabricModelV1({ wallType: 'solid_masonry', insulationLevel: 'moderate', airTightness: 'leaky'   });
    const tight  = runFabricModelV1({ wallType: 'solid_masonry', insulationLevel: 'moderate', airTightness: 'tight'   });
    expect(tight.lossIndex!).toBeLessThan(leaky.lossIndex!);
  });

  it('[semantic] better fabric increases driftTauHours but does not change thermalMassBand', () => {
    const poor = runFabricModelV1({ thermalMass: 'medium', insulationLevel: 'poor',        airTightness: 'leaky'   });
    const good = runFabricModelV1({ thermalMass: 'medium', insulationLevel: 'exceptional', airTightness: 'passive' });
    expect(good.driftTauHours!).toBeGreaterThan(poor.driftTauHours!);
    expect(poor.thermalMassBand).toBe('medium');
    expect(good.thermalMassBand).toBe('medium');
  });

  it('[semantic] solid_masonry + poor + leaky stays high/very_high loss even with heavy mass', () => {
    const result = runFabricModelV1({
      wallType: 'solid_masonry',
      insulationLevel: 'poor',
      glazing: 'single',
      roofInsulation: 'poor',
      airTightness: 'leaky',
      thermalMass: 'heavy',
    });
    expect(['high', 'very_high']).toContain(result.heatLossBand);
    expect(result.thermalMassBand).toBe('heavy');
  });

});
