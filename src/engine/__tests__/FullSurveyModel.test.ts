import { describe, it, expect } from 'vitest';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { toEngineInput } from '../../ui/fullSurvey/FullSurveyModelV1';
import { runEngine } from '../Engine';

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
