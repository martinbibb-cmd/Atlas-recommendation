/**
 * Tests for the composable system model:
 *  - types and canonical compositions (types.ts)
 *  - conceptModelToGraph graph generator (systemGraphGenerator.ts)
 */

import { describe, it, expect } from 'vitest';
import {
  CANONICAL_REGULAR_BOILER,
  CANONICAL_SYSTEM_BOILER,
  CANONICAL_COMBI,
  CANONICAL_HEAT_PUMP,
} from '../model/types';
import type { SystemConceptModel } from '../model/types';
import { conceptModelToGraph } from '../model/systemGraphGenerator';

// ─── Canonical compositions ───────────────────────────────────────────────────

describe('canonical compositions', () => {
  it('CANONICAL_REGULAR_BOILER has regular_boiler heat source', () => {
    expect(CANONICAL_REGULAR_BOILER.heatSource).toBe('regular_boiler');
  });

  it('CANONICAL_REGULAR_BOILER uses vented_cylinder DHW service', () => {
    expect(CANONICAL_REGULAR_BOILER.hotWaterService).toBe('vented_cylinder');
  });

  it('CANONICAL_REGULAR_BOILER uses y_plan controls', () => {
    expect(CANONICAL_REGULAR_BOILER.controls).toBe('y_plan');
  });

  it('CANONICAL_REGULAR_BOILER has no integrated pump or expansion', () => {
    expect(CANONICAL_REGULAR_BOILER.traits?.integratedPump).toBe(false);
    expect(CANONICAL_REGULAR_BOILER.traits?.integratedExpansion).toBe(false);
    expect(CANONICAL_REGULAR_BOILER.traits?.integratedPlateHex).toBe(false);
  });

  it('CANONICAL_SYSTEM_BOILER has system_boiler heat source', () => {
    expect(CANONICAL_SYSTEM_BOILER.heatSource).toBe('system_boiler');
  });

  it('CANONICAL_SYSTEM_BOILER uses unvented_cylinder DHW service', () => {
    expect(CANONICAL_SYSTEM_BOILER.hotWaterService).toBe('unvented_cylinder');
  });

  it('CANONICAL_SYSTEM_BOILER has integrated pump and expansion', () => {
    expect(CANONICAL_SYSTEM_BOILER.traits?.integratedPump).toBe(true);
    expect(CANONICAL_SYSTEM_BOILER.traits?.integratedExpansion).toBe(true);
    expect(CANONICAL_SYSTEM_BOILER.traits?.integratedPlateHex).toBe(false);
  });

  it('CANONICAL_COMBI uses system_boiler as heat source (not a separate kind)', () => {
    expect(CANONICAL_COMBI.heatSource).toBe('system_boiler');
  });

  it('CANONICAL_COMBI uses combi_plate_hex DHW service', () => {
    expect(CANONICAL_COMBI.hotWaterService).toBe('combi_plate_hex');
  });

  it('CANONICAL_COMBI has all three integration traits set', () => {
    expect(CANONICAL_COMBI.traits?.integratedPump).toBe(true);
    expect(CANONICAL_COMBI.traits?.integratedExpansion).toBe(true);
    expect(CANONICAL_COMBI.traits?.integratedPlateHex).toBe(true);
  });

  it('CANONICAL_COMBI uses no zone-control topology', () => {
    expect(CANONICAL_COMBI.controls).toBe('none');
  });

  it('CANONICAL_HEAT_PUMP uses heat_pump heat source', () => {
    expect(CANONICAL_HEAT_PUMP.heatSource).toBe('heat_pump');
  });

  it('CANONICAL_HEAT_PUMP uses hp_diverter controls', () => {
    expect(CANONICAL_HEAT_PUMP.controls).toBe('hp_diverter');
  });

  it('CANONICAL_HEAT_PUMP uses ufh emitters', () => {
    expect(CANONICAL_HEAT_PUMP.emitters).toContain('ufh');
  });
});

// ─── conceptModelToGraph — combi ──────────────────────────────────────────────

