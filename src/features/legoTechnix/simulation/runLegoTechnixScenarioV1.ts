import type { LegoTechnixDomain } from '../domains';
import type { LegoTechnixGraphV1 } from '../types';
import type { ComponentStateV1 } from './ComponentStateV1';
import type { DomesticDrawOffDemandV1 } from './DomesticDrawOffDemandV1';
import type { LegoTechnixSimulationStateV1 } from './LegoTechnixSimulationStateV1';
import type { LegoTechnixTickInputV1 } from './LegoTechnixTickInputV1';
import type {
  LegoTechnixSimulationEventV1,
  LegoTechnixSimulationWarningV1,
} from './LegoTechnixTickResultV1';
import { resolveActivePathsV1 } from './resolveActivePathsV1';
import { runLegoTechnixTickV1 } from './runLegoTechnixTickV1';

export interface ScenarioSampleSelectorsV1 {
  readonly roomComponentId?: string;
  readonly storedDhwComponentId?: string;
  readonly sourceComponentId?: string;
}

interface ScenarioEventBaseV1 {
  readonly atSecond: number;
  readonly durationSeconds?: number;
}

export interface ScenarioThermostatChangeEventV1 extends ScenarioEventBaseV1 {
  readonly type: 'thermostat_change';
  readonly componentId: string;
  readonly setpointTemperatureC: number;
}

export interface ScenarioDhwDrawOffEventV1 extends ScenarioEventBaseV1 {
  readonly type: 'dhw_draw_off';
  readonly drawOffComponentId: string;
  readonly drawOffFlowLpm: number;
  readonly mixedOutletTargetTemperatureC: number;
  readonly coldInletTemperatureC: number;
}

export interface ScenarioOutsideTemperatureChangeEventV1 extends ScenarioEventBaseV1 {
  readonly type: 'outside_temperature_change';
  readonly componentId: string;
  readonly temperatureC: number;
}

export interface ScenarioControlOverrideEventV1 extends ScenarioEventBaseV1 {
  readonly type: 'control_override';
  readonly componentId: string;
  readonly override?: unknown;
  readonly clear?: boolean;
}

export type ScenarioScheduledEventV1 =
  | ScenarioThermostatChangeEventV1
  | ScenarioDhwDrawOffEventV1
  | ScenarioOutsideTemperatureChangeEventV1
  | ScenarioControlOverrideEventV1;

export interface ScenarioInputV1 {
  readonly graph: LegoTechnixGraphV1;
  readonly initialState: LegoTechnixSimulationStateV1;
  readonly durationSeconds: number;
  readonly timestepSeconds: number;
  readonly startWallClockMs?: number;
  readonly sampleSelectors?: ScenarioSampleSelectorsV1;
  readonly scheduledEvents?: readonly ScenarioScheduledEventV1[];
}

export interface ScenarioActiveBranchV1 {
  readonly pathId: string;
  readonly label: string;
  readonly domain: LegoTechnixDomain;
}

export interface ScenarioTimelineSampleV1 {
  readonly offsetSeconds: number;
  readonly wallClockMs: number;
  readonly tickIndex: number;
  readonly roomTemperatureC?: number;
  readonly storedDhwTemperatureC?: number;
  readonly storedDhwTargetTemperatureC?: number;
  readonly usableHotWaterLitresAt40C?: number;
  readonly storedDhwRecoveryKw?: number;
  readonly sourceFlowTemperatureC?: number;
  readonly sourceReturnTemperatureC?: number;
  readonly sourceHeatOutputKw?: number;
  readonly dhwDrawOffFlowLpm?: number;
  readonly dhwDrawOffTargetTemperatureC?: number;
  readonly condensingLikely?: boolean;
  readonly cyclingRisk?: boolean;
  readonly activeBranches: readonly ScenarioActiveBranchV1[];
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
  readonly tickBlocked: boolean;
  readonly blockReason?: string;
}

export interface ScenarioResultV1 {
  readonly schemaVersion: '1.0';
  readonly durationSeconds: number;
  readonly timestepSeconds: number;
  readonly tickCount: number;
  readonly sampleSelectors: ScenarioSampleSelectorsV1;
  readonly timelineSamples: readonly ScenarioTimelineSampleV1[];
  readonly finalState: LegoTechnixSimulationStateV1;
}

interface SortedScenarioEventV1 {
  readonly event: ScenarioScheduledEventV1;
  readonly order: number;
}

