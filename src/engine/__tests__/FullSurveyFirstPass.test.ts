/**
 * FullSurveyFirstPass.test.ts
 *
 * Validates the first-pass survey fast-path requirements:
 *
 *   1. Minimal completion path — the engine can produce a valid result from the
 *      survey's default input values without any further data entry.
 *
 *   2. Simulator can run from first-pass data — the cleaned EngineInputV2_3
 *      produced by sanitiseModelForEngine + toEngineInput is accepted by
 *      runEngine without errors and returns a meaningful recommendation.
 *
 *   3. Routing contract — onComplete receives a clean EngineInputV2_3 that
 *      does NOT contain the fullSurvey UI extras so it can be passed directly
 *      to LabShell.
 */
import { describe, it, expect } from 'vitest';
import { toEngineInput } from '../../ui/fullSurvey/FullSurveyModelV1';
import { sanitiseModelForEngine } from '../../ui/fullSurvey/sanitiseModelForEngine';
import { runEngine } from '../Engine';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';

/**
 * Mirrors the `defaultInput` defined inside FullSurveyStepper — these are the
 * values the survey starts with before the user touches anything.
 */
const SURVEY_DEFAULT_INPUT: FullSurveyModelV1 = {
  postcode: '',
  // dynamicMainsPressure is the legacy required field; dynamicMainsPressureBar is
  // an optional alias (engine reads dynamicMainsPressureBar ?? dynamicMainsPressure).
  dynamicMainsPressure: 1.0,
  buildingMass: 'heavy',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 2,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: false,
  hasMagneticFilter: false,
  installationPolicy: 'full_job',
  dhwTankType: 'standard',
  installerNetwork: 'british_gas',
  fullSurvey: {
    manualEvidence: {},
    telemetryPlaceholders: { coolingTau: null, confidence: 'none' },
  },
};

describe('FullSurveyFirstPass — minimal completion path', () => {
  it('sanitiseModelForEngine accepts default input without throwing', () => {
    expect(() => sanitiseModelForEngine(SURVEY_DEFAULT_INPUT)).not.toThrow();
  });

  it('toEngineInput produces a valid EngineInputV2_3 from default input', () => {
    const cleaned = sanitiseModelForEngine(SURVEY_DEFAULT_INPUT);
    const engineInput = toEngineInput(cleaned);
    expect(engineInput.primaryPipeDiameter).toBe(22);
    expect(engineInput.bathroomCount).toBe(2);
    expect(engineInput.occupancySignature).toBe('professional');
    expect(engineInput.highOccupancy).toBe(false);
    expect(engineInput.heatLossWatts).toBe(8000);
  });

  it('engine runs without error from default survey input (first-pass data only)', () => {
    const cleaned = sanitiseModelForEngine(SURVEY_DEFAULT_INPUT);
    const engineInput = toEngineInput(cleaned);
    expect(() => runEngine(engineInput)).not.toThrow();
  });

  it('engine produces a non-empty recommendation from default survey input', () => {
    const cleaned = sanitiseModelForEngine(SURVEY_DEFAULT_INPUT);
    const engineInput = toEngineInput(cleaned);
    const { engineOutput } = runEngine(engineInput);
    expect(engineOutput.recommendation.primary.length).toBeGreaterThan(0);
  });

  it('engine produces at least one eligibility entry from default survey input', () => {
    const cleaned = sanitiseModelForEngine(SURVEY_DEFAULT_INPUT);
    const engineInput = toEngineInput(cleaned);
    const { engineOutput } = runEngine(engineInput);
    expect(engineOutput.eligibility.length).toBeGreaterThan(0);
  });
});

describe('FullSurveyFirstPass — simulator routing contract', () => {
  it('onComplete payload does not contain fullSurvey UI extras', () => {
    const cleaned = sanitiseModelForEngine(SURVEY_DEFAULT_INPUT);
    const engineInput = toEngineInput(cleaned);
    // Simulates the value passed to onComplete(engineInput) in FullSurveyStepper.
    expect('fullSurvey' in engineInput).toBe(false);
  });

  it('onComplete payload is accepted by runEngine (simulator-ready)', () => {
    const cleaned = sanitiseModelForEngine(SURVEY_DEFAULT_INPUT);
    const engineInput = toEngineInput(cleaned);
    expect(() => runEngine(engineInput)).not.toThrow();
  });

  it('first-pass data with known pressure produces a concrete recommendation', () => {
    const withPressure: FullSurveyModelV1 = {
      ...SURVEY_DEFAULT_INPUT,
      dynamicMainsPressureBar: 2.0,
      mainsDynamicFlowLpm: 14,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      currentHeatSourceType: 'combi',
    };
    const cleaned = sanitiseModelForEngine(withPressure);
    const engineInput = toEngineInput(cleaned);
    const { engineOutput } = runEngine(engineInput);
    expect(engineOutput.recommendation.primary.length).toBeGreaterThan(0);
  });
});

// ─── peakConcurrentOutlets auto-derivation ────────────────────────────────────

describe('FullSurveyFirstPass — peakConcurrentOutlets auto-derivation', () => {
  it('auto-derives peakConcurrentOutlets=2 from a high-simultaneous-use preset when not explicitly set', () => {
    // family_teenagers has simultaneousUseSeverity='high' → should produce 2
    const withPreset: FullSurveyModelV1 = {
      ...SURVEY_DEFAULT_INPUT,
      demandPreset: 'family_teenagers',
      peakConcurrentOutlets: undefined,
    };
    const cleaned = sanitiseModelForEngine(withPreset);
    expect(cleaned.peakConcurrentOutlets).toBe(2);
  });

  it('auto-derives peakConcurrentOutlets=2 from a medium-simultaneous-use preset when not explicitly set', () => {
    // family_young_children has simultaneousUseSeverity='medium' → should produce 2
    const withPreset: FullSurveyModelV1 = {
      ...SURVEY_DEFAULT_INPUT,
      demandPreset: 'family_young_children',
      peakConcurrentOutlets: undefined,
    };
    const cleaned = sanitiseModelForEngine(withPreset);
    expect(cleaned.peakConcurrentOutlets).toBe(2);
  });

  it('auto-derives peakConcurrentOutlets=1 from a low-simultaneous-use preset when not explicitly set', () => {
    // single_working_adult has simultaneousUseSeverity='low' → should produce 1
    const withPreset: FullSurveyModelV1 = {
      ...SURVEY_DEFAULT_INPUT,
      demandPreset: 'single_working_adult',
      peakConcurrentOutlets: undefined,
    };
    const cleaned = sanitiseModelForEngine(withPreset);
    expect(cleaned.peakConcurrentOutlets).toBe(1);
  });

  it('does NOT override peakConcurrentOutlets when the user has explicitly set it', () => {
    // Explicit user value must win over auto-derived value
    const withExplicit: FullSurveyModelV1 = {
      ...SURVEY_DEFAULT_INPUT,
      demandPreset: 'family_teenagers',
      peakConcurrentOutlets: 1,
    };
    const cleaned = sanitiseModelForEngine(withExplicit);
    expect(cleaned.peakConcurrentOutlets).toBe(1);
  });

  it('leaves peakConcurrentOutlets undefined when no demandPreset is set', () => {
    const withoutPreset: FullSurveyModelV1 = {
      ...SURVEY_DEFAULT_INPUT,
      demandPreset: undefined,
      peakConcurrentOutlets: undefined,
    };
    const cleaned = sanitiseModelForEngine(withoutPreset);
    expect(cleaned.peakConcurrentOutlets).toBeUndefined();
  });
});
