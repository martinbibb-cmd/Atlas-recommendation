import type { LegoTechnixDomain } from '../domains';
import type { LegoTechnixGraphV1 } from '../types';
import type { ComponentStateV1, ComponentOperatingModeV1 } from './ComponentStateV1';
import type { EdgeStateV1 } from './EdgeStateV1';
import type { ActivePathResolutionV1 } from './resolveActivePathsV1';
import type { LegoTechnixTickInputV1 } from './LegoTechnixTickInputV1';
import type {
  LegoTechnixSimulationEventV1,
  LegoTechnixSimulationWarningV1,
} from './LegoTechnixTickResultV1';

const CONDENSING_RETURN_THRESHOLD_C = 55;

interface EdgeTemperatureEstimateV1 {
  readonly estimatedInletTemperatureC?: number;
  readonly estimatedOutletTemperatureC?: number;
}

export interface HeatSourceEvaluationResultV1 {
  readonly edgeTemperatureByConnectionId: Readonly<Record<string, EdgeTemperatureEstimateV1>>;
  readonly thermalStateByComponentId: Readonly<Record<string, Partial<ComponentStateV1>>>;
  readonly primaryOutputScaleByDomain: Readonly<Partial<Record<LegoTechnixDomain, number>>>;
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) {
    return Math.min(current + maxDelta, target);
  }
  if (current > target) {
    return Math.max(current - maxDelta, target);
  }
  return current;
}

function parseControlDemand(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (record.controlDemandState === 'demanding') {
    return true;
  }
  if (record.controlDemandState === 'none') {
    return false;
  }
  const candidates = [
    record.demand,
    record.controlDemand,
    record.callForHeat,
    record.isCallingForHeat,
    record.enabled,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'boolean') {
      return candidate;
    }
  }
  return undefined;
}

function sumRequiredLoadByDomainKw(
  graph: LegoTechnixGraphV1,
  activePathResolution: ActivePathResolutionV1,
  edgeStateByConnectionId: ReadonlyMap<string, EdgeStateV1>,
): ReadonlyMap<LegoTechnixDomain, number> {
  const activeComponentIds = new Set(activePathResolution.activeComponentIds);
  const requiredByDomain = new Map<LegoTechnixDomain, number>();

  for (const contract of graph.heatTransferComponents ?? []) {
    if (!activeComponentIds.has(contract.componentId)) {
      continue;
    }
    const inletEdge = graph.connections.find((connection) => (
      connection.targetComponentId === contract.componentId
      && connection.domain === contract.primaryDomain
    ));
    const outletEdge = graph.connections.find((connection) => (
      connection.sourceComponentId === contract.componentId
      && connection.domain === contract.primaryDomain
    ));
    const inletState = inletEdge ? edgeStateByConnectionId.get(inletEdge.id) : undefined;
    const outletState = outletEdge ? edgeStateByConnectionId.get(outletEdge.id) : undefined;
    const preferredFlowEdge = outletState ?? inletState;
    const hasActivePrimaryFlow = (
      (inletState?.isActive ?? false) || (outletState?.isActive ?? false)
    ) && (preferredFlowEdge?.estimatedFlowKgPerS ?? 0) > 0;

    if (!hasActivePrimaryFlow) {
      continue;
    }

    requiredByDomain.set(
      contract.primaryDomain,
      (requiredByDomain.get(contract.primaryDomain) ?? 0)
        + Math.max(contract.output.energyTransfer.primaryEnergyRemovedKw, 0),
    );
  }

  return requiredByDomain;
}

function getPrimaryConnections(
  graph: LegoTechnixGraphV1,
  componentId: string,
  primaryDomain: LegoTechnixDomain,
): {
  readonly inletConnectionIds: readonly string[];
  readonly outletConnectionIds: readonly string[];
} {
  const inletConnectionIds = graph.connections
    .filter((connection) => (
      connection.targetComponentId === componentId
      && connection.domain === primaryDomain
    ))
    .map((connection) => connection.id);
  const outletConnectionIds = graph.connections
    .filter((connection) => (
      connection.sourceComponentId === componentId
      && connection.domain === primaryDomain
    ))
    .map((connection) => connection.id);
  return { inletConnectionIds, outletConnectionIds };
}

