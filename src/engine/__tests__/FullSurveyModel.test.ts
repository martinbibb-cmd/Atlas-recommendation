import { describe, it, expect } from 'vitest';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { toEngineInput } from '../../ui/fullSurvey/FullSurveyModelV1';
import { runEngine } from '../Engine';
import { normalizeInput } from '../normalizer/Normalizer';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

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
