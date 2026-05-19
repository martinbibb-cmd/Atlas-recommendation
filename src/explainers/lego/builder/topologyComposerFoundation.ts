import {
  BOILER_FOOTPRINT,
  BOILER_PORTS,
  CYLINDER_FOOTPRINT,
  CYLINDER_PORTS,
  EXPANSION_VESSEL_FOOTPRINT,
  EXPANSION_VESSEL_PORTS,
  PUMP_FOOTPRINT,
  PUMP_PORTS,
  RADIATOR_FOOTPRINT,
  RADIATOR_PORTS,
} from '../../../library/visualPrimitives/primitives';
import { ROUTING_RAILS, type RoutingRail } from '../../../library/visualPrimitives/primitiveTokens';
import type {
  BuildEdge,
  BuildGraph,
  BuildNode,
  PartKind,
  TopologyComponentPlacementModel,
  TopologyConnectionModel,
  TopologyPlacementModel,
} from './types';

export type SpawnTopologyId = 'sealed_unvented' | 'combi_direct_hot_water';

type PlacementPort = TopologyComponentPlacementModel['ports'][string];

function withRole(
  ports: Record<string, { x: number; y: number; side: 'left' | 'right' | 'top' | 'bottom' }>,
  roles: Record<string, PlacementPort['role']>,
): TopologyComponentPlacementModel['ports'] {
  return Object.fromEntries(
    Object.entries(ports).map(([id, port]) => [id, { ...port, role: roles[id] }]),
  );
}

function comp(params: {
  componentId: string;
  componentRole: string;
  kind: PartKind;
  primitiveId: string;
  x: number;
  y: number;
  rotation?: number;
  orientation?: TopologyComponentPlacementModel['orientation'];
  footprint: { width: number; height: number };
  ports: TopologyComponentPlacementModel['ports'];
}): TopologyComponentPlacementModel {
  return {
    componentId: params.componentId,
    componentRole: params.componentRole,
    kind: params.kind,
    primitiveId: params.primitiveId,
    x: params.x,
    y: params.y,
    rotation: params.rotation ?? 0,
    orientation: params.orientation ?? 'right',
    footprint: params.footprint,
    ports: params.ports,
  };
}

function conn(
  id: string,
  sourceComponentId: string,
  sourcePortId: string,
  targetComponentId: string,
  targetPortId: string,
  rail: RoutingRail,
): TopologyConnectionModel {
  return {
    id,
    source: { componentId: sourceComponentId, portId: sourcePortId },
    target: { componentId: targetComponentId, portId: targetPortId },
    rail,
  };
}