export function evaluateHeatSourcesV1(
  graph: LegoTechnixGraphV1,
  previousState: Readonly<{ componentStates: readonly ComponentStateV1[] }>,
  activePathResolution: ActivePathResolutionV1,
  edgeStates: readonly EdgeStateV1[],
  tickInput: LegoTechnixTickInputV1,
  stagedComponentStateById?: Readonly<Record<string, Partial<ComponentStateV1>>>,
): HeatSourceEvaluationResultV1 {
  const events: LegoTechnixSimulationEventV1[] = [];
  const warnings: LegoTechnixSimulationWarningV1[] = [];
  const thermalStateByComponentId: Record<string, Partial<ComponentStateV1>> = {};
  const edgeTemperatureByConnectionId: Record<string, EdgeTemperatureEstimateV1> = {};
  const outputByDomainKw = new Map<LegoTechnixDomain, number>();
  const edgeStateByConnectionId = new Map(edgeStates.map((edgeState) => [edgeState.connectionId, edgeState]));
  const previousStateByComponentId = new Map(
    previousState.componentStates.map((componentState) => [componentState.componentId, componentState]),
  );

  const requiredLoadByDomainKw = sumRequiredLoadByDomainKw(graph, activePathResolution, edgeStateByConnectionId);
  const timestepSeconds = Math.max(tickInput.timestepSeconds, 0);
  const activeResolvedPathIds = new Set(
    activePathResolution.resolvedPaths
      .filter((path) => path.isActive)
      .map((path) => path.pathId),
  );

  for (const model of graph.heatSourceModels ?? []) {
    const demandOverride = parseControlDemand(tickInput.controlOverrides?.[model.componentId]);
    const stagedDemandState = stagedComponentStateById?.[model.componentId]?.controlDemandState;
    const controlDemandState = typeof demandOverride === 'boolean'
      ? (demandOverride ? 'demanding' : 'none')
      : (stagedDemandState ?? model.controlDemandState ?? 'none');
    const hasActivePrimaryPath = (graph.activeCircuitPaths ?? []).some((path) => (
      activeResolvedPathIds.has(path.id)
      && path.domain === model.primaryDomain
      && path.sourceComponentId === model.componentId
    ));
    const isDeadheaded = activePathResolution.deadheadedComponentIds.includes(model.componentId);
    const shouldFire = controlDemandState === 'demanding' && hasActivePrimaryPath && !isDeadheaded;

    const previous = previousStateByComponentId.get(model.componentId);
    const { inletConnectionIds, outletConnectionIds } = getPrimaryConnections(
      graph,
      model.componentId,
      model.primaryDomain,
    );

    const inferredReturnTemperatureC = inletConnectionIds
      .map((connectionId) => edgeStateByConnectionId.get(connectionId))
      .map((edgeState) => edgeState?.estimatedOutletTemperatureC ?? edgeState?.estimatedInletTemperatureC)
      .find((value): value is number => typeof value === 'number');
    const returnTemperatureC = round3(
      inferredReturnTemperatureC
      ?? previous?.returnTemperatureC
      ?? model.returnTemperatureC
      ?? (model.targetFlowTemperatureC - 20),
    );

    const previousFlowTemperatureC = previous?.currentTemperatureC
      ?? previous?.lastPrimaryOutletTemperatureC
      ?? returnTemperatureC;
    const rampDeltaC = Math.max(model.rampRateCPerSecond, 0) * timestepSeconds;
    const nextFlowTemperatureC = shouldFire
      ? approach(previousFlowTemperatureC, model.targetFlowTemperatureC, rampDeltaC)
      : returnTemperatureC;

    const requiredLoadKw = requiredLoadByDomainKw.get(model.primaryDomain) ?? 0;
    const capabilityMaxKw = Math.max(0, Math.min(model.maxOutputKw, model.nominalOutputKw));
    let outputKw = 0;
    let cyclingRisk = false;

    if (shouldFire) {
      cyclingRisk = requiredLoadKw < model.minStableOutputKw;
      outputKw = clamp(
        Math.max(requiredLoadKw, model.minStableOutputKw),
        0,
        capabilityMaxKw,
      );
      outputByDomainKw.set(
        model.primaryDomain,
        (outputByDomainKw.get(model.primaryDomain) ?? 0) + outputKw,
      );
    }

    const condensingLikely = returnTemperatureC < CONDENSING_RETURN_THRESHOLD_C;
    const operatingMode: ComponentOperatingModeV1 = isDeadheaded
      ? 'fault'
      : (shouldFire ? 'running' : 'idle');

    thermalStateByComponentId[model.componentId] = {
      isActive: shouldFire,
      operatingMode,
      currentTemperatureC: round3(nextFlowTemperatureC),
      targetTemperatureC: model.targetFlowTemperatureC,
      nominalOutputKw: round3(model.nominalOutputKw),
      minStableOutputKw: round3(model.minStableOutputKw),
      maxOutputKw: round3(model.maxOutputKw),
      targetFlowTemperatureC: round3(model.targetFlowTemperatureC),
      returnTemperatureC,
      rampRateCPerSecond: round3(model.rampRateCPerSecond),
      modulationStrategy: model.modulationStrategy,
      controlDemandState,
      condensingLikely,
      cyclingRisk,
      heatGainKw: round3(outputKw),
      netHeatKw: round3(outputKw),
      lastPrimaryInletTemperatureC: returnTemperatureC,
      lastPrimaryOutletTemperatureC: round3(nextFlowTemperatureC),
    };

    for (const connectionId of outletConnectionIds) {
      edgeTemperatureByConnectionId[connectionId] = {
        estimatedInletTemperatureC: round3(nextFlowTemperatureC),
        estimatedOutletTemperatureC: round3(nextFlowTemperatureC),
      };
    }

    if (isDeadheaded && controlDemandState === 'demanding') {
      warnings.push({
        code: 'heat_source_deadheaded',
        componentId: model.componentId,
        message: `Heat source "${model.componentId}" has demand but no active return path; source is held off.`,
      });
    } else if (controlDemandState === 'demanding' && !hasActivePrimaryPath) {
      warnings.push({
        code: 'heat_source_no_active_path',
        componentId: model.componentId,
        message: `Heat source "${model.componentId}" has demand but no active primary path; source is held off.`,
      });
    }

    if (cyclingRisk && shouldFire) {
      warnings.push({
        code: 'heat_source_cycling_risk',
        componentId: model.componentId,
        message: `Heat source "${model.componentId}" required load ${round3(requiredLoadKw)}kW is below minimum stable output ${round3(model.minStableOutputKw)}kW.`,
      });
    }

    events.push({
      type: 'heat_source_evaluated',
      componentId: model.componentId,
      message: `Heat source "${model.componentId}" is ${shouldFire ? 'firing' : 'off'} at ${round3(outputKw)}kW with flow ${round3(nextFlowTemperatureC)}°C and return ${returnTemperatureC}°C.`,
    });
  }

  const primaryOutputScaleByDomain: Partial<Record<LegoTechnixDomain, number>> = {};
  for (const [domain, requiredLoadKw] of requiredLoadByDomainKw.entries()) {
    const availableOutputKw = outputByDomainKw.get(domain) ?? 0;
    primaryOutputScaleByDomain[domain] = requiredLoadKw > 0
      ? round3(clamp(availableOutputKw / requiredLoadKw, 0, 1))
      : 0;
  }

  return {
    edgeTemperatureByConnectionId,
    thermalStateByComponentId,
    primaryOutputScaleByDomain,
    events,
    warnings,
  };
}
