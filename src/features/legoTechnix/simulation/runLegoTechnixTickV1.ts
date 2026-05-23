import type { LegoTechnixGraphV1 } from '../types';
import { validateLegoTechnixGraphV1 } from '../validation';
import type { ComponentStateV1 } from './ComponentStateV1';
import type { DomainStateV1 } from './DomainStateV1';
import type { EdgeStateV1 } from './EdgeStateV1';
import type { LegoTechnixSimulationStateV1 } from './LegoTechnixSimulationStateV1';
import type { LegoTechnixTickInputV1 } from './LegoTechnixTickInputV1';
import type { MassFlowAllocationResultV1 } from './allocateMassFlowV1';
import { allocateMassFlowV1 } from './allocateMassFlowV1';
import type { HeatTransferEvaluationResultV1 } from './evaluateHeatTransfersV1';
import { evaluateHeatTransfersV1 } from './evaluateHeatTransfersV1';
import type {
  LegoTechnixSimulationEventV1,
  LegoTechnixSimulationWarningV1,
  LegoTechnixTickResultV1,
} from './LegoTechnixTickResultV1';
import type { ActivePathResolutionV1 } from './resolveActivePathsV1';
import { resolveActivePathsV1 } from './resolveActivePathsV1';

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
// Stage 3 — active path resolution
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Stage 3b — mass-flow allocation
// ---------------------------------------------------------------------------

interface MassFlowAllocationStageResult {
  readonly allocation: MassFlowAllocationResultV1;
}

function runMassFlowAllocation(
  graph: LegoTechnixGraphV1,
  activePathResolution: ActivePathResolutionV1,
  tickInput: LegoTechnixTickInputV1,
): MassFlowAllocationStageResult {
  return {
    allocation: allocateMassFlowV1(graph, activePathResolution, tickInput),
  };
}

// ---------------------------------------------------------------------------
// Stage 4 — thermal/component evaluation (placeholder)
// ---------------------------------------------------------------------------

interface ThermalEvalResult {
  readonly edgeTemperatureByConnectionId: Readonly<Record<string, {
    readonly estimatedInletTemperatureC?: number;
    readonly estimatedOutletTemperatureC?: number;
  }>>;
  readonly roomHeatGainKw: number;
  readonly storedWaterHeatGainKw: number;
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

function runThermalComponentEvaluation(
  graph: LegoTechnixGraphV1,
  activePathResolution: ActivePathResolutionV1,
  edgeStates: readonly EdgeStateV1[],
): ThermalEvalResult {
  const evaluation: HeatTransferEvaluationResultV1 = evaluateHeatTransfersV1(
    graph,
    activePathResolution,
    edgeStates,
  );

  return evaluation;
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
  activePathResolution: ActivePathResolutionV1,
): readonly ComponentStateV1[] {
  const previousById = new Map(previous.componentStates.map((s) => [s.componentId, s]));
  const activeComponentIds = new Set(activePathResolution.activeComponentIds);

  return graph.components.map((component): ComponentStateV1 => {
    const prev = previousById.get(component.id);
    return {
      componentId: component.id,
      isActive: activeComponentIds.has(component.id),
      operatingMode: activePathResolution.componentOperatingModes[component.id] ?? 'idle',
      measuredTemperatureC: prev?.measuredTemperatureC,
      setpointTemperatureC: prev?.setpointTemperatureC,
    };
  });
}

function buildEdgeStates(
  graph: LegoTechnixGraphV1,
  previous: LegoTechnixSimulationStateV1,
  activePathResolution: ActivePathResolutionV1,
  massFlowAllocation: MassFlowAllocationResultV1,
  edgeTemperatureByConnectionId?: Readonly<Record<string, {
    readonly estimatedInletTemperatureC?: number;
    readonly estimatedOutletTemperatureC?: number;
  }>>,
): readonly EdgeStateV1[] {
  const previousById = new Map(previous.edgeStates.map((s) => [s.connectionId, s]));
  const activeConnectionIds = new Set(activePathResolution.activeConnectionIds);

  return graph.connections.map((connection): EdgeStateV1 => {
    const prev = previousById.get(connection.id);
    const thermalEstimate = edgeTemperatureByConnectionId?.[connection.id];
    const edgeFlow = massFlowAllocation.edgeFlowByConnectionId[connection.id];
    const isActive = activeConnectionIds.has(connection.id);
    const estimatedFlowLps = isActive ? (edgeFlow?.estimatedFlowLps ?? 0) : 0;
    return {
      connectionId: connection.id,
      isActive,
      estimatedFlowLps,
      estimatedFlowKgPerS: estimatedFlowLps,
      estimatedVelocityMps: isActive ? edgeFlow?.estimatedVelocityMps : undefined,
      flowRiskBand: isActive ? edgeFlow?.flowRiskBand : undefined,
      estimatedInletTemperatureC: thermalEstimate?.estimatedInletTemperatureC
        ?? prev?.estimatedInletTemperatureC,
      estimatedOutletTemperatureC: thermalEstimate?.estimatedOutletTemperatureC
        ?? prev?.estimatedOutletTemperatureC,
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
 *   3b. mass-flow allocation
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
  const pathResult = resolveActivePathsV1(graph, previousState, tickInput);
  events.push(...pathResult.events);
  warnings.push(...pathResult.warnings);

  // Stage 3b — mass-flow allocation
  const flowResult = runMassFlowAllocation(graph, pathResult, tickInput);
  events.push(...flowResult.allocation.events);
  warnings.push(...flowResult.allocation.warnings);

  const edgeStatesAfterFlow = buildEdgeStates(graph, previousState, pathResult, flowResult.allocation);

  // Stage 4 — thermal/component evaluation
  const thermalResult = runThermalComponentEvaluation(graph, pathResult, edgeStatesAfterFlow);
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
    componentStates: buildComponentStates(graph, previousState, pathResult),
    edgeStates: buildEdgeStates(
      graph,
      previousState,
      pathResult,
      flowResult.allocation,
      thermalResult.edgeTemperatureByConnectionId,
    ),
    domainStates: buildDomainStates(graph, previousState),
  };

  return {
    nextState,
    events,
    warnings,
    tickBlocked: false,
  };
}
