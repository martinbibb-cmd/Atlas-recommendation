/**
 * Tests for smartAdd — auto-connect "click-in" heuristics.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { smartAdd } from '../builder/smartAttach'
import type { BuildGraph } from '../builder/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyGraph(): BuildGraph {
  return { nodes: [], edges: [] }
}

function graphWith(kinds: Array<{ kind: Parameters<typeof smartAdd>[1]; id?: string }>): BuildGraph {
  let g = emptyGraph()
  for (const { kind } of kinds) {
    g = smartAdd(g, kind).nextGraph
  }
  return g
}

function findNode(g: BuildGraph, kind: string) {
  return g.nodes.find(n => n.kind === kind)
}

function hasEdge(g: BuildGraph, fromKind: string, fromPort: string, toKind: string, toPort: string) {
  const fromNode = g.nodes.find(n => n.kind === fromKind)
  const toNode = g.nodes.find(n => n.kind === toKind)
  if (!fromNode || !toNode) return false
  return g.edges.some(
    e =>
      ((e.from.nodeId === fromNode.id && e.from.portId === fromPort &&
        e.to.nodeId === toNode.id && e.to.portId === toPort) ||
       (e.from.nodeId === toNode.id && e.from.portId === toPort &&
        e.to.nodeId === fromNode.id && e.to.portId === fromPort)),
  )
}

// ─── Placement ────────────────────────────────────────────────────────────────

describe('smartAdd — placement', () => {
  it('places the first node at a reasonable position', () => {
    const { nextGraph, placedNodeId } = smartAdd(emptyGraph(), 'heat_source_combi')
    const node = nextGraph.nodes.find(n => n.id === placedNodeId)
    expect(node).toBeDefined()
    expect(node!.x).toBeGreaterThan(0)
    expect(node!.y).toBeGreaterThan(0)
  })

  it('returns the id of the newly placed node', () => {
    const { nextGraph, placedNodeId } = smartAdd(emptyGraph(), 'heat_source_combi')
    expect(nextGraph.nodes.some(n => n.id === placedNodeId)).toBe(true)
  })
})

// ─── Emitters → CH loop ──────────────────────────────────────────────────────

describe('smartAdd — emitters: flow + auto-common return', () => {
  it('auto-connects rads flow_in to combi flow_out and also wires return', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_combi').nextGraph
    g = smartAdd(g, 'radiator_loop').nextGraph

    expect(hasEdge(g, 'heat_source_combi', 'flow_out', 'radiator_loop', 'flow_in')).toBe(true)
    // Auto-common return: return leg is now wired automatically
    expect(hasEdge(g, 'radiator_loop', 'return_out', 'heat_source_combi', 'return_in')).toBe(true)
  })

  it('auto-connects UFH flow_in to system boiler flow_out and also wires return', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_system_boiler').nextGraph
    g = smartAdd(g, 'ufh_loop').nextGraph

    expect(hasEdge(g, 'heat_source_system_boiler', 'flow_out', 'ufh_loop', 'flow_in')).toBe(true)
    expect(hasEdge(g, 'ufh_loop', 'return_out', 'heat_source_system_boiler', 'return_in')).toBe(true)
  })

  it('auto-connects radiator flow_in to heat pump flow_out and also wires return', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_heat_pump').nextGraph
    g = smartAdd(g, 'radiator_loop').nextGraph

    expect(hasEdge(g, 'heat_source_heat_pump', 'flow_out', 'radiator_loop', 'flow_in')).toBe(true)
    expect(hasEdge(g, 'radiator_loop', 'return_out', 'heat_source_heat_pump', 'return_in')).toBe(true)
  })

  it('does not create duplicate flow edges if radiator added twice', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_combi').nextGraph
    g = smartAdd(g, 'radiator_loop').nextGraph
    g = smartAdd(g, 'radiator_loop').nextGraph
    // Both rads get their own flow_in connected — check no duplicates
    const flowEdges = g.edges.filter(
      e => e.from.portId === 'flow_out' || e.to.portId === 'flow_out',
    )
    expect(flowEdges.length).toBe(2) // one per rad loop
  })
})

// ─── Vented cylinder auto-adds CWS ───────────────────────────────────────────

describe('smartAdd — vented cylinder', () => {
  it('auto-adds CWS cistern when adding a vented cylinder with none present', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_regular_boiler').nextGraph
    g = smartAdd(g, 'dhw_vented_cylinder').nextGraph

    const cws = findNode(g, 'cws_cistern')
    expect(cws).toBeDefined()
  })

  it('auto-connects CWS cold_out to vented cylinder cold_in', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_regular_boiler').nextGraph
    g = smartAdd(g, 'dhw_vented_cylinder').nextGraph

    expect(hasEdge(g, 'cws_cistern', 'cold_out', 'dhw_vented_cylinder', 'cold_in')).toBe(true)
  })

  it('does not add a second CWS if one already exists', () => {
    let g = smartAdd(emptyGraph(), 'cws_cistern').nextGraph
    g = smartAdd(g, 'dhw_vented_cylinder').nextGraph

    const cwsNodes = g.nodes.filter(n => n.kind === 'cws_cistern')
    expect(cwsNodes.length).toBe(1)
  })

  it('does not auto-connect cylinder coil to regular boiler (boiler has no coil ports)', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_regular_boiler').nextGraph
    g = smartAdd(g, 'dhw_vented_cylinder').nextGraph

    // Boiler no longer has coil_flow/coil_return ports — no direct coil-to-coil connection
    expect(
      hasEdge(g, 'heat_source_regular_boiler', 'coil_flow', 'dhw_vented_cylinder', 'coil_flow'),
    ).toBe(false)
    expect(
      hasEdge(g, 'dhw_vented_cylinder', 'coil_return', 'heat_source_regular_boiler', 'coil_return'),
    ).toBe(false)
  })

  it('auto-wires cylinder coil_flow from regular boiler flow_out', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_regular_boiler').nextGraph
    g = smartAdd(g, 'dhw_vented_cylinder').nextGraph

    expect(
      hasEdge(g, 'heat_source_regular_boiler', 'flow_out', 'dhw_vented_cylinder', 'coil_flow'),
    ).toBe(true)
  })

  it('auto-wires cylinder coil_return to regular boiler return_in', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_regular_boiler').nextGraph
    g = smartAdd(g, 'dhw_vented_cylinder').nextGraph

    expect(
      hasEdge(g, 'dhw_vented_cylinder', 'coil_return', 'heat_source_regular_boiler', 'return_in'),
    ).toBe(true)
  })
})

// ─── Unvented / Mixergy cylinder ─────────────────────────────────────────────

describe('smartAdd — unvented and Mixergy cylinder', () => {
  it('does not create a coil_flow↔coil_flow edge (ports do not exist on boiler)', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_system_boiler').nextGraph
    g = smartAdd(g, 'dhw_unvented_cylinder').nextGraph

    expect(
      hasEdge(g, 'heat_source_system_boiler', 'coil_flow', 'dhw_unvented_cylinder', 'coil_flow'),
    ).toBe(false)
  })

  it('auto-wires unvented cylinder coil_flow from system boiler flow_out', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_system_boiler').nextGraph
    g = smartAdd(g, 'dhw_unvented_cylinder').nextGraph

    expect(
      hasEdge(g, 'heat_source_system_boiler', 'flow_out', 'dhw_unvented_cylinder', 'coil_flow'),
    ).toBe(true)
  })

  it('auto-wires unvented cylinder coil_return to system boiler return_in', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_system_boiler').nextGraph
    g = smartAdd(g, 'dhw_unvented_cylinder').nextGraph

    expect(
      hasEdge(g, 'dhw_unvented_cylinder', 'coil_return', 'heat_source_system_boiler', 'return_in'),
    ).toBe(true)
  })

  it('does not create a coil_flow↔coil_flow edge for Mixergy (ports do not exist on boiler)', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_system_boiler').nextGraph
    g = smartAdd(g, 'dhw_mixergy').nextGraph

    expect(hasEdge(g, 'heat_source_system_boiler', 'coil_flow', 'dhw_mixergy', 'coil_flow')).toBe(
      false,
    )
  })

  it('auto-wires Mixergy coil_flow from system boiler flow_out', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_system_boiler').nextGraph
    g = smartAdd(g, 'dhw_mixergy').nextGraph

    expect(
      hasEdge(g, 'heat_source_system_boiler', 'flow_out', 'dhw_mixergy', 'coil_flow'),
    ).toBe(true)
  })

  it('does not add CWS when adding unvented cylinder', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_system_boiler').nextGraph
    g = smartAdd(g, 'dhw_unvented_cylinder').nextGraph

    expect(g.nodes.some(n => n.kind === 'cws_cistern')).toBe(false)
  })
})

// ─── Outlets ─────────────────────────────────────────────────────────────────

describe('smartAdd — outlets (hot + cold)', () => {
  it('connects shower to combi hot_out and cold_in when no cylinder', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_combi').nextGraph
    g = smartAdd(g, 'shower_outlet').nextGraph

    expect(hasEdge(g, 'heat_source_combi', 'hot_out', 'shower_outlet', 'hot_in')).toBe(true)
    expect(hasEdge(g, 'heat_source_combi', 'cold_in', 'shower_outlet', 'cold_in')).toBe(true)
  })

  it('connects tap to cylinder hot_out when cylinder is present', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_system_boiler').nextGraph
    g = smartAdd(g, 'dhw_unvented_cylinder').nextGraph
    g = smartAdd(g, 'tap_outlet').nextGraph

    expect(hasEdge(g, 'dhw_unvented_cylinder', 'hot_out', 'tap_outlet', 'hot_in')).toBe(true)
  })

  it('connects tap cold supply from cylinder cold_in (shared mains junction) on unvented stored system', () => {
    // Unvented cylinder — no CWS cistern, so cold rail is the cylinder's cold_in
    let g = smartAdd(emptyGraph(), 'heat_source_system_boiler').nextGraph
    g = smartAdd(g, 'dhw_unvented_cylinder').nextGraph
    g = smartAdd(g, 'tap_outlet').nextGraph

    expect(hasEdge(g, 'dhw_unvented_cylinder', 'cold_in', 'tap_outlet', 'cold_in')).toBe(true)
  })

  it('connects tap cold supply from CWS cold_out on vented stored system', () => {
    // Vented cylinder — CWS is auto-added and is the authoritative cold source
    let g = smartAdd(emptyGraph(), 'heat_source_regular_boiler').nextGraph
    g = smartAdd(g, 'dhw_vented_cylinder').nextGraph // auto-adds CWS
    g = smartAdd(g, 'tap_outlet').nextGraph

    expect(hasEdge(g, 'dhw_vented_cylinder', 'hot_out', 'tap_outlet', 'hot_in')).toBe(true)
    expect(hasEdge(g, 'cws_cistern', 'cold_out', 'tap_outlet', 'cold_in')).toBe(true)
    // Must NOT connect from cylinder cold_in (that's the CWS→cylinder feed, not a distribution rail)
    expect(hasEdge(g, 'dhw_vented_cylinder', 'cold_in', 'tap_outlet', 'cold_in')).toBe(false)
  })
})

// ─── Cold tap outlet ─────────────────────────────────────────────────────────

describe('smartAdd — cold_tap_outlet', () => {
  it('connects cold tap only to cold_in of combi (no hot)', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_combi').nextGraph
    g = smartAdd(g, 'cold_tap_outlet').nextGraph

    // Should have a cold connection
    const coldTapNode = findNode(g, 'cold_tap_outlet')!
    const edges = g.edges.filter(e => e.to.nodeId === coldTapNode.id || e.from.nodeId === coldTapNode.id)
    expect(edges.length).toBeGreaterThan(0)

    // Should never connect to a hot port
    const hotEdge = edges.find(
      e =>
        (e.from.nodeId === coldTapNode.id && e.from.portId === 'hot_in') ||
        (e.to.nodeId === coldTapNode.id && e.to.portId === 'hot_in'),
    )
    expect(hotEdge).toBeUndefined()
  })

  it('connects cold tap to CWS when available', () => {
    let g = smartAdd(emptyGraph(), 'cws_cistern').nextGraph
    g = smartAdd(g, 'cold_tap_outlet').nextGraph

    expect(hasEdge(g, 'cws_cistern', 'cold_out', 'cold_tap_outlet', 'cold_in')).toBe(true)
  })
})

// ─── Regular boiler safety tokens ────────────────────────────────────────────

describe('smartAdd — regular boiler safety tokens', () => {
  it('connects open vent vent_in to regular boiler flow_out', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_regular_boiler').nextGraph
    g = smartAdd(g, 'open_vent').nextGraph

    expect(
      hasEdge(g, 'heat_source_regular_boiler', 'flow_out', 'open_vent', 'vent_in'),
    ).toBe(true)
  })

  it('connects F&E feed_in to open vent vent_out when open vent is already present', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_regular_boiler').nextGraph
    g = smartAdd(g, 'open_vent').nextGraph
    g = smartAdd(g, 'feed_and_expansion').nextGraph

    expect(hasEdge(g, 'open_vent', 'vent_out', 'feed_and_expansion', 'feed_in')).toBe(true)
  })

  it('does not auto-connect open vent to a combi boiler', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_combi').nextGraph
    g = smartAdd(g, 'open_vent').nextGraph

    const ovNode = findNode(g, 'open_vent')!
    const ovEdges = g.edges.filter(
      e => e.from.nodeId === ovNode.id || e.to.nodeId === ovNode.id,
    )
    expect(ovEdges.length).toBe(0)
  })
})

// ─── Outlet bindings ─────────────────────────────────────────────────────────

describe('smartAdd — outlet bindings', () => {
  it('assigns first outlet to slot A', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_combi').nextGraph
    const { nextGraph, placedNodeId } = smartAdd(g, 'shower_outlet')

    expect(nextGraph.outletBindings?.A).toBe(placedNodeId)
  })

  it('assigns second outlet to slot B', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_combi').nextGraph
    g = smartAdd(g, 'shower_outlet').nextGraph
    const { nextGraph, placedNodeId } = smartAdd(g, 'bath_outlet')

    expect(nextGraph.outletBindings?.B).toBe(placedNodeId)
  })

  it('assigns cold_tap_outlet to next free slot', () => {
    let g = smartAdd(emptyGraph(), 'heat_source_combi').nextGraph
    const { nextGraph, placedNodeId } = smartAdd(g, 'cold_tap_outlet')

    expect(nextGraph.outletBindings?.A).toBe(placedNodeId)
  })

  it('does not bind non-outlet tokens', () => {
    const { nextGraph } = smartAdd(emptyGraph(), 'heat_source_combi')

    expect(nextGraph.outletBindings?.A).toBeUndefined()
  })
})

// ─── Heat source priority ─────────────────────────────────────────────────────

describe('smartAdd — anchor priority', () => {
  it('combi takes priority over heat pump as anchor', () => {
    // Add heat pump first, then combi, then rads — rads should connect to combi
    let g = smartAdd(emptyGraph(), 'heat_source_heat_pump').nextGraph
    g = smartAdd(g, 'heat_source_combi').nextGraph
    g = smartAdd(g, 'radiator_loop').nextGraph

    expect(hasEdge(g, 'heat_source_combi', 'flow_out', 'radiator_loop', 'flow_in')).toBe(true)
  })
})
