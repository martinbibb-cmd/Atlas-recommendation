import type { HeatTransferComponentV1, LegoTechnixGraphV1 } from '../types';
import type { ActivePathResolutionV1 } from './resolveActivePathsV1';
import type { EdgeStateV1 } from './EdgeStateV1';
import type {
  LegoTechnixSimulationEventV1,
  LegoTechnixSimulationWarningV1,
} from './LegoTechnixTickResultV1';

const WATER_SPECIFIC_HEAT_KJ_PER_KG_K = 4.186;
const DEFAULT_PRIMARY_INLET_TEMPERATURE_C = 70;
const ENERGY_BALANCE_TOLERANCE_KW = 0.0001;

interface EdgeTemperatureEstimateV1 {
  readonly estimatedInletTemperatureC?: number;
  readonly estimatedOutletTemperatureC?: number;
}

export interface HeatTransferEvaluationResultV1 {
  readonly edgeTemperatureByConnectionId: Readonly<Record<string, EdgeTemperatureEstimateV1>>;
  readonly roomHeatGainKw: number;
  readonly storedWaterHeatGainKw: number;
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

interface EvaluatedHeatTransferComponentV1 {
  readonly contract: HeatTransferComponentV1;
  readonly orderIndex: number;
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function buildPrimaryComponentOrderIndexById(graph: LegoTechnixGraphV1): ReadonlyMap<string, number> {
  const adjacencyByComponentId = new Map<string, Set<string>>();
  const inboundByComponentId = new Map<string, number>();

  for (const component of graph.components) {
    adjacencyByComponentId.set(component.id, new Set());
    inboundByComponentId.set(component.id, 0);
  }

  for (const connection of graph.connections) {
    if (connection.domain !== 'primary_heating') {
      continue;
    }
    adjacencyByComponentId.get(connection.sourceComponentId)?.add(connection.targetComponentId);
    inboundByComponentId.set(
      connection.targetComponentId,
      (inboundByComponentId.get(connection.targetComponentId) ?? 0) + 1,
    );
  }

  const queue: string[] = [];
  for (const [componentId, inbound] of inboundByComponentId.entries()) {
    if (inbound === 0) {
      queue.push(componentId);
    }
  }

  const orderIndexById = new Map<string, number>();
  let index = 0;

  while (queue.length > 0) {
    const componentId = queue.shift();
    if (!componentId || orderIndexById.has(componentId)) {
      continue;
    }
    orderIndexById.set(componentId, index);
    index += 1;
    for (const nextComponentId of adjacencyByComponentId.get(componentId) ?? []) {
      const nextInbound = (inboundByComponentId.get(nextComponentId) ?? 0) - 1;
      inboundByComponentId.set(nextComponentId, nextInbound);
      if (nextInbound === 0) {
        queue.push(nextComponentId);
      }
    }
  }

  for (const component of graph.components) {
    if (!orderIndexById.has(component.id)) {
      orderIndexById.set(component.id, Number.MAX_SAFE_INTEGER);
    }
  }

  return orderIndexById;
}

function getPrimaryInletConnectionId(
  graph: LegoTechnixGraphV1,
  componentId: string,
  primaryDomain: HeatTransferComponentV1['primaryDomain'],
): string | undefined {
  return graph.connections.find((connection) => (
    connection.targetComponentId === componentId
    && connection.domain === primaryDomain
  ))?.id;
}

function getPrimaryOutletConnectionId(
  graph: LegoTechnixGraphV1,
  componentId: string,
  primaryDomain: HeatTransferComponentV1['primaryDomain'],
): string | undefined {
  return graph.connections.find((connection) => (
    connection.sourceComponentId === componentId
    && connection.domain === primaryDomain
  ))?.id;
}

function getEdgeStateByConnectionId(
  edgeStates: readonly EdgeStateV1[],
): ReadonlyMap<string, EdgeStateV1> {
  return new Map(edgeStates.map((edgeState) => [edgeState.connectionId, edgeState]));
}

function resolvePrimaryInletTemperatureC(
  contract: HeatTransferComponentV1,
  inletConnectionId: string | undefined,
  edgeStateByConnectionId: ReadonlyMap<string, EdgeStateV1>,
  evaluatedEdgeTemperatureByConnectionId: Readonly<Record<string, EdgeTemperatureEstimateV1>>,
): number {
  const evaluated = inletConnectionId ? evaluatedEdgeTemperatureByConnectionId[inletConnectionId] : undefined;
  const edgeState = inletConnectionId ? edgeStateByConnectionId.get(inletConnectionId) : undefined;

  const candidate = evaluated?.estimatedOutletTemperatureC
    ?? evaluated?.estimatedInletTemperatureC
    ?? edgeState?.estimatedOutletTemperatureC
    ?? edgeState?.estimatedInletTemperatureC
    ?? contract.input.primary.inletTemperatureC
    ?? DEFAULT_PRIMARY_INLET_TEMPERATURE_C;

  return round3(candidate);
}

export function evaluateHeatTransfersV1(
  graph: LegoTechnixGraphV1,
  activePathResolution: ActivePathResolutionV1,
  edgeStates: readonly EdgeStateV1[],
): HeatTransferEvaluationResultV1 {
  const activeComponentIds = new Set(activePathResolution.activeComponentIds);
  const edgeStateByConnectionId = getEdgeStateByConnectionId(edgeStates);
  const events: LegoTechnixSimulationEventV1[] = [];
  const warnings: LegoTechnixSimulationWarningV1[] = [];
  const edgeTemperatureByConnectionId: Record<string, EdgeTemperatureEstimateV1> = {};
  const componentOrderIndexById = buildPrimaryComponentOrderIndexById(graph);

  const contracts: EvaluatedHeatTransferComponentV1[] = (graph.heatTransferComponents ?? [])
    .filter((contract) => (
      contract.family === 'radiator' || contract.family === 'cylinder_coil'
    ))
    .map((contract) => ({
      contract,
      orderIndex: componentOrderIndexById.get(contract.componentId) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.orderIndex - b.orderIndex);

  let roomHeatGainKw = 0;
  let storedWaterHeatGainKw = 0;

  for (const { contract } of contracts) {
    const isActive = activeComponentIds.has(contract.componentId);
    const energyTransfer = contract.output.energyTransfer;
    const declaredLossesKw = energyTransfer.declaredLossesKw ?? 0;
    const energyImbalanceKw = Math.abs(
      energyTransfer.primaryEnergyRemovedKw
      - (energyTransfer.secondaryEnergyGainedKw + declaredLossesKw),
    );

    if (energyImbalanceKw > ENERGY_BALANCE_TOLERANCE_KW) {
      warnings.push({
        code: 'heat_transfer_energy_imbalance',
        componentId: contract.componentId,
        message: `Heat-transfer contract "${contract.id}" is imbalanced by ${round3(energyImbalanceKw)}kW.`,
      });
    }

    const inletConnectionId = getPrimaryInletConnectionId(graph, contract.componentId, contract.primaryDomain);
    const outletConnectionId = getPrimaryOutletConnectionId(graph, contract.componentId, contract.primaryDomain);

    if (!isActive) {
      events.push({
        type: 'heat_transfer_inactive',
        componentId: contract.componentId,
        message: `Heat transfer "${contract.id}" inactive; transferred 0kW this tick.`,
      });
      continue;
    }

    const preferredFlowEdge = (
      (outletConnectionId && edgeStateByConnectionId.get(outletConnectionId))
      ?? (inletConnectionId && edgeStateByConnectionId.get(inletConnectionId))
    );
    const massFlowKgPerS = preferredFlowEdge?.estimatedFlowKgPerS ?? 0;

    if (!(massFlowKgPerS > 0)) {
      warnings.push({
        code: 'heat_transfer_missing_mass_flow',
        componentId: contract.componentId,
        message: `Heat transfer "${contract.id}" active but has no positive mass flow; transferred 0kW.`,
      });
      events.push({
        type: 'heat_transfer_zero_flow',
        componentId: contract.componentId,
        message: `Heat transfer "${contract.id}" zero-flow guard applied.`,
      });
      continue;
    }

    const primaryInletTemperatureC = resolvePrimaryInletTemperatureC(
      contract,
      inletConnectionId,
      edgeStateByConnectionId,
      edgeTemperatureByConnectionId,
    );
    const deltaTemperatureK = energyTransfer.primaryEnergyRemovedKw
      / (massFlowKgPerS * WATER_SPECIFIC_HEAT_KJ_PER_KG_K);
    const primaryOutletTemperatureC = round3(primaryInletTemperatureC - deltaTemperatureK);

    if (outletConnectionId) {
      edgeTemperatureByConnectionId[outletConnectionId] = {
        estimatedInletTemperatureC: primaryInletTemperatureC,
        estimatedOutletTemperatureC: primaryOutletTemperatureC,
      };
    }

    if (contract.family === 'radiator') {
      roomHeatGainKw += energyTransfer.secondaryEnergyGainedKw;
    } else if (contract.family === 'cylinder_coil') {
      storedWaterHeatGainKw += energyTransfer.secondaryEnergyGainedKw;
    }

    events.push({
      type: 'heat_transfer_evaluated',
      componentId: contract.componentId,
      message: `Heat transfer "${contract.id}" removed ${round3(energyTransfer.primaryEnergyRemovedKw)}kW from primary and delivered ${round3(energyTransfer.secondaryEnergyGainedKw)}kW to ${contract.input.secondary.medium}.`,
    });
  }

  roomHeatGainKw = round3(roomHeatGainKw);
  storedWaterHeatGainKw = round3(storedWaterHeatGainKw);

  events.push({
    type: 'room_heat_gain_placeholder',
    message: `Room heat gain placeholder: ${roomHeatGainKw}kW.`,
  });
  events.push({
    type: 'stored_water_heat_gain_placeholder',
    message: `Stored water heat gain placeholder: ${storedWaterHeatGainKw}kW.`,
  });

  return {
    edgeTemperatureByConnectionId,
    roomHeatGainKw,
    storedWaterHeatGainKw,
    events,
    warnings,
  };
}