describe('conceptModelToGraph — combi', () => {
  const graph = conceptModelToGraph(CANONICAL_COMBI);

  it('includes a heat_source_combi node', () => {
    expect(graph.nodes.some(n => n.kind === 'heat_source_combi')).toBe(true);
  });

  it('includes a radiator_loop node', () => {
    expect(graph.nodes.some(n => n.kind === 'radiator_loop')).toBe(true);
  });

  it('includes a manifold_hot and manifold_cold node', () => {
    expect(graph.nodes.some(n => n.kind === 'manifold_hot')).toBe(true);
    expect(graph.nodes.some(n => n.kind === 'manifold_cold')).toBe(true);
  });

  it('includes outlet nodes', () => {
    expect(graph.nodes.some(n => n.kind === 'shower_outlet')).toBe(true);
    expect(graph.nodes.some(n => n.kind === 'bath_outlet')).toBe(true);
    expect(graph.nodes.some(n => n.kind === 'tap_outlet')).toBe(true);
  });

  it('does not include any cylinder node', () => {
    const cylinderKinds = ['dhw_vented_cylinder', 'dhw_unvented_cylinder', 'dhw_mixergy'];
    expect(graph.nodes.some(n => cylinderKinds.includes(n.kind))).toBe(false);
  });

  it('does not include a three_port_valve or zone_valve', () => {
    expect(graph.nodes.some(n => n.kind === 'three_port_valve')).toBe(false);
    expect(graph.nodes.some(n => n.kind === 'zone_valve')).toBe(false);
  });

  it('sets outlet bindings for A, B, C', () => {
    expect(graph.outletBindings?.A).toBe('sh');
    expect(graph.outletBindings?.B).toBe('bath');
    expect(graph.outletBindings?.C).toBe('tap1');
  });

  it('connects CH flow from boiler to radiator_loop', () => {
    const chFlowEdge = graph.edges.find(
      e => e.from.nodeId === 'hs' && e.from.portId === 'flow_out' &&
           e.to.portId === 'flow_in',
    );
    expect(chFlowEdge).toBeDefined();
  });
});

// ─── conceptModelToGraph — regular boiler + Y-plan ───────────────────────────

describe('conceptModelToGraph — regular boiler + Y-plan + vented cylinder', () => {
  const graph = conceptModelToGraph(CANONICAL_REGULAR_BOILER);

  it('includes a heat_source_regular_boiler node', () => {
    expect(graph.nodes.some(n => n.kind === 'heat_source_regular_boiler')).toBe(true);
  });

  it('includes a three_port_valve node for Y-plan', () => {
    expect(graph.nodes.some(n => n.kind === 'three_port_valve')).toBe(true);
  });

  it('includes a dhw_vented_cylinder node', () => {
    expect(graph.nodes.some(n => n.kind === 'dhw_vented_cylinder')).toBe(true);
  });

  it('includes feed_and_expansion and open_vent for open-vented circuit', () => {
    expect(graph.nodes.some(n => n.kind === 'feed_and_expansion')).toBe(true);
    expect(graph.nodes.some(n => n.kind === 'open_vent')).toBe(true);
  });

  it('includes a cws_cistern for tank-fed cold supply', () => {
    expect(graph.nodes.some(n => n.kind === 'cws_cistern')).toBe(true);
  });

  it('does not include a heat_source_combi node', () => {
    expect(graph.nodes.some(n => n.kind === 'heat_source_combi')).toBe(false);
  });

  it('connects boiler CH flow to three_port_valve', () => {
    const edge = graph.edges.find(
      e => e.from.nodeId === 'hs' && e.from.portId === 'flow_out' &&
           e.to.nodeId === 'v3',
    );
    expect(edge).toBeDefined();
  });

  it('connects valve out_b to cylinder coil_flow', () => {
    const edge = graph.edges.find(
      e => e.from.nodeId === 'v3' && e.from.portId === 'out_b' &&
           e.to.portId === 'coil_flow',
    );
    expect(edge).toBeDefined();
  });
});

// ─── conceptModelToGraph — system boiler + S-plan ────────────────────────────

