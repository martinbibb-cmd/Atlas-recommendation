import {
  BOILER_FOOTPRINT,
  BOILER_PORTS,
  CYLINDER_FOOTPRINT,
  CYLINDER_PORTS,
  EXPANSION_VESSEL_FOOTPRINT,
  EXPANSION_VESSEL_PORTS,
  RADIATOR_FOOTPRINT,
  RADIATOR_PORTS,
} from '../../../library/visualPrimitives/primitives';
import { ROUTING_RAILS, type RoutingRail } from '../../../library/visualPrimitives/primitiveTokens';
import {
  computeTopologyLayout,
  getTopologyLayoutDeclaration,
  routeEmitterSpurs,
  routeFlowRail,
  routeReturnRail,
  routeVertical,
  validateLayout,
  type LayoutState,
  type PipeSegment,
} from '../../../library/visualTopologies/layout';
import type { VisualTopologyId } from '../../../library/visualTopologies/visualTopologyRegistry';
import type {
  BuildEdge,
  BuildGraph,
  BuildNode,
  PartKind,
  TopologyComponentPlacementModel,
  TopologyConnectionModel,
  TopologyPlacementModel,
  PortDef,
} from './types';

export type SpawnTopologyId = 'sealed_unvented' | 'combi_direct_hot_water';

type PlacementPort = TopologyComponentPlacementModel['ports'][string];

interface ComponentSpec {
  componentId: string;
  componentRole: string;
  kind: PartKind;
  primitiveId: string;
  orientation?: TopologyComponentPlacementModel['orientation'];
  footprint: { width: number; height: number };
  ports: TopologyComponentPlacementModel['ports'];
}

interface ConnectionSpec {
  id: string;
  sourceComponentId: string;
  sourcePortId: string;
  targetComponentId: string;
  targetPortId: string;
  rail: RoutingRail;
}

const TOPOLOGY_PRIMITIVE_SCALE = 0.7;

function scaleCoord(value: number): number {
  return Math.round(value * TOPOLOGY_PRIMITIVE_SCALE);
}

function scaleFootprint(footprint: { width: number; height: number }): { width: number; height: number } {
  return {
    width: scaleCoord(footprint.width),
    height: scaleCoord(footprint.height),
  };
}

function scalePorts(
  ports: Record<string, { x: number; y: number; side: 'left' | 'right' | 'top' | 'bottom' }>,
): Record<string, { x: number; y: number; side: 'left' | 'right' | 'top' | 'bottom' }> {
  return Object.fromEntries(
    Object.entries(ports).map(([id, port]) => [
      id,
      { x: scaleCoord(port.x), y: scaleCoord(port.y), side: port.side },
    ]),
  );
}

function assignPortRoles(
  ports: Record<string, { x: number; y: number; side: 'left' | 'right' | 'top' | 'bottom' }>,
  roles: Record<string, PlacementPort['role']>,
): TopologyComponentPlacementModel['ports'] {
  return Object.fromEntries(
    Object.entries(ports).map(([id, port]) => [id, { ...port, role: roles[id] }]),
  );
}

const SEALED_COMPONENT_SPECS: readonly ComponentSpec[] = [
  {
    componentId: 'boiler',
    componentRole: 'boiler',
    kind: 'heat_source_system_boiler',
    primitiveId: 'boiler_system',
    footprint: scaleFootprint(BOILER_FOOTPRINT),
    ports: assignPortRoles(
      scalePorts({
        flow_out: BOILER_PORTS.system.primary_flow,
        return_in: BOILER_PORTS.system.primary_return,
      }),
      { flow_out: 'flow', return_in: 'return' },
    ),
  },
  {
    componentId: 'radiator_branch_1',
    componentRole: 'radiator_branch_1',
    kind: 'radiator_loop',
    primitiveId: 'radiator_panel_1',
    footprint: scaleFootprint(RADIATOR_FOOTPRINT),
    ports: assignPortRoles(
      scalePorts({
        flow_in: RADIATOR_PORTS.opposite_ends_bottom.trv_flow_in,
        return_out: RADIATOR_PORTS.opposite_ends_bottom.lockshield_return_out,
      }),
      { flow_in: 'flow', return_out: 'return' },
    ),
  },
  {
    componentId: 'radiator_branch_2',
    componentRole: 'radiator_branch_2',
    kind: 'radiator_loop',
    primitiveId: 'radiator_panel_2',
    footprint: scaleFootprint(RADIATOR_FOOTPRINT),
    ports: assignPortRoles(
      scalePorts({
        flow_in: RADIATOR_PORTS.opposite_ends_bottom.trv_flow_in,
        return_out: RADIATOR_PORTS.opposite_ends_bottom.lockshield_return_out,
      }),
      { flow_in: 'flow', return_out: 'return' },
    ),
  },
  {
    componentId: 'unvented_cylinder',
    componentRole: 'unvented_cylinder',
    kind: 'dhw_unvented_cylinder',
    primitiveId: 'cylinder_unvented',
    footprint: scaleFootprint(CYLINDER_FOOTPRINT),
    ports: assignPortRoles(
      scalePorts({
        coil_flow: CYLINDER_PORTS.coil_flow_in,
        coil_return: CYLINDER_PORTS.coil_return_out,
        hot_out: CYLINDER_PORTS.hot_draw_off,
        cold_in: CYLINDER_PORTS.cold_inlet,
      }),
      { coil_flow: 'flow', coil_return: 'return', hot_out: 'hot', cold_in: 'cold' },
    ),
  },
  {
    componentId: 'expansion_vessel_on_primary_return',
    componentRole: 'expansion_vessel_on_primary_return',
    kind: 'sealed_system_kit',
    primitiveId: 'expansion_vessel',
    footprint: scaleFootprint(EXPANSION_VESSEL_FOOTPRINT),
    ports: assignPortRoles(
      scalePorts({
        circuit_in: EXPANSION_VESSEL_PORTS.circuit_connection,
      }),
      { circuit_in: 'return' },
    ),
  },
];

