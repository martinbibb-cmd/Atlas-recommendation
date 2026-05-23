import type {
  LegoTechnixActiveCircuitPathV1,
  LegoTechnixComponentV1,
  LegoTechnixConnectionV1,
  LegoTechnixGraphV1,
} from '../types';
import type { ComponentOperatingModeV1 } from './ComponentStateV1';
import type { LegoTechnixSimulationStateV1 } from './LegoTechnixSimulationStateV1';
import type { LegoTechnixTickInputV1 } from './LegoTechnixTickInputV1';
import type {
  LegoTechnixSimulationEventV1,
  LegoTechnixSimulationWarningV1,
} from './LegoTechnixTickResultV1';

export const ACTIVE_PATH_REASONS_V1 = [
  'active',
  'closed_actuator',
  'missing_return_path',
  'inactive',
  'deadhead',
] as const;

export type ActivePathResolutionReasonV1 = (typeof ACTIVE_PATH_REASONS_V1)[number];

export interface ResolvedActivePathV1 {
  readonly pathId: string;
  readonly isActive: boolean;
  readonly reason: ActivePathResolutionReasonV1;
  readonly activeConnectionIds: readonly string[];
  readonly activeComponentIds: readonly string[];
  readonly driverComponentId: string;
}

export interface ActivePathResolutionV1 {
  readonly activeConnectionIds: readonly string[];
  readonly activeComponentIds: readonly string[];
  readonly componentOperatingModes: Readonly<Record<string, ComponentOperatingModeV1>>;
  readonly deadheadedComponentIds: readonly string[];
  readonly resolvedPaths: readonly ResolvedActivePathV1[];
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

interface EvaluatedPath {
  readonly path: LegoTechnixActiveCircuitPathV1;
  readonly pathComponentIds: readonly string[];
  readonly allConnectionIds: readonly string[];
  readonly driverComponentId: string;
  readonly preliminaryActive: boolean;
  readonly reason: ActivePathResolutionReasonV1;
}

function readActuatorOverride(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.isOpen === 'boolean') {
    return record.isOpen;
  }
  if (typeof record.isActive === 'boolean') {
    return record.isActive;
  }
  if (typeof record.open === 'boolean') {
    return record.open;
  }
  if (typeof record.closed === 'boolean') {
    return !record.closed;
  }
  if (record.position === 'open') {
    return true;
  }
  if (record.position === 'closed') {
    return false;
  }

  return undefined;
}

function collectPathConnections(
  path: LegoTechnixActiveCircuitPathV1,
  connectionById: ReadonlyMap<string, LegoTechnixConnectionV1>,
): readonly LegoTechnixConnectionV1[] {
  return [...path.forwardConnectionIds, ...(path.returnConnectionIds ?? [])]
    .map((connectionId) => connectionById.get(connectionId))
    .filter((connection): connection is LegoTechnixConnectionV1 => Boolean(connection));
}

function collectPathComponentIds(
  path: LegoTechnixActiveCircuitPathV1,
  connections: readonly LegoTechnixConnectionV1[],
): readonly string[] {
  const componentIds = new Set<string>([
    path.sourceComponentId,
    path.sinkComponentId,
  ]);

  for (const connection of connections) {
    componentIds.add(connection.sourceComponentId);
    componentIds.add(connection.targetComponentId);
  }

  return [...componentIds];
}

function determineDriverComponentId(
  path: LegoTechnixActiveCircuitPathV1,
  pathComponentIds: readonly string[],
  componentById: ReadonlyMap<string, LegoTechnixComponentV1>,
): string {
  for (const componentId of pathComponentIds) {
    const component = componentById.get(componentId);
    if (component?.behaviours?.includes('adds_pressure')) {
      return componentId;
    }
  }

  return path.sourceComponentId;
}

