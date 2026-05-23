import type { LegoTechnixGraphV1 } from '../types';
import type { ComponentStateV1 } from './ComponentStateV1';
import type { EdgeStateV1 } from './EdgeStateV1';
import type { HeatTransferEvaluationResultV1 } from './evaluateHeatTransfersV1';
import type {
  LegoTechnixSimulationEventV1,
  LegoTechnixSimulationWarningV1,
} from './LegoTechnixTickResultV1';
import type { ActivePathResolutionV1 } from './resolveActivePathsV1';

const CONDENSING_RETURN_THRESHOLD_C = 55;

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function resolvePrimaryOutletConnectionId(
  graph: LegoTechnixGraphV1,
  componentId: string,
  primaryDomain: string,
): string | undefined {
  return graph.connections.find((connection) => (
    connection.sourceComponentId === componentId
    && connection.domain === primaryDomain
  ))?.id;
}

function resolveSourceRuntimeReturnC(
  graph: LegoTechnixGraphV1,
  heatSourceComponentId: string,
  primaryDomain: string,
  activePathResolution: ActivePathResolutionV1,
  edgeStateByConnectionId: ReadonlyMap<string, EdgeStateV1>,
  edgeTemperatureByConnectionId: HeatTransferEvaluationResultV1['edgeTemperatureByConnectionId'],
): number | undefined {
  const activePathIds = new Set(
    activePathResolution.resolvedPaths
      .filter((path) => path.isActive)
      .map((path) => path.pathId),
  );
  const reachableSinkComponentIds = new Set(
    (graph.activeCircuitPaths ?? [])
      .filter((path) => (
        activePathIds.has(path.id)
        && path.domain === primaryDomain
        && path.sourceComponentId === heatSourceComponentId
      ))
      .map((path) => path.sinkComponentId),
  );

  let weightedReturnTemp = 0;
  let totalMassFlowKgPerS = 0;

  for (const contract of graph.heatTransferComponents ?? []) {
    if (contract.primaryDomain !== primaryDomain) {
      continue;
    }
    if (!reachableSinkComponentIds.has(contract.componentId)) {
      continue;
    }
    if (!activePathResolution.activeComponentIds.includes(contract.componentId)) {
      continue;
    }

    const outletConnectionId = resolvePrimaryOutletConnectionId(
      graph,
      contract.componentId,
      contract.primaryDomain,
    );
    if (!outletConnectionId) {
      continue;
    }
    const outletEdgeState = edgeStateByConnectionId.get(outletConnectionId);
    const massFlowKgPerS = outletEdgeState?.isActive ? (outletEdgeState.estimatedFlowKgPerS ?? 0) : 0;
    if (massFlowKgPerS <= 0) {
      continue;
    }
    const edgeTemperature = edgeTemperatureByConnectionId[outletConnectionId];
    const returnTemperatureC = edgeTemperature?.estimatedOutletTemperatureC
      ?? edgeTemperature?.estimatedInletTemperatureC
      ?? outletEdgeState?.estimatedOutletTemperatureC
      ?? outletEdgeState?.estimatedInletTemperatureC;
    if (typeof returnTemperatureC !== 'number') {
      continue;
    }

    weightedReturnTemp += massFlowKgPerS * returnTemperatureC;
    totalMassFlowKgPerS += massFlowKgPerS;
  }

  if (totalMassFlowKgPerS <= 0) {
    return undefined;
  }

  return round3(weightedReturnTemp / totalMassFlowKgPerS);
}

export interface AggregateReturnTemperatureResultV1 {
  readonly thermalStateByComponentId: Readonly<Record<string, Partial<ComponentStateV1>>>;
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

export function aggregateReturnTemperatureV1(
  graph: LegoTechnixGraphV1,
  previousState: Readonly<{ componentStates: readonly ComponentStateV1[] }>,
  activePathResolution: ActivePathResolutionV1,
  edgeStates: readonly EdgeStateV1[],
  heatTransferResult: HeatTransferEvaluationResultV1,
  stagedThermalStateByComponentId?: Readonly<Record<string, Partial<ComponentStateV1>>>,
): AggregateReturnTemperatureResultV1 {
  const thermalStateByComponentId: Record<string, Partial<ComponentStateV1>> = {};
  const events: LegoTechnixSimulationEventV1[] = [];
  const warnings: LegoTechnixSimulationWarningV1[] = [];
  const edgeStateByConnectionId = new Map(edgeStates.map((edgeState) => [edgeState.connectionId, edgeState]));
  const previousByComponentId = new Map(
    previousState.componentStates.map((componentState) => [componentState.componentId, componentState]),
  );

  for (const model of graph.heatSourceModels ?? []) {
    const runtimeReturnTemperatureC = resolveSourceRuntimeReturnC(
      graph,
      model.componentId,
      model.primaryDomain,
      activePathResolution,
      edgeStateByConnectionId,
      heatTransferResult.edgeTemperatureByConnectionId,
    );
    const staged = stagedThermalStateByComponentId?.[model.componentId];
    const stagedTargetFlowTemperatureC = staged?.targetFlowTemperatureC
      ?? staged?.calculatedTargetFlowTemperatureC;
    const fallbackTargetFlowTemperatureC = stagedTargetFlowTemperatureC
      ?? previousByComponentId.get(model.componentId)?.targetFlowTemperatureC
      ?? model.calculatedTargetFlowTemperatureC
      ?? model.targetFlowTemperatureC;
    const fallbackReturnTemperatureC = model.heatSourceType === 'gas_boiler'
      ? (fallbackTargetFlowTemperatureC - 20)
      : (
        previousByComponentId.get(model.componentId)?.returnTemperatureC
        ?? model.returnTemperatureC
        ?? (fallbackTargetFlowTemperatureC - 20)
      );
    const resolvedReturnTemperatureC = round3(runtimeReturnTemperatureC ?? fallbackReturnTemperatureC);
    const condensingConfidence = typeof runtimeReturnTemperatureC === 'number'
      ? 'derived'
      : 'assumed';

    thermalStateByComponentId[model.componentId] = {
      returnTemperatureC: resolvedReturnTemperatureC,
      condensingLikely: resolvedReturnTemperatureC < CONDENSING_RETURN_THRESHOLD_C,
      condensingConfidence,
      lastPrimaryInletTemperatureC: resolvedReturnTemperatureC,
    };

    if (typeof runtimeReturnTemperatureC === 'number') {
      events.push({
        type: 'return_temperature_aggregated',
        componentId: model.componentId,
        message: `Heat source "${model.componentId}" runtime return aggregated to ${resolvedReturnTemperatureC}°C.`,
      });
    }
  }

  return {
    thermalStateByComponentId,
    events,
    warnings,
  };
}