function buildSealedUnventedModel(): TopologyPlacementModel {
  const boilerSystemPorts = withRole(
    {
      flow_out: BOILER_PORTS.system.primary_flow,
      return_in: BOILER_PORTS.system.primary_return,
    },
    { flow_out: 'flow', return_in: 'return' },
  );

  const combiOutletPorts = {
    hot_in: { x: 0, y: 18, side: 'left' as const, role: 'hot' as const },
    cold_in: { x: 0, y: 56, side: 'left' as const, role: 'cold' as const },
  };

  return {
    components: [
      comp({
        componentId: 'boiler',
        componentRole: 'system_boiler',
        kind: 'heat_source_system_boiler',
        primitiveId: 'boiler_system',
        x: 130,
        y: 290,
        footprint: BOILER_FOOTPRINT,
        ports: boilerSystemPorts,
      }),
      comp({
        componentId: 'pump',
        componentRole: 'primary_pump',
        kind: 'pump',
        primitiveId: 'pump_primary',
        x: 330,
        y: 304,
        footprint: PUMP_FOOTPRINT,
        ports: withRole({ in: PUMP_PORTS.flow_in, out: PUMP_PORTS.flow_out }, { in: 'flow', out: 'flow' }),
      }),
      comp({
        componentId: 'cylinder',
        componentRole: 'unvented_cylinder',
        kind: 'dhw_unvented_cylinder',
        primitiveId: 'cylinder_unvented',
        x: 560,
        y: 170,
        footprint: CYLINDER_FOOTPRINT,
        ports: withRole(
          {
            coil_flow: CYLINDER_PORTS.coil_flow_in,
            coil_return: CYLINDER_PORTS.coil_return_out,
            hot_out: CYLINDER_PORTS.hot_draw_off,
            cold_in: CYLINDER_PORTS.cold_inlet,
          },
          { coil_flow: 'flow', coil_return: 'return', hot_out: 'hot', cold_in: 'cold' },
        ),
      }),
      comp({
        componentId: 'rad_1',
        componentRole: 'radiator_branch_1',
        kind: 'radiator_loop',
        primitiveId: 'radiator_panel_1',
        x: 520,
        y: 60,
        footprint: RADIATOR_FOOTPRINT,
        ports: withRole(
          {
            flow_in: RADIATOR_PORTS.opposite_ends_bottom.trv_flow_in,
            return_out: RADIATOR_PORTS.opposite_ends_bottom.lockshield_return_out,
          },
          { flow_in: 'flow', return_out: 'return' },
        ),
      }),
      comp({
        componentId: 'rad_2',
        componentRole: 'radiator_branch_2',
        kind: 'radiator_loop',
        primitiveId: 'radiator_panel_2',
        x: 710,
        y: 60,
        footprint: RADIATOR_FOOTPRINT,
        ports: withRole(
          {
            flow_in: RADIATOR_PORTS.opposite_ends_bottom.trv_flow_in,
            return_out: RADIATOR_PORTS.opposite_ends_bottom.lockshield_return_out,
          },
          { flow_in: 'flow', return_out: 'return' },
        ),
      }),
      comp({
        componentId: 'expansion',
        componentRole: 'expansion_vessel',
        kind: 'sealed_system_kit',
        primitiveId: 'expansion_vessel',
        x: 650,
        y: 300,
        footprint: EXPANSION_VESSEL_FOOTPRINT,
        ports: withRole(
          { circuit_in: EXPANSION_VESSEL_PORTS.circuit_connection },
          { circuit_in: 'return' },
        ),
      }),
      comp({
        componentId: 'shower',
        componentRole: 'dhw_outlet_shower',
        kind: 'shower_outlet',
        primitiveId: 'fixture_shower',
        x: 870,
        y: 170,
        footprint: { width: 100, height: 74 },
        ports: combiOutletPorts,
      }),
      comp({
        componentId: 'bath',
        componentRole: 'dhw_outlet_bath',
        kind: 'bath_outlet',
        primitiveId: 'fixture_bath',
        x: 870,
        y: 300,
        footprint: { width: 100, height: 74 },
        ports: combiOutletPorts,
      }),
    ],
    connections: [
      conn('e_boiler_pump', 'boiler', 'flow_out', 'pump', 'in', ROUTING_RAILS.CH_FLOW),
      conn('e_pump_cyl', 'pump', 'out', 'cylinder', 'coil_flow', ROUTING_RAILS.CH_FLOW),
      conn('e_cyl_return', 'cylinder', 'coil_return', 'boiler', 'return_in', ROUTING_RAILS.CH_RETURN),
      conn('e_pump_rad1', 'pump', 'out', 'rad_1', 'flow_in', ROUTING_RAILS.CH_FLOW),
      conn('e_pump_rad2', 'pump', 'out', 'rad_2', 'flow_in', ROUTING_RAILS.CH_FLOW),
      conn('e_rad1_return', 'rad_1', 'return_out', 'boiler', 'return_in', ROUTING_RAILS.CH_RETURN),
      conn('e_rad2_return', 'rad_2', 'return_out', 'boiler', 'return_in', ROUTING_RAILS.CH_RETURN),
      conn('e_expand_return', 'expansion', 'circuit_in', 'boiler', 'return_in', ROUTING_RAILS.CH_RETURN),
      conn('e_cyl_hot_shower', 'cylinder', 'hot_out', 'shower', 'hot_in', ROUTING_RAILS.DHW),
      conn('e_cyl_hot_bath', 'cylinder', 'hot_out', 'bath', 'hot_in', ROUTING_RAILS.DHW),
      conn('e_cyl_cold_shower', 'cylinder', 'cold_in', 'shower', 'cold_in', ROUTING_RAILS.CW_MAINS),
      conn('e_cyl_cold_bath', 'cylinder', 'cold_in', 'bath', 'cold_in', ROUTING_RAILS.CW_MAINS),
    ],
  };
}

