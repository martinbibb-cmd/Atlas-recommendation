import type { LegoTechnixDomain } from '../domains';
import type { LegoTechnixGraphV1 } from '../types';
import type { LegoTechnixConfidence } from '../confidence';
import type { ComponentStateV1, ComponentOperatingModeV1 } from './ComponentStateV1';
import type { EdgeStateV1 } from './EdgeStateV1';
import type { ActivePathResolutionV1 } from './resolveActivePathsV1';
import type { LegoTechnixTickInputV1 } from './LegoTechnixTickInputV1';
import type {
  LegoTechnixSimulationEventV1,
  LegoTechnixSimulationWarningV1,
} from './LegoTechnixTickResultV1';

const CONDENSING_RETURN_THRESHOLD_C = 55;
const HEAT_PUMP_HIGH_COP_MAX_FLOW_C = 35;
const HEAT_PUMP_NORMAL_COP_MAX_FLOW_C = 45;
const HEAT_PUMP_REDUCED_COP_MAX_FLOW_C = 55;
const HEAT_PUMP_EFFICIENCY_WARNING_FLOW_C = 55;
const ASSUMED_ROOM_AIR_TEMP_C = 20;
const LOW_CONFIDENCE_CONDENSING: LegoTechnixConfidence = 'assumed';

interface EdgeTemperatureEstimateV1 {
  readonly estimatedInletTemperatureC?: number;
  readonly estimatedOutletTemperatureC?: number;
}