const COMBI_COMPONENT_SPECS: readonly ComponentSpec[] = [
  {
    componentId: 'combi_boiler',
    componentRole: 'combi_boiler',
    kind: 'heat_source_combi',
    primitiveId: 'boiler_combi',
    footprint: scaleFootprint(BOILER_FOOTPRINT),
    ports: assignPortRoles(
      scalePorts({
        flow_out: BOILER_PORTS.combi.primary_flow,
        return_in: BOILER_PORTS.combi.primary_return,
        cold_in: BOILER_PORTS.combi.cold_mains_in,
        hot_out: BOILER_PORTS.combi.dhw_out,
      }),
      { flow_out: 'flow', return_in: 'return', cold_in: 'cold', hot_out: 'hot' },
    ),
  },
  {
    componentId: 'radiator_branch_1',
    componentRole: 'radiator_branch_1',
    kind: 'radiator_loop',
    primitiveId: 'radiator_panel_1',
    footprint: scaleFootprint(RADIATOR_FOOTPRINT),
    ports: assignPortRoles(
      scalePorts({
        flow_in: RADIATOR_PORTS.opposite_ends_bottom.trv_flow_in,
        return_out: RADIATOR_PORTS.opposite_ends_bottom.lockshield_return_out,
      }),
      { flow_in: 'flow', return_out: 'return' },
    ),
  },
  {
    componentId: 'radiator_branch_2',
    componentRole: 'radiator_branch_2',
    kind: 'radiator_loop',
    primitiveId: 'radiator_panel_2',
    footprint: scaleFootprint(RADIATOR_FOOTPRINT),
    ports: assignPortRoles(
      scalePorts({
        flow_in: RADIATOR_PORTS.opposite_ends_bottom.trv_flow_in,
        return_out: RADIATOR_PORTS.opposite_ends_bottom.lockshield_return_out,
      }),
      { flow_in: 'flow', return_out: 'return' },
    ),
  },
];

const SEALED_CONNECTION_SPECS: readonly ConnectionSpec[] = [
  {
    id: 'e_boiler_to_cylinder_flow',
    sourceComponentId: 'boiler',
    sourcePortId: 'flow_out',
    targetComponentId: 'unvented_cylinder',
    targetPortId: 'coil_flow',
    rail: ROUTING_RAILS.CH_FLOW,
  },
  {
    id: 'e_cylinder_to_boiler_return',
    sourceComponentId: 'unvented_cylinder',
    sourcePortId: 'coil_return',
    targetComponentId: 'boiler',
    targetPortId: 'return_in',
    rail: ROUTING_RAILS.CH_RETURN,
  },
  {
    id: 'e_boiler_to_rad1_flow',
    sourceComponentId: 'boiler',
    sourcePortId: 'flow_out',
    targetComponentId: 'radiator_branch_1',
    targetPortId: 'flow_in',
    rail: ROUTING_RAILS.CH_FLOW,
  },
  {
    id: 'e_boiler_to_rad2_flow',
    sourceComponentId: 'boiler',
    sourcePortId: 'flow_out',
    targetComponentId: 'radiator_branch_2',
    targetPortId: 'flow_in',
    rail: ROUTING_RAILS.CH_FLOW,
  },
  {
    id: 'e_rad1_to_boiler_return',
    sourceComponentId: 'radiator_branch_1',
    sourcePortId: 'return_out',
    targetComponentId: 'boiler',
    targetPortId: 'return_in',
    rail: ROUTING_RAILS.CH_RETURN,
  },
  {
    id: 'e_rad2_to_boiler_return',
    sourceComponentId: 'radiator_branch_2',
    sourcePortId: 'return_out',
    targetComponentId: 'boiler',
    targetPortId: 'return_in',
    rail: ROUTING_RAILS.CH_RETURN,
  },
  {
    id: 'e_expansion_to_boiler_return',
    sourceComponentId: 'expansion_vessel_on_primary_return',
    sourcePortId: 'circuit_in',
    targetComponentId: 'boiler',
    targetPortId: 'return_in',
    rail: ROUTING_RAILS.CH_RETURN,
  },
];

