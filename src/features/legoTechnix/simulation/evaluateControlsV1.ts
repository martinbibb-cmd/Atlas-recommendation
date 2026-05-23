import type {
  ControlActuatorV1,
  ControlLogicV1,
  ControlSensorV1,
  LegoTechnixGraphV1,
} from '../types';
import type { ComponentStateV1 } from './ComponentStateV1';
import type { LegoTechnixSimulationStateV1 } from './LegoTechnixSimulationStateV1';
import type { LegoTechnixTickInputV1 } from './LegoTechnixTickInputV1';
import type {
  LegoTechnixSimulationEventV1,
  LegoTechnixSimulationWarningV1,
} from './LegoTechnixTickResultV1';

interface SPlanDemandOutputV1 {
  readonly heatingDemand: boolean;
  readonly hotWaterDemand: boolean;
}

export interface ControlEvaluationResultV1 {
  readonly componentStateById: Readonly<Record<string, Partial<ComponentStateV1>>>;
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

function toDemandState(isDemanding: boolean): 'none' | 'demanding' {
  return isDemanding ? 'demanding' : 'none';
}

function parseBooleanCandidate(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

function parseNumberCandidate(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function parseActuatorOverride(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return parseBooleanCandidate(record.isOpen)
    ?? parseBooleanCandidate(record.isActive)
    ?? parseBooleanCandidate(record.open)
    ?? (parseBooleanCandidate(record.closed) === true ? false : undefined)
    ?? (record.position === 'open' ? true : undefined)
    ?? (record.position === 'closed' ? false : undefined);
}

function parseTemperatureOverride(
  value: unknown,
  keys: readonly string[],
): number | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = parseNumberCandidate(record[key]);
    if (typeof candidate === 'number') {
      return candidate;
    }
  }
  return undefined;
}

function resolveSensorTemperatures(
  sensor: ControlSensorV1,
  previousStateById: ReadonlyMap<string, ComponentStateV1>,
  tickInput: LegoTechnixTickInputV1,
): {
  readonly measuredTemperatureC?: number;
  readonly setpointTemperatureC?: number;
} {
  const observedState = previousStateById.get(sensor.observedComponentId);
  const sensorOverride = tickInput.controlOverrides?.[sensor.componentId];
  const observedOverride = tickInput.controlOverrides?.[sensor.observedComponentId];

  const measuredTemperatureC = parseTemperatureOverride(sensorOverride, [
    'measuredTemperatureC',
    'currentTemperatureC',
    'temperatureC',
  ]) ?? parseTemperatureOverride(observedOverride, [
    'currentTemperatureC',
    'measuredTemperatureC',
    'temperatureC',
  ]) ?? observedState?.currentTemperatureC
    ?? observedState?.measuredTemperatureC;

  const setpointTemperatureC = parseTemperatureOverride(sensorOverride, [
    'setpointTemperatureC',
    'targetTemperatureC',
  ]) ?? parseTemperatureOverride(observedOverride, [
    'targetTemperatureC',
    'setpointTemperatureC',
  ]) ?? observedState?.targetTemperatureC
    ?? observedState?.setpointTemperatureC;

  return { measuredTemperatureC, setpointTemperatureC };
}

function evaluateThermostatDemand(
  sensor: ControlSensorV1,
  previousSensorState: ComponentStateV1 | undefined,
  measuredTemperatureC: number,
  setpointTemperatureC: number,
): boolean {
  const hysteresisC = Math.max(sensor.hysteresisC, 0);
  const wasDemanding = previousSensorState?.controlDemandState === 'demanding';
  return wasDemanding
    ? measuredTemperatureC < setpointTemperatureC
    : measuredTemperatureC < (setpointTemperatureC - hysteresisC);
}

function buildSensorState(
  isDemanding: boolean,
  measuredTemperatureC: number,
  setpointTemperatureC: number,
): Partial<ComponentStateV1> {
  return {
    isActive: isDemanding,
    operatingMode: isDemanding ? 'running' : 'idle',
    measuredTemperatureC,
    setpointTemperatureC,
    controlDemandState: toDemandState(isDemanding),
  };
}

function buildLogicState(isDemanding: boolean): Partial<ComponentStateV1> {
  return {
    isActive: isDemanding,
    operatingMode: isDemanding ? 'running' : 'idle',
    controlDemandState: toDemandState(isDemanding),
  };
}

function buildActuatorState(isOpen: boolean, isDemanding: boolean): Partial<ComponentStateV1> {
  return {
    isActive: isOpen,
    operatingMode: isOpen ? 'running' : 'idle',
    actuatorPosition: isOpen ? 'open' : 'closed',
    controlDemandState: toDemandState(isDemanding),
  };
}

function resolveLogicOutputs(
  logic: ControlLogicV1,
  sensorDemandByComponentId: ReadonlyMap<string, boolean>,
): SPlanDemandOutputV1 {
  return {
    heatingDemand: sensorDemandByComponentId.get(logic.roomSensorComponentId) ?? false,
    hotWaterDemand: sensorDemandByComponentId.get(logic.cylinderSensorComponentId) ?? false,
  };
}

function resolveActuatorDemand(
  actuator: ControlActuatorV1,
  logicOutputByComponentId: ReadonlyMap<string, SPlanDemandOutputV1>,
): boolean {
  const logicOutput = logicOutputByComponentId.get(actuator.logicComponentId);
  if (!logicOutput) {
    return false;
  }
  return actuator.channel === 'heating'
    ? logicOutput.heatingDemand
    : logicOutput.hotWaterDemand;
}

export function evaluateControlsV1(
  graph: LegoTechnixGraphV1,
  previousState: LegoTechnixSimulationStateV1,
  tickInput: LegoTechnixTickInputV1,
): ControlEvaluationResultV1 {
  const componentStateById: Record<string, Partial<ComponentStateV1>> = {};
  const events: LegoTechnixSimulationEventV1[] = [];
  const warnings: LegoTechnixSimulationWarningV1[] = [];
  const previousStateById = new Map(
    previousState.componentStates.map((componentState) => [componentState.componentId, componentState]),
  );
  const sensorDemandByComponentId = new Map<string, boolean>();
  const logicOutputByComponentId = new Map<string, SPlanDemandOutputV1>();
  const heatSourceDemandByComponentId = new Map<string, boolean>();

  for (const sensor of graph.controlSensors ?? []) {
    const previousSensorState = previousStateById.get(sensor.componentId);
    const { measuredTemperatureC, setpointTemperatureC } = resolveSensorTemperatures(
      sensor,
      previousStateById,
      tickInput,
    );

    if (
      typeof measuredTemperatureC !== 'number'
      || typeof setpointTemperatureC !== 'number'
    ) {
      warnings.push({
        code: 'control_sensor_temperature_missing',
        componentId: sensor.componentId,
        message: `Control sensor "${sensor.componentId}" could not read a previous-tick temperature and setpoint.`,
      });
      continue;
    }

    const isDemanding = evaluateThermostatDemand(
      sensor,
      previousSensorState,
      measuredTemperatureC,
      setpointTemperatureC,
    );
    sensorDemandByComponentId.set(sensor.componentId, isDemanding);
    componentStateById[sensor.componentId] = buildSensorState(
      isDemanding,
      measuredTemperatureC,
      setpointTemperatureC,
    );
    events.push({
      type: 'control_sensor_evaluated',
      componentId: sensor.componentId,
      message: `Control sensor "${sensor.componentId}" read ${measuredTemperatureC}°C against ${setpointTemperatureC}°C and is ${isDemanding ? 'demanding' : 'satisfied'}.`,
    });
  }

  for (const logic of graph.controlLogics ?? []) {
    const output = resolveLogicOutputs(logic, sensorDemandByComponentId);
    const isDemanding = output.heatingDemand || output.hotWaterDemand;
    logicOutputByComponentId.set(logic.componentId, output);
    componentStateById[logic.componentId] = buildLogicState(isDemanding);
    events.push({
      type: 'control_logic_evaluated',
      componentId: logic.componentId,
      message: `Control logic "${logic.componentId}" resolved heating=${output.heatingDemand} hot_water=${output.hotWaterDemand}.`,
    });
  }

  for (const actuator of graph.controlActuators ?? []) {
    const isDemanding = resolveActuatorDemand(actuator, logicOutputByComponentId);
    const override = parseActuatorOverride(tickInput.controlOverrides?.[actuator.componentId]);
    const isOpen = override ?? (isDemanding || actuator.normallyOpen === true);
    componentStateById[actuator.componentId] = buildActuatorState(isOpen, isDemanding);
    for (const heatSourceComponentId of actuator.heatSourceComponentIds ?? []) {
      heatSourceDemandByComponentId.set(
        heatSourceComponentId,
        (heatSourceDemandByComponentId.get(heatSourceComponentId) ?? false) || isOpen,
      );
    }
    events.push({
      type: 'control_actuator_evaluated',
      componentId: actuator.componentId,
      message: `Control actuator "${actuator.componentId}" is ${isOpen ? 'open' : 'closed'} from ${isDemanding ? 'demand' : 'satisfied'} logic output.`,
    });
  }

  for (const [componentId, isDemanding] of heatSourceDemandByComponentId.entries()) {
    componentStateById[componentId] = {
      ...(componentStateById[componentId] ?? {}),
      controlDemandState: toDemandState(isDemanding),
    };
  }

  return {
    componentStateById,
    events,
    warnings,
  };
}
