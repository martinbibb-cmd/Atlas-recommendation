/**
 * storedTopology.test.ts — PR4 stored-system topology correctness tests.
 *
 * Validates that:
 *   1. `buildStoredTopology` dispatcher exists and routes to the correct builder.
 *   2. `buildStoredYPlan` generates a graph with correct Y-plan topology.
 *   3. `buildStoredSPlan` generates a graph with correct S-plan topology.
 *   4. Generated stored-system graphs pass `validateLabGraph` with no errors.
 *   5. Emitters are not connected to the cylinder body.
 *   6. Cylinder coil is on the primary domain, not heating.
 *   7. Cylinder domestic ports (cold_in / hot_out) use cold / dhw domains only.
 *   8. Combi system is not polluted by stored-system cylinder logic.
 */

import { describe, it, expect } from 'vitest'
import {
  buildStoredTopology,
  buildStoredYPlan,
  buildStoredSPlan,
  generateGraphFromConcept,
} from '../model/generateGraphFromConcept'
import {
  CANONICAL_COMBI,
  CANONICAL_REGULAR_BOILER,
  CANONICAL_SYSTEM_BOILER,
  CANONICAL_HEAT_PUMP,
} from '../model/types'
import { buildGraphToLabGraph } from '../types/graph'
import { validateLabGraph } from '../validation/validateLabGraph'

// ─── 1. buildStoredTopology dispatcher ───────────────────────────────────────

describe('buildStoredTopology — dispatcher', () => {
  it('routes y_plan to a graph with a three_port_valve', () => {
    const graph = buildStoredTopology(CANONICAL_REGULAR_BOILER)
    expect(graph.nodes.some(n => n.kind === 'three_port_valve')).toBe(true)
  })

  it('routes s_plan to a graph with zone valves (no three_port_valve)', () => {
    const graph = buildStoredTopology(CANONICAL_SYSTEM_BOILER)
    expect(graph.nodes.some(n => n.kind === 'zone_valve')).toBe(true)
    expect(graph.nodes.some(n => n.kind === 'three_port_valve')).toBe(false)
  })

  it('y_plan result includes dhw_vented_cylinder', () => {
    const graph = buildStoredTopology(CANONICAL_REGULAR_BOILER)
    expect(graph.nodes.some(n => n.kind === 'dhw_vented_cylinder')).toBe(true)
  })

  it('s_plan result includes dhw_unvented_cylinder', () => {
    const graph = buildStoredTopology(CANONICAL_SYSTEM_BOILER)
    expect(graph.nodes.some(n => n.kind === 'dhw_unvented_cylinder')).toBe(true)
  })
})

// ─── 2. buildStoredYPlan — Y-plan topology ────────────────────────────────────

