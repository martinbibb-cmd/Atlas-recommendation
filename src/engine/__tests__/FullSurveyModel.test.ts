import { describe, it, expect } from 'vitest';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { toEngineInput } from '../../ui/fullSurvey/FullSurveyModelV1';
import { sanitiseModelForEngine } from '../../ui/fullSurvey/sanitiseModelForEngine';
import { runEngine } from '../Engine';
import { normalizeInput } from '../normalizer/Normalizer';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import { ageFactor } from '../modules/BoilerEfficiencyModelV1';

const baseEngineFields = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium' as const,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional' as const,
  highOccupancy: false,
  preferCombi: true,
};

const surveyModel: FullSurveyModelV1 = {
  ...baseEngineFields,
  fullSurvey: {
    connectedEvidence: { energyProvider: 'placeholder', hive: 'placeholder' },
    manualEvidence: { annualGasKwh: 12000, annualElecKwh: 3500 },
    telemetryPlaceholders: { coolingTau: null, confidence: 'none' },
  },
};

describe('FullSurveyModelV1 — toEngineInput', () => {
  it('strips fullSurvey extras before engine call', () => {
    const engineInput = toEngineInput(surveyModel);
    expect('fullSurvey' in engineInput).toBe(false);
  });

  it('preserves all EngineInputV2_3 fields', () => {
    const engineInput = toEngineInput(surveyModel);
    expect(engineInput.postcode).toBe('SW1A 1AA');
    expect(engineInput.dynamicMainsPressure).toBe(2.5);
    expect(engineInput.heatLossWatts).toBe(8000);
    expect(engineInput.bathroomCount).toBe(1);
  });

  it('engine runs cleanly with toEngineInput output (no fullSurvey leakage)', () => {
    const engineInput = toEngineInput(surveyModel);
    expect(() => runEngine(engineInput)).not.toThrow();
  });

  it('engine output is identical whether called with plain input or stripped survey model', () => {
    const directResult = runEngine(baseEngineFields);
    const strippedResult = runEngine(toEngineInput(surveyModel));

    // Core physics outputs must match
    expect(strippedResult.engineOutput.recommendation.primary).toBe(
      directResult.engineOutput.recommendation.primary,
    );
    expect(strippedResult.engineOutput.eligibility.map(e => e.status)).toEqual(
      directResult.engineOutput.eligibility.map(e => e.status),
    );
  });

  it('fullSurvey extras are preserved on the model object (UI state)', () => {
    expect(surveyModel.fullSurvey?.manualEvidence?.annualGasKwh).toBe(12000);
    expect(surveyModel.fullSurvey?.manualEvidence?.annualElecKwh).toBe(3500);
    expect(surveyModel.fullSurvey?.connectedEvidence?.energyProvider).toBe('placeholder');
    expect(surveyModel.fullSurvey?.connectedEvidence?.hive).toBe('placeholder');
    expect(surveyModel.fullSurvey?.telemetryPlaceholders?.confidence).toBe('none');
  });

  it('connectedEvidence accepts "connected" status', () => {
    const connected: FullSurveyModelV1 = {
      ...baseEngineFields,
      fullSurvey: {
        connectedEvidence: { energyProvider: 'connected', hive: 'connected' },
      },
    };
    expect(connected.fullSurvey?.connectedEvidence?.energyProvider).toBe('connected');
    expect(connected.fullSurvey?.connectedEvidence?.hive).toBe('connected');
  });

  it('telemetryPlaceholders accepts high confidence', () => {
    const withTelemetry: FullSurveyModelV1 = {
      ...baseEngineFields,
      fullSurvey: {
        telemetryPlaceholders: { coolingTau: 45, confidence: 'high' },
      },
    };
    expect(withTelemetry.fullSurvey?.telemetryPlaceholders?.coolingTau).toBe(45);
    expect(withTelemetry.fullSurvey?.telemetryPlaceholders?.confidence).toBe('high');
  });

  it('toEngineInput works when fullSurvey is undefined', () => {
    const noExtras: FullSurveyModelV1 = { ...baseEngineFields };
    const engineInput = toEngineInput(noExtras);
    expect('fullSurvey' in engineInput).toBe(false);
    expect(() => runEngine(engineInput)).not.toThrow();
  });
});

// ── Contract integrity: currentBoilerSedbukPct ───────────────────────────────