function isActuatorOpen(
  componentId: string,
  previousStateById: ReadonlyMap<string, LegoTechnixSimulationStateV1['componentStates'][number]>,
  tickInput: LegoTechnixTickInputV1,
  stagedComponentStateById?: Readonly<Record<string, Partial<LegoTechnixSimulationStateV1['componentStates'][number]>>>,
): boolean {
  const override = readActuatorOverride(tickInput.controlOverrides?.[componentId]);
  if (typeof override === 'boolean') {
    return override;
  }

  const stagedState = stagedComponentStateById?.[componentId];
  if (stagedState?.actuatorPosition === 'open') {
    return true;
  }
  if (stagedState?.actuatorPosition === 'closed') {
    return false;
  }
  if (stagedState?.operatingMode === 'running' || stagedState?.isActive === true) {
    return true;
  }
  if (stagedState?.operatingMode === 'idle' || stagedState?.isActive === false) {
    return false;
  }

  const previousState = previousStateById.get(componentId);
  if (!previousState) {
    return true;
  }

  if (previousState.operatingMode === 'running' || previousState.isActive) {
    return true;
  }

  if (previousState.operatingMode === 'idle' || previousState.operatingMode === 'bypassed') {
    return false;
  }

  return true;
}

function evaluatePath(
  path: LegoTechnixActiveCircuitPathV1,
  componentById: ReadonlyMap<string, LegoTechnixComponentV1>,
  connectionById: ReadonlyMap<string, LegoTechnixConnectionV1>,
  previousStateById: ReadonlyMap<string, LegoTechnixSimulationStateV1['componentStates'][number]>,
  tickInput: LegoTechnixTickInputV1,
  stagedComponentStateById?: Readonly<Record<string, Partial<LegoTechnixSimulationStateV1['componentStates'][number]>>>,
): EvaluatedPath {
  const connections = collectPathConnections(path, connectionById);
  const pathComponentIds = collectPathComponentIds(path, connections);
  const driverComponentId = determineDriverComponentId(path, pathComponentIds, componentById);

  if (path.domain === 'primary_heating' && (!path.returnConnectionIds || path.returnConnectionIds.length === 0)) {
    return {
      path,
      pathComponentIds,
      allConnectionIds: connections.map((connection) => connection.id),
      driverComponentId,
      preliminaryActive: false,
      reason: 'missing_return_path',
    };
  }

  const hasClosedActuator = pathComponentIds.some((componentId) => {
    const component = componentById.get(componentId);
    return component?.role === 'control_actuator'
      && !isActuatorOpen(componentId, previousStateById, tickInput, stagedComponentStateById);
  });

  if (hasClosedActuator) {
    return {
      path,
      pathComponentIds,
      allConnectionIds: connections.map((connection) => connection.id),
      driverComponentId,
      preliminaryActive: false,
      reason: 'closed_actuator',
    };
  }

  return {
    path,
    pathComponentIds,
    allConnectionIds: connections.map((connection) => connection.id),
    driverComponentId,
    preliminaryActive: connections.length > 0,
    reason: connections.length > 0 ? 'active' : 'inactive',
  };
}