describe('buildStoredYPlan — topology correctness', () => {
  const graph = buildStoredYPlan('vented_cylinder', ['radiators'])

  it('includes a heat_source_regular_boiler', () => {
    expect(graph.nodes.some(n => n.kind === 'heat_source_regular_boiler')).toBe(true)
  })

  it('includes a three_port_valve', () => {
    expect(graph.nodes.some(n => n.kind === 'three_port_valve')).toBe(true)
  })

  it('includes a dhw_vented_cylinder', () => {
    expect(graph.nodes.some(n => n.kind === 'dhw_vented_cylinder')).toBe(true)
  })

  it('includes a radiator_loop', () => {
    expect(graph.nodes.some(n => n.kind === 'radiator_loop')).toBe(true)
  })

  it('includes cws_cistern for open-vented circuit', () => {
    expect(graph.nodes.some(n => n.kind === 'cws_cistern')).toBe(true)
  })

  it('valve out_a connects to radiator_loop (heating branch)', () => {
    const v3 = graph.nodes.find(n => n.kind === 'three_port_valve')!
    const rads = graph.nodes.find(n => n.kind === 'radiator_loop')!
    const edge = graph.edges.find(
      e => e.from.nodeId === v3.id && e.to.nodeId === rads.id,
    )
    expect(edge).toBeDefined()
    expect(edge!.domain).toBe('heating')
  })

  it('valve out_b connects to cylinder coil_flow (primary branch)', () => {
    const v3  = graph.nodes.find(n => n.kind === 'three_port_valve')!
    const cyl = graph.nodes.find(n => n.kind === 'dhw_vented_cylinder')!
    const edge = graph.edges.find(
      e => e.from.nodeId === v3.id && e.to.nodeId === cyl.id && e.to.portId === 'coil_flow',
    )
    expect(edge).toBeDefined()
    expect(edge!.domain).toBe('primary')
  })

  it('radiator_loop is NOT connected to the cylinder', () => {
    const rads = graph.nodes.find(n => n.kind === 'radiator_loop')!
    const cyl  = graph.nodes.find(n => n.kind === 'dhw_vented_cylinder')!
    const hasDirectLink = graph.edges.some(
      e =>
        (e.from.nodeId === rads.id && e.to.nodeId === cyl.id) ||
        (e.from.nodeId === cyl.id && e.to.nodeId === rads.id),
    )
    expect(hasDirectLink).toBe(false)
  })

  it('cylinder coil_return returns to boiler on primary domain (not coil_return port)', () => {
    const hs  = graph.nodes.find(n => n.kind === 'heat_source_regular_boiler')!
    const cyl = graph.nodes.find(n => n.kind === 'dhw_vented_cylinder')!
    const coilReturn = graph.edges.find(
      e => e.from.nodeId === cyl.id && e.from.portId === 'coil_return' && e.to.nodeId === hs.id,
    )
    expect(coilReturn).toBeDefined()
    expect(coilReturn!.domain).toBe('primary')
    // The boiler-side port must NOT be 'coil_return' (that is a cylinder-only port)
    expect(coilReturn!.to.portId).not.toBe('coil_return')
  })

  it('cylinder hot_out connects to manifold on dhw domain', () => {
    const cyl = graph.nodes.find(n => n.kind === 'dhw_vented_cylinder')!
    const hotEdge = graph.edges.find(
      e => e.from.nodeId === cyl.id && e.from.portId === 'hot_out',
    )
    expect(hotEdge).toBeDefined()
    expect(hotEdge!.domain).toBe('dhw')
  })

  it('cylinder cold_in receives on cold domain (from CWS or manifold)', () => {
    const cyl = graph.nodes.find(n => n.kind === 'dhw_vented_cylinder')!
    const coldEdge = graph.edges.find(
      e => e.to.nodeId === cyl.id && e.to.portId === 'cold_in',
    )
    expect(coldEdge).toBeDefined()
    expect(coldEdge!.domain).toBe('cold')
  })
})

// ─── 3. buildStoredSPlan — S-plan topology ────────────────────────────────────

