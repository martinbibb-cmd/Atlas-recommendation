import { describe, it, expect } from 'vitest';
import { buildBoilerEfficiencyModelV1, ageFactor, oversizePenalty } from '../modules/BoilerEfficiencyModelV1';

describe('BoilerEfficiencyModelV1', () => {
  it('applies age + oversize degradation for combi boilers', () => {
    const model = buildBoilerEfficiencyModelV1({
      type: 'combi',
      condensing: 'yes',
      ageYears: 12,
      nominalOutputKw: 30,
      peakHeatLossKw: 12,
      demandHeatKw96: new Array(96).fill(1.5),
    });

    expect(model.baselineSeasonalEta).toBeDefined();
    expect(model.ageAdjustedEta).toBeCloseTo((model.baselineSeasonalEta ?? 0) * 0.94, 3);
    expect(model.oversize?.band).toBe('oversized');
    expect(model.oversize?.penalty).toBe(0.06);
    expect(model.inHomeAdjustedEta).toBeCloseTo((model.ageAdjustedEta ?? 0) * 0.94, 3);
    expect(model.etaSeries96).toHaveLength(96);
  });

  it('applies age-only degradation for system boilers', () => {
    const model = buildBoilerEfficiencyModelV1({
      type: 'system',
      condensing: 'yes',
      ageYears: 9,
      nominalOutputKw: 18,
      peakHeatLossKw: 10,
      demandHeatKw96: new Array(96).fill(2),
    });

    expect(model.oversize).toBeUndefined();
    expect(model.inHomeAdjustedEta).toBe(model.ageAdjustedEta);
  });

  it('uses deterministic helper factors', () => {
    expect(ageFactor(4)).toBe(1);
    expect(ageFactor(14)).toBe(0.94);
    expect(ageFactor(25)).toBe(0.88);

    expect(oversizePenalty('well_matched')).toBe(0);
    expect(oversizePenalty('mild_oversize')).toBe(0.03);
    expect(oversizePenalty('oversized')).toBe(0.06);
    expect(oversizePenalty('aggressive')).toBe(0.09);
  });

  it('uses inputSedbukPct as baseline when no SEDBUK GC lookup result is available', () => {
    // No gcNumber → SEDBUK lookup returns no seasonal eta → inputSedbukPct should be used
    const model = buildBoilerEfficiencyModelV1({
      type: 'combi',
      ageYears: 10,
      inputSedbukPct: 62, // ErP class G
    });

    // baselineSeasonalEta should be 0.62 (62% from inputSedbukPct), not the 0.84 unknown fallback
    expect(model.baselineSeasonalEta).toBeCloseTo(0.62, 3);
    // age factor for 10 years is 0.97
    expect(model.ageAdjustedEta).toBeCloseTo(0.62 * 0.97, 3);
  });

  it('uses inputSedbukPct as baseline for system boilers when no GC lookup available', () => {
    const model = buildBoilerEfficiencyModelV1({
      type: 'system',
      ageYears: 8,
      inputSedbukPct: 80, // ErP class D
    });

    expect(model.baselineSeasonalEta).toBeCloseTo(0.80, 3);
    expect(model.oversize).toBeUndefined(); // no oversize for system boilers
  });

  it('SEDBUK GC database lookup takes precedence over inputSedbukPct', () => {
    // Worcester Bosch Greenstar 30i: GC 47-583-01, seasonalEfficiency 0.91 in sedbuk-mini.json
    const modelWithGc = buildBoilerEfficiencyModelV1({
      type: 'combi',
      gcNumber: '4758301',
      ageYears: 5,
      inputSedbukPct: 62, // should be ignored when GC lookup matches
    });

    // sedbuk.source in BoilerEfficiencyModelV1 is mapped to 'gc' | 'band' | 'unknown'
    expect(modelWithGc.sedbuk.source).toBe('gc');
    expect(modelWithGc.baselineSeasonalEta).toBeCloseTo(0.91, 3);
  });

  it('inputSedbukPct takes priority over SEDBUK band fallback when no GC lookup', () => {
    // No gcNumber → band fallback fires (condensing='yes', age=5 → modern_condensing_recent → 0.92)
    // But inputSedbukPct=62 should override the band fallback
    const modelBandOnly = buildBoilerEfficiencyModelV1({
      type: 'combi',
      condensing: 'yes',
      ageYears: 5,
    });
    const modelWithErp = buildBoilerEfficiencyModelV1({
      type: 'combi',
      condensing: 'yes',
      ageYears: 5,
      inputSedbukPct: 62, // ErP class G — should override band fallback
    });

    // Band-only path: band fallback gives 0.92 (modern_condensing_recent)
    // sedbuk.source in BoilerEfficiencyModelV1 is mapped to 'gc' | 'band' | 'unknown'
    expect(modelBandOnly.sedbuk.source).toBe('band');
    expect(modelBandOnly.baselineSeasonalEta).toBeCloseTo(0.92, 3);

    // ErP path: inputSedbukPct overrides band fallback
    expect(modelWithErp.baselineSeasonalEta).toBeCloseTo(0.62, 3);
  });

  it('disclaimer notes include the baseline source', () => {
    const modelWithErp = buildBoilerEfficiencyModelV1({
      type: 'combi',
      ageYears: 10,
      inputSedbukPct: 62,
    });
    const hasErpNote = modelWithErp.disclaimerNotes.some(n => n.includes('ErP / SEDBUK'));
    expect(hasErpNote).toBe(true);
  });
});
