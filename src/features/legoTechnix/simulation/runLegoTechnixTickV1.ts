import type { LegoTechnixGraphV1 } from '../types';
import { validateLegoTechnixGraphV1 } from '../validation';
import type { ComponentStateV1 } from './ComponentStateV1';
import type { DomainStateV1 } from './DomainStateV1';
import type { EdgeStateV1 } from './EdgeStateV1';
import type { LegoTechnixSimulationStateV1 } from './LegoTechnixSimulationStateV1';
import type { LegoTechnixTickInputV1 } from './LegoTechnixTickInputV1';
import type { MassFlowAllocationResultV1 } from './allocateMassFlowV1';
import { allocateMassFlowV1 } from './allocateMassFlowV1';
import { aggregateReturnTemperatureV1 } from './aggregateReturnTemperatureV1';
import type { HeatTransferEvaluationResultV1 } from './evaluateHeatTransfersV1';
import { evaluateHeatTransfersV1 } from './evaluateHeatTransfersV1';
import type { HeatSourceEvaluationResultV1 } from './evaluateHeatSourcesV1';
import { evaluateHeatSourcesV1 } from './evaluateHeatSourcesV1';
import { evaluateControlsV1 } from './evaluateControlsV1';
import { evaluatePipeEdgesV1 } from './evaluatePipeEdgesV1';
import { integrateThermalStateV1 } from './integrateThermalStateV1';
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
  readonly componentStateById: Readonly<Record<string, Partial<ComponentStateV1>>>;
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

