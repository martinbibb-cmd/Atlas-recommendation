import { describe, it, expect } from 'vitest';
import {
  inferDhwUseBand,
  inferPlateHexCondition,
  inferCylinderCondition,
  inferBoilerCondition,
} from '../modules/ComponentConditionModule';
import type {
  WaterConditionInputs,
  UsageInputs,
  PlateHexInputs,
  CylinderInputs,
  BoilerConditionInputs,
} from '../modules/ComponentConditionModule';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const softWater: WaterConditionInputs = {
  hardnessBand: 'soft',
  softenerPresent: false,
};

const hardWater: WaterConditionInputs = {
  hardnessBand: 'hard',
  softenerPresent: false,
};

const veryHardWater: WaterConditionInputs = {
  hardnessBand: 'very_hard',
  softenerPresent: false,
};

const veryHardWaterWithSoftener: WaterConditionInputs = {
  hardnessBand: 'very_hard',
  softenerPresent: true,
};

const lowUsage: UsageInputs = {
  dhwUseBand: 'low',
  occupancy: 1,
  simultaneousUseLikely: false,
};

const highUsage: UsageInputs = {
  dhwUseBand: 'high',
  occupancy: 4,
  simultaneousUseLikely: true,
};

const veryHighUsage: UsageInputs = {
  dhwUseBand: 'very_high',
  occupancy: 5,
  simultaneousUseLikely: true,
};

// ─── inferDhwUseBand ──────────────────────────────────────────────────────────

describe('inferDhwUseBand', () => {
  it('returns "low" for a single occupant with one bathroom', () => {
    expect(inferDhwUseBand(1, 1)).toBe('low');
  });

  it('returns "low" for two occupants with one bathroom', () => {
    expect(inferDhwUseBand(2, 1)).toBe('low');
  });

  it('returns "moderate" for three occupants with one bathroom', () => {
    expect(inferDhwUseBand(3, 1)).toBe('moderate');
  });

  it('returns "high" for four occupants with two bathrooms', () => {
    expect(inferDhwUseBand(4, 2)).toBe('high');
  });

  it('returns "very_high" for five occupants with two bathrooms', () => {
    expect(inferDhwUseBand(5, 2)).toBe('very_high');
  });

  it('returns "very_high" when peak concurrent outlets is 3 or more', () => {
    expect(inferDhwUseBand(2, 1, 3)).toBe('very_high');
  });

  it('returns "moderate" when peak concurrent outlets is 2 with single occupant', () => {
    expect(inferDhwUseBand(1, 1, 2)).toBe('moderate');
  });

  it('returns "high" for two occupants with three bathrooms', () => {
    expect(inferDhwUseBand(2, 3)).toBe('high');
  });
});

// ─── inferPlateHexCondition ───────────────────────────────────────────────────