interface WeatherCompensationResolutionV1 {
  readonly enabled: boolean;
  readonly targetFlowTemperatureC: number;
  readonly calculatedTargetFlowTemperatureC?: number;
  readonly designOutsideTemperatureC?: number;
  readonly mildOutsideTemperatureC?: number;
  readonly targetFlowAtDesignC?: number;
  readonly targetFlowAtMildC?: number;
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

function resolveOutsideTemperatureFromState(
  previousStateByComponentId: ReadonlyMap<string, ComponentStateV1>,
  outsideTemperatureSourceComponentId?: string,
): number | undefined {
  if (!outsideTemperatureSourceComponentId) {
    return undefined;
  }
  const state = previousStateByComponentId.get(outsideTemperatureSourceComponentId);
  return state?.currentTemperatureC ?? state?.measuredTemperatureC;
}

function resolveWeatherCompensation(
  model: NonNullable<LegoTechnixGraphV1['heatSourceModels']>[number],
  previousStateByComponentId: ReadonlyMap<string, ComponentStateV1>,
  warnings: LegoTechnixSimulationWarningV1[],
): WeatherCompensationResolutionV1 {
  const weather = model.weatherCompensation;
  const enabled = weather?.enabled ?? model.weatherCompensationEnabled ?? false;
  const baseTargetFlowTemperatureC = round3(model.targetFlowTemperatureC);
  if (!enabled) {
    return {
      enabled: false,
      targetFlowTemperatureC: baseTargetFlowTemperatureC,
    };
  }

  const designOutsideTemperatureC = weather?.designOutsideTemperatureC ?? model.designOutsideTemperatureC;
  const mildOutsideTemperatureC = weather?.mildOutsideTemperatureC ?? model.mildOutsideTemperatureC;
  const targetFlowAtDesignC = weather?.targetFlowAtDesignC ?? model.targetFlowAtDesignC;
  const targetFlowAtMildC = weather?.targetFlowAtMildC ?? model.targetFlowAtMildC;
  if (
    typeof designOutsideTemperatureC !== 'number'
    || typeof mildOutsideTemperatureC !== 'number'
    || typeof targetFlowAtDesignC !== 'number'
    || typeof targetFlowAtMildC !== 'number'
  ) {
    return {
      enabled: true,
      targetFlowTemperatureC: baseTargetFlowTemperatureC,
      designOutsideTemperatureC,
      mildOutsideTemperatureC,
      targetFlowAtDesignC,
      targetFlowAtMildC,
    };
  }

  const outsideTemperatureC = resolveOutsideTemperatureFromState(
    previousStateByComponentId,
    weather?.outsideTemperatureSourceComponentId,
  );
  if (typeof outsideTemperatureC !== 'number') {
    warnings.push({
      code: 'weather_comp_outside_temperature_missing',
      componentId: model.componentId,
      message: `Heat source "${model.componentId}" weather compensation missing outside temperature; falling back to configured target flow.`,
    });
    return {
      enabled: true,
      targetFlowTemperatureC: baseTargetFlowTemperatureC,
      designOutsideTemperatureC,
      mildOutsideTemperatureC,
      targetFlowAtDesignC,
      targetFlowAtMildC,
    };
  }

  let interpolatedTargetFlowC = targetFlowAtDesignC;
  const outsideRange = mildOutsideTemperatureC - designOutsideTemperatureC;
  if (Math.abs(outsideRange) > Number.EPSILON) {
    const interpolation = (
      (outsideTemperatureC - designOutsideTemperatureC)
      / outsideRange
    );
    interpolatedTargetFlowC = targetFlowAtDesignC + (
      interpolation
      * (targetFlowAtMildC - targetFlowAtDesignC)
    );
  }

  const minTargetFlowTemperatureC = weather?.minTargetFlowTemperatureC;
  const maxTargetFlowTemperatureC = weather?.maxTargetFlowTemperatureC;
  if (typeof minTargetFlowTemperatureC === 'number') {
    interpolatedTargetFlowC = Math.max(interpolatedTargetFlowC, minTargetFlowTemperatureC);
  }
  if (typeof maxTargetFlowTemperatureC === 'number') {
    interpolatedTargetFlowC = Math.min(interpolatedTargetFlowC, maxTargetFlowTemperatureC);
  }

  return {
    enabled: true,
    targetFlowTemperatureC: round3(interpolatedTargetFlowC),
    calculatedTargetFlowTemperatureC: round3(interpolatedTargetFlowC),
    designOutsideTemperatureC,
    mildOutsideTemperatureC,
    targetFlowAtDesignC,
    targetFlowAtMildC,
  };
}

function evaluateLowTemperatureEmitterSuitability(
  graph: LegoTechnixGraphV1,
  model: NonNullable<LegoTechnixGraphV1['heatSourceModels']>[number],
  targetFlowTemperatureC: number,
  previousStateByComponentId: ReadonlyMap<string, ComponentStateV1>,
): ComponentStateV1['lowTemperatureEmitterSuitability'] | undefined {
  const outsideComponent = graph.components.find((component) => component.domains?.includes('outside_environment'));
  const outsideTemperatureC = outsideComponent
    ? previousStateByComponentId.get(outsideComponent.id)?.currentTemperatureC
    : undefined;
  if (typeof outsideTemperatureC !== 'number') {
    return undefined;
  }

  const roomComponentById = new Map(
    graph.components
      .filter((component) => component.domains?.includes('room_air'))
      .map((component) => [component.id, component]),
  );

  let requiredHeatKw = 0;
  let availableHeatKw = 0;
  let comparedRoomCount = 0;
  let radiatorCount = 0;

  for (const contract of graph.heatTransferComponents ?? []) {
    if (contract.family !== 'radiator' || contract.primaryDomain !== model.primaryDomain) {
      continue;
    }
    radiatorCount += 1;
    const roomConnection = graph.connections.find((connection) => (
      connection.sourceComponentId === contract.componentId
      && connection.domain === 'room_air'
      && roomComponentById.has(connection.targetComponentId)
    ));
    if (!roomConnection) {
      continue;
    }
    const roomState = previousStateByComponentId.get(roomConnection.targetComponentId);
    const roomTargetTemperatureC = roomState?.targetTemperatureC ?? roomState?.setpointTemperatureC;
    const roomHeatLossKwPerK = roomState?.heatLossKwPerK;
    if (typeof roomTargetTemperatureC !== 'number' || typeof roomHeatLossKwPerK !== 'number') {
      continue;
    }
    comparedRoomCount += 1;
    requiredHeatKw += Math.max(roomHeatLossKwPerK * (roomTargetTemperatureC - outsideTemperatureC), 0);
    const referenceFlowTemperatureC = model.targetFlowAtDesignC ?? model.targetFlowTemperatureC;
    const availableScale = referenceFlowTemperatureC > ASSUMED_ROOM_AIR_TEMP_C
      ? clamp(
        (targetFlowTemperatureC - ASSUMED_ROOM_AIR_TEMP_C)
          / (referenceFlowTemperatureC - ASSUMED_ROOM_AIR_TEMP_C),
        0,
        1.2,
      )
      : 0;
    availableHeatKw += Math.max(contract.output.energyTransfer.secondaryEnergyGainedKw, 0) * availableScale;
  }

  if (radiatorCount === 0 || comparedRoomCount === 0) {
    return {
      status: 'unknown',
      confidence: 'assumed',
      provenance: [
        'No comparable radiator contracts with room heat-loss state were available.',
      ],
    };
  }

  const hasShortfall = availableHeatKw < requiredHeatKw;
  return {
    status: hasShortfall ? 'shortfall' : 'suitable',
    requiredHeatKw: round3(requiredHeatKw),
    availableHeatKw: round3(availableHeatKw),
    confidence: 'estimated',
    provenance: [
      'Derived from radiator secondary output contracts scaled by calculated target flow.',
      'Compared against room heat-loss requirement from room heatLossKwPerK and temperature target versus outside.',
    ],
  };
}

function resolveHeatPumpCopBand(targetFlowTemperatureC: number): ComponentStateV1['estimatedCopBand'] {
  if (targetFlowTemperatureC <= HEAT_PUMP_HIGH_COP_MAX_FLOW_C) {
    return 'high';
  }
  if (targetFlowTemperatureC <= HEAT_PUMP_NORMAL_COP_MAX_FLOW_C) {
    return 'normal';
  }
  if (targetFlowTemperatureC <= HEAT_PUMP_REDUCED_COP_MAX_FLOW_C) {
    return 'reduced';
  }
  return 'poor';
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
    const weatherCompensation = resolveWeatherCompensation(model, previousStateByComponentId, warnings);
    const activeTargetFlowTemperatureC = weatherCompensation.targetFlowTemperatureC;
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
      ?? (activeTargetFlowTemperatureC - 20),
    );

