// src/explainers/lego/__tests__/resolveSystemTopology.test.ts
//
// Tests for the runtime topology classifier.

import { describe, it, expect } from 'vitest'
import {
  resolveSystemTopology,
  supplyBottleneckLabel,
  dhwSourceDescription,
  type ResolvedSystemTopology,
} from '../sim/resolveSystemTopology'
import type { BuildGraph } from '../builder/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGraph(nodeKinds: string[]): BuildGraph {
  return {
    nodes: nodeKinds.map((kind, i) => ({
      id: `n${i}`,
      kind: kind as BuildGraph['nodes'][0]['kind'],
      x: i * 100,
      y: 0,
      r: 0,
    })),
    edges: [],
  }
}

// ─── DHW service type classification ─────────────────────────────────────────

describe('resolveSystemTopology — dhwServiceType', () => {
  it('classifies a graph with heat_source_combi as combi', () => {
    const graph = makeGraph(['heat_source_combi', 'radiator_loop'])
    const t = resolveSystemTopology(graph)
    expect(t.dhwServiceType).toBe('combi')
  })

  it('classifies a graph with dhw_vented_cylinder as vented_cylinder', () => {
    const graph = makeGraph([
      'heat_source_regular_boiler',
      'dhw_vented_cylinder',
      'cws_cistern',
      'radiator_loop',
    ])
    const t = resolveSystemTopology(graph)
    expect(t.dhwServiceType).toBe('vented_cylinder')
  })

  it('classifies a graph with dhw_unvented_cylinder as unvented_cylinder', () => {
    const graph = makeGraph([
      'heat_source_system_boiler',
      'dhw_unvented_cylinder',
      'radiator_loop',
    ])
    const t = resolveSystemTopology(graph)
    expect(t.dhwServiceType).toBe('unvented_cylinder')
  })

  it('classifies a graph with dhw_mixergy as mixergy', () => {
    const graph = makeGraph([
      'heat_source_system_boiler',
      'dhw_mixergy',
      'radiator_loop',
    ])
    const t = resolveSystemTopology(graph)
    expect(t.dhwServiceType).toBe('mixergy')
  })

  it('classifies a heating-only graph as none', () => {
    const graph = makeGraph([
      'heat_source_system_boiler',
      'radiator_loop',
    ])
    const t = resolveSystemTopology(graph)
    expect(t.dhwServiceType).toBe('none')
  })

  it('returns none for an empty graph', () => {
    const t = resolveSystemTopology({ nodes: [], edges: [] })
    expect(t.dhwServiceType).toBe('none')
  })
})

// ─── DHW supply type ──────────────────────────────────────────────────────────

describe('resolveSystemTopology — dhwSupplyType', () => {
  it('combi is mains-fed', () => {
    const graph = makeGraph(['heat_source_combi'])
    const t = resolveSystemTopology(graph)
    expect(t.dhwSupplyType).toBe('mains')
  })

  it('vented cylinder is cws_tank (tank-fed)', () => {
    const graph = makeGraph([
      'heat_source_regular_boiler',
      'dhw_vented_cylinder',
      'cws_cistern',
    ])
    const t = resolveSystemTopology(graph)
    expect(t.dhwSupplyType).toBe('cws_tank')
  })

  it('vented cylinder is still cws_tank even without explicit CWS cistern node', () => {
    // Vented cylinder is always tank-fed by definition
    const graph = makeGraph(['heat_source_regular_boiler', 'dhw_vented_cylinder'])
    const t = resolveSystemTopology(graph)
    expect(t.dhwSupplyType).toBe('cws_tank')
  })

  it('unvented cylinder is mains-fed', () => {
    const graph = makeGraph(['heat_source_system_boiler', 'dhw_unvented_cylinder'])
    const t = resolveSystemTopology(graph)
    expect(t.dhwSupplyType).toBe('mains')
  })

  it('mixergy is mains-fed', () => {
    const graph = makeGraph(['heat_source_system_boiler', 'dhw_mixergy'])
    const t = resolveSystemTopology(graph)
    expect(t.dhwSupplyType).toBe('mains')
  })

  it('heating-only system has no supply type', () => {
    const graph = makeGraph(['heat_source_system_boiler', 'radiator_loop'])
    const t = resolveSystemTopology(graph)
    expect(t.dhwSupplyType).toBe('none')
  })
})