const COMBI_CONNECTION_SPECS: readonly ConnectionSpec[] = [
  {
    id: 'e_combi_to_rad1_flow',
    sourceComponentId: 'combi_boiler',
    sourcePortId: 'flow_out',
    targetComponentId: 'radiator_branch_1',
    targetPortId: 'flow_in',
    rail: ROUTING_RAILS.CH_FLOW,
  },
  {
    id: 'e_combi_to_rad2_flow',
    sourceComponentId: 'combi_boiler',
    sourcePortId: 'flow_out',
    targetComponentId: 'radiator_branch_2',
    targetPortId: 'flow_in',
    rail: ROUTING_RAILS.CH_FLOW,
  },
  {
    id: 'e_rad1_to_combi_return',
    sourceComponentId: 'radiator_branch_1',
    sourcePortId: 'return_out',
    targetComponentId: 'combi_boiler',
    targetPortId: 'return_in',
    rail: ROUTING_RAILS.CH_RETURN,
  },
  {
    id: 'e_rad2_to_combi_return',
    sourceComponentId: 'radiator_branch_2',
    sourcePortId: 'return_out',
    targetComponentId: 'combi_boiler',
    targetPortId: 'return_in',
    rail: ROUTING_RAILS.CH_RETURN,
  },
];

function resolveVisualTopologyId(topologyId: SpawnTopologyId): VisualTopologyId {
  switch (topologyId) {
    case 'sealed_unvented':
      return 'sealed_unvented_cylinder';
    case 'combi_direct_hot_water':
      return 'combi_direct_hot_water';
    default: {
      const exhaustiveCheck: never = topologyId;
      throw new Error(`Unsupported topology id: ${String(exhaustiveCheck)}`);
    }
  }
}

function resolveSpecs(topologyId: SpawnTopologyId): {
  components: readonly ComponentSpec[];
  connections: readonly ConnectionSpec[];
} {
  switch (topologyId) {
    case 'sealed_unvented':
      return { components: SEALED_COMPONENT_SPECS, connections: SEALED_CONNECTION_SPECS };
    case 'combi_direct_hot_water':
      return { components: COMBI_COMPONENT_SPECS, connections: COMBI_CONNECTION_SPECS };
    default: {
      const exhaustiveCheck: never = topologyId;
      throw new Error(`Unsupported topology id: ${String(exhaustiveCheck)}`);
    }
  }
}

function createComponentPlacement(
  spec: ComponentSpec,
  layout: LayoutState,
): TopologyComponentPlacementModel {
  const position = layout.positions[spec.componentRole] ?? { left: 0, top: 0 };
  return {
    componentId: spec.componentId,
    componentRole: spec.componentRole,
    kind: spec.kind,
    primitiveId: spec.primitiveId,
    x: position.left,
    y: position.top,
    rotation: 0,
    orientation: spec.orientation ?? 'right',
    footprint: spec.footprint,
    ports: spec.ports,
  };
}

function getAbsPortPoint(
  component: TopologyComponentPlacementModel,
  portId: string,
): { x: number; y: number } | null {
  const port = component.ports[portId];
  if (!port) return null;
  return { x: component.x + port.x, y: component.y + port.y };
}

function buildFallbackOrthogonalRoute(
  source: { x: number; y: number },
  target: { x: number; y: number },
  rail: RoutingRail,
): readonly PipeSegment[] {
  return [
    { x1: source.x, y1: source.y, x2: target.x, y2: source.y, rail, strokeKind: 'branch' },
    { x1: target.x, y1: source.y, x2: target.x, y2: target.y, rail, strokeKind: 'branch' },
  ];
}

