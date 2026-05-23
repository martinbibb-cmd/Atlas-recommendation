import { isWaterCarryingDomain } from '../hydraulicConnectionEdge';
import type { LegoTechnixGraphV1 } from '../types';
import type { ActivePathResolutionV1 } from './resolveActivePathsV1';
import type { LegoTechnixTickInputV1 } from './LegoTechnixTickInputV1';
import type {
  LegoTechnixSimulationEventV1,
  LegoTechnixSimulationWarningV1,
} from './LegoTechnixTickResultV1';
import type { FlowRiskBandV1 } from './EdgeStateV1';

const DEFAULT_DRIVER_AVAILABLE_FLOW_LPS = 0.2;
const DEFAULT_RESISTANCE_INDEX = 1;
const HIGH_VELOCITY_RISK_MPS = 1.5;
const MICROBORE_DIAMETER_MM = 12;
const MICROBORE_BOTTLENECK_RISK_MPS = 0.9;
const MIN_RESISTANCE_INDEX = 0.01;

interface PathAllocationBasis {
  readonly pathId: string;
  readonly connectionIds: readonly string[];
  readonly resistanceIndex: number;
}

export interface EdgeFlowEstimateV1 {
  readonly estimatedFlowLps: number;
  readonly estimatedVelocityMps?: number;
  readonly flowRiskBand?: FlowRiskBandV1;
}

