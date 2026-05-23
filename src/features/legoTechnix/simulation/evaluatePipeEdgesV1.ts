import { isWaterCarryingDomain } from '../hydraulicConnectionEdge';
import type { LegoTechnixDomain } from '../domains';
import type { LegoTechnixGraphV1 } from '../types';
import type { ComponentStateV1 } from './ComponentStateV1';
import type { EdgeStateV1 } from './EdgeStateV1';
import type { ActivePathResolutionV1 } from './resolveActivePathsV1';
import type {
  LegoTechnixSimulationEventV1,
  LegoTechnixSimulationWarningV1,
} from './LegoTechnixTickResultV1';

const WATER_SPECIFIC_HEAT_KJ_PER_KG_K = 4.186;
const DEFAULT_AMBIENT_TEMPERATURE_C = 20;
const DEFAULT_HEAT_LOSS_W_PER_M_BY_INSULATION: Readonly<Record<string, number>> = {
  insulated: 2,
  partial: 6,
  uninsulated: 12,
  unknown: 8,
};

interface EdgeTemperatureEstimateV1 {
  readonly estimatedInletTemperatureC?: number;
  readonly estimatedOutletTemperatureC?: number;
}

export interface EvaluatePipeEdgesOptionsV1 {
  readonly initialEdgeTemperatureByConnectionId?: Readonly<Record<string, EdgeTemperatureEstimateV1>>;
}

export interface PipeEdgeEvaluationResultV1 {
  readonly edgeTemperatureByConnectionId: Readonly<Record<string, EdgeTemperatureEstimateV1>>;
  readonly edgeThermalStateByConnectionId: Readonly<Record<string, {
    readonly transitDelayQueueC?: readonly number[];
    readonly estimatedTransitSeconds?: number;
    readonly estimatedPipeHeatLossKw?: number;
  }>>;
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function inferAmbientTemperatureC(
  graph: LegoTechnixGraphV1,
  edge: LegoTechnixGraphV1['connections'][number],
  previousEdgeState: EdgeStateV1 | undefined,
  previousEdgeStateByConnectionId: ReadonlyMap<string, EdgeStateV1>,
  previousComponentTemperatureById: ReadonlyMap<string, number>,
): number {
  const ambientDomainId = edge.physical.ambientDomainId;
  if (ambientDomainId) {
    const ambientComponent = graph.components.find((component) => (
      component.domains?.includes(ambientDomainId as LegoTechnixDomain)
    ));
    if (ambientComponent) {
      const candidate = previousComponentTemperatureById.get(ambientComponent.id);
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return candidate;
      }
    }
  }

  const sourceEdge = graph.connections.find((connection) => (
    connection.targetComponentId === edge.sourceComponentId && connection.domain === edge.domain
  ));
  const sourceEdgeState = sourceEdge
    ? previousEdgeStateByConnectionId.get(sourceEdge.id)
    : previousEdgeState;
  const sourceTemp = sourceEdgeState?.estimatedOutletTemperatureC ?? sourceEdgeState?.estimatedInletTemperatureC;
  if (typeof sourceTemp === 'number' && Number.isFinite(sourceTemp)) {
    return sourceTemp;
  }

  return DEFAULT_AMBIENT_TEMPERATURE_C;
}

function resolveInletTemperatureC(
  graph: LegoTechnixGraphV1,
  edge: LegoTechnixGraphV1['connections'][number],
  previousEdgeState: EdgeStateV1 | undefined,
  edgeTemperatureByConnectionId: Record<string, EdgeTemperatureEstimateV1>,
): number | undefined {
  const seeded = edgeTemperatureByConnectionId[edge.id];
  const seededCandidate = seeded?.estimatedInletTemperatureC ?? seeded?.estimatedOutletTemperatureC;
  if (typeof seededCandidate === 'number' && Number.isFinite(seededCandidate)) {
    return seededCandidate;
  }

  const sourceEdge = graph.connections.find((connection) => (
    connection.targetComponentId === edge.sourceComponentId && connection.domain === edge.domain
  ));
  const sourceEvaluated = sourceEdge ? edgeTemperatureByConnectionId[sourceEdge.id] : undefined;
  const sourceCandidate = sourceEvaluated?.estimatedOutletTemperatureC ?? sourceEvaluated?.estimatedInletTemperatureC;
  if (typeof sourceCandidate === 'number' && Number.isFinite(sourceCandidate)) {
    return sourceCandidate;
  }

  const previousCandidate = previousEdgeState?.estimatedOutletTemperatureC
    ?? previousEdgeState?.estimatedInletTemperatureC;
  if (typeof previousCandidate === 'number' && Number.isFinite(previousCandidate)) {
    return previousCandidate;
  }

  return undefined;
}

