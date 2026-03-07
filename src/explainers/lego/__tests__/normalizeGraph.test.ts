/**
 * Tests for normalizeGraph.ts — automatic tee/manifold insertion pass.
 */

import { describe, it, expect } from 'vitest'
import { normalizeGraph } from '../builder/normalizeGraph'
import type { BuildGraph } from '../builder/types'
import { PRESETS } from '../builder/presets'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function portUse(graph: BuildGraph): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of graph.edges) {
    const a = `${e.from.nodeId}:${e.from.portId}`
    const b = `${e.to.nodeId}:${e.to.portId}`
    m.set(a, (m.get(a) ?? 0) + 1)
    m.set(b, (m.get(b) ?? 0) + 1)
  }
  return m
}

function maxPortUse(graph: BuildGraph): number {
  const use = portUse(graph)
  let max = 0
  for (const v of use.values()) {
    if (v > max) max = v
  }
  return max
}

// ─── Two-branch normalisation → tee ──────────────────────────────────────────

describe('normalizeGraph — 2 branches → tee insertion', () => {
  it('inserts a tee_hot when a hot port is used for 2 branches', () => {
    const graph: BuildGraph = {
      nodes: [
        { id: 'hs',    kind: 'heat_source_combi', x: 0,   y: 0, r: 0 },
        { id: 'sh',    kind: 'shower_outlet',     x: 300, y: 0,   r: 0 },
        { id: 'bath',  kind: 'bath_outlet',       x: 300, y: 100, r: 0 },
      ],
      edges: [
        { id: 'e1', from: { nodeId: 'hs', portId: 'hot_out' }, to: { nodeId: 'sh',   portId: 'hot_in' } },
        { id: 'e2', from: { nodeId: 'hs', portId: 'hot_out' }, to: { nodeId: 'bath', portId: 'hot_in' } },
      ],
    }

    const result = normalizeGraph(graph)

    // The original port should no longer appear more than once.
    expect(maxPortUse(result)).toBe(1)
    // A tee_hot node should be present.
    expect(result.nodes.some(n => n.kind === 'tee_hot')).toBe(true)
    // We should have 3 edges: hs→tee.in, sh→tee.out1, bath→tee.out2 (or similar).
    expect(result.edges).toHaveLength(3)
  })

  it('inserts a tee_cold when a cold port is used for 2 branches', () => {
    const graph: BuildGraph = {
      nodes: [
        { id: 'hs',   kind: 'heat_source_combi', x: 0,   y: 0,   r: 0 },
        { id: 'sh',   kind: 'shower_outlet',     x: 300, y: 0,   r: 0 },
        { id: 'bath', kind: 'bath_outlet',       x: 300, y: 100, r: 0 },
      ],
      edges: [
        { id: 'e1', from: { nodeId: 'hs', portId: 'cold_in' }, to: { nodeId: 'sh',   portId: 'cold_in' } },
        { id: 'e2', from: { nodeId: 'hs', portId: 'cold_in' }, to: { nodeId: 'bath', portId: 'cold_in' } },
      ],
    }

    const result = normalizeGraph(graph)

    expect(maxPortUse(result)).toBe(1)
    expect(result.nodes.some(n => n.kind === 'tee_cold')).toBe(true)
  })
})

// ─── Multi-branch normalisation → manifold ───────────────────────────────────