export function resolveActivePathsV1(
  graph: LegoTechnixGraphV1,
  previousState: LegoTechnixSimulationStateV1,
  tickInput: LegoTechnixTickInputV1,
  stagedComponentStateById?: Readonly<Record<string, Partial<LegoTechnixSimulationStateV1['componentStates'][number]>>>,
): ActivePathResolutionV1 {
  const componentById = new Map(graph.components.map((component) => [component.id, component]));
  const connectionById = new Map(graph.connections.map((connection) => [connection.id, connection]));
  const previousStateById = new Map(previousState.componentStates.map((state) => [state.componentId, state]));

  const evaluatedPaths = (graph.activeCircuitPaths ?? []).map((path) => (
    evaluatePath(path, componentById, connectionById, previousStateById, tickInput)
  )).map((evaluatedPath) => evaluatedPath);
  const stagedEvaluatedPaths = (graph.activeCircuitPaths ?? []).map((path) => (
    evaluatePath(
      path,
      componentById,
      connectionById,
      previousStateById,
      tickInput,
      stagedComponentStateById,
    )
  ));

  const primaryPathsByDriver = new Map<string, EvaluatedPath[]>();
  for (const evaluatedPath of stagedEvaluatedPaths) {
    if (evaluatedPath.path.domain !== 'primary_heating') {
      continue;
    }

    if (!primaryPathsByDriver.has(evaluatedPath.driverComponentId)) {
      primaryPathsByDriver.set(evaluatedPath.driverComponentId, []);
    }
    primaryPathsByDriver.get(evaluatedPath.driverComponentId)?.push(evaluatedPath);
  }

  const deadheadedComponentIds = new Set<string>();
  for (const [driverComponentId, driverPaths] of primaryPathsByDriver.entries()) {
    const hasActivePath = driverPaths.some((path) => path.preliminaryActive);
    if (!hasActivePath && driverPaths.length > 0) {
      deadheadedComponentIds.add(driverComponentId);
    }
  }

  const resolvedPaths: ResolvedActivePathV1[] = stagedEvaluatedPaths.map((evaluatedPath) => {
    const isDeadheadedPrimary = evaluatedPath.path.domain === 'primary_heating'
      && deadheadedComponentIds.has(evaluatedPath.driverComponentId);
    const isActive = evaluatedPath.preliminaryActive && !isDeadheadedPrimary;
    const reason = isActive
      ? 'active'
      : (isDeadheadedPrimary ? 'deadhead' : evaluatedPath.reason);

    return {
      pathId: evaluatedPath.path.id,
      isActive,
      reason,
      activeConnectionIds: isActive ? evaluatedPath.allConnectionIds : [],
      activeComponentIds: isActive ? evaluatedPath.pathComponentIds : [],
      driverComponentId: evaluatedPath.driverComponentId,
    };
  });

  const activeConnectionIds = new Set<string>();
  const activeComponentIds = new Set<string>();
  for (const resolvedPath of resolvedPaths) {
    for (const connectionId of resolvedPath.activeConnectionIds) {
      activeConnectionIds.add(connectionId);
    }
    for (const componentId of resolvedPath.activeComponentIds) {
      activeComponentIds.add(componentId);
    }
  }

  const activePrimaryDrivers = new Set(
    resolvedPaths
      .filter((path) => path.isActive)
      .map((path) => path.driverComponentId),
  );

  const bypassedComponentIds = new Set<string>();
  for (const evaluatedPath of stagedEvaluatedPaths) {
    const hasAlternativeActivePath = evaluatedPath.path.domain === 'primary_heating'
      && activePrimaryDrivers.has(evaluatedPath.driverComponentId);

    if (evaluatedPath.preliminaryActive || !hasAlternativeActivePath) {
      continue;
    }

    for (const componentId of evaluatedPath.pathComponentIds) {
      if (activeComponentIds.has(componentId)) {
        continue;
      }

      const component = componentById.get(componentId);
      if (!component || component.role === 'control_actuator') {
        continue;
      }

      bypassedComponentIds.add(componentId);
    }
  }

  const componentOperatingModes = Object.fromEntries(
    graph.components.map((component): [string, ComponentOperatingModeV1] => {
      const isClosedActuator = component.role === 'control_actuator'
        && !isActuatorOpen(component.id, previousStateById, tickInput, stagedComponentStateById);

      if (deadheadedComponentIds.has(component.id)) {
        return [component.id, 'fault'];
      }

      if (activeComponentIds.has(component.id)) {
        return [component.id, 'running'];
      }

      if (bypassedComponentIds.has(component.id)) {
        return [component.id, 'bypassed'];
      }

      if (isClosedActuator) {
        return [component.id, 'idle'];
      }

      return [component.id, 'idle'];
    }),
  );

  const warnings: LegoTechnixSimulationWarningV1[] = [...deadheadedComponentIds].map((componentId) => ({
    code: 'deadhead_detected',
    componentId,
    message: `Primary driver "${componentId}" is deadheaded; no active source-to-sink-to-return path remains.`,
  }));

  const events: LegoTechnixSimulationEventV1[] = [...deadheadedComponentIds].map((componentId) => ({
    type: 'deadhead_detected',
    componentId,
    message: `Primary driver "${componentId}" has no hydraulically active loop this tick.`,
  }));

  return {
    activeConnectionIds: [...activeConnectionIds],
    activeComponentIds: [...activeComponentIds],
    componentOperatingModes,
    deadheadedComponentIds: [...deadheadedComponentIds],
    resolvedPaths,
    events,
    warnings,
  };
}
