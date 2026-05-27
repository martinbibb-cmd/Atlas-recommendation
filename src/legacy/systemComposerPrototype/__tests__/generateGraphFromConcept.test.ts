/**
 * Tests for generateGraphFromConcept (PR3 — topology-driven graph generation).
 *
 * Validates that the public `generateGraphFromConcept` entry point produces
 * correct, valid BuildGraphs for each canonical system topology and for
 * custom SystemConceptModel inputs.
 */

import { describe, it, expect } from 'vitest';
import { generateGraphFromConcept } from '../model/generateGraphFromConcept';
import {
  CANONICAL_COMBI,
  CANONICAL_REGULAR_BOILER,
  CANONICAL_SYSTEM_BOILER,
  CANONICAL_HEAT_PUMP,
  type SystemConceptModel,
} from '../model/types';

// ─── Shared structural assertions ────────────────────────────────────────────

function assertGraphIsValid(graph: ReturnType<typeof generateGraphFromConcept>) {
  expect(graph.nodes.length).toBeGreaterThan(0);
  expect(graph.edges.length).toBeGreaterThan(0);
  // All edge endpoint nodeIds must refer to existing nodes.
  const nodeIds = new Set(graph.nodes.map(n => n.id));
  for (const edge of graph.edges) {
    expect(nodeIds.has(edge.from.nodeId), `edge from nodeId '${edge.from.nodeId}' missing`).toBe(true);
    expect(nodeIds.has(edge.to.nodeId),   `edge to nodeId '${edge.to.nodeId}' missing`).toBe(true);
  }
  // All nodes must have finite positions.
  for (const n of graph.nodes) {
    expect(isFinite(n.x), `node ${n.id} x is not finite`).toBe(true);
    expect(isFinite(n.y), `node ${n.id} y is not finite`).toBe(true);
  }
  // Outlet bindings must reference existing nodes if present.
  if (graph.outletBindings) {
    for (const [slot, nodeId] of Object.entries(graph.outletBindings)) {
      if (nodeId) {
        expect(nodeIds.has(nodeId), `outletBinding ${slot} refs missing node '${nodeId}'`).toBe(true);
      }
    }
  }
}

// ─── 1. Combi ─────────────────────────────────────────────────────────────────

describe('generateGraphFromConcept — combi system', () => {
  const graph = generateGraphFromConcept(CANONICAL_COMBI);

  it('returns a structurally valid graph', () => {
    assertGraphIsValid(graph);
  });

  it('includes a heat_source_combi node', () => {
    expect(graph.nodes.some(n => n.kind === 'heat_source_combi')).toBe(true);
  });

  it('includes a radiator_loop node', () => {
    expect(graph.nodes.some(n => n.kind === 'radiator_loop')).toBe(true);
  });

  it('does not include any cylinder node', () => {
    const cylinderKinds = ['dhw_vented_cylinder', 'dhw_unvented_cylinder', 'dhw_mixergy'];
    expect(graph.nodes.some(n => cylinderKinds.includes(n.kind))).toBe(false);
  });

  it('includes manifold_hot and manifold_cold', () => {
    expect(graph.nodes.some(n => n.kind === 'manifold_hot')).toBe(true);
    expect(graph.nodes.some(n => n.kind === 'manifold_cold')).toBe(true);
  });

  it('includes outlet nodes', () => {
    expect(graph.nodes.some(n => n.kind === 'shower_outlet')).toBe(true);
    expect(graph.nodes.some(n => n.kind === 'bath_outlet')).toBe(true);
    expect(graph.nodes.some(n => n.kind === 'tap_outlet')).toBe(true);
  });

  it('sets outlet bindings for A, B, C', () => {
    expect(graph.outletBindings?.A).toBeDefined();
    expect(graph.outletBindings?.B).toBeDefined();
    expect(graph.outletBindings?.C).toBeDefined();
  });

  it('does not include a three_port_valve or zone_valve', () => {
    expect(graph.nodes.some(n => n.kind === 'three_port_valve')).toBe(false);
    expect(graph.nodes.some(n => n.kind === 'zone_valve')).toBe(false);
  });
});

