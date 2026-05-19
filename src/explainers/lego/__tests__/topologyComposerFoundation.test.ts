import { describe, expect, it } from 'vitest';
import { spawnTopologyGraph } from '../builder/topologyComposerFoundation';
import { validateGraph } from '../builder/graphValidate';
import { ROUTING_RAILS } from '../../../library/visualPrimitives/primitiveTokens';

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
    const hotEdge = graph.edges.find(edge => edge.id === 'e_hot_shower');
    expect(hotEdge).toBeDefined();
    if (!hotEdge) return;

    hotEdge.rail = ROUTING_RAILS.CW_MAINS;
    const warnings = validateGraph(graph);
    const railWarnings = warnings.filter(w => w.id === `rail_impossible_${hotEdge.id}`);
    expect(railWarnings.length).toBe(1);
  });
});