    const previousFlowTemperatureC = previous?.currentTemperatureC
      ?? previous?.lastPrimaryOutletTemperatureC
      ?? returnTemperatureC;
    const rampDeltaC = Math.max(model.rampRateCPerSecond, 0) * timestepSeconds;
    const nextFlowTemperatureC = shouldFire
      ? approach(previousFlowTemperatureC, activeTargetFlowTemperatureC, rampDeltaC)
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
    const lowTemperatureEmitterSuitability = evaluateLowTemperatureEmitterSuitability(
      graph,
      model,
      activeTargetFlowTemperatureC,
      previousStateByComponentId,
    );
    const estimatedCopBand = model.heatSourceType === 'heat_pump'
      ? resolveHeatPumpCopBand(activeTargetFlowTemperatureC)
      : undefined;
    const operatingMode: ComponentOperatingModeV1 = isDeadheaded
      ? 'fault'
      : (shouldFire ? 'running' : 'idle');

    thermalStateByComponentId[model.componentId] = {
      isActive: shouldFire,
      operatingMode,
      currentTemperatureC: round3(nextFlowTemperatureC),
      targetTemperatureC: activeTargetFlowTemperatureC,
      nominalOutputKw: round3(model.nominalOutputKw),
      minStableOutputKw: round3(model.minStableOutputKw),
      maxOutputKw: round3(model.maxOutputKw),
      targetFlowTemperatureC: round3(activeTargetFlowTemperatureC),
      returnTemperatureC,
      rampRateCPerSecond: round3(model.rampRateCPerSecond),
      modulationStrategy: model.modulationStrategy,
      heatSourceType: model.heatSourceType,
      controlDemandState,
      condensingLikely,
      condensingConfidence: LOW_CONFIDENCE_CONDENSING,
      cyclingRisk,
      heatGainKw: round3(outputKw),
      netHeatKw: round3(outputKw),
      lastPrimaryInletTemperatureC: returnTemperatureC,
      lastPrimaryOutletTemperatureC: round3(nextFlowTemperatureC),
      designOutsideTemperatureC: weatherCompensation.designOutsideTemperatureC,
      mildOutsideTemperatureC: weatherCompensation.mildOutsideTemperatureC,
      targetFlowAtDesignC: weatherCompensation.targetFlowAtDesignC,
      targetFlowAtMildC: weatherCompensation.targetFlowAtMildC,
      calculatedTargetFlowTemperatureC: weatherCompensation.calculatedTargetFlowTemperatureC,
      estimatedCopBand,
      lowTemperatureEmitterSuitability,
      weatherCompensationEnabled: weatherCompensation.enabled,
      loadCompensationEnabled: model.loadCompensationEnabled ?? false,
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

    if (
      model.heatSourceType === 'heat_pump'
      && activeTargetFlowTemperatureC > HEAT_PUMP_EFFICIENCY_WARNING_FLOW_C
    ) {
      warnings.push({
        code: 'heat_pump_target_flow_high_temperature',
        componentId: model.componentId,
        message: `Heat source "${model.componentId}" target flow ${round3(activeTargetFlowTemperatureC)}°C is above common efficient heat-pump range.`,
      });
    }
    if (
      model.heatSourceType === 'heat_pump'
      && lowTemperatureEmitterSuitability?.status === 'shortfall'
    ) {
      warnings.push({
        code: 'low_temperature_emitter_output_shortfall',
        componentId: model.componentId,
        message: `Heat source "${model.componentId}" emitter output estimate ${lowTemperatureEmitterSuitability.availableHeatKw ?? 0}kW is below room heat-loss requirement ${lowTemperatureEmitterSuitability.requiredHeatKw ?? 0}kW at low target flow.`,
      });
    }
    if (model.heatSourceType === 'heat_pump') {
      const hasHighTemperatureDhwTarget = (graph.heatTransferComponents ?? []).some((contract) => {
        if (contract.family !== 'cylinder_coil' || contract.primaryDomain !== model.primaryDomain) {
          return false;
        }
        const storeConnection = graph.connections.find((connection) => (
          connection.sourceComponentId === contract.componentId
          && connection.domain === 'domestic_hot'
        ));
        if (!storeConnection) {
          return false;
        }
        const storeState = previousStateByComponentId.get(storeConnection.targetComponentId);
        return (storeState?.targetTemperatureC ?? 0) >= HEAT_PUMP_EFFICIENCY_WARNING_FLOW_C;
      });
      if (hasHighTemperatureDhwTarget && activeTargetFlowTemperatureC >= HEAT_PUMP_REDUCED_COP_MAX_FLOW_C) {
        warnings.push({
          code: 'heat_pump_dhw_high_temperature_support_required',
          componentId: model.componentId,
          message: `Heat source "${model.componentId}" DHW target appears to require high flow temperature or immersion support.`,
        });
      }
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