describe('normalizeGraph — 4 branches → manifold_hot', () => {
  it('inserts a manifold_hot when a hot port fans out to 4 outlets', () => {
    const graph: BuildGraph = {
      nodes: [
        { id: 'hs',   kind: 'heat_source_combi', x: 0,   y: 0,   r: 0 },
        { id: 'sh',   kind: 'shower_outlet',     x: 300, y: 0,   r: 0 },
        { id: 'bath', kind: 'bath_outlet',       x: 300, y: 80,  r: 0 },
        { id: 'tap1', kind: 'tap_outlet',        x: 300, y: 160, r: 0 },
        { id: 'tap2', kind: 'tap_outlet',        x: 300, y: 240, r: 0 },
      ],
      edges: [
        { id: 'e1', from: { nodeId: 'hs', portId: 'hot_out' }, to: { nodeId: 'sh',   portId: 'hot_in' } },
        { id: 'e2', from: { nodeId: 'hs', portId: 'hot_out' }, to: { nodeId: 'bath', portId: 'hot_in' } },
        { id: 'e3', from: { nodeId: 'hs', portId: 'hot_out' }, to: { nodeId: 'tap1', portId: 'hot_in' } },
        { id: 'e4', from: { nodeId: 'hs', portId: 'hot_out' }, to: { nodeId: 'tap2', portId: 'hot_in' } },
      ],
    }

    const result = normalizeGraph(graph)

    expect(maxPortUse(result)).toBe(1)
    expect(result.nodes.some(n => n.kind === 'manifold_hot')).toBe(true)
    expect(result.nodes.some(n => n.kind === 'tee_hot')).toBe(false)
    // 1 trunk edge + 4 branch edges = 5 edges total
    expect(result.edges).toHaveLength(5)
  })
})

describe('normalizeGraph — 5 branches → manifold_cold', () => {
  it('inserts a manifold_cold when a cold port fans out to 5 outlets', () => {
    const graph: BuildGraph = {
      nodes: [
        { id: 'hs',     kind: 'heat_source_combi', x: 0,   y: 0,   r: 0 },
        { id: 'sh',     kind: 'shower_outlet',     x: 300, y: 0,   r: 0 },
        { id: 'bath',   kind: 'bath_outlet',       x: 300, y: 80,  r: 0 },
        { id: 'tap1',   kind: 'tap_outlet',        x: 300, y: 160, r: 0 },
        { id: 'tap2',   kind: 'tap_outlet',        x: 300, y: 240, r: 0 },
        { id: 'ctap',   kind: 'cold_tap_outlet',   x: 300, y: 320, r: 0 },
      ],
      edges: [
        { id: 'c1', from: { nodeId: 'hs', portId: 'cold_in' }, to: { nodeId: 'sh',   portId: 'cold_in' } },
        { id: 'c2', from: { nodeId: 'hs', portId: 'cold_in' }, to: { nodeId: 'bath', portId: 'cold_in' } },
        { id: 'c3', from: { nodeId: 'hs', portId: 'cold_in' }, to: { nodeId: 'tap1', portId: 'cold_in' } },
        { id: 'c4', from: { nodeId: 'hs', portId: 'cold_in' }, to: { nodeId: 'tap2', portId: 'cold_in' } },
        { id: 'c5', from: { nodeId: 'hs', portId: 'cold_in' }, to: { nodeId: 'ctap', portId: 'cold_in' } },
      ],
    }

    const result = normalizeGraph(graph)

    expect(maxPortUse(result)).toBe(1)
    expect(result.nodes.some(n => n.kind === 'manifold_cold')).toBe(true)
    expect(result.nodes.some(n => n.kind === 'tee_cold')).toBe(false)
    // 1 trunk edge + 5 branch edges = 6 edges total
    expect(result.edges).toHaveLength(6)
  })
})

// ─── Already-clean graph is unchanged ────────────────────────────────────────

describe('normalizeGraph — already-clean graph', () => {
  it('does not modify a graph with no multi-use ports', () => {
    const graph: BuildGraph = {
      nodes: [
        { id: 'hs',  kind: 'heat_source_combi', x: 0,   y: 0, r: 0 },
        { id: 'rads',kind: 'radiator_loop',     x: 300, y: 0, r: 0 },
      ],
      edges: [
        { id: 'ch1', from: { nodeId: 'hs', portId: 'flow_out' }, to: { nodeId: 'rads', portId: 'flow_in' } },
        { id: 'ch2', from: { nodeId: 'rads', portId: 'return_out' }, to: { nodeId: 'hs', portId: 'return_in' } },
      ],
    }

    const result = normalizeGraph(graph)

    expect(result.nodes).toHaveLength(graph.nodes.length)
    expect(result.edges).toHaveLength(graph.edges.length)
  })

  it('does not mutate the original graph', () => {
    const graph: BuildGraph = {
      nodes: [
        { id: 'hs',   kind: 'heat_source_combi', x: 0,   y: 0, r: 0 },
        { id: 'sh',   kind: 'shower_outlet',     x: 300, y: 0, r: 0 },
        { id: 'bath', kind: 'bath_outlet',       x: 300, y: 80, r: 0 },
      ],
      edges: [
        { id: 'e1', from: { nodeId: 'hs', portId: 'hot_out' }, to: { nodeId: 'sh',   portId: 'hot_in' } },
        { id: 'e2', from: { nodeId: 'hs', portId: 'hot_out' }, to: { nodeId: 'bath', portId: 'hot_in' } },
      ],
    }
    const originalNodeCount = graph.nodes.length
    const originalEdgeCount = graph.edges.length

    normalizeGraph(graph)

    expect(graph.nodes).toHaveLength(originalNodeCount)
    expect(graph.edges).toHaveLength(originalEdgeCount)
  })
})