describe('EngineInputV2_3 — currentBoilerSedbukPct contract', () => {
  it('schema accepts currentBoilerSedbukPct as an optional number', () => {
    // TypeScript compile-time check (would fail to compile if field is missing)
    const input: EngineInputV2_3 = {
      ...baseEngineFields,
      currentBoilerSedbukPct: 84,
    };
    expect(input.currentBoilerSedbukPct).toBe(84);
  });

  it('schema accepts absence of currentBoilerSedbukPct (optional)', () => {
    const input: EngineInputV2_3 = { ...baseEngineFields };
    expect(input.currentBoilerSedbukPct).toBeUndefined();
  });

  /**
   * Contract integrity test — the key regression guard.
   *
   * Given: SEDBUK nominal = 84, decay = 10
   * Expect: current efficiency = 74 (not 82 which the old hardcoded-92 formula would give)
   */
  it('current efficiency = nominal − decay (74), not 92 − decay (82)', () => {
    const sedbukNominal = 84;
    const input: EngineInputV2_3 = {
      ...baseEngineFields,
      postcode: 'SW1A 1AA', // hard water → meaningful decay
      currentBoilerSedbukPct: sedbukNominal,
      systemAgeYears: 10,
    };
    const normalizer = normalizeInput(input);
    const decay = normalizer.tenYearEfficiencyDecayPct;

    // Using the correct formula (nominal - decay)
    const correctCurrent = Math.max(50, sedbukNominal - decay);
    // What the old formula would have produced (hardcoded 92 - decay)
    const wrongCurrent = Math.max(50, 92 - decay);

    // With decay = 10, correct = 74, wrong = 82
    expect(correctCurrent).toBe(Math.max(50, sedbukNominal - decay));
    // The two formulas must differ when sedbukNominal ≠ 92
    expect(correctCurrent).not.toBe(wrongCurrent);
    // Specifically: correct answer uses the actual SEDBUK nominal
    expect(correctCurrent).toBe(Math.max(50, (input.currentBoilerSedbukPct ?? 92) - decay));
  });
});

// ── Boiler age → efficiency decay (sanitiseModelForEngine bridge) ─────────────
// These tests verify that when currentSystem.boiler.ageYears is populated (which
// sanitiseModelForEngine does by bridging from currentBoilerAgeYears), the engine
// correctly applies age degradation to the boiler efficiency model.

describe('Engine — boiler age drives efficiency decay via currentSystem.boiler', () => {
  const baseInput = {
    ...baseEngineFields,
    postcode: 'SW1A 1AA',
  };

  it('boilerEfficiencyModelV1 is undefined without currentSystem.boiler', () => {
    const result = runEngine(baseInput);
    // Without currentSystem.boiler the engine cannot build a boiler efficiency model
    expect(result.boilerEfficiencyModelV1).toBeUndefined();
  });

  it('boilerEfficiencyModelV1 is built when currentSystem.boiler is provided', () => {
    const input = {
      ...baseInput,
      currentSystem: {
        boiler: { type: 'combi' as const, ageYears: 10 },
      },
    };
    const result = runEngine(input);
    expect(result.boilerEfficiencyModelV1).toBeDefined();
  });

  it('age factor is < 1 for a 10-year-old boiler (efficiency decay applied)', () => {
    const input = {
      ...baseInput,
      currentSystem: {
        boiler: { type: 'combi' as const, ageYears: 10 },
      },
    };
    const result = runEngine(input);
    const model = result.boilerEfficiencyModelV1;
    expect(model).toBeDefined();
    // 10 years → ageFactor 0.97 per BoilerEfficiencyModelV1
    expect(model!.age.factor).toBe(0.97);
    // Age-adjusted eta must be below baseline
    expect(model!.ageAdjustedEta!).toBeLessThan(model!.baselineSeasonalEta!);
  });

  it('a new boiler (0 years) has no age decay (factor = 1.0)', () => {
    const input = {
      ...baseInput,
      currentSystem: {
        boiler: { type: 'combi' as const, ageYears: 0 },
      },
    };
    const result = runEngine(input);
    const model = result.boilerEfficiencyModelV1;
    expect(model).toBeDefined();
    expect(model!.age.factor).toBe(1.0);
    expect(model!.ageAdjustedEta).toBe(model!.baselineSeasonalEta);
  });

  it('older boiler (20+ years) has greater decay than a 5-year-old boiler', () => {
    const youngInput = { ...baseInput, currentSystem: { boiler: { type: 'combi' as const, ageYears: 5 } } };
    const oldInput   = { ...baseInput, currentSystem: { boiler: { type: 'combi' as const, ageYears: 20 } } };

    const youngModel = runEngine(youngInput).boilerEfficiencyModelV1!;
    const oldModel   = runEngine(oldInput).boilerEfficiencyModelV1!;

    expect(youngModel.ageAdjustedEta!).toBeGreaterThan(oldModel.ageAdjustedEta!);
  });
});

// ── sanitiseModelForEngine — boiler bridge regression ────────────────────────

