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
});