// ─── Primary coil ─────────────────────────────────────────────────────────────

describe('resolveSystemTopology — hasPrimaryCoil', () => {
  it('cylinder systems have a primary coil', () => {
    for (const kind of ['dhw_vented_cylinder', 'dhw_unvented_cylinder', 'dhw_mixergy']) {
      const graph = makeGraph([kind])
      const t = resolveSystemTopology(graph)
      expect(t.hasPrimaryCoil).toBe(true)
    }
  })

  it('combi does not have a primary coil', () => {
    const t = resolveSystemTopology(makeGraph(['heat_source_combi']))
    expect(t.hasPrimaryCoil).toBe(false)
  })

  it('heating-only system has no primary coil', () => {
    const t = resolveSystemTopology(makeGraph(['heat_source_system_boiler', 'radiator_loop']))
    expect(t.hasPrimaryCoil).toBe(false)
  })
})

// ─── Heating circuit ──────────────────────────────────────────────────────────

describe('resolveSystemTopology — hasHeatingCircuit', () => {
  it('detects radiator_loop as a heating circuit', () => {
    const t = resolveSystemTopology(makeGraph(['heat_source_combi', 'radiator_loop']))
    expect(t.hasHeatingCircuit).toBe(true)
  })

  it('detects ufh_loop as a heating circuit', () => {
    const t = resolveSystemTopology(makeGraph(['heat_source_heat_pump', 'ufh_loop']))
    expect(t.hasHeatingCircuit).toBe(true)
  })

  it('reports no heating circuit when only DHW components are present', () => {
    const t = resolveSystemTopology(makeGraph(['heat_source_combi']))
    expect(t.hasHeatingCircuit).toBe(false)
  })
})

// ─── Control topology ─────────────────────────────────────────────────────────

describe('resolveSystemTopology — controlTopology', () => {
  it('identifies y_plan from three_port_valve', () => {
    const graph = makeGraph([
      'heat_source_regular_boiler',
      'three_port_valve',
      'dhw_vented_cylinder',
      'radiator_loop',
    ])
    expect(resolveSystemTopology(graph).controlTopology).toBe('y_plan')
  })

  it('identifies s_plan from two zone valves', () => {
    const graph = makeGraph([
      'heat_source_system_boiler',
      'zone_valve',
      'zone_valve',
      'dhw_unvented_cylinder',
      'radiator_loop',
    ])
    expect(resolveSystemTopology(graph).controlTopology).toBe('s_plan')
  })

  it('identifies s_plan_multi_zone from three or more zone valves', () => {
    const graph = makeGraph([
      'heat_source_system_boiler',
      'zone_valve',
      'zone_valve',
      'zone_valve',
      'dhw_unvented_cylinder',
      'radiator_loop',
    ])
    expect(resolveSystemTopology(graph).controlTopology).toBe('s_plan_multi_zone')
  })

  it('identifies hp_diverter from heat pump + buffer', () => {
    const graph = makeGraph([
      'heat_source_heat_pump',
      'buffer',
      'dhw_unvented_cylinder',
      'ufh_loop',
    ])
    expect(resolveSystemTopology(graph).controlTopology).toBe('hp_diverter')
  })

  it('identifies hp_diverter from heat pump + low_loss_header', () => {
    const graph = makeGraph([
      'heat_source_heat_pump',
      'low_loss_header',
      'dhw_unvented_cylinder',
      'ufh_loop',
    ])
    expect(resolveSystemTopology(graph).controlTopology).toBe('hp_diverter')
  })

  it('returns none when no control components are present', () => {
    const t = resolveSystemTopology(makeGraph(['heat_source_combi', 'radiator_loop']))
    expect(t.controlTopology).toBe('none')
  })
})

// ─── Node ID resolution ───────────────────────────────────────────────────────