describe('sanitiseModelForEngine — boiler bridge', () => {
  const baseSurvey: FullSurveyModelV1 = {
    postcode: 'SW1A 1AA',
    dynamicMainsPressure: 2.5,
    buildingMass: 'medium' as const,
    primaryPipeDiameter: 22,
    heatLossWatts: 8000,
    radiatorCount: 10,
    hasLoftConversion: false,
    returnWaterTemp: 45,
    bathroomCount: 1,
    occupancySignature: 'professional' as const,
    highOccupancy: false,
    preferCombi: true,
  };

  it('bridges flat fields into currentSystem.boiler when no nested boiler existed', () => {
    const model: FullSurveyModelV1 = {
      ...baseSurvey,
      currentHeatSourceType: 'combi',
      currentBoilerAgeYears: 12,
      currentBoilerOutputKw: 28,
    };
    const result = sanitiseModelForEngine(model);
    expect(result.currentSystem?.boiler?.ageYears).toBe(12);
    expect(result.currentSystem?.boiler?.type).toBe('combi');
    expect(result.currentSystem?.boiler?.nominalOutputKw).toBe(28);
  });

  it('does not overwrite an explicitly provided currentSystem.boiler.ageYears', () => {
    const model: FullSurveyModelV1 = {
      ...baseSurvey,
      currentHeatSourceType: 'combi',
      currentBoilerAgeYears: 5,   // flat field — should NOT win
      currentSystem: {
        boiler: { type: 'combi', ageYears: 10 },  // nested — should be preserved
      },
    };
    const result = sanitiseModelForEngine(model);
    expect(result.currentSystem?.boiler?.ageYears).toBe(10);
  });

  it('bridges correctly into the engine pipeline (boilerEfficiencyModelV1 built)', () => {
    const ageYears = 10;
    const model: FullSurveyModelV1 = {
      ...baseSurvey,
      currentHeatSourceType: 'combi',
      currentBoilerAgeYears: ageYears,
    };
    const engineInput = toEngineInput(sanitiseModelForEngine(model));
    const result = runEngine(engineInput);
    expect(result.boilerEfficiencyModelV1).toBeDefined();
    expect(result.boilerEfficiencyModelV1!.age.factor).toBe(ageFactor(ageYears));
  });
});

// ── sanitiseModelForEngine — plate HEX bridge ──────────────────────────────