describe('buildStoredSPlan — topology correctness', () => {
  const graph = buildStoredSPlan('unvented_cylinder', ['radiators'])

  it('includes a heat_source_system_boiler', () => {
    expect(graph.nodes.some(n => n.kind === 'heat_source_system_boiler')).toBe(true)
  })

  it('includes exactly two zone_valve nodes', () => {
    expect(graph.nodes.filter(n => n.kind === 'zone_valve').length).toBe(2)
  })

  it('includes a dhw_unvented_cylinder', () => {
    expect(graph.nodes.some(n => n.kind === 'dhw_unvented_cylinder')).toBe(true)
  })

  it('includes a radiator_loop', () => {
    expect(graph.nodes.some(n => n.kind === 'radiator_loop')).toBe(true)
  })

  it('CH zone_valve connects to radiator_loop (heating domain)', () => {
    const rads = graph.nodes.find(n => n.kind === 'radiator_loop')!
    const edgeToRads = graph.edges.find(
      e => e.to.nodeId === rads.id && e.to.portId === 'flow_in',
    )
    expect(edgeToRads).toBeDefined()
    expect(edgeToRads!.domain).toBe('heating')
    // Source must be zone_valve, not the cylinder
    const cylIds = new Set(
      graph.nodes.filter(n =>
        n.kind === 'dhw_unvented_cylinder' ||
        n.kind === 'dhw_vented_cylinder' ||
        n.kind === 'dhw_mixergy',
      ).map(n => n.id),
    )
    expect(cylIds.has(edgeToRads!.from.nodeId)).toBe(false)
  })

  it('HW zone_valve connects to cylinder coil_flow (primary domain)', () => {
    const cyl = graph.nodes.find(n => n.kind === 'dhw_unvented_cylinder')!
    const coilEdge = graph.edges.find(
      e => e.to.nodeId === cyl.id && e.to.portId === 'coil_flow',
    )
    expect(coilEdge).toBeDefined()
    expect(coilEdge!.domain).toBe('primary')
    // Source must be zone_valve, not radiator_loop
    const radNode = graph.nodes.find(n => n.kind === 'radiator_loop')
    if (radNode) {
      expect(coilEdge!.from.nodeId).not.toBe(radNode.id)
    }
  })

  it('radiator_loop is NOT directly connected to the cylinder', () => {
    const rads = graph.nodes.find(n => n.kind === 'radiator_loop')!
    const cyl  = graph.nodes.find(n => n.kind === 'dhw_unvented_cylinder')!
    const hasDirectLink = graph.edges.some(
      e =>
        (e.from.nodeId === rads.id && e.to.nodeId === cyl.id) ||
        (e.from.nodeId === cyl.id && e.to.nodeId === rads.id),
    )
    expect(hasDirectLink).toBe(false)
  })

  it('cylinder coil_return returns to boiler on primary domain (not coil_return port)', () => {
    const hs  = graph.nodes.find(n => n.kind === 'heat_source_system_boiler')!
    const cyl = graph.nodes.find(n => n.kind === 'dhw_unvented_cylinder')!
    const coilReturn = graph.edges.find(
      e => e.from.nodeId === cyl.id && e.from.portId === 'coil_return' && e.to.nodeId === hs.id,
    )
    expect(coilReturn).toBeDefined()
    expect(coilReturn!.domain).toBe('primary')
    expect(coilReturn!.to.portId).not.toBe('coil_return')
  })

  it('cylinder hot_out on dhw domain, cold_in on cold domain', () => {
    const cyl = graph.nodes.find(n => n.kind === 'dhw_unvented_cylinder')!
    const hotEdge = graph.edges.find(
      e => e.from.nodeId === cyl.id && e.from.portId === 'hot_out',
    )
    const coldEdge = graph.edges.find(
      e => e.to.nodeId === cyl.id && e.to.portId === 'cold_in',
    )
    expect(hotEdge?.domain).toBe('dhw')
    expect(coldEdge?.domain).toBe('cold')
  })
})

// ─── 4. validateLabGraph passes for all canonical presets ────────────────────

describe('validateLabGraph — no errors for canonical presets', () => {
  const presets = [
    { name: 'Combi',                   model: CANONICAL_COMBI },
    { name: 'Regular Boiler (Y-plan)', model: CANONICAL_REGULAR_BOILER },
    { name: 'System Boiler (S-plan)',  model: CANONICAL_SYSTEM_BOILER },
    { name: 'Heat Pump',               model: CANONICAL_HEAT_PUMP },
  ]

  for (const { name, model } of presets) {
    it(`${name}: no validation errors (ok = true)`, () => {
      const buildGraph = generateGraphFromConcept(model)
      const labGraph   = buildGraphToLabGraph(buildGraph)
      const result     = validateLabGraph(labGraph)
      const errors     = result.issues.filter(i => i.severity === 'error')
      expect(errors, `${name} has errors: ${JSON.stringify(errors)}`).toHaveLength(0)
      expect(result.ok).toBe(true)
    })
  }
})

// ─── 5. Combi not polluted by stored-system logic ────────────────────────────

describe('Combi — no stored-system cylinder logic injected', () => {
  const graph = generateGraphFromConcept(CANONICAL_COMBI)

  it('combi graph has no cylinder nodes', () => {
    const cylinderKinds = ['dhw_vented_cylinder', 'dhw_unvented_cylinder', 'dhw_mixergy']
    expect(graph.nodes.some(n => cylinderKinds.includes(n.kind))).toBe(false)
  })

  it('combi graph has no coil_flow or coil_return edges', () => {
    const hasCoilEdge = graph.edges.some(
      e => e.from.portId === 'coil_flow' || e.from.portId === 'coil_return' ||
           e.to.portId   === 'coil_flow' || e.to.portId   === 'coil_return',
    )
    expect(hasCoilEdge).toBe(false)
  })

  it('combi graph has no zone_valve or three_port_valve', () => {
    expect(graph.nodes.some(n => n.kind === 'zone_valve')).toBe(false)
    expect(graph.nodes.some(n => n.kind === 'three_port_valve')).toBe(false)
  })

  it('combi validateLabGraph returns ok=true', () => {
    const labGraph = buildGraphToLabGraph(graph)
    const result   = validateLabGraph(labGraph)
    expect(result.ok).toBe(true)
  })
})