describe('inferPlateHexCondition — conditionBand', () => {
  it('returns "good" for new combi in soft water with good performance', () => {
    const result = inferPlateHexCondition(softWater, lowUsage, {
      applianceAgeYears: 3,
      hotWaterPerformanceBand: 'good',
    });
    expect(result.conditionBand).toBe('good');
  });

  it('returns "moderate" for very hard water without softener and good performance', () => {
    const result = inferPlateHexCondition(veryHardWater, lowUsage, {
      hotWaterPerformanceBand: 'good',
    });
    expect(result.conditionBand).toBe('moderate');
  });

  it('returns "good" for very hard water WITH softener and good performance', () => {
    const result = inferPlateHexCondition(veryHardWaterWithSoftener, lowUsage, {
      hotWaterPerformanceBand: 'good',
    });
    expect(result.conditionBand).toBe('good');
  });

  it('returns "moderate" for slightly reduced performance in soft water', () => {
    const result = inferPlateHexCondition(softWater, lowUsage, {
      hotWaterPerformanceBand: 'slightly_reduced',
    });
    expect(result.conditionBand).toBe('moderate');
  });

  it('returns "poor" for fluctuating performance in hard water with high usage', () => {
    const result = inferPlateHexCondition(hardWater, highUsage, {
      hotWaterPerformanceBand: 'fluctuating',
    });
    expect(result.conditionBand).toBe('poor');
  });

  it('returns "severe" for poor performance in very hard water with very high usage', () => {
    const result = inferPlateHexCondition(veryHardWater, veryHighUsage, {
      hotWaterPerformanceBand: 'poor',
    });
    expect(result.conditionBand).toBe('severe');
  });

  it('returns "poor" for poor performance in soft water at low usage', () => {
    const result = inferPlateHexCondition(softWater, lowUsage, {
      hotWaterPerformanceBand: 'poor',
    });
    expect(result.conditionBand).toBe('poor');
  });

  it('age alone does not push past "moderate" without symptoms', () => {
    const result = inferPlateHexCondition(softWater, lowUsage, {
      applianceAgeYears: 20,
      hotWaterPerformanceBand: 'good',
    });
    // score = 0 (good) + 0 (soft) + 0 (low) + 2 (20yr) = 2 → good
    expect(result.conditionBand).toBe('good');
  });

  it('age amplifies an already-degraded condition', () => {
    const result = inferPlateHexCondition(hardWater, lowUsage, {
      applianceAgeYears: 15,
      hotWaterPerformanceBand: 'slightly_reduced',
    });
    // score = 3 (slightly_reduced) + 2 (hard, no softener) + 0 (low) + 2 (15yr) = 7 → poor
    expect(result.conditionBand).toBe('poor');
  });
});

describe('inferPlateHexCondition — foulingFactor', () => {
  it('is 1.00 for good condition', () => {
    const result = inferPlateHexCondition(softWater, lowUsage, {
      hotWaterPerformanceBand: 'good',
    });
    expect(result.foulingFactor).toBe(1.0);
  });

  it('is 0.90 for moderate condition', () => {
    const result = inferPlateHexCondition(softWater, lowUsage, {
      hotWaterPerformanceBand: 'slightly_reduced',
    });
    expect(result.conditionBand).toBe('moderate');
    expect(result.foulingFactor).toBe(0.90);
  });

  it('is 0.80 for poor condition', () => {
    const result = inferPlateHexCondition(softWater, lowUsage, {
      hotWaterPerformanceBand: 'poor',
    });
    expect(result.foulingFactor).toBe(0.80);
  });

  it('is 0.70 for severe condition', () => {
    const result = inferPlateHexCondition(veryHardWater, veryHighUsage, {
      hotWaterPerformanceBand: 'poor',
    });
    expect(result.foulingFactor).toBe(0.70);
  });
});

describe('inferPlateHexCondition — confidence', () => {
  it('is "high" when hotWaterPerformanceBand is set and water is hard', () => {
    const result = inferPlateHexCondition(hardWater, lowUsage, {
      hotWaterPerformanceBand: 'good',
    });
    expect(result.confidence).toBe('high');
  });

  it('is "medium" when hotWaterPerformanceBand is set but water is soft', () => {
    const result = inferPlateHexCondition(softWater, lowUsage, {
      hotWaterPerformanceBand: 'slightly_reduced',
    });
    expect(result.confidence).toBe('medium');
  });

  it('is "medium" when water is hard but no performance band provided', () => {
    const result = inferPlateHexCondition(hardWater, lowUsage, {});
    expect(result.confidence).toBe('medium');
  });

  it('is "low" when neither performance band nor hardness is provided', () => {
    const result = inferPlateHexCondition(softWater, lowUsage, {});
    expect(result.confidence).toBe('low');
  });

  it('a 5-year-old HEX in brutal water can be worse than a 12-year-old in soft water', () => {
    const youngHardWater = inferPlateHexCondition(
      { hardnessBand: 'very_hard', softenerPresent: false },
      { dhwUseBand: 'high', occupancy: 4, simultaneousUseLikely: true },
      { applianceAgeYears: 5, hotWaterPerformanceBand: 'fluctuating' },
    );
    const oldSoftWater = inferPlateHexCondition(
      { hardnessBand: 'soft', softenerPresent: false },
      { dhwUseBand: 'low', occupancy: 2, simultaneousUseLikely: false },
      { applianceAgeYears: 12, hotWaterPerformanceBand: 'good' },
    );
    expect(youngHardWater.foulingFactor).toBeLessThan(oldSoftWater.foulingFactor);
  });
});

