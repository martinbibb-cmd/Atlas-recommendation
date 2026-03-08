/**
 * Tests for graphToLabControls — the Build→Play conversion utility.
 */

import { describe, it, expect } from 'vitest'
import { graphToLabControls } from '../builder/graphToControls'
import type { BuildGraph } from '../builder/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyGraph(): BuildGraph {
  return { nodes: [], edges: [] }
}

function combiGraph(): BuildGraph {
  return {
    nodes: [
      { id: 'hs', kind: 'heat_source_combi', x: 100, y: 100, r: 0 },
      { id: 'sh', kind: 'shower_outlet', x: 300, y: 100, r: 0 },
    ],
    edges: [
      { id: 'e1', from: { nodeId: 'hs', portId: 'hot_out' }, to: { nodeId: 'sh', portId: 'hot_in' } },
    ],
    outletBindings: { A: 'sh' },
  }
}

function unventedCylinderGraph(): BuildGraph {
  return {
    nodes: [
      { id: 'hs', kind: 'heat_source_system_boiler', x: 100, y: 100, r: 0 },
      { id: 'cyl', kind: 'dhw_unvented_cylinder', x: 300, y: 100, r: 0 },
      { id: 'sh', kind: 'shower_outlet', x: 500, y: 100, r: 0 },
    ],
    edges: [
      { id: 'e1', from: { nodeId: 'cyl', portId: 'hot_out' }, to: { nodeId: 'sh', portId: 'hot_in' } },
    ],
    outletBindings: { A: 'sh' },
  }
}

function ventedCylinderGraph(): BuildGraph {
  return {
    nodes: [
      { id: 'hs', kind: 'heat_source_regular_boiler', x: 100, y: 100, r: 0 },
      { id: 'cyl', kind: 'dhw_vented_cylinder', x: 300, y: 100, r: 0 },
      { id: 'sh', kind: 'shower_outlet', x: 500, y: 100, r: 0 },
    ],
    edges: [],
  }
}

// ── System type inference ──────────────────────────────────────────────────────

describe('graphToLabControls — systemType inference', () => {
  it('infers combi for a graph with a combi heat source', () => {
    const controls = graphToLabControls(combiGraph())
    expect(controls.systemType).toBe('combi')
  })

  it('infers unvented_cylinder for a graph with an unvented cylinder', () => {
    const controls = graphToLabControls(unventedCylinderGraph())
    expect(controls.systemType).toBe('unvented_cylinder')
  })

  it('infers vented_cylinder for a graph with a vented cylinder', () => {
    const controls = graphToLabControls(ventedCylinderGraph())
    expect(controls.systemType).toBe('vented_cylinder')
  })

  it('falls back to combi for an empty graph', () => {
    const controls = graphToLabControls(emptyGraph())
    expect(controls.systemType).toBe('combi')
  })

  it('patch systemType overrides topology inference', () => {
    // Graph has no combi boiler but patch says combi
    const controls = graphToLabControls(unventedCylinderGraph(), { systemType: 'combi' })
    expect(controls.systemType).toBe('combi')
  })
})

// ── Cylinder defaults ──────────────────────────────────────────────────────────

describe('graphToLabControls — cylinder defaults', () => {
  it('adds cylinder defaults for unvented_cylinder topology', () => {
    const controls = graphToLabControls(unventedCylinderGraph())
    expect(controls.cylinder).toBeDefined()
    expect(controls.cylinder?.volumeL).toBe(180)
    expect(controls.cylinder?.initialTempC).toBe(55)
    expect(controls.cylinder?.reheatKw).toBe(12)
  })

  it('adds vented defaults for vented_cylinder topology', () => {
    const controls = graphToLabControls(ventedCylinderGraph())
    expect(controls.vented).toBeDefined()
    expect(controls.vented?.headMeters).toBe(3)
  })

  it('does not add cylinder defaults for combi graph', () => {
    const controls = graphToLabControls(combiGraph())
    expect(controls.cylinder).toBeUndefined()
    expect(controls.vented).toBeUndefined()
  })
})