// ─── 2. Y-plan (regular boiler + vented cylinder) ────────────────────────────

describe('generateGraphFromConcept — regular boiler + Y-plan + vented cylinder', () => {
  const graph = generateGraphFromConcept(CANONICAL_REGULAR_BOILER);

  it('returns a structurally valid graph', () => {
    assertGraphIsValid(graph);
  });

  it('includes a heat_source_regular_boiler node', () => {
    expect(graph.nodes.some(n => n.kind === 'heat_source_regular_boiler')).toBe(true);
  });

  it('includes a three_port_valve for Y-plan', () => {
    expect(graph.nodes.some(n => n.kind === 'three_port_valve')).toBe(true);
  });

  it('includes a dhw_vented_cylinder', () => {
    expect(graph.nodes.some(n => n.kind === 'dhw_vented_cylinder')).toBe(true);
  });

  it('includes feed_and_expansion and open_vent for open-vented circuit', () => {
    expect(graph.nodes.some(n => n.kind === 'feed_and_expansion')).toBe(true);
    expect(graph.nodes.some(n => n.kind === 'open_vent')).toBe(true);
  });

  it('includes a cws_cistern for tank-fed supply', () => {
    expect(graph.nodes.some(n => n.kind === 'cws_cistern')).toBe(true);
  });

  it('connects boiler CH flow to three_port_valve', () => {
    const edge = graph.edges.find(
      e => e.from.nodeId === 'hs' && e.from.portId === 'flow_out' && e.to.nodeId === 'v3',
    );
    expect(edge).toBeDefined();
  });

  it('connects valve out_b to cylinder coil_flow', () => {
    const edge = graph.edges.find(
      e => e.from.nodeId === 'v3' && e.from.portId === 'out_b' && e.to.portId === 'coil_flow',
    );
    expect(edge).toBeDefined();
  });
});

// ─── 3. S-plan (system boiler + unvented cylinder) ───────────────────────────

describe('generateGraphFromConcept — system boiler + S-plan + unvented cylinder', () => {
  const graph = generateGraphFromConcept(CANONICAL_SYSTEM_BOILER);

  it('returns a structurally valid graph', () => {
    assertGraphIsValid(graph);
  });

  it('includes a heat_source_system_boiler node', () => {
    expect(graph.nodes.some(n => n.kind === 'heat_source_system_boiler')).toBe(true);
  });

  it('includes a pump node', () => {
    expect(graph.nodes.some(n => n.kind === 'pump')).toBe(true);
  });

  it('includes two zone_valve nodes', () => {
    expect(graph.nodes.filter(n => n.kind === 'zone_valve').length).toBe(2);
  });

  it('includes a dhw_unvented_cylinder', () => {
    expect(graph.nodes.some(n => n.kind === 'dhw_unvented_cylinder')).toBe(true);
  });

  it('does not include a three_port_valve (S-plan uses zone valves)', () => {
    expect(graph.nodes.some(n => n.kind === 'three_port_valve')).toBe(false);
  });

  it('does not include feed_and_expansion (sealed system)', () => {
    expect(graph.nodes.some(n => n.kind === 'feed_and_expansion')).toBe(false);
  });

  it('connects boiler to pump and pump to tee', () => {
    const boilerToPump = graph.edges.find(
      e => e.from.nodeId === 'hs' && e.to.nodeId === 'pump',
    );
    const pumpToTee = graph.edges.find(
      e => e.from.nodeId === 'pump' && e.to.nodeId === 'tee_f',
    );
    expect(boilerToPump).toBeDefined();
    expect(pumpToTee).toBeDefined();
  });
});

// ─── 4. Heat pump ─────────────────────────────────────────────────────────────