// ─── inferCylinderCondition ───────────────────────────────────────────────────

describe('inferCylinderCondition — insulationFactor', () => {
  it('modern_factory cylinder in good condition has near-perfect insulation', () => {
    const result = inferCylinderCondition(softWater, lowUsage, {
      cylinderType: 'modern_factory',
      retentionBand: 'good',
    });
    expect(result.insulationFactor).toBeGreaterThanOrEqual(0.94);
  });

  it('copper cylinder has lower insulation baseline than modern_factory', () => {
    const copper = inferCylinderCondition(softWater, lowUsage, {
      cylinderType: 'copper',
      retentionBand: 'good',
    });
    const modern = inferCylinderCondition(softWater, lowUsage, {
      cylinderType: 'modern_factory',
      retentionBand: 'good',
    });
    expect(copper.insulationFactor).toBeLessThan(modern.insulationFactor);
  });

  it('poor retention band reduces insulationFactor', () => {
    const poor = inferCylinderCondition(softWater, lowUsage, {
      cylinderType: 'foam_lagged',
      retentionBand: 'poor',
    });
    const good = inferCylinderCondition(softWater, lowUsage, {
      cylinderType: 'foam_lagged',
      retentionBand: 'good',
    });
    expect(poor.insulationFactor).toBeLessThan(good.insulationFactor);
  });

  it('20+ year age band reduces insulationFactor', () => {
    const aged = inferCylinderCondition(softWater, lowUsage, {
      cylinderType: 'foam_lagged',
      ageBand: '20+',
      retentionBand: 'good',
    });
    const young = inferCylinderCondition(softWater, lowUsage, {
      cylinderType: 'foam_lagged',
      ageBand: '<5',
      retentionBand: 'good',
    });
    expect(aged.insulationFactor).toBeLessThan(young.insulationFactor);
  });

  it('insulationFactor is never below 0.65 (minimum floor)', () => {
    const result = inferCylinderCondition(veryHardWater, veryHighUsage, {
      cylinderType: 'copper',
      ageBand: '20+',
      retentionBand: 'poor',
    });
    expect(result.insulationFactor).toBeGreaterThanOrEqual(0.65);
  });

  it('mixergy cylinder has highest insulation baseline', () => {
    const mixergy = inferCylinderCondition(softWater, lowUsage, {
      cylinderType: 'mixergy',
      retentionBand: 'good',
    });
    const modern = inferCylinderCondition(softWater, lowUsage, {
      cylinderType: 'modern_factory',
      retentionBand: 'good',
    });
    expect(mixergy.insulationFactor).toBeGreaterThanOrEqual(modern.insulationFactor);
  });
});