// ── graphFacts and outletBindings always come from graph ──────────────────────

describe('graphToLabControls — graphFacts pinned to graph', () => {
  it('derives graphFacts.hotFedOutletNodeIds from graph topology', () => {
    const controls = graphToLabControls(combiGraph())
    // shower_outlet 'sh' is connected to hot_out so it should be hot-fed
    expect(controls.graphFacts?.hotFedOutletNodeIds).toContain('sh')
  })

  it('graphFacts patch override is ignored — always uses live graph', () => {
    const controls = graphToLabControls(combiGraph(), {
      graphFacts: { hotFedOutletNodeIds: ['stale_id'], coldOnlyOutletNodeIds: [], hasStoredDhw: false },
    })
    expect(controls.graphFacts?.hotFedOutletNodeIds).not.toContain('stale_id')
  })

  it('copies outletBindings from graph', () => {
    const controls = graphToLabControls(combiGraph())
    expect(controls.outletBindings).toEqual({ A: 'sh' })
  })
})

// ── Patch merging ──────────────────────────────────────────────────────────────

describe('graphToLabControls — patch merging', () => {
  it('applies combiDhwKw from patch', () => {
    const controls = graphToLabControls(combiGraph(), { combiDhwKw: 40 })
    expect(controls.combiDhwKw).toBe(40)
  })

  it('applies coldInletC from patch', () => {
    const controls = graphToLabControls(combiGraph(), { coldInletC: 5 })
    expect(controls.coldInletC).toBe(5)
  })

  it('falls back to default mainsDynamicFlowLpm when patch omits it', () => {
    const controls = graphToLabControls(combiGraph())
    expect(controls.mainsDynamicFlowLpm).toBe(14)
  })
})

// ── hasHeatingCircuit propagation ─────────────────────────────────────────────

function systemWithRadiatorLoopGraph(): BuildGraph {
  return {
    nodes: [
      { id: 'hs',  kind: 'heat_source_system_boiler', x: 100, y: 100, r: 0 },
      { id: 'cyl', kind: 'dhw_unvented_cylinder',     x: 300, y: 100, r: 0 },
      { id: 'rad', kind: 'radiator_loop',             x: 300, y: 300, r: 0 },
    ],
    edges: [],
  }
}

function systemWithUfhLoopGraph(): BuildGraph {
  return {
    nodes: [
      { id: 'hs',  kind: 'heat_source_system_boiler', x: 100, y: 100, r: 0 },
      { id: 'ufh', kind: 'ufh_loop',                  x: 300, y: 300, r: 0 },
    ],
    edges: [],
  }
}

describe('graphToLabControls — hasHeatingCircuit in graphFacts', () => {
  it('sets hasHeatingCircuit true when graph has a radiator_loop', () => {
    const controls = graphToLabControls(systemWithRadiatorLoopGraph())
    expect(controls.graphFacts?.hasHeatingCircuit).toBe(true)
  })

  it('sets hasHeatingCircuit true when graph has a ufh_loop', () => {
    const controls = graphToLabControls(systemWithUfhLoopGraph())
    expect(controls.graphFacts?.hasHeatingCircuit).toBe(true)
  })

  it('sets hasHeatingCircuit false when graph has no heating emitters', () => {
    const controls = graphToLabControls(combiGraph())
    expect(controls.graphFacts?.hasHeatingCircuit).toBe(false)
  })

  it('sets hasHeatingCircuit false for a DHW-only system (no emitters)', () => {
    const controls = graphToLabControls(unventedCylinderGraph())
    expect(controls.graphFacts?.hasHeatingCircuit).toBe(false)
  })
})