function getDelayTicks(transitSeconds: number, timestepSeconds: number): number {
  const safeTimestep = Math.max(timestepSeconds, 0.001);
  return Math.max(0, Math.ceil(transitSeconds / safeTimestep) - 1);
}

function applyHeatLossC(
  inletTemperatureC: number,
  ambientTemperatureC: number,
  simpleHeatLossWPerM: number,
  lengthM: number,
  massFlowKgPerS: number,
): { readonly outletTemperatureC: number; readonly lossKw: number } {
  const lossKw = Math.max(simpleHeatLossWPerM, 0) * Math.max(lengthM, 0) / 1000;
  if (massFlowKgPerS <= 0) {
    return {
      outletTemperatureC: inletTemperatureC,
      lossKw: 0,
    };
  }
  const deltaTemperatureK = lossKw / (massFlowKgPerS * WATER_SPECIFIC_HEAT_KJ_PER_KG_K);
  const outletTemperatureC = Math.max(ambientTemperatureC, inletTemperatureC - deltaTemperatureK);
  return {
    outletTemperatureC,
    lossKw,
  };
}

export function evaluatePipeEdgesV1(
  graph: LegoTechnixGraphV1,
  previousComponentStates: readonly ComponentStateV1[],
  previousEdgeStates: readonly EdgeStateV1[],
  currentEdgeStates: readonly EdgeStateV1[],
  activePathResolution: ActivePathResolutionV1,
  timestepSeconds: number,
  options: EvaluatePipeEdgesOptionsV1 = {},
): PipeEdgeEvaluationResultV1 {
  const events: LegoTechnixSimulationEventV1[] = [];
  const warnings: LegoTechnixSimulationWarningV1[] = [];
  const activeConnectionIds = new Set(activePathResolution.activeConnectionIds);
  const previousEdgeStateByConnectionId = new Map(
    previousEdgeStates.map((edgeState) => [edgeState.connectionId, edgeState]),
  );
  const currentEdgeStateByConnectionId = new Map(
    currentEdgeStates.map((edgeState) => [edgeState.connectionId, edgeState]),
  );
  const previousComponentTemperatureById = new Map(
    previousComponentStates
      .filter((componentState) => typeof componentState.currentTemperatureC === 'number')
      .map((componentState) => [componentState.componentId, componentState.currentTemperatureC as number]),
  );

  const edgeTemperatureByConnectionId: Record<string, EdgeTemperatureEstimateV1> = {
    ...(options.initialEdgeTemperatureByConnectionId ?? {}),
  };
  const edgeThermalStateByConnectionId: Record<string, {
    readonly transitDelayQueueC?: readonly number[];
    readonly estimatedTransitSeconds?: number;
    readonly estimatedPipeHeatLossKw?: number;
  }> = {};

  for (const edge of graph.connections) {
    if (!isWaterCarryingDomain(edge.domain)) {
      continue;
    }

    const previousEdgeState = previousEdgeStateByConnectionId.get(edge.id);
    const currentEdgeState = currentEdgeStateByConnectionId.get(edge.id);
    const isActive = activeConnectionIds.has(edge.id) && (currentEdgeState?.isActive ?? false);
    const massFlowKgPerS = currentEdgeState?.estimatedFlowKgPerS ?? 0;
    const velocityMps = currentEdgeState?.estimatedVelocityMps;
    const previousQueue = [...(previousEdgeState?.transitDelayQueueC ?? [])];
    const previousEstimatedInletTemperatureC = previousEdgeState?.estimatedInletTemperatureC;
    const previousEstimatedOutletTemperatureC = previousEdgeState?.estimatedOutletTemperatureC;
    const seeded = edgeTemperatureByConnectionId[edge.id];

    if (!isActive) {
      edgeTemperatureByConnectionId[edge.id] = {
        estimatedInletTemperatureC: seeded?.estimatedInletTemperatureC ?? previousEstimatedInletTemperatureC,
        estimatedOutletTemperatureC: seeded?.estimatedOutletTemperatureC ?? previousEstimatedOutletTemperatureC,
      };
      edgeThermalStateByConnectionId[edge.id] = {
        transitDelayQueueC: previousQueue,
        estimatedTransitSeconds: previousEdgeState?.estimatedTransitSeconds,
        estimatedPipeHeatLossKw: previousEdgeState?.estimatedPipeHeatLossKw,
      };
      continue;
    }

    if (massFlowKgPerS <= 0) {
      edgeTemperatureByConnectionId[edge.id] = {
        estimatedInletTemperatureC: seeded?.estimatedInletTemperatureC ?? previousEstimatedInletTemperatureC,
        estimatedOutletTemperatureC: seeded?.estimatedOutletTemperatureC ?? previousEstimatedOutletTemperatureC,
      };
      edgeThermalStateByConnectionId[edge.id] = {
        transitDelayQueueC: previousQueue,
        estimatedTransitSeconds: previousEdgeState?.estimatedTransitSeconds,
        estimatedPipeHeatLossKw: previousEdgeState?.estimatedPipeHeatLossKw,
      };
      continue;
    }

    const inletTemperatureC = resolveInletTemperatureC(
      graph,
      edge,
      previousEdgeState,
      edgeTemperatureByConnectionId,
    );
    if (typeof inletTemperatureC !== 'number') {
      warnings.push({
        code: 'pipe_temperature_inlet_missing',
        message: `Connection "${edge.id}" has active flow but no inlet temperature; retaining previous thermal state.`,
      });
      edgeTemperatureByConnectionId[edge.id] = {
        estimatedInletTemperatureC: previousEstimatedInletTemperatureC,
        estimatedOutletTemperatureC: previousEstimatedOutletTemperatureC,
      };
      edgeThermalStateByConnectionId[edge.id] = {
        transitDelayQueueC: previousQueue,
        estimatedTransitSeconds: previousEdgeState?.estimatedTransitSeconds,
        estimatedPipeHeatLossKw: previousEdgeState?.estimatedPipeHeatLossKw,
      };
      continue;
    }

    const lengthM = edge.physical.lengthM;
    if (!(typeof lengthM === 'number' && Number.isFinite(lengthM) && lengthM >= 0)
      || !(typeof velocityMps === 'number' && Number.isFinite(velocityMps) && velocityMps > 0)) {
      warnings.push({
        code: 'pipe_geometry_missing',
        message: `Connection "${edge.id}" is missing length or velocity; falling back to pass-through temperature.`,
      });
      edgeTemperatureByConnectionId[edge.id] = {
        estimatedInletTemperatureC: round3(inletTemperatureC),
        estimatedOutletTemperatureC: round3(inletTemperatureC),
      };
      edgeThermalStateByConnectionId[edge.id] = {
        transitDelayQueueC: previousQueue,
        estimatedTransitSeconds: previousEdgeState?.estimatedTransitSeconds,
        estimatedPipeHeatLossKw: 0,
      };
      continue;
    }

    const transitSeconds = Math.max(lengthM / velocityMps, 0);
    const simpleHeatLossWPerM = edge.physical.simpleHeatLossWPerM
      ?? DEFAULT_HEAT_LOSS_W_PER_M_BY_INSULATION[edge.physical.insulationState ?? 'unknown']
      ?? 0;
    const ambientTemperatureC = inferAmbientTemperatureC(
      graph,
      edge,
      previousEdgeState,
      previousEdgeStateByConnectionId,
      previousComponentTemperatureById,
    );
    const heatLoss = applyHeatLossC(
      inletTemperatureC,
      ambientTemperatureC,
      simpleHeatLossWPerM,
      lengthM,
      massFlowKgPerS,
    );
    const cooledInletTemperatureC = round3(heatLoss.outletTemperatureC);

    let outletTemperatureC = cooledInletTemperatureC;
    const nextQueue = [...previousQueue];
    const delayTicks = getDelayTicks(transitSeconds, timestepSeconds);
    if (delayTicks > 0) {
      nextQueue.push(cooledInletTemperatureC);
      if (nextQueue.length > delayTicks) {
        const shifted = nextQueue.shift();
        outletTemperatureC = typeof shifted === 'number'
          ? shifted
          : (previousEstimatedOutletTemperatureC ?? cooledInletTemperatureC);
      } else {
        outletTemperatureC = previousEstimatedOutletTemperatureC ?? cooledInletTemperatureC;
      }
    }

    edgeTemperatureByConnectionId[edge.id] = {
      estimatedInletTemperatureC: round3(inletTemperatureC),
      estimatedOutletTemperatureC: round3(outletTemperatureC),
    };
    edgeThermalStateByConnectionId[edge.id] = {
      transitDelayQueueC: nextQueue,
      estimatedTransitSeconds: round3(transitSeconds),
      estimatedPipeHeatLossKw: round3(heatLoss.lossKw),
    };
    events.push({
      type: 'pipe_edge_evaluated',
      componentId: edge.id,
      message: `Pipe "${edge.id}" transit=${round3(transitSeconds)}s, loss=${round3(heatLoss.lossKw)}kW, outlet=${round3(outletTemperatureC)}°C.`,
    });
  }

  return {
    edgeTemperatureByConnectionId,
    edgeThermalStateByConnectionId,
    events,
    warnings,
  };
}
