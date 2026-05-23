import type { LegoTechnixGraphV1 } from '../types';
import { validateLegoTechnixGraphV1 } from '../validation';
import type { ComponentStateV1 } from './ComponentStateV1';
import type { DomainStateV1 } from './DomainStateV1';
import type { EdgeStateV1 } from './EdgeStateV1';
import type { LegoTechnixSimulationStateV1 } from './LegoTechnixSimulationStateV1';
import type { LegoTechnixTickInputV1 } from './LegoTechnixTickInputV1';
import type {
  LegoTechnixSimulationEventV1,
  LegoTechnixSimulationWarningV1,
  LegoTechnixTickResultV1,
} from './LegoTechnixTickResultV1';

// ---------------------------------------------------------------------------
// Stage 1 — control/sensor poll (placeholder)
// ---------------------------------------------------------------------------

interface SensorPollResult {
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

function runControlSensorPoll(
  _graph: LegoTechnixGraphV1,
  _previousState: LegoTechnixSimulationStateV1,
  _tickInput: LegoTechnixTickInputV1,
): SensorPollResult {
  // Stage 1 placeholder: a future PR will interrogate control_sensor components
  // and apply tickInput.controlOverrides to produce updated setpoints / readings.
  return { events: [], warnings: [] };
}

// ---------------------------------------------------------------------------
// Stage 2 — pressure pre-flight check
// ---------------------------------------------------------------------------

interface PressurePreFlightResult {
  readonly passed: boolean;
  readonly blockReason?: string;
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

function runPressurePreFlight(graph: LegoTechnixGraphV1): PressurePreFlightResult {
  const validation = validateLegoTechnixGraphV1(graph);
  if (!validation.isValid) {
    const firstError = validation.errors[0];
    return {
      passed: false,
      blockReason: `pressure_pre_flight_failed: ${firstError?.code ?? 'unknown'} — ${firstError?.message ?? ''}`,
      warnings: [],
    };
  }

  const warnings: LegoTechnixSimulationWarningV1[] = validation.warnings.map((w) => ({
    code: w.code,
    message: w.message,
  }));

  return { passed: true, warnings };
}

// ---------------------------------------------------------------------------
// Stage 3 — active path resolution (placeholder)
// ---------------------------------------------------------------------------

interface ActivePathResult {
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

function runActivePathResolution(
  _graph: LegoTechnixGraphV1,
  _previousState: LegoTechnixSimulationStateV1,
): ActivePathResult {
  // Stage 3 placeholder: a future PR will walk activeCircuitPaths to mark
  // which edges carry flow this tick.
  return { events: [], warnings: [] };
}

// ---------------------------------------------------------------------------
// Stage 4 — thermal/component evaluation (placeholder)
// ---------------------------------------------------------------------------

interface ThermalEvalResult {
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

function runThermalComponentEvaluation(
  _graph: LegoTechnixGraphV1,
  _previousState: LegoTechnixSimulationStateV1,
  _tickInput: LegoTechnixTickInputV1,
): ThermalEvalResult {
  // Stage 4 placeholder: a future PR will evaluate heatTransferComponents and
  // update per-component temperatures using the heat-transfer contracts.
  return { events: [], warnings: [] };
}

// ---------------------------------------------------------------------------
// Stage 5 — environment integration (placeholder)
// ---------------------------------------------------------------------------

interface EnvironmentIntegrationResult {
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

function runEnvironmentIntegration(
  _graph: LegoTechnixGraphV1,
  _previousState: LegoTechnixSimulationStateV1,
  _tickInput: LegoTechnixTickInputV1,
): EnvironmentIntegrationResult {
  // Stage 5 placeholder: a future PR will apply ambient-domain effects such as
  // pipe heat loss (simpleHeatLossWPerM) and outside_environment temperature.
  return { events: [], warnings: [] };
}

// ---------------------------------------------------------------------------
// Stage 6 — state commit
// ---------------------------------------------------------------------------

function buildComponentStates(
  graph: LegoTechnixGraphV1,
  previous: LegoTechnixSimulationStateV1,
): readonly ComponentStateV1[] {
  const previousById = new Map(previous.componentStates.map((s) => [s.componentId, s]));

  return graph.components.map((component): ComponentStateV1 => {
    const prev = previousById.get(component.id);
    return {
      componentId: component.id,
      isActive: prev?.isActive ?? false,
      operatingMode: prev?.operatingMode ?? 'idle',
      measuredTemperatureC: prev?.measuredTemperatureC,
      setpointTemperatureC: prev?.setpointTemperatureC,
    };
  });
}

function buildEdgeStates(
  graph: LegoTechnixGraphV1,
  previous: LegoTechnixSimulationStateV1,
): readonly EdgeStateV1[] {
  const previousById = new Map(previous.edgeStates.map((s) => [s.connectionId, s]));

  return graph.connections.map((connection): EdgeStateV1 => {
    const prev = previousById.get(connection.id);
    return {
      connectionId: connection.id,
      isActive: prev?.isActive ?? false,
      estimatedFlowKgPerS: prev?.estimatedFlowKgPerS,
      estimatedInletTemperatureC: prev?.estimatedInletTemperatureC,
      estimatedOutletTemperatureC: prev?.estimatedOutletTemperatureC,
    };
  });
}

function buildDomainStates(
  graph: LegoTechnixGraphV1,
  previous: LegoTechnixSimulationStateV1,
): readonly DomainStateV1[] {
  const previousById = new Map(previous.domainStates.map((s) => [s.domainId, s]));

  return (graph.hydraulicDomains ?? []).map((hd): DomainStateV1 => {
    const prev = previousById.get(hd.id as import('../domains').LegoTechnixDomain);
    return {
      domainId: hd.id as import('../domains').LegoTechnixDomain,
      isOnline: prev?.isOnline ?? true,
      pressureBar: prev?.pressureBar ?? hd.nominalColdPressureBar,
    };
  });
}

// ---------------------------------------------------------------------------
// Public tick entry-point
// ---------------------------------------------------------------------------

/**
 * Run a single deterministic simulation tick.
 *
 * Pipeline order:
 *   1. control/sensor poll
 *   2. pressure pre-flight check  ← blocks tick on failure
 *   3. active path resolution
 *   4. thermal/component evaluation
 *   5. environment integration
 *   6. state commit
 *
 * The previousState is never mutated; a fresh nextState is always returned.
 */
export function runLegoTechnixTickV1(
  graph: LegoTechnixGraphV1,
  previousState: LegoTechnixSimulationStateV1,
  tickInput: LegoTechnixTickInputV1,
): LegoTechnixTickResultV1 {
  const events: LegoTechnixSimulationEventV1[] = [];
  const warnings: LegoTechnixSimulationWarningV1[] = [];

  // Stage 1 — control/sensor poll
  const pollResult = runControlSensorPoll(graph, previousState, tickInput);
  events.push(...pollResult.events);
  warnings.push(...pollResult.warnings);

  // Stage 2 — pressure pre-flight check
  const preFlightResult = runPressurePreFlight(graph);
  warnings.push(...preFlightResult.warnings);
  if (!preFlightResult.passed) {
    return {
      nextState: previousState,
      events,
      warnings,
      tickBlocked: true,
      blockReason: preFlightResult.blockReason,
    };
  }

  // Stage 3 — active path resolution
  const pathResult = runActivePathResolution(graph, previousState);
  events.push(...pathResult.events);
  warnings.push(...pathResult.warnings);

  // Stage 4 — thermal/component evaluation
  const thermalResult = runThermalComponentEvaluation(graph, previousState, tickInput);
  events.push(...thermalResult.events);
  warnings.push(...thermalResult.warnings);

  // Stage 5 — environment integration
  const envResult = runEnvironmentIntegration(graph, previousState, tickInput);
  events.push(...envResult.events);
  warnings.push(...envResult.warnings);

  // Stage 6 — state commit
  const nextState: LegoTechnixSimulationStateV1 = {
    schemaVersion: '1.0',
    tickIndex: previousState.tickIndex + 1,
    wallClockMs: tickInput.wallClockMs,
    componentStates: buildComponentStates(graph, previousState),
    edgeStates: buildEdgeStates(graph, previousState),
    domainStates: buildDomainStates(graph, previousState),
  };

  return {
    nextState,
    events,
    warnings,
    tickBlocked: false,
  };
}