function buildConnectionPipeRoute(
  spec: ConnectionSpec,
  layout: LayoutState,
  componentsById: Map<string, TopologyComponentPlacementModel>,
): readonly PipeSegment[] {
  const sourceComponent = componentsById.get(spec.sourceComponentId);
  const targetComponent = componentsById.get(spec.targetComponentId);
  if (!sourceComponent || !targetComponent) return [];

  const sourcePortPoint = getAbsPortPoint(sourceComponent, spec.sourcePortId);
  const targetPortPoint = getAbsPortPoint(targetComponent, spec.targetPortId);
  if (!sourcePortPoint || !targetPortPoint) return [];

  if (
    spec.rail === ROUTING_RAILS.CH_FLOW &&
    targetComponent.kind === 'radiator_loop' &&
    spec.targetPortId === 'flow_in'
  ) {
    const flowSpur = routeEmitterSpurs(targetComponent.x, layout.rails).find(
      segment => segment.rail === ROUTING_RAILS.CH_FLOW,
    );
    if (!flowSpur) return [];
    return [
      routeVertical(
        sourcePortPoint.x,
        sourcePortPoint.y,
        layout.rails.flowY,
        ROUTING_RAILS.CH_FLOW,
        'branch',
        `${spec.id}_source_up`,
      ),
      routeFlowRail(sourcePortPoint.x, flowSpur.x1, layout.rails, `${spec.id}_flow_rail`),
      flowSpur,
    ];
  }

  if (
    spec.rail === ROUTING_RAILS.CH_RETURN &&
    sourceComponent.kind === 'radiator_loop' &&
    spec.sourcePortId === 'return_out'
  ) {
    const returnSpur = routeEmitterSpurs(sourceComponent.x, layout.rails).find(
      segment => segment.rail === ROUTING_RAILS.CH_RETURN,
    );
    if (!returnSpur) return [];
    return [
      returnSpur,
      routeReturnRail(returnSpur.x1, targetPortPoint.x, layout.rails, `${spec.id}_return_rail`),
      routeVertical(
        targetPortPoint.x,
        layout.rails.returnY,
        targetPortPoint.y,
        ROUTING_RAILS.CH_RETURN,
        'branch',
        `${spec.id}_target_down`,
      ),
    ];
  }

  if (spec.rail === ROUTING_RAILS.CH_FLOW) {
    return [
      routeVertical(
        sourcePortPoint.x,
        sourcePortPoint.y,
        layout.rails.flowY,
        ROUTING_RAILS.CH_FLOW,
        'branch',
        `${spec.id}_source_to_flow`,
      ),
      routeFlowRail(sourcePortPoint.x, targetPortPoint.x, layout.rails, `${spec.id}_flow`),
      routeVertical(
        targetPortPoint.x,
        layout.rails.flowY,
        targetPortPoint.y,
        ROUTING_RAILS.CH_FLOW,
        'branch',
        `${spec.id}_flow_to_target`,
      ),
    ];
  }

  if (spec.rail === ROUTING_RAILS.CH_RETURN) {
    return [
      routeVertical(
        sourcePortPoint.x,
        sourcePortPoint.y,
        layout.rails.returnY,
        ROUTING_RAILS.CH_RETURN,
        'branch',
        `${spec.id}_source_to_return`,
      ),
      routeReturnRail(sourcePortPoint.x, targetPortPoint.x, layout.rails, `${spec.id}_return`),
      routeVertical(
        targetPortPoint.x,
        layout.rails.returnY,
        targetPortPoint.y,
        ROUTING_RAILS.CH_RETURN,
        'branch',
        `${spec.id}_return_to_target`,
      ),
    ];
  }

  return buildFallbackOrthogonalRoute(sourcePortPoint, targetPortPoint, spec.rail);
}

function createConnection(
  spec: ConnectionSpec,
  pipeRoute: readonly PipeSegment[],
): TopologyConnectionModel {
  return {
    id: spec.id,
    source: { componentId: spec.sourceComponentId, portId: spec.sourcePortId },
    target: { componentId: spec.targetComponentId, portId: spec.targetPortId },
    rail: spec.rail,
    pipeRoute,
  };
}

function roleCompatible(a: PortDef['role'], b: PortDef['role']): boolean {
  if (a === 'unknown' || b === 'unknown') return true;
  if (a === b) return true;
  const primaryCircuitRoles = new Set<PortDef['role']>(['flow', 'return', 'store']);
  if (primaryCircuitRoles.has(a) && primaryCircuitRoles.has(b)) return true;
  if ((a === 'hot' && b === 'cold') || (a === 'cold' && b === 'hot')) return false;
  return false;
}