function cloneState(state: LegoTechnixSimulationStateV1): LegoTechnixSimulationStateV1 {
  return JSON.parse(JSON.stringify(state)) as LegoTechnixSimulationStateV1;
}

function buildIdleComponentState(componentId: string): ComponentStateV1 {
  return {
    componentId,
    isActive: false,
    operatingMode: 'idle',
  };
}

function upsertComponentState(
  state: LegoTechnixSimulationStateV1,
  componentId: string,
  patch: Partial<ComponentStateV1>,
): LegoTechnixSimulationStateV1 {
  const nextComponentStates = [...state.componentStates];
  const existingIndex = nextComponentStates.findIndex((componentState) => componentState.componentId === componentId);
  if (existingIndex >= 0) {
    nextComponentStates[existingIndex] = {
      ...nextComponentStates[existingIndex],
      ...patch,
    };
  } else {
    nextComponentStates.push({
      ...buildIdleComponentState(componentId),
      ...patch,
    });
  }

  return {
    ...state,
    componentStates: nextComponentStates,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildSortedEvents(
  scheduledEvents: readonly ScenarioScheduledEventV1[] = [],
): readonly SortedScenarioEventV1[] {
  return scheduledEvents
    .map((event, order) => ({ event, order }))
    .sort((left, right) => (
      left.event.atSecond === right.event.atSecond
        ? left.order - right.order
        : left.event.atSecond - right.event.atSecond
    ));
}

function findFirstComponentId(
  graph: LegoTechnixGraphV1,
  predicate: (component: LegoTechnixGraphV1['components'][number]) => boolean,
): string | undefined {
  return graph.components.find(predicate)?.id;
}

function resolveSelectors(
  graph: LegoTechnixGraphV1,
  selectors?: ScenarioSampleSelectorsV1,
): ScenarioSampleSelectorsV1 {
  return {
    roomComponentId: selectors?.roomComponentId
      ?? findFirstComponentId(graph, (component) => component.domains?.includes('room_air') === true),
    storedDhwComponentId: selectors?.storedDhwComponentId
      ?? findFirstComponentId(graph, (component) => (
        component.role === 'store' && component.domains?.includes('domestic_hot') === true
      )),
    sourceComponentId: selectors?.sourceComponentId ?? graph.heatSourceModels?.[0]?.componentId,
  };
}

function buildScenarioEvent(
  type: string,
  componentId: string | undefined,
  message: string,
): LegoTechnixSimulationEventV1 {
  return {
    type,
    componentId,
    message,
  };
}

function overlapsTick(
  eventStartSecond: number,
  eventDurationSeconds: number | undefined,
  tickStartSecond: number,
  tickEndSecond: number,
): boolean {
  const eventEndSecond = typeof eventDurationSeconds === 'number'
    ? eventStartSecond + Math.max(eventDurationSeconds, 0)
    : Number.POSITIVE_INFINITY;
  return eventStartSecond < tickEndSecond && eventEndSecond > tickStartSecond;
}

function buildTickDrawOffDemand(
  event: ScenarioDhwDrawOffEventV1,
  tickStartSecond: number,
  tickEndSecond: number,
  tickDurationSeconds: number,
): DomesticDrawOffDemandV1 | undefined {
  if (!overlapsTick(event.atSecond, event.durationSeconds, tickStartSecond, tickEndSecond)) {
    return undefined;
  }

  if (!(tickDurationSeconds > 0)) {
    return undefined;
  }

  const overlapStartSecond = Math.max(event.atSecond, tickStartSecond);
  const overlapEndSecond = Math.min(
    tickEndSecond,
    typeof event.durationSeconds === 'number'
      ? event.atSecond + Math.max(event.durationSeconds, 0)
      : tickEndSecond,
  );
  const overlapSeconds = overlapEndSecond - overlapStartSecond;
  if (!(overlapSeconds > 0)) {
    return undefined;
  }

  return {
    drawOffComponentId: event.drawOffComponentId,
    drawOffFlowLpm: event.drawOffFlowLpm * clamp(overlapSeconds / tickDurationSeconds, 0, 1),
    mixedOutletTargetTemperatureC: event.mixedOutletTargetTemperatureC,
    coldInletTemperatureC: event.coldInletTemperatureC,
  };
}

function findComponentState(
  state: LegoTechnixSimulationStateV1,
  componentId?: string,
): ComponentStateV1 | undefined {
  if (!componentId) {
    return undefined;
  }
  return state.componentStates.find((componentState) => componentState.componentId === componentId);
}

function buildActiveBranches(
  graph: LegoTechnixGraphV1,
  state: LegoTechnixSimulationStateV1,
  tickInput: LegoTechnixTickInputV1,
): readonly ScenarioActiveBranchV1[] {
  const activePathIds = new Set(
    resolveActivePathsV1(graph, state, tickInput).resolvedPaths
      .filter((resolvedPath) => resolvedPath.isActive)
      .map((resolvedPath) => resolvedPath.pathId),
  );

  return (graph.activeCircuitPaths ?? [])
    .filter((path) => activePathIds.has(path.id))
    .map((path) => ({
      pathId: path.id,
      label: path.label,
      domain: path.domain,
    }));
}

function sumDrawOffFlowLpm(
  drawOffDemands: readonly DomesticDrawOffDemandV1[],
): number | undefined {
  const totalFlowLpm = drawOffDemands.reduce((sum, demand) => sum + demand.drawOffFlowLpm, 0);
  return totalFlowLpm > 0 ? totalFlowLpm : undefined;
}

function buildWeightedDrawOffTargetTemperatureC(
  drawOffDemands: readonly DomesticDrawOffDemandV1[],
): number | undefined {
  const totalFlowLpm = sumDrawOffFlowLpm(drawOffDemands);
  if (typeof totalFlowLpm !== 'number' || totalFlowLpm <= 0) {
    return undefined;
  }

  return drawOffDemands.reduce(
    (weightedSum, demand) => weightedSum + (demand.mixedOutletTargetTemperatureC * demand.drawOffFlowLpm),
    0,
  ) / totalFlowLpm;
}

export function runLegoTechnixScenarioV1(input: ScenarioInputV1): ScenarioResultV1 {
  if (!(input.timestepSeconds > 0) || !Number.isFinite(input.timestepSeconds)) {
    throw new Error('Scenario timestepSeconds must be a positive finite number.');
  }
  if (!(input.durationSeconds >= 0) || !Number.isFinite(input.durationSeconds)) {
    throw new Error('Scenario durationSeconds must be a finite number greater than or equal to zero.');
  }

  const sortedEvents = buildSortedEvents(input.scheduledEvents);
  const selectors = resolveSelectors(input.graph, input.sampleSelectors);
  const persistentControlOverrides: Record<string, unknown> = {};
  const appliedPersistentEventOrders = new Set<number>();
  const timelineSamples: ScenarioTimelineSampleV1[] = [];

  let currentState = cloneState(input.initialState);
  if (typeof input.startWallClockMs === 'number') {
    currentState = {
      ...currentState,
      wallClockMs: input.startWallClockMs,
    };
  }

  const tickCount = Math.ceil(input.durationSeconds / input.timestepSeconds);
  for (let tickOffset = 0; tickOffset < tickCount; tickOffset += 1) {
    const tickStartSecond = tickOffset * input.timestepSeconds;
    const remainingSeconds = input.durationSeconds - tickStartSecond;
    const tickDurationSeconds = Math.min(input.timestepSeconds, Math.max(remainingSeconds, 0));
    const tickEndSecond = tickStartSecond + tickDurationSeconds;
    const tickScenarioEvents: LegoTechnixSimulationEventV1[] = [];
    const tickDrawOffDemands: DomesticDrawOffDemandV1[] = [];

    for (const { event, order } of sortedEvents) {
      if (event.type === 'dhw_draw_off') {
        const drawOffDemand = buildTickDrawOffDemand(
          event,
          tickStartSecond,
          tickEndSecond,
          tickDurationSeconds,
        );
        if (!drawOffDemand) {
          continue;
        }

        tickDrawOffDemands.push(drawOffDemand);
        tickScenarioEvents.push(buildScenarioEvent(
          'scenario_dhw_draw_off',
          event.drawOffComponentId,
          `Scenario draw-off applied at ${tickEndSecond}s for "${event.drawOffComponentId}".`,
        ));
        continue;
      }

      if (appliedPersistentEventOrders.has(order) || event.atSecond >= tickEndSecond) {
        continue;
      }

      switch (event.type) {
        case 'thermostat_change':
          currentState = upsertComponentState(currentState, event.componentId, {
            targetTemperatureC: event.setpointTemperatureC,
          });
          tickScenarioEvents.push(buildScenarioEvent(
            'scenario_thermostat_change',
            event.componentId,
            `Scenario thermostat target for "${event.componentId}" set to ${event.setpointTemperatureC}°C.`,
          ));
          appliedPersistentEventOrders.add(order);
          break;
        case 'outside_temperature_change':
          currentState = upsertComponentState(currentState, event.componentId, {
            currentTemperatureC: event.temperatureC,
          });
          tickScenarioEvents.push(buildScenarioEvent(
            'scenario_outside_temperature_change',
            event.componentId,
            `Scenario outside temperature for "${event.componentId}" set to ${event.temperatureC}°C.`,
          ));
          appliedPersistentEventOrders.add(order);
          break;
        case 'control_override':
          if (typeof event.durationSeconds === 'number') {
            break;
          }
          if (event.clear === true) {
            delete persistentControlOverrides[event.componentId];
          } else {
            persistentControlOverrides[event.componentId] = event.override;
          }
          tickScenarioEvents.push(buildScenarioEvent(
            'scenario_control_override',
            event.componentId,
            event.clear === true
              ? `Scenario control override cleared for "${event.componentId}".`
              : `Scenario control override set for "${event.componentId}".`,
          ));
          appliedPersistentEventOrders.add(order);
          break;
      }
    }

    const activeTimedControlOverrides = Object.fromEntries(
      sortedEvents.flatMap(({ event }) => {
        if (
          event.type !== 'control_override'
          || typeof event.durationSeconds !== 'number'
          || !overlapsTick(event.atSecond, event.durationSeconds, tickStartSecond, tickEndSecond)
          || event.clear === true
        ) {
          return [];
        }

        return [[event.componentId, event.override] as const];
      }),
    );
    for (const { event } of sortedEvents) {
      if (
        event.type !== 'control_override'
        || typeof event.durationSeconds !== 'number'
        || !overlapsTick(event.atSecond, event.durationSeconds, tickStartSecond, tickEndSecond)
        || event.clear === true
      ) {
        continue;
      }

      tickScenarioEvents.push(buildScenarioEvent(
        'scenario_control_override',
        event.componentId,
        `Timed scenario control override active for "${event.componentId}".`,
      ));
    }

    const tickInput: LegoTechnixTickInputV1 = {
      wallClockMs: currentState.wallClockMs + (tickDurationSeconds * 1000),
      timestepSeconds: tickDurationSeconds,
      controlOverrides: {
        ...persistentControlOverrides,
        ...activeTimedControlOverrides,
      },
      domesticDrawOffDemands: tickDrawOffDemands,
    };

    const tickResult = runLegoTechnixTickV1(input.graph, currentState, tickInput);
    const nextState = {
      ...tickResult.nextState,
      wallClockMs: tickInput.wallClockMs,
    };
    const roomState = findComponentState(nextState, selectors.roomComponentId);
    const storedDhwState = findComponentState(nextState, selectors.storedDhwComponentId);
    const sourceState = findComponentState(nextState, selectors.sourceComponentId);

    timelineSamples.push({
      offsetSeconds: tickEndSecond,
      wallClockMs: nextState.wallClockMs,
      tickIndex: nextState.tickIndex,
      roomTemperatureC: roomState?.currentTemperatureC,
      storedDhwTemperatureC: storedDhwState?.currentTemperatureC,
      storedDhwTargetTemperatureC: storedDhwState?.targetTemperatureC,
      usableHotWaterLitresAt40C: storedDhwState?.usableHotWaterLitresAt40C,
      storedDhwRecoveryKw: storedDhwState?.heatGainKw,
      sourceFlowTemperatureC: sourceState?.currentTemperatureC,
      sourceReturnTemperatureC: sourceState?.returnTemperatureC,
      sourceHeatOutputKw: sourceState?.heatGainKw,
      dhwDrawOffFlowLpm: sumDrawOffFlowLpm(tickDrawOffDemands),
      dhwDrawOffTargetTemperatureC: buildWeightedDrawOffTargetTemperatureC(tickDrawOffDemands),
      condensingLikely: sourceState?.condensingLikely,
      cyclingRisk: sourceState?.cyclingRisk,
      activeBranches: buildActiveBranches(input.graph, nextState, tickInput),
      events: [...tickScenarioEvents, ...tickResult.events],
      warnings: tickResult.warnings,
      tickBlocked: tickResult.tickBlocked,
      blockReason: tickResult.blockReason,
    });

    currentState = nextState;
  }

  return {
    schemaVersion: '1.0',
    durationSeconds: input.durationSeconds,
    timestepSeconds: input.timestepSeconds,
    tickCount,
    sampleSelectors: selectors,
    timelineSamples,
    finalState: currentState,
  };
}