// ─── Preset graphs: no multi-use ports after normalization ───────────────────

describe('normalizeGraph — preset graphs are already clean', () => {
  for (const preset of PRESETS) {
    it(`preset "${preset.id}" has no multi-use ports`, () => {
      // Presets should already use manifolds, so normalization should be a no-op.
      const result = normalizeGraph(preset.graph)
      expect(maxPortUse(result)).toBeLessThanOrEqual(1)
    })
  }
})

// ─── graphValidate — emitter connectivity check ───────────────────────────────

import { validateGraph } from '../builder/graphValidate'

describe('validateGraph — emitter connectivity (no false positive for simple combi)', () => {
  it('does not warn when radiator is directly connected to combi CH ports', () => {
    const graph: BuildGraph = {
      nodes: [
        { id: 'hs',   kind: 'heat_source_combi', x: 0,   y: 0, r: 0 },
        { id: 'rads', kind: 'radiator_loop',     x: 300, y: 0, r: 0 },
      ],
      edges: [
        { id: 'ch1', from: { nodeId: 'hs',   portId: 'flow_out'   }, to: { nodeId: 'rads', portId: 'flow_in'  } },
        { id: 'ch2', from: { nodeId: 'rads', portId: 'return_out' }, to: { nodeId: 'hs',   portId: 'return_in'} },
      ],
    }

    const warnings = validateGraph(graph)
    const emitterWarnings = warnings.filter(w => w.id.startsWith('emitter_'))
    expect(emitterWarnings).toHaveLength(0)
  })

  it('warns when radiator flow_in is disconnected', () => {
    const graph: BuildGraph = {
      nodes: [
        { id: 'hs',   kind: 'heat_source_combi', x: 0,   y: 0, r: 0 },
        { id: 'rads', kind: 'radiator_loop',     x: 300, y: 0, r: 0 },
      ],
      edges: [
        // Only the return side is connected
        { id: 'ch2', from: { nodeId: 'rads', portId: 'return_out' }, to: { nodeId: 'hs', portId: 'return_in' } },
      ],
    }

    const warnings = validateGraph(graph)
    expect(warnings.some(w => w.id.startsWith('emitter_open_'))).toBe(true)
  })

  it('does not produce "Port used multiple times" warnings', () => {
    // Simulate the old broken combi preset pattern (boiler hot_out → multiple outlets).
    const graph: BuildGraph = {
      nodes: [
        { id: 'hs',   kind: 'heat_source_combi', x: 0,   y: 0,   r: 0 },
        { id: 'sh',   kind: 'shower_outlet',     x: 300, y: 0,   r: 0 },
        { id: 'bath', kind: 'bath_outlet',       x: 300, y: 100, r: 0 },
      ],
      edges: [
        { id: 'e1', from: { nodeId: 'hs', portId: 'hot_out' }, to: { nodeId: 'sh',   portId: 'hot_in' } },
        { id: 'e2', from: { nodeId: 'hs', portId: 'hot_out' }, to: { nodeId: 'bath', portId: 'hot_in' } },
      ],
    }

    const warnings = validateGraph(graph)
    const multiWarnings = warnings.filter(w => w.id.startsWith('multi_'))
    expect(multiWarnings).toHaveLength(0)
  })
})
