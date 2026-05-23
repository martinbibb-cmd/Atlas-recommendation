import { describe, expect, it } from 'vitest';
import {
  simpleRegularBoilerGraph,
  simpleRegularBoilerInitialStateV1,
} from '../fixtures/simpleRegularBoilerGraph';
import {
  sPlanControlGraph,
  sPlanControlInitialStateV1,
} from '../fixtures/sPlanControlGraph';
import type { LegoTechnixSimulationStateV1 } from '../simulation/LegoTechnixSimulationStateV1';
import { runLegoTechnixScenarioV1 } from '../simulation/runLegoTechnixScenarioV1';

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

function findSample(
  timelineSamples: ReturnType<typeof runLegoTechnixScenarioV1>['timelineSamples'],
  offsetSeconds: number,
) {
  return timelineSamples.find((sample) => sample.offsetSeconds === offsetSeconds);
}

describe('runLegoTechnixScenarioV1', () => {
  it('runs a 1 hour cylinder recovery scenario deterministically', () => {
    const initialState = cloneState(sPlanControlInitialStateV1);
    setComponentTemperature(initialState, 'living_room', 21);

    const scenarioInput = {
      graph: sPlanControlGraph,
      initialState,
      durationSeconds: 3600,
      timestepSeconds: 60,
      sampleSelectors: {
        roomComponentId: 'living_room',
        storedDhwComponentId: 'stored_dhw_volume',
        sourceComponentId: 'regular_boiler',
      },
    } as const;

    const firstRun = runLegoTechnixScenarioV1(scenarioInput);
    const secondRun = runLegoTechnixScenarioV1(scenarioInput);

    expect(firstRun).toEqual(secondRun);
    expect(firstRun.timelineSamples).toHaveLength(60);
    expect(firstRun.finalState.tickIndex).toBe(60);
    expect(firstRun.timelineSamples.at(-1)?.storedDhwTemperatureC).toBeGreaterThan(45);
    expect(
      firstRun.timelineSamples.some((sample) => (
        sample.activeBranches.some((branch) => branch.pathId === 'active_primary_dhw_cycle')
      )),
    ).toBe(true);
  });

  it('runs a 24 hour heating scenario deterministically with thermostat and outside events', () => {
    const initialState = cloneState(sPlanControlInitialStateV1);
    setComponentTemperature(initialState, 'stored_dhw_volume', 60);

    const scenarioInput = {
      graph: sPlanControlGraph,
      initialState,
      durationSeconds: 24 * 3600,
      timestepSeconds: 900,
      sampleSelectors: {
        roomComponentId: 'living_room',
        storedDhwComponentId: 'stored_dhw_volume',
        sourceComponentId: 'regular_boiler',
      },
      scheduledEvents: [
        {
          type: 'outside_temperature_change',
          atSecond: 6 * 3600,
          componentId: 'outside_air',
          temperatureC: 2,
        },
        {
          type: 'thermostat_change',
          atSecond: 12 * 3600,
          componentId: 'living_room',
          setpointTemperatureC: 21,
        },
      ],
    } as const;

    const firstRun = runLegoTechnixScenarioV1(scenarioInput);
    const secondRun = runLegoTechnixScenarioV1(scenarioInput);

    expect(firstRun).toEqual(secondRun);
    expect(firstRun.timelineSamples).toHaveLength(96);
    expect(firstRun.timelineSamples.at(-1)?.roomTemperatureC).toBeGreaterThan(18);
    expect(
      firstRun.timelineSamples.some((sample) => (
        sample.events.some((event) => event.type === 'scenario_outside_temperature_change')
      )),
    ).toBe(true);
    expect(
      firstRun.timelineSamples.some((sample) => (
        sample.events.some((event) => event.type === 'scenario_thermostat_change')
      )),
    ).toBe(true);
  });

  it('applies scheduled DHW draw-off events to the stored-water timeline', () => {
    const initialState = cloneState(simpleRegularBoilerInitialStateV1);
    setComponentTemperature(initialState, 'living_room', 21);

    const baseInput = {
      graph: simpleRegularBoilerGraph,
      initialState,
      durationSeconds: 3600,
      timestepSeconds: 60,
      sampleSelectors: {
        roomComponentId: 'living_room',
        storedDhwComponentId: 'stored_dhw_volume',
        sourceComponentId: 'regular_boiler',
      },
    } as const;

    const baseline = runLegoTechnixScenarioV1(baseInput);
    const withDrawOff = runLegoTechnixScenarioV1({
      ...baseInput,
      scheduledEvents: [
        {
          type: 'dhw_draw_off',
          atSecond: 1800,
          durationSeconds: 600,
          drawOffComponentId: 'domestic_hot_draw_off',
          drawOffFlowLpm: 10,
          mixedOutletTargetTemperatureC: 40,
          coldInletTemperatureC: 10,
        },
      ],
    });

    const baselineAfterDrawOff = findSample(baseline.timelineSamples, 2400);
    const drawOffAfterEvent = findSample(withDrawOff.timelineSamples, 2400);

    expect(drawOffAfterEvent?.storedDhwTemperatureC).toBeLessThan(baselineAfterDrawOff?.storedDhwTemperatureC ?? 0);
    expect(drawOffAfterEvent?.usableHotWaterLitresAt40C).toBeLessThan(
      baselineAfterDrawOff?.usableHotWaterLitresAt40C ?? 0,
    );
    expect(
      withDrawOff.timelineSamples.some((sample) => (
        sample.events.some((event) => event.type === 'scenario_dhw_draw_off')
      )),
    ).toBe(true);
  });

  it('lets control override events change active branch timelines', () => {
    const initialState = cloneState(sPlanControlInitialStateV1);
    setComponentTemperature(initialState, 'stored_dhw_volume', 60);

    const result = runLegoTechnixScenarioV1({
      graph: sPlanControlGraph,
      initialState,
      durationSeconds: 1800,
      timestepSeconds: 900,
      sampleSelectors: {
        roomComponentId: 'living_room',
        storedDhwComponentId: 'stored_dhw_volume',
        sourceComponentId: 'regular_boiler',
      },
      scheduledEvents: [
        {
          type: 'control_override',
          atSecond: 0,
          durationSeconds: 900,
          componentId: 'heating_zone_valve',
          override: { position: 'closed' },
        },
      ],
    });

    expect(findSample(result.timelineSamples, 900)?.activeBranches).not.toContainEqual(
      expect.objectContaining({ pathId: 'active_primary_heating_cycle' }),
    );
    expect(findSample(result.timelineSamples, 1800)?.activeBranches).toContainEqual(
      expect.objectContaining({ pathId: 'active_primary_heating_cycle' }),
    );
  });
});