function runControlSensorPoll(
  graph: LegoTechnixGraphV1,
  previousState: LegoTechnixSimulationStateV1,
  tickInput: LegoTechnixTickInputV1,
): SensorPollResult {
  return evaluateControlsV1(graph, previousState, tickInput);
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
  readonly transferByComponentId: HeatTransferEvaluationResultV1['transferByComponentId'];
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

function runThermalComponentEvaluation(
  graph: LegoTechnixGraphV1,
  activePathResolution: ActivePathResolutionV1,
  edgeStates: readonly EdgeStateV1[],
  initialEdgeTemperatureByConnectionId: Readonly<Record<string, {
    readonly estimatedInletTemperatureC?: number;
    readonly estimatedOutletTemperatureC?: number;
  }>>,
  primaryOutputScaleByDomain: HeatSourceEvaluationResultV1['primaryOutputScaleByDomain'],
): ThermalEvalResult {
  const evaluation: HeatTransferEvaluationResultV1 = evaluateHeatTransfersV1(
    graph,
    activePathResolution,
    edgeStates,
    {
      initialEdgeTemperatureByConnectionId,
      primaryOutputScaleByDomain,
    },
  );

  return evaluation;
}

// ---------------------------------------------------------------------------
// Stage 5 — environment integration (placeholder)
// ---------------------------------------------------------------------------

interface EnvironmentIntegrationResult {
  readonly thermalStateByComponentId: Readonly<Record<string, Partial<ComponentStateV1>>>;
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

function runEnvironmentIntegration(
  graph: LegoTechnixGraphV1,
  previousState: LegoTechnixSimulationStateV1,
  heatTransferResult: HeatTransferEvaluationResultV1,
  tickInput: LegoTechnixTickInputV1,
): EnvironmentIntegrationResult {
  return integrateThermalStateV1(
    graph,
    previousState,
    heatTransferResult,
    tickInput,
  );
}

// ---------------------------------------------------------------------------
// Stage 6 — state commit
// ---------------------------------------------------------------------------

function buildComponentStates(
  graph: LegoTechnixGraphV1,
  previous: LegoTechnixSimulationStateV1,
  activePathResolution: ActivePathResolutionV1,
  thermalStateByComponentId: Readonly<Record<string, Partial<ComponentStateV1>>> = {},
): readonly ComponentStateV1[] {
  const previousById = new Map(previous.componentStates.map((s) => [s.componentId, s]));
  const activeComponentIds = new Set(activePathResolution.activeComponentIds);

  return graph.components.map((component): ComponentStateV1 => {
    const prev = previousById.get(component.id);
    const thermalPatch = thermalStateByComponentId[component.id];
    return {
      componentId: component.id,
      isActive: thermalPatch?.isActive ?? activeComponentIds.has(component.id),
      operatingMode: thermalPatch?.operatingMode
        ?? activePathResolution.componentOperatingModes[component.id]
        ?? 'idle',
      measuredTemperatureC: prev?.measuredTemperatureC,
      setpointTemperatureC: prev?.setpointTemperatureC,
      currentTemperatureC: thermalPatch?.currentTemperatureC ?? prev?.currentTemperatureC,
      targetTemperatureC: thermalPatch?.targetTemperatureC ?? prev?.targetTemperatureC,
      thermalMassKwhPerK: thermalPatch?.thermalMassKwhPerK ?? prev?.thermalMassKwhPerK,
      heatLossKwPerK: thermalPatch?.heatLossKwPerK ?? prev?.heatLossKwPerK,
      heatGainKw: thermalPatch?.heatGainKw ?? prev?.heatGainKw,
      heatLossKw: thermalPatch?.heatLossKw ?? prev?.heatLossKw,
      netHeatKw: thermalPatch?.netHeatKw ?? prev?.netHeatKw,
      volumeLitres: thermalPatch?.volumeLitres ?? prev?.volumeLitres,
      storedEnergyKwh: thermalPatch?.storedEnergyKwh ?? prev?.storedEnergyKwh,
      standingLossKw: thermalPatch?.standingLossKw ?? prev?.standingLossKw,
      usableHotWaterLitresAt40C: (
        thermalPatch?.usableHotWaterLitresAt40C
        ?? prev?.usableHotWaterLitresAt40C
      ),
      usableTopLayerHotWaterLitresAt40C: (
        thermalPatch?.usableTopLayerHotWaterLitresAt40C
        ?? prev?.usableTopLayerHotWaterLitresAt40C
      ),
      storageModel: thermalPatch?.storageModel ?? prev?.storageModel,
      chargingMode: thermalPatch?.chargingMode ?? prev?.chargingMode,
      stratificationLayers: thermalPatch?.stratificationLayers ?? prev?.stratificationLayers,
      lastTransferKw: thermalPatch?.lastTransferKw ?? prev?.lastTransferKw,
      lastPrimaryInletTemperatureC: (
        thermalPatch?.lastPrimaryInletTemperatureC
        ?? prev?.lastPrimaryInletTemperatureC
      ),
      lastPrimaryOutletTemperatureC: (
        thermalPatch?.lastPrimaryOutletTemperatureC
        ?? prev?.lastPrimaryOutletTemperatureC
      ),
      lastSecondaryGainKw: thermalPatch?.lastSecondaryGainKw ?? prev?.lastSecondaryGainKw,
      primaryCoilInletTemperatureC: (
        thermalPatch?.primaryCoilInletTemperatureC
        ?? prev?.primaryCoilInletTemperatureC
      ),
      primaryCoilOutletTemperatureC: (
        thermalPatch?.primaryCoilOutletTemperatureC
        ?? prev?.primaryCoilOutletTemperatureC
      ),
      lastRecoveryKw: thermalPatch?.lastRecoveryKw ?? prev?.lastRecoveryKw,
      radiatorPrimaryReturnTemperatureC: (
        thermalPatch?.radiatorPrimaryReturnTemperatureC
        ?? prev?.radiatorPrimaryReturnTemperatureC
      ),
      nominalOutputKw: thermalPatch?.nominalOutputKw ?? prev?.nominalOutputKw,
      minStableOutputKw: thermalPatch?.minStableOutputKw ?? prev?.minStableOutputKw,
      maxOutputKw: thermalPatch?.maxOutputKw ?? prev?.maxOutputKw,
      targetFlowTemperatureC: thermalPatch?.targetFlowTemperatureC ?? prev?.targetFlowTemperatureC,
      returnTemperatureC: thermalPatch?.returnTemperatureC ?? prev?.returnTemperatureC,
      rampRateCPerSecond: thermalPatch?.rampRateCPerSecond ?? prev?.rampRateCPerSecond,
      modulationStrategy: thermalPatch?.modulationStrategy ?? prev?.modulationStrategy,
      heatSourceType: thermalPatch?.heatSourceType ?? prev?.heatSourceType,
      controlDemandState: thermalPatch?.controlDemandState ?? prev?.controlDemandState,
      actuatorPosition: thermalPatch?.actuatorPosition ?? prev?.actuatorPosition,
      condensingLikely: thermalPatch?.condensingLikely ?? prev?.condensingLikely,
      condensingConfidence: thermalPatch?.condensingConfidence ?? prev?.condensingConfidence,
      cyclingRisk: thermalPatch?.cyclingRisk ?? prev?.cyclingRisk,
      designOutsideTemperatureC: thermalPatch?.designOutsideTemperatureC ?? prev?.designOutsideTemperatureC,
      mildOutsideTemperatureC: thermalPatch?.mildOutsideTemperatureC ?? prev?.mildOutsideTemperatureC,
      targetFlowAtDesignC: thermalPatch?.targetFlowAtDesignC ?? prev?.targetFlowAtDesignC,
      targetFlowAtMildC: thermalPatch?.targetFlowAtMildC ?? prev?.targetFlowAtMildC,
      calculatedTargetFlowTemperatureC: (
        thermalPatch?.calculatedTargetFlowTemperatureC ?? prev?.calculatedTargetFlowTemperatureC
      ),
      estimatedCop: thermalPatch?.estimatedCop ?? prev?.estimatedCop,
      estimatedCopBand: thermalPatch?.estimatedCopBand ?? prev?.estimatedCopBand,
      lowTemperatureEmitterSuitability: (
        thermalPatch?.lowTemperatureEmitterSuitability ?? prev?.lowTemperatureEmitterSuitability
      ),
      weatherCompensationEnabled: (
        thermalPatch?.weatherCompensationEnabled ?? prev?.weatherCompensationEnabled
      ),
      loadCompensationEnabled: thermalPatch?.loadCompensationEnabled ?? prev?.loadCompensationEnabled,
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
  edgeThermalStateByConnectionId?: Readonly<Record<string, {
    readonly transitDelayQueueC?: readonly number[];
    readonly estimatedTransitSeconds?: number;
    readonly estimatedPipeHeatLossKw?: number;
  }>>,
): readonly EdgeStateV1[] {
  const previousById = new Map(previous.edgeStates.map((s) => [s.connectionId, s]));
  const activeConnectionIds = new Set(activePathResolution.activeConnectionIds);

  return graph.connections.map((connection): EdgeStateV1 => {
    const prev = previousById.get(connection.id);
    const thermalEstimate = edgeTemperatureByConnectionId?.[connection.id];
    const thermalState = edgeThermalStateByConnectionId?.[connection.id];
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
      transitDelayQueueC: thermalState?.transitDelayQueueC ?? prev?.transitDelayQueueC,
      estimatedTransitSeconds: thermalState?.estimatedTransitSeconds ?? prev?.estimatedTransitSeconds,
      estimatedPipeHeatLossKw: thermalState?.estimatedPipeHeatLossKw ?? prev?.estimatedPipeHeatLossKw,
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
  const pathResult = resolveActivePathsV1(
    graph,
    previousState,
    tickInput,
    pollResult.componentStateById,
  );
  events.push(...pathResult.events);
  warnings.push(...pathResult.warnings);

  // Stage 3b — mass-flow allocation
  const flowResult = runMassFlowAllocation(graph, pathResult, tickInput);
  events.push(...flowResult.allocation.events);
  warnings.push(...flowResult.allocation.warnings);

  const edgeStatesAfterFlow = buildEdgeStates(graph, previousState, pathResult, flowResult.allocation);

  // Stage 3c — heat-source behaviour and supply temperature
  const heatSourceResult = evaluateHeatSourcesV1(
    graph,
    previousState,
    pathResult,
    edgeStatesAfterFlow,
    tickInput,
    pollResult.componentStateById,
  );
  events.push(...heatSourceResult.events);
  warnings.push(...heatSourceResult.warnings);

  // Stage 3d — pipe transit and edge heat loss
  const pipeResult = evaluatePipeEdgesV1(
    graph,
    previousState.componentStates,
    previousState.edgeStates,
    edgeStatesAfterFlow,
    pathResult,
    tickInput.timestepSeconds,
    {
      initialEdgeTemperatureByConnectionId: heatSourceResult.edgeTemperatureByConnectionId,
    },
  );
  events.push(...pipeResult.events);
  warnings.push(...pipeResult.warnings);

  // Stage 4 — thermal/component evaluation
  const thermalResult = runThermalComponentEvaluation(
    graph,
    pathResult,
    edgeStatesAfterFlow,
    pipeResult.edgeTemperatureByConnectionId,
    heatSourceResult.primaryOutputScaleByDomain,
  );
  events.push(...thermalResult.events);
  warnings.push(...thermalResult.warnings);

  // Stage 5 — environment integration
  const envResult = runEnvironmentIntegration(graph, previousState, thermalResult, tickInput);
  events.push(...envResult.events);
  warnings.push(...envResult.warnings);

  const returnTemperatureResult = aggregateReturnTemperatureV1(
    graph,
    previousState,
    pathResult,
    edgeStatesAfterFlow,
    thermalResult,
    heatSourceResult.thermalStateByComponentId,
  );
  events.push(...returnTemperatureResult.events);
  warnings.push(...returnTemperatureResult.warnings);

  const mergedThermalStateByComponentId: Record<string, Partial<ComponentStateV1>> = {
    ...pollResult.componentStateById,
    ...heatSourceResult.thermalStateByComponentId,
  };
  for (const [componentId, patch] of Object.entries(envResult.thermalStateByComponentId)) {
    mergedThermalStateByComponentId[componentId] = {
      ...(mergedThermalStateByComponentId[componentId] ?? {}),
      ...patch,
    };
  }
  for (const [componentId, patch] of Object.entries(returnTemperatureResult.thermalStateByComponentId)) {
    mergedThermalStateByComponentId[componentId] = {
      ...(mergedThermalStateByComponentId[componentId] ?? {}),
      ...patch,
    };
  }

  // Stage 6 — state commit
  const nextState: LegoTechnixSimulationStateV1 = {
    schemaVersion: '1.0',
    tickIndex: previousState.tickIndex + 1,
    wallClockMs: tickInput.wallClockMs,
    componentStates: buildComponentStates(
      graph,
      previousState,
      pathResult,
      mergedThermalStateByComponentId,
    ),
    edgeStates: buildEdgeStates(
      graph,
      previousState,
      pathResult,
      flowResult.allocation,
      thermalResult.edgeTemperatureByConnectionId,
      pipeResult.edgeThermalStateByConnectionId,
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
