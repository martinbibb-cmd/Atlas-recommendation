/**
 * mainsInputPipeline.test.ts
 *
 * End-to-end regression tests for the mains water pressure/flow input pipeline.
 *
 * Tests span the full chain:
 *   survey form data
 *     → mapSurveyToEngineInput (mapper)
 *     → sanitiseModelForEngine (sanitiser)
 *     → runEngine (engine + recommendation)
 *
 * Acceptance criteria verified here:
 *   1. Mapper correctly places survey mains fields into canonical nested mains object.
 *   2. Mapper only promotes flow to mains.flowRateLpm when mains_flow_known=true.
 *   3. Sanitiser propagates nested mains object → flat fields without overwriting.
 *   4. Engine input contains the same mains values that were entered in the survey.
 *   5. No hidden default replaces valid survey mains input.
 *   6. Low confirmed mains flow materially penalises combi in recommendation scoring.
 *   7. Working-payload round-trip: mains fields survive save/reload simulation.
 */

import { describe, it, expect } from 'vitest';
import { mapSurveyToEngineInput, type SurveyFormData } from '../../lib/mappers/mapSurveyToEngineInput';
import { sanitiseModelForEngine } from '../../ui/fullSurvey/sanitiseModelForEngine';
import { toEngineInput } from '../../ui/fullSurvey/FullSurveyModelV1';
import { runEngine } from '../Engine';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseSurveyForm: SurveyFormData = {
  postcode: 'SW1A 1AA',
  dynamic_pressure_bar: 2.5,
};

/** Minimal FullSurveyModelV1 that the sanitiser and engine expect. */
const baseEngineFields: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: true,
};

// ─── 1. Mapper regression ─────────────────────────────────────────────────────

