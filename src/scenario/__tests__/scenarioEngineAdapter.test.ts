import { describe, expect, it } from 'vitest';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import { applyScenarioToEngineInput, DEFAULT_SCENARIO_STATE } from '../scenarioEngineAdapter';

const baseInput: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 1.8,
  mainsDynamicFlowLpm: 14,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  bathroomCount: 1,
  occupancyCount: 3,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  occupancySignature: 'professional',
  buildingMass: 'medium',
  highOccupancy: false,
  preferCombi: true,
};

describe('applyScenarioToEngineInput', () => {
  it('adds demand events for demand scenarios', () => {
    const result = applyScenarioToEngineInput(baseInput, {
      ...DEFAULT_SCENARIO_STATE,
      extraShowers: 1,
      kitchenTap: true,
      bathRunning: true,
    });

    expect(result.dayProfile?.dhwEvents).toHaveLength(3);
    expect(result.peakConcurrentOutlets).toBeGreaterThanOrEqual(4);
  });

  it('forces full-day heating band when heatingDemand is active', () => {
    const result = applyScenarioToEngineInput(baseInput, {
      ...DEFAULT_SCENARIO_STATE,
      heatingDemand: true,
    });

    expect(result.dayProfile?.heatingBands).toEqual([
      { startMin: 0, endMin: 24 * 60, targetC: 21 },
    ]);
  });

  it('overrides nominal boiler output when specified', () => {
    const result = applyScenarioToEngineInput(baseInput, {
      ...DEFAULT_SCENARIO_STATE,
      boilerOutputOverrideKw: 18,
    });

    expect(result.currentBoilerOutputKw).toBe(18);
    expect(result.currentSystem?.boiler?.nominalOutputKw).toBe(18);
  });
});
