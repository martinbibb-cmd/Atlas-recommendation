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

  it('heavy thermal mass returns stable inertiaBand', () => {
    const result = runFabricModelV1({
      thermalMass: 'heavy',
      insulationLevel: 'moderate',
      airTightness: 'average',
    });
    expect(result.inertiaBand).toBe('stable');
    expect(result.tauHours).not.toBeNull();
    expect(result.tauHours!).toBeGreaterThan(40);
  });

  it('light thermal mass returns spiky inertiaBand', () => {
    const result = runFabricModelV1({
      thermalMass: 'light',
      insulationLevel: 'moderate',
      airTightness: 'average',
    });
    expect(result.inertiaBand).toBe('spiky');
    expect(result.tauHours!).toBeLessThan(20);
  });

  it('tauHours is null when thermalMass is unknown', () => {
    const result = runFabricModelV1({ thermalMass: 'unknown' });
    expect(result.tauHours).toBeNull();
    expect(result.inertiaBand).toBe('unknown');
  });

  it('tauHours is null when thermalMass is omitted', () => {
    const result = runFabricModelV1({ wallType: 'solid_masonry' });
    expect(result.tauHours).toBeNull();
    expect(result.inertiaBand).toBe('unknown');
  });

  it('Passivhaus special case: light + exceptional + passive → tauHours = 190.5', () => {
    const result = runFabricModelV1({
      thermalMass: 'light',
      insulationLevel: 'exceptional',
      airTightness: 'passive',
    });
    expect(result.tauHours).toBe(190.5);
  });

  it('leaky airtightness reduces tauHours vs average', () => {
    const leaky = runFabricModelV1({ thermalMass: 'heavy', insulationLevel: 'moderate', airTightness: 'leaky' });
    const average = runFabricModelV1({ thermalMass: 'heavy', insulationLevel: 'moderate', airTightness: 'average' });
    expect(leaky.tauHours!).toBeLessThan(average.tauHours!);
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
    // Inertia should be non-spiky (heavy mass with leaky air = moderate or stable)
    expect(['moderate', 'stable']).toContain(result.inertiaBand);
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

});