function buildCombiDirectModel(): TopologyPlacementModel {
  const combiPorts = withRole(
    {
      flow_out: BOILER_PORTS.combi.primary_flow,
      return_in: BOILER_PORTS.combi.primary_return,
      cold_in: BOILER_PORTS.combi.cold_mains_in,
      hot_out: BOILER_PORTS.combi.dhw_out,
    },
    { flow_out: 'flow', return_in: 'return', cold_in: 'cold', hot_out: 'hot' },
  );

  const outletPorts = {
    hot_in: { x: 0, y: 18, side: 'left' as const, role: 'hot' as const },
    cold_in: { x: 0, y: 56, side: 'left' as const, role: 'cold' as const },
  };

  return {
    components: [
      comp({
        componentId: 'boiler',
        componentRole: 'combi_boiler',
        kind: 'heat_source_combi',
        primitiveId: 'boiler_combi',
        x: 210,
        y: 260,
        footprint: BOILER_FOOTPRINT,
        ports: combiPorts,
      }),
      comp({
        componentId: 'rad_1',
        componentRole: 'radiator_branch_1',
        kind: 'radiator_loop',
        primitiveId: 'radiator_panel_1',
        x: 520,
        y: 90,
        footprint: RADIATOR_FOOTPRINT,
        ports: withRole(
          {
            flow_in: RADIATOR_PORTS.opposite_ends_bottom.trv_flow_in,
            return_out: RADIATOR_PORTS.opposite_ends_bottom.lockshield_return_out,
          },
          { flow_in: 'flow', return_out: 'return' },
        ),
      }),
      comp({
        componentId: 'rad_2',
        componentRole: 'radiator_branch_2',
        kind: 'radiator_loop',
        primitiveId: 'radiator_panel_2',
        x: 700,
        y: 90,
        footprint: RADIATOR_FOOTPRINT,
        ports: withRole(
          {
            flow_in: RADIATOR_PORTS.opposite_ends_bottom.trv_flow_in,
            return_out: RADIATOR_PORTS.opposite_ends_bottom.lockshield_return_out,
          },
          { flow_in: 'flow', return_out: 'return' },
        ),
      }),
      comp({
        componentId: 'shower',
        componentRole: 'dhw_outlet_shower',
        kind: 'shower_outlet',
        primitiveId: 'fixture_shower',
        x: 900,
        y: 180,
        footprint: { width: 100, height: 74 },
        ports: outletPorts,
      }),
      comp({
        componentId: 'tap',
        componentRole: 'dhw_outlet_tap',
        kind: 'tap_outlet',
        primitiveId: 'fixture_tap',
        x: 900,
        y: 300,
        footprint: { width: 100, height: 74 },
        ports: outletPorts,
      }),
    ],
    connections: [
      conn('e_flow_rad1', 'boiler', 'flow_out', 'rad_1', 'flow_in', ROUTING_RAILS.CH_FLOW),
      conn('e_flow_rad2', 'boiler', 'flow_out', 'rad_2', 'flow_in', ROUTING_RAILS.CH_FLOW),
      conn('e_return_rad1', 'rad_1', 'return_out', 'boiler', 'return_in', ROUTING_RAILS.CH_RETURN),
      conn('e_return_rad2', 'rad_2', 'return_out', 'boiler', 'return_in', ROUTING_RAILS.CH_RETURN),
      conn('e_hot_shower', 'boiler', 'hot_out', 'shower', 'hot_in', ROUTING_RAILS.DHW),
      conn('e_hot_tap', 'boiler', 'hot_out', 'tap', 'hot_in', ROUTING_RAILS.DHW),
      conn('e_cold_shower', 'boiler', 'cold_in', 'shower', 'cold_in', ROUTING_RAILS.CW_MAINS),
      conn('e_cold_tap', 'boiler', 'cold_in', 'tap', 'cold_in', ROUTING_RAILS.CW_MAINS),
    ],
  };
}

export function spawnTopologyPlacementModel(topologyId: SpawnTopologyId): TopologyPlacementModel {
  if (topologyId === 'sealed_unvented') return buildSealedUnventedModel();
  return buildCombiDirectModel();
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
    meta: { roleFrom, roleTo },
  };
}

export function buildGraphFromTopologyPlacementModel(model: TopologyPlacementModel): BuildGraph {
  return {
    nodes: model.components.map(toNode),
    edges: model.connections.map(connection => toEdge(connection, model)),
  };
}

export function spawnTopologyGraph(topologyId: SpawnTopologyId): BuildGraph {
  return buildGraphFromTopologyPlacementModel(spawnTopologyPlacementModel(topologyId));
}

