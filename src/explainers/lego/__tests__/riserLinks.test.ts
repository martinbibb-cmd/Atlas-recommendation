// src/explainers/lego/__tests__/riserLinks.test.ts
//
// Tests for multi-floor riser connectivity in graph.ts.
//
// Coverage:
//   - RiserLink type is accepted as data
//   - applyRiserLinks: no-op when links array is empty
//   - applyRiserLinks: re-targets edges whose toNodeId matches a groundNodeId
//   - applyRiserLinks: leaves edges unaffected when toNodeId does not match
//   - applyRiserLinks: preserves all other edge fields (domain, fromNodeId, ports)
//   - applyRiserLinks: handles multiple links independently
//   - applyRiserLinks: original nodes list is unchanged (riser nodes retained)

import { describe, it, expect } from 'vitest'
import type { LabGraph, LabEdge, LabNode, RiserLink } from '../types/graph'
import { applyRiserLinks } from '../types/graph'

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeNode(id: string): LabNode {
  return { id, kind: 'radiator_loop', x: 0, y: 0 }
}

function makeRiserNode(id: string): LabNode {
  return { id, kind: 'riser', x: 50, y: 50 }
}

function makeEdge(
  id: string,
  fromNodeId: string,
  toNodeId: string,
): LabEdge {
  return {
    id,
    fromNodeId,
    fromPort: 'flow',
    toNodeId,
    toPort: 'flow',
    domain: 'heating',
  }
}

// ─── applyRiserLinks ──────────────────────────────────────────────────────────

describe('applyRiserLinks', () => {
  it('returns the same graph (by reference) when links is empty', () => {
    const graph: LabGraph = {
      nodes: [makeNode('a'), makeNode('b')],
      edges: [makeEdge('e1', 'a', 'b')],
    }
    const result = applyRiserLinks(graph, [])
    expect(result).toBe(graph)
  })

  it('re-targets an edge to the first-floor riser when toNodeId matches groundNodeId', () => {
    const riserGround = makeRiserNode('riser_gnd')
    const riserFirst  = makeRiserNode('riser_1st')
    const boiler      = makeNode('boiler')
    const graph: LabGraph = {
      nodes: [boiler, riserGround, riserFirst],
      edges: [makeEdge('e1', 'boiler', 'riser_gnd')],
    }
    const link: RiserLink = { groundNodeId: 'riser_gnd', firstNodeId: 'riser_1st' }
    const result = applyRiserLinks(graph, [link])

    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].toNodeId).toBe('riser_1st')
    // fromNodeId must be unchanged
    expect(result.edges[0].fromNodeId).toBe('boiler')
  })

  it('leaves unrelated edges unchanged', () => {
    const riserGround = makeRiserNode('riser_gnd')
    const riserFirst  = makeRiserNode('riser_1st')
    const boiler      = makeNode('boiler')
    const rad         = makeNode('rad')
    const graph: LabGraph = {
      nodes: [boiler, riserGround, riserFirst, rad],
      edges: [
        makeEdge('e1', 'boiler', 'riser_gnd'),
        makeEdge('e2', 'boiler', 'rad'),
      ],
    }
    const link: RiserLink = { groundNodeId: 'riser_gnd', firstNodeId: 'riser_1st' }
    const result = applyRiserLinks(graph, [link])

    const e2 = result.edges.find(e => e.id === 'e2')!
    expect(e2.toNodeId).toBe('rad')
  })

  it('preserves domain and port roles on re-targeted edges', () => {
    const riserGround = makeRiserNode('riser_gnd')
    const riserFirst  = makeRiserNode('riser_1st')
    const graph: LabGraph = {
      nodes: [riserGround, riserFirst],
      edges: [
        {
          id: 'e1',
          fromNodeId: 'src',
          fromPort: 'coil_flow',
          toNodeId: 'riser_gnd',
          toPort: 'in',
          domain: 'primary',
        },
      ],
    }
    const link: RiserLink = { groundNodeId: 'riser_gnd', firstNodeId: 'riser_1st' }
    const result = applyRiserLinks(graph, [link])

    const edge = result.edges[0]
    expect(edge.fromPort).toBe('coil_flow')
    expect(edge.toPort).toBe('in')
    expect(edge.domain).toBe('primary')
  })

  it('handles multiple links independently', () => {
    const nodes: LabNode[] = [
      makeRiserNode('riser_gnd_a'),
      makeRiserNode('riser_1st_a'),
      makeRiserNode('riser_gnd_b'),
      makeRiserNode('riser_1st_b'),
    ]
    const graph: LabGraph = {
      nodes,
      edges: [
        makeEdge('e1', 'boilerA', 'riser_gnd_a'),
        makeEdge('e2', 'boilerB', 'riser_gnd_b'),
      ],
    }
    const links: RiserLink[] = [
      { groundNodeId: 'riser_gnd_a', firstNodeId: 'riser_1st_a' },
      { groundNodeId: 'riser_gnd_b', firstNodeId: 'riser_1st_b' },
    ]
    const result = applyRiserLinks(graph, links)

    expect(result.edges.find(e => e.id === 'e1')!.toNodeId).toBe('riser_1st_a')
    expect(result.edges.find(e => e.id === 'e2')!.toNodeId).toBe('riser_1st_b')
  })

  it('retains all original nodes (riser nodes are not removed)', () => {
    const riserGround = makeRiserNode('riser_gnd')
    const riserFirst  = makeRiserNode('riser_1st')
    const graph: LabGraph = {
      nodes: [riserGround, riserFirst],
      edges: [makeEdge('e1', 'src', 'riser_gnd')],
    }
    const result = applyRiserLinks(graph, [
      { groundNodeId: 'riser_gnd', firstNodeId: 'riser_1st' },
    ])
    const nodeIds = result.nodes.map(n => n.id)
    expect(nodeIds).toContain('riser_gnd')
    expect(nodeIds).toContain('riser_1st')
  })
})
