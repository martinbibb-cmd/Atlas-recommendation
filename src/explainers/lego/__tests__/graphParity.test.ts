// src/explainers/lego/__tests__/graphParity.test.ts
//
// Tests for the shared LabGraph types, buildGraphToLabGraph converter, and
// compareGraphShape parity helper introduced in PR1.
//
// PR1 goal: Edit mode owns one authoritative LabGraph; Play mode consumes a
// deep clone of that graph without any topology reconstruction.

import { describe, it, expect } from 'vitest'
import {
  buildGraphToLabGraph,
  compareGraphShape,
  type LabGraph,
} from '../types/graph'
import type { BuildGraph } from '../builder/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGraph(overrides: Partial<BuildGraph> = {}): BuildGraph {
  return {
    nodes: [
      { id: 'boiler-1', kind: 'heat_source_system_boiler', x: 100, y: 100, r: 0 },
      { id: 'pump-1',   kind: 'pump',                     x: 200, y: 100, r: 0 },
      { id: 'cyl-1',    kind: 'dhw_unvented_cylinder',    x: 300, y: 100, r: 0 },
    ],
    edges: [
      {
        id: 'edge-1',
        from: { nodeId: 'boiler-1', portId: 'flow' },
        to:   { nodeId: 'pump-1',   portId: 'in' },
      },
      {
        id: 'edge-2',
        from: { nodeId: 'pump-1',  portId: 'out' },
        to:   { nodeId: 'cyl-1',   portId: 'primary_in' },
      },
    ],
    ...overrides,
  }
}

// ─── buildGraphToLabGraph ────────────────────────────────────────────────────

describe('buildGraphToLabGraph', () => {
  it('converts nodes preserving id, kind, x, y', () => {
    const bg = makeGraph()
    const lg = buildGraphToLabGraph(bg)

    expect(lg.nodes).toHaveLength(3)

    const boiler = lg.nodes.find(n => n.id === 'boiler-1')
    expect(boiler).toBeDefined()
    expect(boiler?.kind).toBe('heat_source_system_boiler')
    expect(boiler?.x).toBe(100)
    expect(boiler?.y).toBe(100)
  })

  it('converts edges with fromNodeId / fromPort / toNodeId / toPort', () => {
    const bg = makeGraph()
    const lg = buildGraphToLabGraph(bg)

    expect(lg.edges).toHaveLength(2)

    const e1 = lg.edges.find(e => e.id === 'edge-1')
    expect(e1).toBeDefined()
    expect(e1?.fromNodeId).toBe('boiler-1')
    expect(e1?.fromPort).toBe('flow')
    expect(e1?.toNodeId).toBe('pump-1')
    expect(e1?.toPort).toBe('in')
  })

  it('preserves all node ids exactly', () => {
    const bg = makeGraph()
    const lg = buildGraphToLabGraph(bg)
    const ids = lg.nodes.map(n => n.id)
    expect(ids).toContain('boiler-1')
    expect(ids).toContain('pump-1')
    expect(ids).toContain('cyl-1')
  })

  it('preserves all edge ids exactly', () => {
    const bg = makeGraph()
    const lg = buildGraphToLabGraph(bg)
    const ids = lg.edges.map(e => e.id)
    expect(ids).toContain('edge-1')
    expect(ids).toContain('edge-2')
  })

  it('returns empty arrays for an empty graph', () => {
    const bg: BuildGraph = { nodes: [], edges: [] }
    const lg = buildGraphToLabGraph(bg)
    expect(lg.nodes).toHaveLength(0)
    expect(lg.edges).toHaveLength(0)
  })
})

// ─── compareGraphShape ───────────────────────────────────────────────────────

describe('compareGraphShape', () => {
  it('returns all-true when graphs are identical', () => {
    const bg = makeGraph()
    const a = buildGraphToLabGraph(bg)
    const b = buildGraphToLabGraph(bg)
    const result = compareGraphShape(a, b)
    expect(result.nodeCountEqual).toBe(true)
    expect(result.edgeCountEqual).toBe(true)
    expect(result.sameNodeIds).toBe(true)
    expect(result.sameEdgeIds).toBe(true)
  })

  it('detects node count mismatch', () => {
    const a = buildGraphToLabGraph(makeGraph())
    const b: LabGraph = { nodes: a.nodes.slice(0, 2), edges: a.edges }
    const result = compareGraphShape(a, b)
    expect(result.nodeCountEqual).toBe(false)
  })

  it('detects edge count mismatch', () => {
    const a = buildGraphToLabGraph(makeGraph())
    const b: LabGraph = { nodes: a.nodes, edges: a.edges.slice(0, 1) }
    const result = compareGraphShape(a, b)
    expect(result.edgeCountEqual).toBe(false)
  })

  it('detects node id mismatch even when count matches', () => {
    const a = buildGraphToLabGraph(makeGraph())
    const b: LabGraph = {
      nodes: [
        ...a.nodes.slice(0, 2),
        { id: 'different-id', kind: 'pump', x: 0, y: 0 },
      ],
      edges: a.edges,
    }
    const result = compareGraphShape(a, b)
    expect(result.nodeCountEqual).toBe(true)
    expect(result.sameNodeIds).toBe(false)
  })

  it('detects edge id mismatch even when count matches', () => {
    const a = buildGraphToLabGraph(makeGraph())
    const b: LabGraph = {
      nodes: a.nodes,
      edges: [
        a.edges[0],
        { id: 'wrong-edge-id', fromNodeId: 'x', fromPort: 'flow', toNodeId: 'y', toPort: 'return', domain: 'heating' },
      ],
    }
    const result = compareGraphShape(a, b)
    expect(result.edgeCountEqual).toBe(true)
    expect(result.sameEdgeIds).toBe(false)
  })

  it('passes for empty-graph round-trip (play entry from blank canvas)', () => {
    const empty: LabGraph = { nodes: [], edges: [] }
    const result = compareGraphShape(empty, empty)
    expect(result.nodeCountEqual).toBe(true)
    expect(result.edgeCountEqual).toBe(true)
    expect(result.sameNodeIds).toBe(true)
    expect(result.sameEdgeIds).toBe(true)
  })
})

// ─── id-preservation through structuredClone ─────────────────────────────────

describe('id preservation via structuredClone', () => {
  it('deep clone preserves all node ids (simulates enterPlay snapshot)', () => {
    const bg = makeGraph()
    const editorLab = buildGraphToLabGraph(bg)
    // Simulate what enterPlay does: structuredClone the BuildGraph, then convert
    const snapshot = structuredClone(bg)
    const playLab = buildGraphToLabGraph(snapshot)
    const parity = compareGraphShape(editorLab, playLab)
    expect(parity.nodeCountEqual).toBe(true)
    expect(parity.edgeCountEqual).toBe(true)
    expect(parity.sameNodeIds).toBe(true)
    expect(parity.sameEdgeIds).toBe(true)
  })

  it('snapshot is independent (mutations do not affect the editor graph)', () => {
    const bg = makeGraph()
    const snapshot = structuredClone(bg)
    // Mutate the snapshot
    snapshot.nodes[0].id = 'mutated-id'
    // Original is unchanged
    expect(bg.nodes[0].id).toBe('boiler-1')
  })
})