function sPlanGraph(): BuildGraph {
  // System boiler + 2 zone valves = S-plan topology
  return {
    nodes: [
      { id: 'hs',   kind: 'heat_source_system_boiler', x: 100, y: 200, r: 0 },
      { id: 'cyl',  kind: 'dhw_unvented_cylinder',     x: 400, y: 100, r: 0 },
      { id: 'rads', kind: 'radiator',                  x: 400, y: 300, r: 0 },
      { id: 'zv1',  kind: 'zone_valve',                x: 280, y: 100, r: 0 },
      { id: 'zv2',  kind: 'zone_valve',                x: 280, y: 300, r: 0 },
    ],
    edges: [],
  }
}

function yPlanGraph(): BuildGraph {
  // Regular boiler + 3-port valve = Y-plan topology
  return {
    nodes: [
      { id: 'hs',  kind: 'heat_source_regular_boiler', x: 100, y: 200, r: 0 },
      { id: 'cyl', kind: 'dhw_vented_cylinder',        x: 400, y: 100, r: 0 },
      { id: 'rads', kind: 'radiator',                  x: 400, y: 300, r: 0 },
      { id: 'v3',  kind: 'three_port_valve',           x: 280, y: 200, r: 0 },
    ],
    edges: [],
  }
}

describe('graphToLabControls — controlTopology derivation', () => {
  it('derives s_plan topology for a graph with 2 zone valves', () => {
    const controls = graphToLabControls(sPlanGraph())
    expect(controls.controlTopology).toBe('s_plan')
  })

  it('derives y_plan topology for a graph with a three-port valve', () => {
    const controls = graphToLabControls(yPlanGraph())
    expect(controls.controlTopology).toBe('y_plan')
  })

  it('derives none topology for a plain combi graph', () => {
    const controls = graphToLabControls(combiGraph())
    expect(controls.controlTopology).toBe('none')
  })

  it('controlTopology is always derived from graph — patch cannot override it', () => {
    // Even if someone passes a stale/wrong topology in the patch, the graph wins
    const controls = graphToLabControls(sPlanGraph(), { controlTopology: 'none' })
    expect(controls.controlTopology).toBe('s_plan')
  })
})

// ── systemKind — single-source-of-truth from graph ────────────────────────────

function heatPumpGraph(): BuildGraph {
  return {
    nodes: [
      { id: 'hp',  kind: 'heat_source_heat_pump',     x: 100, y: 100, r: 0 },
      { id: 'cyl', kind: 'dhw_unvented_cylinder',     x: 300, y: 100, r: 0 },
    ],
    edges: [],
  }
}

describe('graphToLabControls — systemKind derived from graph', () => {
  it('sets systemKind combi for a combi graph', () => {
    const controls = graphToLabControls(combiGraph())
    expect(controls.systemKind).toBe('combi')
  })

  it('sets systemKind stored for an unvented cylinder graph', () => {
    const controls = graphToLabControls(unventedCylinderGraph())
    expect(controls.systemKind).toBe('stored')
  })

  it('sets systemKind stored for a vented cylinder graph', () => {
    const controls = graphToLabControls(ventedCylinderGraph())
    expect(controls.systemKind).toBe('stored')
  })

  it('sets systemKind heat_pump for a heat pump graph', () => {
    const controls = graphToLabControls(heatPumpGraph())
    expect(controls.systemKind).toBe('heat_pump')
  })

  it('systemKind is always from graph — patch cannot override it to combi', () => {
    // A stored-system graph must NOT be classified as combi even if the patch
    // tries to set systemType to combi.  systemKind is pinned to the graph.
    const controls = graphToLabControls(unventedCylinderGraph(), { systemType: 'combi' })
    expect(controls.systemKind).toBe('stored')
  })

  it('systemKind defaults to combi for empty graph', () => {
    const controls = graphToLabControls(emptyGraph())
    expect(controls.systemKind).toBe('combi')
  })
})

// ── isMixergy in graphFacts ───────────────────────────────────────────────────

