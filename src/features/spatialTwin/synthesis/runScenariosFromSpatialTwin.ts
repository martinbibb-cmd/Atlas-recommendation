/**
 * runScenariosFromSpatialTwin.ts — PR6
 *
 * Runs the Atlas engine for each design scenario that is included in the report,
 * and returns a ScenarioResultEnvelope per scenario.
 *
 * Flow per scenario:
 *   1. Project base model through the scenario's ordered patch stack.
 *   2. Build an engine input from the projected model + survey overrides.
 *   3. Run the engine to produce an EngineOutputV1.
 *   4. Compute the spatial delta summary (differences from base model).
 *   5. Derive a ScenarioRecommendationSummary from the engine output.
 *   6. Return the complete ScenarioResultEnvelope.
 *
 * Scenarios with `includeInReport === false` are silently skipped.
 *
 * The base model is never mutated.
 */

import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type { SpatialTwinFeatureState, SpatialTwinModelV1 } from '../state/spatialTwin.types';
import type { ScenarioResultEnvelope } from './ScenarioSynthesisModel';
import { applyScenarioPatches } from '../patches/applyScenarioPatches';
import { buildSpatialTwinCompareSummary } from '../compare/buildSpatialTwinCompareSummary';
import { projectSpatialTwinToEngineInput } from '../engine/projectSpatialTwinToEngineInput';
import { runEngine } from '../../../engine/Engine';
import { buildScenarioRecommendationSummary } from './buildScenarioRecommendationSummary';

/** Minimum required fields merged in when the survey partial is under-specified. */
const ENGINE_INPUT_DEFAULTS: Partial<EngineInputV2_3> = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.0,
  bathroomCount: 1,
  occupancyCount: 2,
  heatLossWatts: 6000,
  radiatorCount: 8,
  returnWaterTemp: 50,
  buildingMass: 'medium',
  highOccupancy: false,
  preferCombi: false,
  currentHeatSourceType: 'combi',
  occupancySignature: 'steady',
};

/**
 * Merge defaults, spatial projection, and explicit survey overrides into a
 * complete EngineInputV2_3 ready for the engine runner.
 */
function buildEngineInput(
  projected: SpatialTwinModelV1,
  surveyOverrides: Partial<EngineInputV2_3>,
): EngineInputV2_3 {
  const spatialProjection = projectSpatialTwinToEngineInput(projected, {}, 'proposed');
  return {
    ...ENGINE_INPUT_DEFAULTS,
    ...spatialProjection,
    ...surveyOverrides,
  } as EngineInputV2_3;
}

/**
 * Run the Atlas engine for every included scenario in the spatial twin feature
 * state and return one ScenarioResultEnvelope per scenario.
 *
 * Scenarios where `includeInReport === false` are skipped.
 * When the base model is null, an empty array is returned.
 *
 * @param state          Current SpatialTwinFeatureState (read-only, never mutated).
 * @param surveyOverrides Survey data used to supplement the spatial projection.
 * @returns              Array of derived envelopes, one per included scenario.
 */
export function runScenariosFromSpatialTwin(
  state: SpatialTwinFeatureState,
  surveyOverrides: Partial<EngineInputV2_3> = {},
): ScenarioResultEnvelope[] {
  if (state.model == null) return [];

  const base = state.model;
  const includedScenarios = state.scenarios.filter(s => s.includeInReport !== false);

  return includedScenarios.map<ScenarioResultEnvelope>(scenario => {
    const patches = state.patchesByScenario[scenario.scenarioId] ?? [];
    const projected = applyScenarioPatches(base, patches);

    const engineInput = buildEngineInput(projected, surveyOverrides);
    const fullResult = runEngine(engineInput);
    const engineOutput = fullResult.engineOutput;

    const deltaSummary = buildSpatialTwinCompareSummary(projected);
    const summary = buildScenarioRecommendationSummary(scenario.scenarioId, engineOutput);

    return {
      scenarioId: scenario.scenarioId,
      engineInput,
      engineOutput,
      deltaSummary,
      summary,
    };
  });
}