describe('inferCylinderCondition — coilTransferFactor', () => {
  it('is 1.00 in soft water with low usage and no age penalty', () => {
    const result = inferCylinderCondition(softWater, lowUsage, {
      cylinderType: 'modern_factory',
      retentionBand: 'good',
    });
    expect(result.coilTransferFactor).toBe(1.0);
  });

  it('is below 1.0 in very hard water without softener', () => {
    const result = inferCylinderCondition(veryHardWater, lowUsage, {
      cylinderType: 'modern_factory',
      retentionBand: 'good',
    });
    expect(result.coilTransferFactor).toBeLessThan(1.0);
  });

  it('is higher with softener than without in very hard water', () => {
    const withSoftener = inferCylinderCondition(
      veryHardWaterWithSoftener,
      lowUsage,
      { cylinderType: 'foam_lagged', retentionBand: 'good' },
    );
    const withoutSoftener = inferCylinderCondition(
      veryHardWater,
      lowUsage,
      { cylinderType: 'foam_lagged', retentionBand: 'good' },
    );
    expect(withSoftener.coilTransferFactor).toBeGreaterThan(withoutSoftener.coilTransferFactor);
  });

  it('poor retention band reduces coilTransferFactor', () => {
    const poor = inferCylinderCondition(hardWater, highUsage, {
      cylinderType: 'foam_lagged',
      ageBand: '10-20',
      retentionBand: 'poor',
    });
    const good = inferCylinderCondition(hardWater, highUsage, {
      cylinderType: 'foam_lagged',
      ageBand: '10-20',
      retentionBand: 'good',
    });
    expect(poor.coilTransferFactor).toBeLessThan(good.coilTransferFactor);
  });
});

describe('inferCylinderCondition — conditionBand and confidence', () => {
  it('returns "good" conditionBand for modern cylinder in soft water', () => {
    const result = inferCylinderCondition(softWater, lowUsage, {
      cylinderType: 'modern_factory',
      retentionBand: 'good',
    });
    expect(result.conditionBand).toBe('good');
  });

  it('returns "poor" or "severe" for aged copper cylinder in very hard water', () => {
    const result = inferCylinderCondition(veryHardWater, highUsage, {
      cylinderType: 'copper',
      ageBand: '20+',
      retentionBand: 'poor',
    });
    expect(['poor', 'severe']).toContain(result.conditionBand);
  });

  it('confidence is "high" when cylinderType is known and retention is not good', () => {
    const result = inferCylinderCondition(softWater, lowUsage, {
      cylinderType: 'foam_lagged',
      retentionBand: 'poor',
    });
    expect(result.confidence).toBe('high');
  });

  it('confidence is "medium" when cylinderType is known but retention defaults to good', () => {
    const result = inferCylinderCondition(softWater, lowUsage, {
      cylinderType: 'modern_factory',
      retentionBand: 'good',
    });
    expect(result.confidence).toBe('medium');
  });

  it('confidence is "low" when cylinderType is unknown and no retention signal', () => {
    const result = inferCylinderCondition(softWater, lowUsage, {
      cylinderType: 'unknown',
    });
    expect(result.confidence).toBe('low');
  });

  it('confidence is "medium" when cylinderType is unknown but retention is poor', () => {
    const result = inferCylinderCondition(softWater, lowUsage, {
      cylinderType: 'unknown',
      retentionBand: 'poor',
    });
    expect(result.confidence).toBe('medium');
  });
});

// ─── Degradation realism checks ───────────────────────────────────────────────

describe('ComponentConditionModule — degradation realism', () => {
  it('5-year cylinder in brutal water + poor retention is worse than 15-year in soft water with good retention', () => {
    const youngBrutal = inferCylinderCondition(
      { hardnessBand: 'very_hard', softenerPresent: false },
      { dhwUseBand: 'very_high', occupancy: 5, simultaneousUseLikely: true },
      { cylinderType: 'foam_lagged', ageBand: '5-10', retentionBand: 'poor' },
    );
    const oldSoft = inferCylinderCondition(
      { hardnessBand: 'soft', softenerPresent: false },
      { dhwUseBand: 'low', occupancy: 2, simultaneousUseLikely: false },
      { cylinderType: 'foam_lagged', ageBand: '10-20', retentionBand: 'good' },
    );
    expect(youngBrutal.coilTransferFactor).toBeLessThanOrEqual(oldSoft.coilTransferFactor);
  });

  it('softener in very hard water significantly reduces plate HEX fouling vs no softener', () => {
    const withSoftener = inferPlateHexCondition(
      { hardnessBand: 'very_hard', softenerPresent: true },
      highUsage,
      { hotWaterPerformanceBand: 'good' },
    );
    const noSoftener = inferPlateHexCondition(
      { hardnessBand: 'very_hard', softenerPresent: false },
      highUsage,
      { hotWaterPerformanceBand: 'good' },
    );
    expect(withSoftener.foulingFactor).toBeGreaterThan(noSoftener.foulingFactor);
  });
});