function mixergyGraph(): BuildGraph {
  return {
    nodes: [
      { id: 'hs',  kind: 'heat_source_system_boiler', x: 100, y: 100, r: 0 },
      { id: 'mix', kind: 'dhw_mixergy',               x: 300, y: 100, r: 0 },
      { id: 'sh',  kind: 'shower_outlet',              x: 500, y: 100, r: 0 },
    ],
    edges: [
      { id: 'e1', from: { nodeId: 'mix', portId: 'hot_out' }, to: { nodeId: 'sh', portId: 'hot_in' } },
    ],
    outletBindings: { A: 'sh' },
  }
}

describe('graphToLabControls — isMixergy in graphFacts', () => {
  it('sets isMixergy true for a Mixergy cylinder graph', () => {
    const controls = graphToLabControls(mixergyGraph())
    expect(controls.graphFacts?.isMixergy).toBe(true)
  })

  it('isMixergy is false for a standard unvented cylinder graph', () => {
    const controls = graphToLabControls(unventedCylinderGraph())
    expect(controls.graphFacts?.isMixergy).toBe(false)
  })

  it('isMixergy is false for a combi graph', () => {
    const controls = graphToLabControls(combiGraph())
    expect(controls.graphFacts?.isMixergy).toBe(false)
  })
})

// ── zoneValveCount in graphFacts ──────────────────────────────────────────────

function sPlanMixergyGraph(): BuildGraph {
  return {
    nodes: [
      { id: 'hs',  kind: 'heat_source_system_boiler', x: 100, y: 100, r: 0 },
      { id: 'mix', kind: 'dhw_mixergy',               x: 300, y: 100, r: 0 },
      { id: 'zv1', kind: 'zone_valve',                x: 200, y:  80, r: 0 },
      { id: 'zv2', kind: 'zone_valve',                x: 200, y: 120, r: 0 },
    ],
    edges: [],
  }
}

describe('graphToLabControls — zoneValveCount in graphFacts', () => {
  it('sets zoneValveCount to 2 for an S-plan graph with two zone valves', () => {
    const controls = graphToLabControls(sPlanMixergyGraph())
    expect(controls.graphFacts?.zoneValveCount).toBe(2)
  })

  it('sets zoneValveCount to 0 for a combi graph with no zone valves', () => {
    const controls = graphToLabControls(combiGraph())
    expect(controls.graphFacts?.zoneValveCount).toBe(0)
  })

  it('sets zoneValveCount to 0 for an unvented cylinder graph with no zone valves', () => {
    const controls = graphToLabControls(unventedCylinderGraph())
    expect(controls.graphFacts?.zoneValveCount).toBe(0)
  })
})

// ── Dynamic outlet model ───────────────────────────────────────────────────────

