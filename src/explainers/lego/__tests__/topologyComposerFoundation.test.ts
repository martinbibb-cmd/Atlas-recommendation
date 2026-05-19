import { describe, expect, it } from 'vitest';
import {
  spawnTopologyGraph,
  spawnTopologyPlacementModel,
  validateTopologyPlacementModel,
} from '../builder/topologyComposerFoundation';
import { validateGraph } from '../builder/graphValidate';
import { ROUTING_RAILS } from '../../../library/visualPrimitives/primitiveTokens';
import { computeTopologyLayout, getTopologyLayoutDeclaration } from '../../../library/visualTopologies/layout';

describe('topologyComposerFoundation', () => {
  it('spawns a complete sealed+unvented topology with placement metadata and rail-bound connections', () => {
    const graph = spawnTopologyGraph('sealed_unvented');

    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
    for (const node of graph.nodes) {
      expect(node.componentRole).toBeTruthy();
      expect(node.primitiveId).toBeTruthy();
      expect(node.footprint).toBeDefined();
      expect(node.ports).toBeDefined();
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
    }

    for (const edge of graph.edges) {
      expect(edge.rail).toBeTruthy();
      const source = graph.nodes.find(n => n.id === edge.from.nodeId);
      const target = graph.nodes.find(n => n.id === edge.to.nodeId);
      expect(source?.ports?.[edge.from.portId]).toBeDefined();
      expect(target?.ports?.[edge.to.portId]).toBeDefined();
    }

    const warnings = validateGraph(graph);
    expect(warnings.filter(w => w.id.startsWith('port_endpoint_missing_'))).toEqual([]);
    expect(warnings.filter(w => w.id.startsWith('disconnected_port_'))).toEqual([]);
    expect(warnings.filter(w => w.id.startsWith('missing_component_role_'))).toEqual([]);
  });

  it('flags impossible rail assignments for incompatible port roles', () => {
    const graph = spawnTopologyGraph('combi_direct_hot_water');
    const returnEdge = graph.edges.find(edge => edge.id === 'e_rad1_to_combi_return');
    expect(returnEdge).toBeDefined();
    if (!returnEdge) return;

    returnEdge.rail = ROUTING_RAILS.DHW;
    const warnings = validateGraph(graph);
    const railWarnings = warnings.filter(w => w.id === `rail_impossible_${returnEdge.id}`);
    expect(railWarnings.length).toBe(1);
  });

  it('maps sealed_unvented component positions directly from topology layout output', () => {
    const model = spawnTopologyPlacementModel('sealed_unvented');
    const layout = computeTopologyLayout(getTopologyLayoutDeclaration('sealed_unvented_cylinder'));

    for (const component of model.components) {
      const expected = layout.positions[component.componentRole];
      expect(expected).toBeDefined();
      if (!expected) continue;
      expect(component.x).toBe(expected.left);
      expect(component.y).toBe(expected.top);
    }
  });

  it('maps combi component positions directly from topology layout output', () => {
    const model = spawnTopologyPlacementModel('combi_direct_hot_water');
    const layout = computeTopologyLayout(getTopologyLayoutDeclaration('combi_direct_hot_water'));

    for (const component of model.components) {
      const expected = layout.positions[component.componentRole];
      expect(expected).toBeDefined();
      if (!expected) continue;
      expect(component.x).toBe(expected.left);
      expect(component.y).toBe(expected.top);
    }
  });

  it('ensures composer topology models have no independent placement truth outside layout-derived roles', () => {
    const sealed = spawnTopologyPlacementModel('sealed_unvented');
    const combi = spawnTopologyPlacementModel('combi_direct_hot_water');
    const sealedRoles = new Set(Object.keys(computeTopologyLayout(getTopologyLayoutDeclaration('sealed_unvented_cylinder')).positions));
    const combiRoles = new Set(Object.keys(computeTopologyLayout(getTopologyLayoutDeclaration('combi_direct_hot_water')).positions));

    for (const component of sealed.components) {
      expect(sealedRoles.has(component.componentRole)).toBe(true);
    }
    for (const component of combi.components) {
      expect(combiRoles.has(component.componentRole)).toBe(true);
    }
  });

  it('ensures every composer connection endpoint resolves to declared primitive ports', () => {
    const model = spawnTopologyPlacementModel('sealed_unvented');
    for (const connection of model.connections) {
      const source = model.components.find(component => component.componentId === connection.source.componentId);
      const target = model.components.find(component => component.componentId === connection.target.componentId);
      expect(source?.ports[connection.source.portId]).toBeDefined();
      expect(target?.ports[connection.target.portId]).toBeDefined();
      expect((connection.pipeRoute ?? []).length).toBeGreaterThan(0);
    }
  });

  it('blocks ready state when layout validation fails', () => {
    const model = spawnTopologyPlacementModel('sealed_unvented');
    const declaration = getTopologyLayoutDeclaration('sealed_unvented_cylinder');
    const layout = computeTopologyLayout(declaration);
    const brokenLayout = {
      ...layout,
      positions: {
        ...layout.positions,
        boiler: { left: -999, top: -999 },
      },
    };

    const validation = validateTopologyPlacementModel({
      model,
      layout: brokenLayout,
      declaration,
    });

    expect(validation.ready).toBe(false);
    expect(validation.warnings.some(warning => warning.startsWith('layout:out_of_zone'))).toBe(true);
  });
});