export function validateTopologyPlacementModel(args: {
  model: TopologyPlacementModel;
  layout: LayoutState;
  declaration: ReturnType<typeof getTopologyLayoutDeclaration>;
}): { ready: boolean; warnings: string[] } {
  const { model, layout, declaration } = args;
  const warnings: string[] = [];

  const layoutValidation = validateLayout(layout, declaration);
  for (const violation of layoutValidation.violations) {
    warnings.push(`layout:${violation.kind}:${violation.message}`);
  }

  for (const connection of model.connections) {
    const sourceComponent = model.components.find(c => c.componentId === connection.source.componentId);
    const targetComponent = model.components.find(c => c.componentId === connection.target.componentId);

    if (!sourceComponent || !targetComponent) {
      warnings.push(`connection:missing_component:${connection.id}`);
      continue;
    }

    const sourcePort = sourceComponent.ports[connection.source.portId];
    const targetPort = targetComponent.ports[connection.target.portId];

    if (!sourcePort || !targetPort) {
      warnings.push(`connection:missing_port:${connection.id}`);
      continue;
    }

    if (!connection.pipeRoute || connection.pipeRoute.length === 0) {
      warnings.push(`connection:missing_route:${connection.id}`);
    }

    if (!roleCompatible(sourcePort.role ?? 'unknown', targetPort.role ?? 'unknown')) {
      warnings.push(`port_compatibility:incompatible_roles:${connection.id}`);
    }
  }

  return { ready: warnings.length === 0, warnings };
}

export function spawnTopologyPlacementModel(topologyId: SpawnTopologyId): TopologyPlacementModel {
  const visualTopologyId = resolveVisualTopologyId(topologyId);
  const declaration = getTopologyLayoutDeclaration(visualTopologyId);
  const layout = computeTopologyLayout(declaration);
  const { components: specs, connections: connectionSpecs } = resolveSpecs(topologyId);

  const components = specs.map(spec => createComponentPlacement(spec, layout));
  const componentsById = new Map(components.map(component => [component.componentId, component]));
  const connections = connectionSpecs.map(spec =>
    createConnection(spec, buildConnectionPipeRoute(spec, layout, componentsById)),
  );

  const model: TopologyPlacementModel = { components, connections };
  const validation = validateTopologyPlacementModel({ model, layout, declaration });

  model.topologyMetadata = {
    selectedTopology: topologyId,
    layoutDeclarationId: declaration.topologyId,
    railMode: declaration.flowRailMode,
    ready: validation.ready,
    validationWarnings: validation.warnings,
  };

  return model;
}

function toNode(component: TopologyComponentPlacementModel): BuildNode {
  return {
    id: component.componentId,
    kind: component.kind,
    x: component.x,
    y: component.y,
    r: component.rotation,
    componentRole: component.componentRole,
    primitiveId: component.primitiveId,
    footprint: component.footprint,
    orientation: component.orientation,
    ports: component.ports,
  };
}

function toEdge(connection: TopologyConnectionModel, model: TopologyPlacementModel): BuildEdge {
  const sourceComponent = model.components.find(c => c.componentId === connection.source.componentId);
  const targetComponent = model.components.find(c => c.componentId === connection.target.componentId);
  const roleFrom = sourceComponent?.ports[connection.source.portId]?.role ?? 'unknown';
  const roleTo = targetComponent?.ports[connection.target.portId]?.role ?? 'unknown';
  return {
    id: connection.id,
    from: { nodeId: connection.source.componentId, portId: connection.source.portId },
    to: { nodeId: connection.target.componentId, portId: connection.target.portId },
    rail: connection.rail,
    meta: {
      roleFrom,
      roleTo,
      pipeRoute: connection.pipeRoute,
    },
  };
}

function isValidConnection(model: TopologyPlacementModel, connection: TopologyConnectionModel): boolean {
  const sourceComponent = model.components.find(c => c.componentId === connection.source.componentId);
  const targetComponent = model.components.find(c => c.componentId === connection.target.componentId);
  if (!sourceComponent || !targetComponent) return false;
  if (!sourceComponent.ports[connection.source.portId]) return false;
  if (!targetComponent.ports[connection.target.portId]) return false;
  return true;
}

export function buildGraphFromTopologyPlacementModel(model: TopologyPlacementModel): BuildGraph {
  const validConnections = model.connections.filter(connection => isValidConnection(model, connection));
  return {
    nodes: model.components.map(toNode),
    edges: validConnections.map(connection => toEdge(connection, model)),
  };
}

export function spawnTopologyGraph(topologyId: SpawnTopologyId): BuildGraph {
  return buildGraphFromTopologyPlacementModel(spawnTopologyPlacementModel(topologyId));
}