describe('graphToLabControls — dynamic outlet model', () => {
  it('generates outlets from graph outlet nodes (not fixed 3 defaults)', () => {
    const controls = graphToLabControls(combiGraph())
    // combiGraph has 1 outlet node (shower_outlet 'sh') — should produce 1 outlet
    expect(controls.outlets).toHaveLength(1)
    expect(controls.outlets[0].id).toBe('A')
    expect(controls.outlets[0].kind).toBe('shower_mixer')
  })

  it('generates dynamic outlet for a graph with 4 outlet nodes', () => {
    const graph: BuildGraph = {
      nodes: [
        { id: 'hs', kind: 'heat_source_combi', x: 100, y: 100, r: 0 },
        { id: 'sh1', kind: 'shower_outlet',    x: 300, y:  50, r: 0 },
        { id: 'bt1', kind: 'bath_outlet',      x: 300, y: 150, r: 0 },
        { id: 'ct1', kind: 'cold_tap_outlet',  x: 300, y: 250, r: 0 },
      ],
      edges: [],
    }
    const controls = graphToLabControls(graph)
    // shower + bath + cold_tap = 3 OUTLET_PART_KINDS nodes
    expect(controls.outlets).toHaveLength(3)
  })

  it('assigns slot A to the first outlet, B to second, C to third', () => {
    const graph: BuildGraph = {
      nodes: [
        { id: 'hs', kind: 'heat_source_combi', x: 100, y: 100, r: 0 },
        { id: 'sh', kind: 'shower_outlet', x: 300, y:  50, r: 0 },
        { id: 'bt', kind: 'bath_outlet',   x: 300, y: 150, r: 0 },
        { id: 'ct', kind: 'cold_tap_outlet', x: 300, y: 250, r: 0 },
      ],
      edges: [],
    }
    const controls = graphToLabControls(graph)
    expect(controls.outlets).toHaveLength(3)
    const ids = controls.outlets.map(o => o.id)
    expect(ids).toContain('A')
    expect(ids).toContain('B')
    expect(ids).toContain('C')
  })

  it('sets serviceClass and coldSourceKind from outletModels', () => {
    const controls = graphToLabControls(combiGraph())
    // combiGraph shower is hot-fed, not cold-only
    const showerOutlet = controls.outlets.find(o => o.kind === 'shower_mixer')
    expect(showerOutlet).toBeDefined()
    // serviceClass should be set (either mixed or hot_only for a shower)
    expect(showerOutlet?.serviceClass).toBeDefined()
  })

  it('only the first outlet starts enabled', () => {
    const graph: BuildGraph = {
      nodes: [
        { id: 'hs', kind: 'heat_source_combi', x: 100, y: 100, r: 0 },
        { id: 'sh', kind: 'shower_outlet', x: 300, y:  50, r: 0 },
        { id: 'bt', kind: 'bath_outlet',   x: 300, y: 150, r: 0 },
      ],
      edges: [],
    }
    const controls = graphToLabControls(graph)
    const sortedById = [...controls.outlets].sort((a, b) => a.id.localeCompare(b.id))
    expect(sortedById[0].enabled).toBe(true)
    for (const o of sortedById.slice(1)) {
      expect(o.enabled).toBe(false)
    }
  })

  it('falls back to defaultOutlets() for empty graph (no outlet nodes)', () => {
    const controls = graphToLabControls(emptyGraph())
    // Empty graph → no outlet nodes → fall back to default 3 outlets
    expect(controls.outlets).toHaveLength(3)
    expect(controls.outlets.map(o => o.id)).toEqual(['A', 'B', 'C'])
  })

  it('outletBindings maps slot labels to builder node IDs', () => {
    const controls = graphToLabControls(combiGraph())
    expect(controls.outletBindings).toBeDefined()
    expect(controls.outletBindings!['A']).toBe('sh')
  })
})

// ── smartAttach — nextOutletSlot beyond C ─────────────────────────────────────
// (These tests exercise the slot-allocation logic indirectly via graphToLabControls)

describe('graphToLabControls — supports more than 3 outlets', () => {
  it('assigns slot D to a 4th outlet node', () => {
    const graph: BuildGraph = {
      nodes: [
        { id: 'hs',  kind: 'heat_source_combi', x: 100, y: 100, r: 0 },
        { id: 'sh1', kind: 'shower_outlet',     x: 300, y:  50, r: 0 },
        { id: 'bt1', kind: 'bath_outlet',       x: 300, y: 150, r: 0 },
        { id: 'ct1', kind: 'cold_tap_outlet',   x: 300, y: 250, r: 0 },
        { id: 'sh2', kind: 'shower_outlet',     x: 300, y: 350, r: 0 },
      ],
      edges: [],
    }
    const controls = graphToLabControls(graph)
    expect(controls.outlets).toHaveLength(4)
    const ids = controls.outlets.map(o => o.id).sort()
    expect(ids).toEqual(['A', 'B', 'C', 'D'])
  })
})