// ─── CylinderInputs without retentionBand (optional) ─────────────────────────

describe('inferCylinderCondition — optional retentionBand', () => {
  it('works when retentionBand is omitted (defaults to good behaviour)', () => {
    const hexInput: CylinderInputs = {
      cylinderType: 'foam_lagged',
      ageBand: '5-10',
    };
    const result = inferCylinderCondition(softWater, lowUsage, hexInput);
    expect(result.insulationFactor).toBeGreaterThan(0.65);
    expect(result.coilTransferFactor).toBeGreaterThan(0.65);
  });
});

// ─── PlateHexInputs without hotWaterPerformanceBand (optional) ───────────────

describe('inferPlateHexCondition — optional hotWaterPerformanceBand', () => {
  it('works when hotWaterPerformanceBand is omitted (defaults to good)', () => {
    const hexInput: PlateHexInputs = { applianceAgeYears: 5 };
    const result = inferPlateHexCondition(softWater, lowUsage, hexInput);
    expect(result.conditionBand).toBe('good');
    expect(result.foulingFactor).toBe(1.0);
  });
});

// ─── inferBoilerCondition ─────────────────────────────────────────────────────

describe('inferBoilerCondition', () => {

  // ── Good band ────────────────────────────────────────────────────────────

  it('returns good for a new condensing boiler with no symptoms', () => {
    const input: BoilerConditionInputs = { ageYears: 3, condensing: 'yes' };
    const result = inferBoilerCondition(input);
    expect(result.conditionBand).toBe('good');
  });

  it('returns good when all inputs are absent (no signals)', () => {
    const result = inferBoilerCondition({});
    expect(result.conditionBand).toBe('good');
  });

  it('returns good for a 7-year-old condensing boiler with no symptoms', () => {
    const input: BoilerConditionInputs = { ageYears: 7, condensing: 'yes' };
    const result = inferBoilerCondition(input);
    expect(result.conditionBand).toBe('good');
  });

  // ── Moderate band ─────────────────────────────────────────────────────────

  it('returns moderate for a 15-year-old condensing boiler with no symptoms', () => {
    const input: BoilerConditionInputs = { ageYears: 15, condensing: 'yes' };
    const result = inferBoilerCondition(input);
    expect(result.conditionBand).toBe('moderate');
  });

  it('returns moderate for an 8-year-old non-condensing boiler', () => {
    // age=8 (+1) + non-condensing (+3) = 4 → moderate
    const input: BoilerConditionInputs = { ageYears: 8, condensing: 'no' };
    const result = inferBoilerCondition(input);
    expect(result.conditionBand).toBe('moderate');
  });

  it('returns moderate for a mildly oversized condensing boiler aged 12', () => {
    // age=12 (+2) + mild_oversize (+1) = 3 → moderate
    const input: BoilerConditionInputs = {
      ageYears: 12,
      condensing: 'yes',
      oversizeBand: 'mild_oversize',
    };
    const result = inferBoilerCondition(input);
    expect(result.conditionBand).toBe('moderate');
  });

  // ── Poor band ─────────────────────────────────────────────────────────────

  it('returns poor for a 20-year-old condensing boiler with no symptoms', () => {
    // age=20 (+4) + condensing → no extra = 4, but mild oversize adds up
    // age=20 (+4) alone = moderate; add oversize oversized (+2) = 6 → poor
    const input: BoilerConditionInputs = {
      ageYears: 20,
      condensing: 'yes',
      oversizeBand: 'oversized',
    };
    const result = inferBoilerCondition(input);
    expect(result.conditionBand).toBe('poor');
  });

  it('returns poor for a 20-year-old non-condensing boiler', () => {
    // age=20 (+4) + non-condensing (+3) = 7 → poor
    const input: BoilerConditionInputs = { ageYears: 20, condensing: 'no' };
    const result = inferBoilerCondition(input);
    expect(result.conditionBand).toBe('poor');
  });

  it('returns poor for a 15-year-old boiler with cavitation noise', () => {
    // age=15 (+3) + condensing=no (+3) + noise (+2) = 8 → poor
    const input: BoilerConditionInputs = {
      ageYears: 15,
      condensing: 'no',
      boilerCavitationOrNoise: true,
    };
    const result = inferBoilerCondition(input);
    expect(result.conditionBand).toBe('poor');
  });

  // ── Severe band ───────────────────────────────────────────────────────────

  it('returns severe for an old non-condensing aggressively oversized boiler', () => {
    // age=15 (+3) + non-condensing (+3) + aggressive (+3) = 9 → severe
    const input: BoilerConditionInputs = {
      ageYears: 15,
      condensing: 'no',
      oversizeBand: 'aggressive',
    };
    const result = inferBoilerCondition(input);
    expect(result.conditionBand).toBe('severe');
  });

  it('returns severe for a 20-year-old non-condensing boiler with noise and repeated failures', () => {
    // age=20 (+4) + non-condensing (+3) + noise (+2) + failures (+1) = 10 → severe
    const input: BoilerConditionInputs = {
      ageYears: 20,
      condensing: 'no',
      boilerCavitationOrNoise: true,
      repeatedPumpOrValveReplacements: true,
    };
    const result = inferBoilerCondition(input);
    expect(result.conditionBand).toBe('severe');
  });

  // ── Confidence ────────────────────────────────────────────────────────────

  it('returns high confidence when both age and condensing status are known', () => {
    const input: BoilerConditionInputs = { ageYears: 10, condensing: 'yes' };
    const result = inferBoilerCondition(input);
    expect(result.confidence).toBe('high');
  });

  it('returns medium confidence when only age is known', () => {
    const input: BoilerConditionInputs = { ageYears: 10 };
    const result = inferBoilerCondition(input);
    expect(result.confidence).toBe('medium');
  });

  it('returns medium confidence when only condensing status is known', () => {
    const input: BoilerConditionInputs = { condensing: 'no' };
    const result = inferBoilerCondition(input);
    expect(result.confidence).toBe('medium');
  });

  it('returns low confidence when no age or condensing signal is present', () => {
    const result = inferBoilerCondition({});
    expect(result.confidence).toBe('low');
  });

  it('returns medium confidence when condensing is unknown (ambiguous)', () => {
    // 'unknown' is not treated as a known signal
    const input: BoilerConditionInputs = { condensing: 'unknown' };
    const result = inferBoilerCondition(input);
    expect(result.confidence).toBe('low');
  });

  // ── Oversize band scoring ─────────────────────────────────────────────────

  it('well_matched oversize adds no score penalty', () => {
    const withWellMatched: BoilerConditionInputs = {
      ageYears: 3, condensing: 'yes', oversizeBand: 'well_matched',
    };
    const withoutOversize: BoilerConditionInputs = { ageYears: 3, condensing: 'yes' };
    expect(inferBoilerCondition(withWellMatched).conditionBand)
      .toBe(inferBoilerCondition(withoutOversize).conditionBand);
  });

  // ── 'unknown' condensing + age>=15 applies a minor penalty ───────────────

  it('applies minor penalty when condensing is unknown and boiler is 15+ years', () => {
    // age=15 (+3) + unknown+age>=15 (+1) = 4 → moderate (same band but higher score)
    const withUnknownOld: BoilerConditionInputs = { ageYears: 15, condensing: 'unknown' };
    const withYesOld: BoilerConditionInputs = { ageYears: 15, condensing: 'yes' };
    // Both should be moderate at age 15, but unknown should have a higher score
    expect(inferBoilerCondition(withUnknownOld).conditionBand).toBe('moderate');
    expect(inferBoilerCondition(withYesOld).conditionBand).toBe('moderate');
  });
});
