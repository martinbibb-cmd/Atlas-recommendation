/**
 * Tests for tee.ts — auto-tee insertion logic.
 */

import { describe, it, expect } from 'vitest'
import { teeKindForRole, insertTee } from '../builder/tee'
import type { BuildGraph } from '../builder/types'

// ─── teeKindForRole ──────────────────────────────────────────────────────────

describe('teeKindForRole', () => {
  it('maps hot → tee_hot', () => expect(teeKindForRole('hot')).toBe('tee_hot'))
  it('maps cold → tee_cold', () => expect(teeKindForRole('cold')).toBe('tee_cold'))
  it('maps return → tee_ch_return', () => expect(teeKindForRole('return')).toBe('tee_ch_return'))
  it('maps flow → tee_ch_flow', () => expect(teeKindForRole('flow')).toBe('tee_ch_flow'))
  it('maps undefined → tee_ch_flow', () => expect(teeKindForRole(undefined)).toBe('tee_ch_flow'))
  it('maps unknown → tee_ch_flow', () => expect(teeKindForRole('unknown')).toBe('tee_ch_flow'))
})

// ─── insertTee ────────────────────────────────────────────────────────────────

function baseGraph(): BuildGraph {
  return {
    nodes: [
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      { id: 'shower', kind: 'shower_outlet', x: 300, y: 0, r: 0 },
    ],
    edges: [
      {
        id: 'e1',
        from: { nodeId: 'combi', portId: 'hot_out' },
        to: { nodeId: 'shower', portId: 'hot_in' },
      },
    ],
  }
}

describe('insertTee', () => {
  it('inserts a tee node when target port is already occupied', () => {
    const graph = baseGraph()
    const bath = { id: 'bath', kind: 'bath_outlet' as const, x: 300, y: 100, r: 0 }
    graph.nodes.push(bath)

    const result = insertTee({
      graph,
      target: { nodeId: 'combi', portId: 'hot_out' },
      incoming: { nodeId: 'bath', portId: 'hot_in' },
      role: 'hot',
    })

    const teeNode = result.nodes.find(n => n.kind === 'tee_hot')
    expect(teeNode).toBeDefined()
    expect(result.nodes).toHaveLength(4) // combi + shower + bath + tee
  })

  it('removes the original edge and replaces with three tee edges', () => {
    const graph = baseGraph()
    const bath = { id: 'bath', kind: 'bath_outlet' as const, x: 300, y: 100, r: 0 }
    graph.nodes.push(bath)

    const result = insertTee({
      graph,
      target: { nodeId: 'combi', portId: 'hot_out' },
      incoming: { nodeId: 'bath', portId: 'hot_in' },
      role: 'hot',
    })

    // Original edge e1 should be gone; 3 new edges added
    expect(result.edges.find(e => e.id === 'e1')).toBeUndefined()
    expect(result.edges).toHaveLength(3)

    const teeNode = result.nodes.find(n => n.kind === 'tee_hot')!
    const teeId = teeNode.id

    // combi hot_out → tee.in
    expect(result.edges.some(
      e => e.from.nodeId === 'combi' && e.from.portId === 'hot_out' &&
           e.to.nodeId === teeId && e.to.portId === 'in',
    )).toBe(true)

    // shower hot_in → tee.out2 (was the original "other end")
    expect(result.edges.some(
      e => e.from.nodeId === 'shower' && e.from.portId === 'hot_in' &&
           e.to.nodeId === teeId && e.to.portId === 'out2',
    )).toBe(true)

    // bath hot_in → tee.out1 (the incoming)
    expect(result.edges.some(
      e => e.from.nodeId === 'bath' && e.from.portId === 'hot_in' &&
           e.to.nodeId === teeId && e.to.portId === 'out1',
    )).toBe(true)
  })

  it('handles no existing edge on target: adds 2 edges via tee', () => {
    const graph: BuildGraph = {
      nodes: [
        { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
        { id: 'shower', kind: 'shower_outlet', x: 300, y: 0, r: 0 },
      ],
      edges: [],
    }

    const result = insertTee({
      graph,
      target: { nodeId: 'combi', portId: 'hot_out' },
      incoming: { nodeId: 'shower', portId: 'hot_in' },
      role: 'hot',
    })

    const teeNode = result.nodes.find(n => n.kind === 'tee_hot')
    expect(teeNode).toBeDefined()
    expect(result.edges).toHaveLength(2)
  })

  it('uses tee_cold for cold role', () => {
    const graph: BuildGraph = {
      nodes: [
        { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
        { id: 'shower', kind: 'shower_outlet', x: 300, y: 0, r: 0 },
      ],
      edges: [
        {
          id: 'e1',
          from: { nodeId: 'combi', portId: 'cold_in' },
          to: { nodeId: 'shower', portId: 'cold_in' },
        },
      ],
    }
    const bath = { id: 'bath', kind: 'bath_outlet' as const, x: 300, y: 100, r: 0 }
    graph.nodes.push(bath)

    const result = insertTee({
      graph,
      target: { nodeId: 'combi', portId: 'cold_in' },
      incoming: { nodeId: 'bath', portId: 'cold_in' },
      role: 'cold',
    })

    expect(result.nodes.find(n => n.kind === 'tee_cold')).toBeDefined()
  })

  it('places tee near the target node', () => {
    const graph = baseGraph()
    const bath = { id: 'bath', kind: 'bath_outlet' as const, x: 300, y: 100, r: 0 }
    graph.nodes.push(bath)

    const result = insertTee({
      graph,
      target: { nodeId: 'combi', portId: 'hot_out' },
      incoming: { nodeId: 'bath', portId: 'hot_in' },
      role: 'hot',
    })

    const teeNode = result.nodes.find(n => n.kind === 'tee_hot')!
    // tee should be near combi (x=0), offset by 40
    expect(teeNode.x).toBeCloseTo(40, 0)
    expect(teeNode.y).toBeCloseTo(40, 0)
  })

  it('does not mutate the original graph', () => {
    const graph = baseGraph()
    const bath = { id: 'bath', kind: 'bath_outlet' as const, x: 300, y: 100, r: 0 }
    graph.nodes.push(bath)

    const originalNodeCount = graph.nodes.length
    const originalEdgeCount = graph.edges.length

    insertTee({
      graph,
      target: { nodeId: 'combi', portId: 'hot_out' },
      incoming: { nodeId: 'bath', portId: 'hot_in' },
      role: 'hot',
    })

    expect(graph.nodes).toHaveLength(originalNodeCount)
    expect(graph.edges).toHaveLength(originalEdgeCount)
  })
})