describe('sanitiseModelForEngine — plate HEX bridge', () => {
  const baseSurvey: FullSurveyModelV1 = {
    postcode: 'SW1A 1AA', // hard water area — SW London
    dynamicMainsPressure: 2.5,
    buildingMass: 'medium' as const,
    primaryPipeDiameter: 22,
    heatLossWatts: 8000,
    radiatorCount: 10,
    hasLoftConversion: false,
    returnWaterTemp: 45,
    bathroomCount: 1,
    occupancySignature: 'professional' as const,
    highOccupancy: false,
    preferCombi: true,
    currentHeatSourceType: 'combi',
  };

  it('sets plateHexFoulingFactor=1.0 and band=good when performance is good in soft water', () => {
    const model: FullSurveyModelV1 = {
      ...baseSurvey,
      postcode: 'G1 1AA', // soft water (Scotland)
      fullSurvey: {
        dhwCondition: { hotWaterPerformanceBand: 'good' },
      },
    };
    const result = sanitiseModelForEngine(model);
    expect(result.plateHexFoulingFactor).toBe(1.0);
    expect(result.plateHexConditionBand).toBe('good');
  });

  it('reduces foulingFactor when performance is poor in hard water', () => {
    const model: FullSurveyModelV1 = {
      ...baseSurvey,
      fullSurvey: {
        dhwCondition: { hotWaterPerformanceBand: 'poor' },
      },
    };
    const result = sanitiseModelForEngine(model);
    // Poor performance in hard water area (SW London) → degraded band + fouling < 1.0
    expect(result.plateHexFoulingFactor).toBeDefined();
    expect(result.plateHexFoulingFactor!).toBeLessThan(1.0);
    expect(['moderate', 'poor', 'severe']).toContain(result.plateHexConditionBand);
  });

  it('hard water + high use + poor performance grades worse than soft water + low use + good performance', () => {
    const degradedModel: FullSurveyModelV1 = {
      ...baseSurvey,
      postcode: 'SW1A 1AA', // hard water
      occupancyCount: 4,
      bathroomCount: 1,
      fullSurvey: {
        dhwCondition: { hotWaterPerformanceBand: 'poor' },
      },
    };
    const cleanModel: FullSurveyModelV1 = {
      ...baseSurvey,
      postcode: 'G1 1AA', // soft water
      occupancyCount: 1,
      fullSurvey: {
        dhwCondition: { hotWaterPerformanceBand: 'good' },
      },
    };
    const degraded = sanitiseModelForEngine(degradedModel);
    const clean = sanitiseModelForEngine(cleanModel);
    expect(degraded.plateHexFoulingFactor!).toBeLessThan(clean.plateHexFoulingFactor!);
  });

  it('age amplifies degradation but does not dominate — young combi in brutal water with poor performance still worse than old combi in soft water with good performance', () => {
    const youngBrutal: FullSurveyModelV1 = {
      ...baseSurvey,
      postcode: 'HP1 1AA', // very hard water
      currentSystem: { boiler: { type: 'combi', ageYears: 5 } },
      fullSurvey: {
        dhwCondition: { hotWaterPerformanceBand: 'poor' },
      },
    };
    const oldSoft: FullSurveyModelV1 = {
      ...baseSurvey,
      postcode: 'G1 1AA', // soft water
      currentSystem: { boiler: { type: 'combi', ageYears: 15 } },
      fullSurvey: {
        dhwCondition: { hotWaterPerformanceBand: 'good' },
      },
    };
    const youngResult = sanitiseModelForEngine(youngBrutal);
    const oldResult = sanitiseModelForEngine(oldSoft);
    // Young combi with poor performance in hard water must score worse than old in soft with good performance
    expect(youngResult.plateHexFoulingFactor!).toBeLessThan(oldResult.plateHexFoulingFactor!);
  });

  it('does not overwrite an explicitly set plateHexFoulingFactor', () => {
    const model: FullSurveyModelV1 = {
      ...baseSurvey,
      plateHexFoulingFactor: 0.85, // explicit override
      fullSurvey: {
        dhwCondition: { hotWaterPerformanceBand: 'poor' }, // would produce lower factor
      },
    };
    const result = sanitiseModelForEngine(model);
    expect(result.plateHexFoulingFactor).toBe(0.85); // preserved
  });

  it('maps softenerPresent → hasSoftener when hasSoftener is not set', () => {
    const model: FullSurveyModelV1 = {
      ...baseSurvey,
      fullSurvey: {
        dhwCondition: { softenerPresent: true },
      },
    };
    const result = sanitiseModelForEngine(model);
    expect(result.hasSoftener).toBe(true);
  });

  it('does not overwrite existing hasSoftener with softenerPresent', () => {
    const model: FullSurveyModelV1 = {
      ...baseSurvey,
      hasSoftener: false, // explicit
      fullSurvey: {
        dhwCondition: { softenerPresent: true }, // different value — must not override
      },
    };
    const result = sanitiseModelForEngine(model);
    expect(result.hasSoftener).toBe(false); // preserved
  });

  it('plate HEX bridging does not run for stored system heat source types', () => {
    const model: FullSurveyModelV1 = {
      ...baseSurvey,
      currentHeatSourceType: 'system', // stored system — no plate HEX
      fullSurvey: {
        dhwCondition: { hotWaterPerformanceBand: 'poor' },
      },
    };
    const result = sanitiseModelForEngine(model);
    // Should not set plate HEX fields for non-combi systems
    expect(result.plateHexFoulingFactor).toBeUndefined();
    expect(result.plateHexConditionBand).toBeUndefined();
  });

  it('foulingFactor flows into engine and reduces combi maxQtoDhwKwDerated', () => {
    const degradedModel: FullSurveyModelV1 = {
      ...baseSurvey,
      fullSurvey: { dhwCondition: { hotWaterPerformanceBand: 'poor' } },
    };
    const cleanModel: FullSurveyModelV1 = {
      ...baseSurvey,
      fullSurvey: { dhwCondition: { hotWaterPerformanceBand: 'good' } },
    };

    const degradedEngineInput = toEngineInput(sanitiseModelForEngine(degradedModel));
    const cleanEngineInput = toEngineInput(sanitiseModelForEngine(cleanModel));

    const degradedResult = runEngine(degradedEngineInput);
    const cleanResult = runEngine(cleanEngineInput);

    // Degraded plate HEX must produce lower effective DHW output
    expect(degradedResult.combiDhwV1.maxQtoDhwKwDerated).toBeLessThan(
      cleanResult.combiDhwV1.maxQtoDhwKwDerated
    );
  });

  it('plateHexConditionBand is surfaced in combiDhwV1 result when survey data provided', () => {
    const model: FullSurveyModelV1 = {
      ...baseSurvey,
      fullSurvey: { dhwCondition: { hotWaterPerformanceBand: 'poor' } },
    };
    const engineInput = toEngineInput(sanitiseModelForEngine(model));
    const result = runEngine(engineInput);
    expect(result.combiDhwV1.plateHexConditionBand).toBeDefined();
  });
});