describe('conceptModelToGraph — system boiler + S-plan + unvented cylinder', () => {
  const graph = conceptModelToGraph(CANONICAL_SYSTEM_BOILER);

  it('includes a heat_source_system_boiler node', () => {
    expect(graph.nodes.some(n => n.kind === 'heat_source_system_boiler')).toBe(true);
  });

  it('includes a pump node (S-plan)', () => {
    expect(graph.nodes.some(n => n.kind === 'pump')).toBe(true);
  });

  it('includes two zone_valve nodes for CH and cylinder', () => {
    const zoneValves = graph.nodes.filter(n => n.kind === 'zone_valve');
    expect(zoneValves.length).toBe(2);
  });

  it('includes a dhw_unvented_cylinder node', () => {
    expect(graph.nodes.some(n => n.kind === 'dhw_unvented_cylinder')).toBe(true);
  });

  it('does not include a three_port_valve', () => {
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

// ─── conceptModelToGraph — heat pump ─────────────────────────────────────────

describe('conceptModelToGraph — heat pump + hp_diverter + unvented cylinder', () => {
  const graph = conceptModelToGraph(CANONICAL_HEAT_PUMP);

  it('includes a heat_source_heat_pump node', () => {
    expect(graph.nodes.some(n => n.kind === 'heat_source_heat_pump')).toBe(true);
  });

  it('includes a buffer node', () => {
    expect(graph.nodes.some(n => n.kind === 'buffer')).toBe(true);
  });

  it('includes a ufh_loop emitter node', () => {
    expect(graph.nodes.some(n => n.kind === 'ufh_loop')).toBe(true);
  });

  it('includes a dhw_unvented_cylinder node', () => {
    expect(graph.nodes.some(n => n.kind === 'dhw_unvented_cylinder')).toBe(true);
  });

  it('connects heat pump to buffer primary circuit', () => {
    const hpToBuf = graph.edges.find(
      e => e.from.nodeId === 'hp' && e.to.nodeId === 'buf',
    );
    expect(hpToBuf).toBeDefined();
  });

  it('connects buffer secondary to tee', () => {
    const bufToTee = graph.edges.find(
      e => e.from.nodeId === 'buf' && e.from.portId === 'secondary_flow',
    );
    expect(bufToTee).toBeDefined();
  });
});

// ─── conceptModelToGraph — mixergy cylinder ───────────────────────────────────

describe('conceptModelToGraph — system boiler + S-plan + Mixergy', () => {
  const model: SystemConceptModel = {
    heatSource: 'system_boiler',
    hotWaterService: 'mixergy',
    controls: 's_plan',
    emitters: ['radiators'],
    traits: { integratedPump: true, integratedExpansion: true, integratedPlateHex: false },
  };
  const graph = conceptModelToGraph(model);

  it('uses dhw_mixergy cylinder node', () => {
    expect(graph.nodes.some(n => n.kind === 'dhw_mixergy')).toBe(true);
  });

  it('does not use dhw_unvented_cylinder', () => {
    expect(graph.nodes.some(n => n.kind === 'dhw_unvented_cylinder')).toBe(false);
  });
});

// ─── conceptModelToGraph — emitter variants ───────────────────────────────────

describe('conceptModelToGraph — emitter variants', () => {
  it('uses ufh_loop when emitters contains ufh', () => {
    const model: SystemConceptModel = {
      heatSource: 'system_boiler',
      hotWaterService: 'unvented_cylinder',
      controls: 's_plan',
      emitters: ['ufh'],
    };
    const graph = conceptModelToGraph(model);
    expect(graph.nodes.some(n => n.kind === 'ufh_loop')).toBe(true);
    expect(graph.nodes.some(n => n.kind === 'radiator_loop')).toBe(false);
  });

  it('uses radiator_loop when emitters is mixed (primary emitter)', () => {
    const model: SystemConceptModel = {
      heatSource: 'system_boiler',
      hotWaterService: 'unvented_cylinder',
      controls: 's_plan',
      emitters: ['mixed'],
    };
    const graph = conceptModelToGraph(model);
    expect(graph.nodes.some(n => n.kind === 'radiator_loop')).toBe(true);
  });

  it('combi with ufh emitter uses ufh_loop', () => {
    const model: SystemConceptModel = {
      heatSource: 'system_boiler',
      hotWaterService: 'combi_plate_hex',
      controls: 'none',
      emitters: ['ufh'],
    };
    const graph = conceptModelToGraph(model);
    expect(graph.nodes.some(n => n.kind === 'ufh_loop')).toBe(true);
  });
});

// ─── conceptModelToGraph — fallback behaviour ─────────────────────────────────

describe('conceptModelToGraph — fallback', () => {
  it('returns a valid graph for an unrecognised combination', () => {
    const model: SystemConceptModel = {
      heatSource: 'regular_boiler',
      hotWaterService: 'unvented_cylinder',
      controls: 'none',
      emitters: ['radiators'],
    };
    const graph = conceptModelToGraph(model);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });
});