export interface MassFlowAllocationResultV1 {
  readonly edgeFlowByConnectionId: Readonly<Record<string, EdgeFlowEstimateV1>>;
  readonly driverAvailableFlowLpsByComponentId: Readonly<Record<string, number>>;
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function parseDriverAvailableFlowLps(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const candidates = [
    record.availableFlowEstimate,
    record.availableFlowEstimateLps,
    record.availableFlowLps,
    record.flowLps,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }

  return undefined;
}

function classifyFlowRiskBand(velocityMps: number, internalDiameterMm?: number): FlowRiskBandV1 | undefined {
  if (typeof internalDiameterMm === 'number'
    && internalDiameterMm <= MICROBORE_DIAMETER_MM
    && velocityMps >= MICROBORE_BOTTLENECK_RISK_MPS) {
    return 'microbore_bottleneck';
  }

  if (velocityMps >= HIGH_VELOCITY_RISK_MPS) {
    return 'high_velocity';
  }

  return undefined;
}

export function allocateMassFlowV1(
  graph: LegoTechnixGraphV1,
  activePathResolution: ActivePathResolutionV1,
  tickInput: LegoTechnixTickInputV1,
): MassFlowAllocationResultV1 {
  const events: LegoTechnixSimulationEventV1[] = [];
  const warnings: LegoTechnixSimulationWarningV1[] = [];
  const connectionById = new Map(graph.connections.map((connection) => [connection.id, connection]));

  const activePathsByDriver = new Map<string, PathAllocationBasis[]>();
  for (const resolvedPath of activePathResolution.resolvedPaths) {
    if (!resolvedPath.isActive || resolvedPath.activeConnectionIds.length === 0) {
      continue;
    }

    const resistanceIndex = resolvedPath.activeConnectionIds.reduce((sum, connectionId) => {
      const edgeResistance = connectionById.get(connectionId)?.physical?.estimatedResistanceIndex;
      if (typeof edgeResistance === 'number' && Number.isFinite(edgeResistance) && edgeResistance >= 0) {
        return sum + edgeResistance;
      }
      warnings.push({
        code: 'flow_assumption_missing_resistance',
        message: `Connection "${connectionId}" has no resistance index; using fallback assumption.`,
      });
      return sum + DEFAULT_RESISTANCE_INDEX;
    }, 0);

    const basis: PathAllocationBasis = {
      pathId: resolvedPath.pathId,
      connectionIds: resolvedPath.activeConnectionIds,
      resistanceIndex: Math.max(resistanceIndex, MIN_RESISTANCE_INDEX),
    };

    if (!activePathsByDriver.has(resolvedPath.driverComponentId)) {
      activePathsByDriver.set(resolvedPath.driverComponentId, []);
    }
    activePathsByDriver.get(resolvedPath.driverComponentId)?.push(basis);
  }

  const flowByConnectionId = new Map<string, number>();
  const driverAvailableFlowLpsByComponentId = new Map<string, number>();

  for (const [driverComponentId, driverPaths] of activePathsByDriver.entries()) {
    const overriddenDriverFlow = parseDriverAvailableFlowLps(tickInput.controlOverrides?.[driverComponentId]);
    const availableFlowLps = overriddenDriverFlow ?? DEFAULT_DRIVER_AVAILABLE_FLOW_LPS;
    driverAvailableFlowLpsByComponentId.set(driverComponentId, round3(availableFlowLps));

    if (overriddenDriverFlow === undefined) {
      warnings.push({
        code: 'flow_assumption_driver_default',
        componentId: driverComponentId,
        message: `Driver "${driverComponentId}" missing availableFlowEstimate; defaulting to ${DEFAULT_DRIVER_AVAILABLE_FLOW_LPS} L/s.`,
      });
    }

    const pathWeights = driverPaths.map((path) => ({
      path,
      weight: 1 / path.resistanceIndex,
    }));
    const totalWeight = pathWeights.reduce((sum, entry) => sum + entry.weight, 0);

    for (const { path, weight } of pathWeights) {
      const allocatedPathFlowLps = totalWeight > 0 ? (availableFlowLps * (weight / totalWeight)) : 0;
      for (const connectionId of path.connectionIds) {
        const current = flowByConnectionId.get(connectionId) ?? 0;
        flowByConnectionId.set(connectionId, current + allocatedPathFlowLps);
      }
      events.push({
        type: 'flow_path_allocated',
        componentId: driverComponentId,
        message: `Allocated ${round3(allocatedPathFlowLps)} L/s to active path "${path.pathId}".`,
      });
    }
  }

  const edgeFlowByConnectionId: Record<string, EdgeFlowEstimateV1> = {};
  for (const connection of graph.connections) {
    if (!isWaterCarryingDomain(connection.domain)) {
      continue;
    }

    const estimatedFlowLps = Math.max(flowByConnectionId.get(connection.id) ?? 0, 0);
    const internalDiameterMm = connection.physical.internalDiameterMm ?? connection.physical.nominalDiameterMm;

    let estimatedVelocityMps: number | undefined;
    let flowRiskBand: FlowRiskBandV1 | undefined;

    if (estimatedFlowLps > 0) {
      if (typeof internalDiameterMm === 'number' && Number.isFinite(internalDiameterMm) && internalDiameterMm > 0) {
        const diameterM = internalDiameterMm / 1000;
        const areaM2 = Math.PI * (diameterM ** 2) / 4;
        const volumetricFlowM3PerS = estimatedFlowLps / 1000;
        estimatedVelocityMps = volumetricFlowM3PerS / areaM2;
        flowRiskBand = classifyFlowRiskBand(estimatedVelocityMps, internalDiameterMm);
      } else {
        warnings.push({
          code: 'flow_assumption_missing_diameter',
          message: `Connection "${connection.id}" missing internal diameter; velocity could not be estimated.`,
        });
      }
    }

    edgeFlowByConnectionId[connection.id] = {
      estimatedFlowLps: round3(estimatedFlowLps),
      estimatedVelocityMps: typeof estimatedVelocityMps === 'number' ? round3(estimatedVelocityMps) : undefined,
      flowRiskBand,
    };

    if (flowRiskBand) {
      warnings.push({
        code: `flow_risk_${flowRiskBand}`,
        message: `Connection "${connection.id}" has ${flowRiskBand.replace('_', ' ')} risk at ${round3(estimatedVelocityMps ?? 0)} m/s.`,
      });
    }
  }

  return {
    edgeFlowByConnectionId,
    driverAvailableFlowLpsByComponentId: Object.fromEntries(driverAvailableFlowLpsByComponentId),
    events,
    warnings,
  };
}