describe('generateGraphFromConcept — heat pump + hp_diverter + unvented cylinder', () => {
  const graph = generateGraphFromConcept(CANONICAL_HEAT_PUMP);

  it('returns a structurally valid graph', () => {
    assertGraphIsValid(graph);
  });

  it('includes a heat_source_heat_pump node', () => {
    expect(graph.nodes.some(n => n.kind === 'heat_source_heat_pump')).toBe(true);
  });

  it('includes a buffer node', () => {
    expect(graph.nodes.some(n => n.kind === 'buffer')).toBe(true);
  });

  it('includes a ufh_loop emitter', () => {
    expect(graph.nodes.some(n => n.kind === 'ufh_loop')).toBe(true);
  });

  it('includes a dhw_unvented_cylinder', () => {
    expect(graph.nodes.some(n => n.kind === 'dhw_unvented_cylinder')).toBe(true);
  });

  it('connects heat pump to buffer primary circuit', () => {
    const edge = graph.edges.find(
      e => e.from.nodeId === 'hp' && e.to.nodeId === 'buf',
    );
    expect(edge).toBeDefined();
  });

  it('connects buffer secondary_flow to tee', () => {
    const edge = graph.edges.find(
      e => e.from.nodeId === 'buf' && e.from.portId === 'secondary_flow',
    );
    expect(edge).toBeDefined();
  });
});

// ─── 5. Custom concept models ─────────────────────────────────────────────────

describe('generateGraphFromConcept — custom models', () => {
  it('mixergy cylinder: uses dhw_mixergy node', () => {
    const model: SystemConceptModel = {
      heatSource: 'system_boiler',
      hotWaterService: 'mixergy',
      controls: 's_plan',
      emitters: ['radiators'],
    };
    const graph = generateGraphFromConcept(model);
    expect(graph.nodes.some(n => n.kind === 'dhw_mixergy')).toBe(true);
  });

  it('UFH emitter: uses ufh_loop for system boiler', () => {
    const model: SystemConceptModel = {
      heatSource: 'system_boiler',
      hotWaterService: 'unvented_cylinder',
      controls: 's_plan',
      emitters: ['ufh'],
    };
    const graph = generateGraphFromConcept(model);
    expect(graph.nodes.some(n => n.kind === 'ufh_loop')).toBe(true);
    expect(graph.nodes.some(n => n.kind === 'radiator_loop')).toBe(false);
  });

  it('combi with UFH emitter: uses ufh_loop', () => {
    const model: SystemConceptModel = {
      heatSource: 'system_boiler',
      hotWaterService: 'combi_plate_hex',
      controls: 'none',
      emitters: ['ufh'],
    };
    const graph = generateGraphFromConcept(model);
    expect(graph.nodes.some(n => n.kind === 'ufh_loop')).toBe(true);
  });

  it('fallback for unrecognised combination returns a valid graph', () => {
    const model: SystemConceptModel = {
      heatSource: 'regular_boiler',
      hotWaterService: 'unvented_cylinder',
      controls: 'none',
      emitters: ['radiators'],
    };
    const graph = generateGraphFromConcept(model);
    assertGraphIsValid(graph);
  });
});

// ─── 6. Concept presets resolve correctly ─────────────────────────────────────

describe('resolveConceptPreset', () => {
  it('resolveConceptPreset produces a graph with nodes and edges', async () => {
    const { resolveConceptPreset, CONCEPT_PRESETS } = await import('../builder/presets');
    for (const preset of CONCEPT_PRESETS) {
      const resolved = resolveConceptPreset(preset);
      expect(resolved.graph.nodes.length, `${preset.id} should have nodes`).toBeGreaterThan(0);
      expect(resolved.graph.edges.length, `${preset.id} should have edges`).toBeGreaterThan(0);
    }
  });

  it('each concept preset has a unique id', async () => {
    const { CONCEPT_PRESETS } = await import('../builder/presets');
    const ids = CONCEPT_PRESETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