describe('resolveSystemTopology — node IDs', () => {
  it('sets cylinderNodeId for vented cylinder', () => {
    const graph = makeGraph(['heat_source_regular_boiler', 'dhw_vented_cylinder'])
    const t = resolveSystemTopology(graph)
    expect(t.cylinderNodeId).toBe('n1')
  })

  it('cylinderNodeId is undefined for combi', () => {
    const t = resolveSystemTopology(makeGraph(['heat_source_combi']))
    expect(t.cylinderNodeId).toBeUndefined()
  })

  it('sets heatSourceNodeId', () => {
    const graph = makeGraph(['heat_source_system_boiler', 'dhw_unvented_cylinder'])
    const t = resolveSystemTopology(graph)
    expect(t.heatSourceNodeId).toBe('n0')
  })

  it('sets outletSourceNodeId to cylinder node for stored systems', () => {
    const graph = makeGraph(['heat_source_regular_boiler', 'dhw_vented_cylinder'])
    const t = resolveSystemTopology(graph)
    expect(t.outletSourceNodeId).toBe(t.cylinderNodeId)
  })

  it('sets outletSourceNodeId to combi node for combi systems', () => {
    const graph = makeGraph(['heat_source_combi'])
    const t = resolveSystemTopology(graph)
    expect(t.outletSourceNodeId).toBe('n0')
  })
})

// ─── supplyBottleneckLabel ────────────────────────────────────────────────────

describe('supplyBottleneckLabel', () => {
  it('returns tank-fed label for vented cylinder', () => {
    const topology: ResolvedSystemTopology = {
      dhwServiceType: 'vented_cylinder',
      dhwSupplyType: 'cws_tank',
      hasPrimaryCoil: true,
      hasHeatingCircuit: true,
      controlTopology: 'y_plan',
    }
    expect(supplyBottleneckLabel(topology)).toContain('tank-fed')
  })

  it('returns mains supply label for combi', () => {
    const topology: ResolvedSystemTopology = {
      dhwServiceType: 'combi',
      dhwSupplyType: 'mains',
      hasPrimaryCoil: false,
      hasHeatingCircuit: true,
      controlTopology: 'none',
    }
    expect(supplyBottleneckLabel(topology)).toContain('mains')
  })

  it('returns mains supply label for unvented cylinder', () => {
    const topology: ResolvedSystemTopology = {
      dhwServiceType: 'unvented_cylinder',
      dhwSupplyType: 'mains',
      hasPrimaryCoil: true,
      hasHeatingCircuit: true,
      controlTopology: 's_plan',
    }
    expect(supplyBottleneckLabel(topology)).toContain('mains')
  })
})

// ─── dhwSourceDescription ────────────────────────────────────────────────────

describe('dhwSourceDescription', () => {
  it('describes combi as on-demand mains-fed', () => {
    const t: ResolvedSystemTopology = {
      dhwServiceType: 'combi', dhwSupplyType: 'mains',
      hasPrimaryCoil: false, hasHeatingCircuit: true, controlTopology: 'none',
    }
    expect(dhwSourceDescription(t)).toContain('On-demand')
  })

  it('describes vented cylinder as stored, tank-fed', () => {
    const t: ResolvedSystemTopology = {
      dhwServiceType: 'vented_cylinder', dhwSupplyType: 'cws_tank',
      hasPrimaryCoil: true, hasHeatingCircuit: true, controlTopology: 'y_plan',
    }
    const desc = dhwSourceDescription(t)
    expect(desc).toContain('Stored')
    expect(desc).toContain('tank-fed')
  })

  it('describes unvented cylinder as stored, mains-fed', () => {
    const t: ResolvedSystemTopology = {
      dhwServiceType: 'unvented_cylinder', dhwSupplyType: 'mains',
      hasPrimaryCoil: true, hasHeatingCircuit: true, controlTopology: 's_plan',
    }
    const desc = dhwSourceDescription(t)
    expect(desc).toContain('Stored')
    expect(desc).toContain('mains-fed')
  })

  it('describes heating-only as no DHW service', () => {
    const t: ResolvedSystemTopology = {
      dhwServiceType: 'none', dhwSupplyType: 'none',
      hasPrimaryCoil: false, hasHeatingCircuit: true, controlTopology: 'none',
    }
    expect(dhwSourceDescription(t)).toContain('no DHW')
  })
})