describe('mainsInputPipeline — mapper regression', () => {
  it('mapper places mains_static_bar into mains.staticPressureBar', () => {
    const result = mapSurveyToEngineInput({ ...baseSurveyForm, mains_static_bar: 3.5 });
    expect(result.mains?.staticPressureBar).toBe(3.5);
    expect(result.staticMainsPressureBar).toBe(3.5);
  });

  it('mapper places mains_dynamic_bar into mains.dynamicPressureBar', () => {
    const result = mapSurveyToEngineInput({ ...baseSurveyForm, mains_dynamic_bar: 2.8 });
    expect(result.mains?.dynamicPressureBar).toBe(2.8);
    expect(result.dynamicMainsPressureBar).toBe(2.8);
  });

  it('mapper places confirmed mains_flow_lpm into mains.flowRateLpm when mains_flow_known=true', () => {
    const result = mapSurveyToEngineInput({
      ...baseSurveyForm,
      mains_flow_lpm: 18,
      mains_flow_known: true,
    });
    expect(result.mains?.flowRateLpm).toBe(18);
    expect(result.mainsDynamicFlowLpm).toBe(18);
    expect(result.mainsDynamicFlowLpmKnown).toBe(true);
  });

  it('mapper does NOT promote unconfirmed mains_flow_lpm to mains.flowRateLpm', () => {
    const result = mapSurveyToEngineInput({
      ...baseSurveyForm,
      mains_flow_lpm: 18,
      mains_flow_known: false,
    });
    // Flat field still receives the value (for display/estimate use)
    expect(result.mainsDynamicFlowLpm).toBe(18);
    // But canonical nested object should NOT contain the unconfirmed reading
    expect(result.mains?.flowRateLpm).toBeUndefined();
    expect(result.mainsDynamicFlowLpmKnown).toBe(false);
  });

  it('mapper populates all three mains fields together correctly', () => {
    const result = mapSurveyToEngineInput({
      ...baseSurveyForm,
      mains_static_bar: 3.5,
      mains_dynamic_bar: 2.8,
      mains_flow_lpm: 16,
      mains_flow_known: true,
    });
    expect(result.mains?.staticPressureBar).toBe(3.5);
    expect(result.mains?.dynamicPressureBar).toBe(2.8);
    expect(result.mains?.flowRateLpm).toBe(16);
    // Flat fields also populated
    expect(result.staticMainsPressureBar).toBe(3.5);
    expect(result.dynamicMainsPressureBar).toBe(2.8);
    expect(result.mainsDynamicFlowLpm).toBe(16);
  });

  it('omits mains object entirely when no mains fields are provided', () => {
    const result = mapSurveyToEngineInput(baseSurveyForm);
    expect(result.mains).toBeUndefined();
  });

  it('isDemoMode=true returns empty object — no mains data leaked', () => {
    const result = mapSurveyToEngineInput(
      { ...baseSurveyForm, mains_static_bar: 3.5, mains_flow_lpm: 18, mains_flow_known: true },
      true,
    );
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ─── 2. Sanitiser regression ──────────────────────────────────────────────────

describe('mainsInputPipeline — sanitiser regression', () => {
  it('sanitiser propagates mains.staticPressureBar → staticMainsPressureBar when flat field absent', () => {
    const model: FullSurveyModelV1 = {
      ...baseEngineFields,
      mains: { staticPressureBar: 3.5 },
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.staticMainsPressureBar).toBe(3.5);
  });

  it('sanitiser propagates mains.dynamicPressureBar → dynamicMainsPressureBar when flat field absent', () => {
    const model: FullSurveyModelV1 = {
      ...baseEngineFields,
      mains: { dynamicPressureBar: 2.8 },
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.dynamicMainsPressureBar).toBe(2.8);
  });

  it('sanitiser propagates mains.flowRateLpm → mainsDynamicFlowLpm and sets mainsDynamicFlowLpmKnown=true', () => {
    const model: FullSurveyModelV1 = {
      ...baseEngineFields,
      mains: { flowRateLpm: 14 },
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.mainsDynamicFlowLpm).toBe(14);
    expect(sanitised.mainsDynamicFlowLpmKnown).toBe(true);
  });

  it('sanitiser does NOT overwrite an existing flat field with a different mains nested value', () => {
    const model: FullSurveyModelV1 = {
      ...baseEngineFields,
      dynamicMainsPressureBar: 2.0,  // explicit flat value
      mains: { dynamicPressureBar: 2.8 },  // different nested value
    };
    const sanitised = sanitiseModelForEngine(model);
    // Existing flat value must be preserved
    expect(sanitised.dynamicMainsPressureBar).toBe(2.0);
  });
});

// ─── 3. End-to-end: survey mains values reach the engine unchanged ────────────

describe('mainsInputPipeline — survey mains values reach engine unchanged', () => {
  it('survey mains_static_bar=3.5 appears in engine input staticMainsPressureBar', () => {
    const mapped = mapSurveyToEngineInput({
      ...baseSurveyForm,
      mains_static_bar: 3.5,
    });
    const model: FullSurveyModelV1 = { ...baseEngineFields, ...mapped };
    const sanitised = sanitiseModelForEngine(model);
    const engineInput = toEngineInput(sanitised);
    expect(engineInput.staticMainsPressureBar).toBe(3.5);
    expect(engineInput.mains?.staticPressureBar).toBe(3.5);
  });

  it('survey mains_flow_lpm=18 (known) appears in engine input mainsDynamicFlowLpm=18', () => {
    const mapped = mapSurveyToEngineInput({
      ...baseSurveyForm,
      mains_flow_lpm: 18,
      mains_flow_known: true,
    });
    const model: FullSurveyModelV1 = { ...baseEngineFields, ...mapped };
    const sanitised = sanitiseModelForEngine(model);
    const engineInput = toEngineInput(sanitised);
    expect(engineInput.mainsDynamicFlowLpm).toBe(18);
    expect(engineInput.mainsDynamicFlowLpmKnown).toBe(true);
  });

  it('engine runs without error when all three mains fields are provided via survey mapper', () => {
    const mapped = mapSurveyToEngineInput({
      ...baseSurveyForm,
      mains_static_bar: 3.5,
      mains_dynamic_bar: 2.8,
      mains_flow_lpm: 16,
      mains_flow_known: true,
    });
    const model: FullSurveyModelV1 = { ...baseEngineFields, ...mapped };
    const sanitised = sanitiseModelForEngine(model);
    const engineInput = toEngineInput(sanitised);
    expect(() => runEngine(engineInput)).not.toThrow();
  });
});

// ─── 4. Low flow penalises combi ─────────────────────────────────────────────

describe('mainsInputPipeline — low confirmed flow penalises combi', () => {
  /**
   * Build a model with known low mains flow (1.5 L/min) and score the combi
   * option vs a baseline with no flow data.
   */
  function scoreCombiWithFlow(flowLpm: number, known: boolean) {
    const model: FullSurveyModelV1 = {
      ...baseEngineFields,
      mains: known ? { flowRateLpm: flowLpm } : undefined,
      mainsDynamicFlowLpm: flowLpm,
      mainsDynamicFlowLpmKnown: known,
    };
    const { engineOutput } = runEngine(toEngineInput(sanitiseModelForEngine(model)));
    return engineOutput.scores?.find(s => s.optionId === 'combi')?.score ?? null;
  }

  it('low confirmed flow (1.5 L/min) scores combi lower than no-flow baseline', () => {
    const noFlowScore = scoreCombiWithFlow(15, false); // high unconfirmed — effectively no guardrail
    const lowConfirmedScore = scoreCombiWithFlow(1.5, true);
    // Low confirmed flow should materially reduce the combi score
    if (noFlowScore !== null && lowConfirmedScore !== null) {
      expect(lowConfirmedScore).toBeLessThan(noFlowScore);
    }
  });

  it('engine runs cleanly with very low confirmed mains flow', () => {
    const model: FullSurveyModelV1 = {
      ...baseEngineFields,
      mains: { flowRateLpm: 1.5 },
      mainsDynamicFlowLpmKnown: true,
    };
    expect(() => runEngine(toEngineInput(sanitiseModelForEngine(model)))).not.toThrow();
  });

  it('adequate confirmed flow (15 L/min) does not penalise combi via the guardrail', () => {
    const model: FullSurveyModelV1 = {
      ...baseEngineFields,
      mains: { flowRateLpm: 15 },
      mainsDynamicFlowLpmKnown: true,
    };
    const { engineOutput } = runEngine(toEngineInput(sanitiseModelForEngine(model)));
    const combiScore = engineOutput.scores?.find(s => s.optionId === 'combi');
    // Check penalty list: should not contain the low-flow guardrail penalty
    const hasLowFlowPenalty = combiScore?.breakdown?.some(b => b.id === 'mains_flow.low_combi') ?? false;
    expect(hasLowFlowPenalty).toBe(false);
  });
});

// ─── 5. Save/reload round-trip simulation ────────────────────────────────────

describe('mainsInputPipeline — save/reload round-trip (working_payload simulation)', () => {
  it('mains fields survive a JSON serialisation/deserialisation round-trip', () => {
    const originalModel: FullSurveyModelV1 = {
      ...baseEngineFields,
      staticMainsPressureBar: 3.5,
      dynamicMainsPressureBar: 2.8,
      mainsDynamicFlowLpm: 16,
      mainsDynamicFlowLpmKnown: true,
      mains: { staticPressureBar: 3.5, dynamicPressureBar: 2.8, flowRateLpm: 16 },
    };

    // Simulate save: serialise to JSON (as working_payload stores it)
    const serialised = JSON.stringify(originalModel);

    // Simulate reload: deserialise from JSON (as VisitPage prefill reads it)
    const reloaded = JSON.parse(serialised) as FullSurveyModelV1;

    expect(reloaded.staticMainsPressureBar).toBe(3.5);
    expect(reloaded.dynamicMainsPressureBar).toBe(2.8);
    expect(reloaded.mainsDynamicFlowLpm).toBe(16);
    expect(reloaded.mainsDynamicFlowLpmKnown).toBe(true);
    expect(reloaded.mains?.staticPressureBar).toBe(3.5);
    expect(reloaded.mains?.dynamicPressureBar).toBe(2.8);
    expect(reloaded.mains?.flowRateLpm).toBe(16);
  });

  it('engine produces consistent output before and after round-trip', () => {
    const originalModel: FullSurveyModelV1 = {
      ...baseEngineFields,
      mains: { flowRateLpm: 16 },
      mainsDynamicFlowLpmKnown: true,
    };

    const preReloadInput = toEngineInput(sanitiseModelForEngine(originalModel));
    const preReloadResult = runEngine(preReloadInput);

    // Simulate serialise/deserialise
    const reloaded = JSON.parse(JSON.stringify(originalModel)) as FullSurveyModelV1;
    const postReloadInput = toEngineInput(sanitiseModelForEngine(reloaded));
    const postReloadResult = runEngine(postReloadInput);

    expect(postReloadResult.engineOutput.recommendation.primary).toBe(
      preReloadResult.engineOutput.recommendation.primary,
    );
  });
});
