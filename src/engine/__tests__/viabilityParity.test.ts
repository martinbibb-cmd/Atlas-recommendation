import { describe, expect, it } from 'vitest';
import { runEngine } from '../Engine';
import { buildScenariosFromEngineOutput } from '../modules/buildScenariosFromEngineOutput';
import { buildCustomerJourneyPack } from '../../library/portal/pdf/buildPortalJourneyPrintModel';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

describe('viability-state parity', () => {
  it('keeps blocked heat-pump viability aligned across engine option, scenario, and PDF pack', () => {
    const input: EngineInputV2_3 = {
      postcode: 'SW1A 1AA',
      dynamicMainsPressure: 2.5,
      buildingMass: 'medium',
      primaryPipeDiameter: 22,
      heatLossWatts: 9500,
      radiatorCount: 10,
      hasLoftConversion: false,
      returnWaterTemp: 55,
      bathroomCount: 2,
      occupancySignature: 'professional',
      highOccupancy: true,
      hasOutdoorSpaceForHeatPump: false,
    };

    const result = runEngine(input);
    const hpOption = result.engineOutput.options?.find((option) => option.id === 'ashp');
    expect(hpOption?.viabilityState).toBe('blocked');

    const scenarios = buildScenariosFromEngineOutput(result.engineOutput);
    const hpScenario = scenarios.find((scenario) => scenario.system.type === 'ashp');
    expect(hpScenario?.viabilityState).toBe('blocked');

    const pack = buildCustomerJourneyPack({
      recommendationSummary: result.engineOutput.recommendation.primary,
      selectedSectionIds: [],
      customerFacts: ['2 bathrooms'],
      journeyType: 'heat_pump',
      recommendationViabilityState: hpOption?.viabilityState,
    });
    expect(pack.staticPdf.recommendationViabilityState).toBe('blocked');
  });
});

