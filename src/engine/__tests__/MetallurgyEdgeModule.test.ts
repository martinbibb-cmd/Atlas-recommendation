import { describe, it, expect } from 'vitest';
import { runMetallurgyEdgeModule } from '../modules/MetallurgyEdgeModule';
import type { MetallurgyEdgeInput } from '../schema/EngineInputV2_3';

const softenerHardWater: MetallurgyEdgeInput = {
  hasSoftener: true,
  waterHardnessCategory: 'hard',
};

const noSoftenerSoftWater: MetallurgyEdgeInput = {
  hasSoftener: false,
  waterHardnessCategory: 'soft',
};

const noSoftenerHardWater: MetallurgyEdgeInput = {
  hasSoftener: false,
  waterHardnessCategory: 'hard',
};

describe('MetallurgyEdgeModule', () => {
  it('recommends al_si and activates the WB softener edge when a softener is present', () => {
    const result = runMetallurgyEdgeModule(softenerHardWater);
    expect(result.recommendedMetallurgy).toBe('al_si');
    expect(result.wbSoftenerEdgeActive).toBe(true);
  });

  it('populates softenerCompatibilityFlag when the WB softener edge is active', () => {
    const result = runMetallurgyEdgeModule(softenerHardWater);
    expect(result.softenerCompatibilityFlag).toBeDefined();
    expect(result.softenerCompatibilityFlag).toContain('Worcester Bosch');
  });

  it('recommends stainless_steel for soft water without a softener', () => {
    const result = runMetallurgyEdgeModule(noSoftenerSoftWater);
    expect(result.recommendedMetallurgy).toBe('stainless_steel');
    expect(result.wbSoftenerEdgeActive).toBe(false);
  });

  it('recommends al_si for hard water without a softener', () => {
    const result = runMetallurgyEdgeModule(noSoftenerHardWater);
    expect(result.recommendedMetallurgy).toBe('al_si');
    expect(result.wbSoftenerEdgeActive).toBe(false);
  });

  it('softenerCompatibilityFlag is undefined when no softener is present', () => {
    const result = runMetallurgyEdgeModule(noSoftenerHardWater);
    expect(result.softenerCompatibilityFlag).toBeUndefined();
  });

  it('respects an explicit al_si metallurgy preference', () => {
    const result = runMetallurgyEdgeModule({
      ...noSoftenerSoftWater,
      preferredMetallurgy: 'al_si',
    });
    expect(result.recommendedMetallurgy).toBe('al_si');
  });

  it('respects an explicit stainless_steel preference', () => {
    const result = runMetallurgyEdgeModule({
      ...noSoftenerHardWater,
      preferredMetallurgy: 'stainless_steel',
    });
    expect(result.recommendedMetallurgy).toBe('stainless_steel');
  });

  it('emits a softener conflict warning when stainless_steel is explicitly chosen with a softener', () => {
    const result = runMetallurgyEdgeModule({
      hasSoftener: true,
      waterHardnessCategory: 'very_hard',
      preferredMetallurgy: 'stainless_steel',
    });
    expect(result.notes.some(n => n.includes('Softener Conflict'))).toBe(true);
  });

  it('provides a recommendationReason string', () => {
    const result = runMetallurgyEdgeModule(softenerHardWater);
    expect(result.recommendationReason.length).toBeGreaterThan(0);
  });

  it('returns a non-empty notes array', () => {
    expect(runMetallurgyEdgeModule(softenerHardWater).notes.length).toBeGreaterThan(0);
    expect(runMetallurgyEdgeModule(noSoftenerSoftWater).notes.length).toBeGreaterThan(0);
  });

  it('WB softener edge IS active regardless of water hardness when a softener is present', () => {
    // Softener overrides water hardness – WB edge should still be active because
    // the softener is present regardless of hardness category.
    const result = runMetallurgyEdgeModule({ hasSoftener: true, waterHardnessCategory: 'moderate' });
    expect(result.wbSoftenerEdgeActive).toBe(true);
  });

  it('emits a Primary Bypass Rule note when WB softener edge is active', () => {
    const result = runMetallurgyEdgeModule(softenerHardWater);
    expect(result.notes.some(n => n.includes('Primary Bypass Rule'))).toBe(true);
  });

  it('does not emit a Primary Bypass Rule note when no softener is present', () => {
    const result = runMetallurgyEdgeModule(noSoftenerHardWater);
    expect(result.notes.some(n => n.includes('Primary Bypass Rule'))).toBe(false);
  });
});
