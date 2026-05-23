import { describe, expect, it } from 'vitest';
import {
  buildDhwRecoveryMetricsV1,
  runLegoTechnixScenarioV1,
} from '..';
import {
  simpleRegularBoilerGraph,
  simpleRegularBoilerInitialStateV1,
} from '../fixtures/simpleRegularBoilerGraph';
import {
  sPlanControlGraph,
  sPlanControlInitialStateV1,
} from '../fixtures/sPlanControlGraph';
import type { LegoTechnixSimulationStateV1 } from '../simulation/LegoTechnixSimulationStateV1';

function cloneState(state: LegoTechnixSimulationStateV1): LegoTechnixSimulationStateV1 {
  return JSON.parse(JSON.stringify(state)) as LegoTechnixSimulationStateV1;
}

function setComponentTemperature(
  state: LegoTechnixSimulationStateV1,
  componentId: string,
  temperatureC: number,
): void {
  const componentState = state.componentStates.find((entry) => entry.componentId === componentId);
  if (!componentState) {
    throw new Error(`Missing component state "${componentId}".`);
  }
  componentState.currentTemperatureC = temperatureC;
}

describe('buildDhwRecoveryMetricsV1', () => {
  it('derives time-to-target and recovery-rate metrics from a cylinder recovery scenario', () => {
    const initialState = cloneState(sPlanControlInitialStateV1);
    setComponentTemperature(initialState, 'living_room', 21);

    const scenarioResult = runLegoTechnixScenarioV1({
      graph: sPlanControlGraph,
      initialState,
      durationSeconds: 3600,
      timestepSeconds: 60,
      sampleSelectors: {
        roomComponentId: 'living_room',
        storedDhwComponentId: 'stored_dhw_volume',
        sourceComponentId: 'regular_boiler',
      },
    });

    const metrics = buildDhwRecoveryMetricsV1(scenarioResult);

    expect(metrics.targetTemperatureC).toBe(60);
    expect(metrics.timeToTargetTemperature).toBeDefined();
    expect(metrics.timeToTargetTemperature).toBeGreaterThan(0);
    expect(metrics.recoveryRateKw).toBeGreaterThan(0);
    expect(metrics.recoveryConfidence).toBe('derived');
    expect(metrics.provenance).toContain(
      'Mixed-cylinder approximation: stored water is treated as fully mixed with no stratification layer modelling.',
    );
  });

  it('reports shower minutes available at 40C from the scenario draw-off timeline', () => {
    const initialState = cloneState(simpleRegularBoilerInitialStateV1);
    setComponentTemperature(initialState, 'living_room', 21);

    const scenarioResult = runLegoTechnixScenarioV1({
      graph: simpleRegularBoilerGraph,
      initialState,
      durationSeconds: 3600,
      timestepSeconds: 60,
      sampleSelectors: {
        roomComponentId: 'living_room',
        storedDhwComponentId: 'stored_dhw_volume',
        sourceComponentId: 'regular_boiler',
      },
      scheduledEvents: [
        {
          type: 'dhw_draw_off',
          atSecond: 600,
          durationSeconds: 1800,
          drawOffComponentId: 'domestic_hot_draw_off',
          drawOffFlowLpm: 10,
          mixedOutletTargetTemperatureC: 40,
          coldInletTemperatureC: 10,
        },
      ],
    });

    const metrics = buildDhwRecoveryMetricsV1(scenarioResult);

    expect(metrics.showerMinutesAvailable).toBeDefined();
    expect(metrics.showerMinutesAvailable).toBeGreaterThan(0);
    expect(metrics.usableHotWaterTimeline.some((sample) => (sample.drawOffFlowLpm ?? 0) > 0)).toBe(true);
    expect(metrics.bathFillCapacity).toBeGreaterThan(0);
  });

  it('can flag exhausted hot-water capacity under high draw-off demand', () => {
    const initialState = cloneState(simpleRegularBoilerInitialStateV1);
    setComponentTemperature(initialState, 'living_room', 21);

    const scenarioResult = runLegoTechnixScenarioV1({
      graph: simpleRegularBoilerGraph,
      initialState,
      durationSeconds: 3600,
      timestepSeconds: 60,
      sampleSelectors: {
        roomComponentId: 'living_room',
        storedDhwComponentId: 'stored_dhw_volume',
        sourceComponentId: 'regular_boiler',
      },
      scheduledEvents: [
        {
          type: 'dhw_draw_off',
          atSecond: 600,
          durationSeconds: 2400,
          drawOffComponentId: 'domestic_hot_draw_off',
          drawOffFlowLpm: 20,
          mixedOutletTargetTemperatureC: 40,
          coldInletTemperatureC: 10,
        },
      ],
    });

    const metrics = buildDhwRecoveryMetricsV1(scenarioResult);

    expect(metrics.exhaustionPoint).toBeDefined();
    expect(metrics.exhaustionPoint).toBeGreaterThanOrEqual(600);
    expect(
      metrics.usableHotWaterTimeline.some((sample) => sample.exhausted),
    ).toBe(true);
  });
});
