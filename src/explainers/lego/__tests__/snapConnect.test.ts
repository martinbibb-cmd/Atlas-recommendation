/**
 * Tests for snapConnect — port snap detection logic.
 */

import { describe, it, expect } from 'vitest'
import { rolesCompatible, findSnapCandidate, portAbs } from '../builder/snapConnect'
import type { BuildGraph } from '../builder/types'

// ─── rolesCompatible ─────────────────────────────────────────────────────────

describe('rolesCompatible', () => {
  it('allows same-role connections', () => {
    expect(rolesCompatible('hot', 'hot')).toBe(true)
    expect(rolesCompatible('cold', 'cold')).toBe(true)
    expect(rolesCompatible('flow', 'flow')).toBe(true)
    expect(rolesCompatible('return', 'return')).toBe(true)
  })

  it('allows flow ↔ return (both flowish)', () => {
    expect(rolesCompatible('flow', 'return')).toBe(true)
    expect(rolesCompatible('return', 'flow')).toBe(true)
    expect(rolesCompatible('flow', 'store')).toBe(true)
    expect(rolesCompatible('store', 'return')).toBe(true)
  })

  it('allows unknown ↔ anything', () => {
    expect(rolesCompatible('unknown', 'hot')).toBe(true)
    expect(rolesCompatible('cold', 'unknown')).toBe(true)
    expect(rolesCompatible('unknown', 'unknown')).toBe(true)
  })

  it('blocks hot ↔ cold', () => {
    expect(rolesCompatible('hot', 'cold')).toBe(false)
    expect(rolesCompatible('cold', 'hot')).toBe(false)
  })

  it('blocks hot ↔ flow', () => {
    expect(rolesCompatible('hot', 'flow')).toBe(false)
    expect(rolesCompatible('flow', 'hot')).toBe(false)
  })

  it('blocks cold ↔ return', () => {
    expect(rolesCompatible('cold', 'return')).toBe(false)
  })
})

// ─── portAbs ─────────────────────────────────────────────────────────────────

describe('portAbs', () => {
  it('returns absolute position of a known port', () => {
    const node = { id: 'n1', kind: 'heat_source_combi' as const, x: 100, y: 200, r: 0 }
    const abs = portAbs(node, 'hot_out')
    expect(abs.x).toBeGreaterThan(100)
    expect(abs.role).toBe('hot')
  })

  it('returns node origin for unknown port id', () => {
    const node = { id: 'n1', kind: 'heat_source_combi' as const, x: 50, y: 60, r: 0 }
    const abs = portAbs(node, 'nonexistent')
    expect(abs.x).toBe(50)
    expect(abs.y).toBe(60)
    expect(abs.role).toBe('unknown')
  })
})

// ─── findSnapCandidate ────────────────────────────────────────────────────────

function makeGraph(nodes: BuildGraph['nodes']): BuildGraph {
  return { nodes, edges: [] }
}

describe('findSnapCandidate', () => {
  it('returns null when no other nodes exist', () => {
    const graph = makeGraph([
      { id: 'a', kind: 'heat_source_combi', x: 100, y: 100, r: 0 },
    ])
    expect(findSnapCandidate({ graph, movingNodeId: 'a', maxDistPx: 100 })).toBeNull()
  })

  it('returns null when moving node id not in graph', () => {
    const graph = makeGraph([
      { id: 'a', kind: 'heat_source_combi', x: 100, y: 100, r: 0 },
    ])
    expect(findSnapCandidate({ graph, movingNodeId: 'missing', maxDistPx: 100 })).toBeNull()
  })

  it('finds the closest compatible port within threshold', () => {
    // Place combi at x=0 and a radiator_loop at x=175 (just past TOKEN_W=170)
    // combi ch_flow_out is at dx=TOKEN_W=170, dy=TOKEN_H/2=37 → abs (170, 37)
    // radiator flow_in is at dx=0, dy=TOKEN_H/2=37 → abs (175, 37)
    // distance ≈ 5 < 36 threshold
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      { id: 'rad', kind: 'radiator_loop', x: 175, y: 0, r: 0 },
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'combi', maxDistPx: 36 })
    expect(cand).not.toBeNull()
    expect(cand!.from.nodeId).toBe('combi')
    expect(cand!.to.nodeId).toBe('rad')
  })

  it('returns null when ports are beyond the threshold', () => {
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      { id: 'rad', kind: 'radiator_loop', x: 500, y: 500, r: 0 },
    ])
    expect(findSnapCandidate({ graph, movingNodeId: 'combi', maxDistPx: 36 })).toBeNull()
  })

  it('does not match hot ↔ cold ports', () => {
    // shower hot_in (hot) should not snap to combi cold_in (cold)
    // Place shower so its hot_in is very close to combi cold_in
    // combi cold_in: dx=L=0, dy=B=74 → abs (0, 74)
    // shower hot_in:  dx=L=0, dy=T+18=18 → abs (2, 74+18-18) = need to think more carefully
    // Let's just verify they are blocked even when close
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      // Position cold_tap so its cold_in is near combi's hot_out
      // combi hot_out: (170, 74); cold_tap cold_in: dx=0, dy=37 → place at x=170, y=74-37=37
      { id: 'cold_tap', kind: 'cold_tap_outlet', x: 170, y: 37, r: 0 },
    ])
    // combi hot_out role='hot', cold_tap cold_in role='cold' — incompatible
    const cand = findSnapCandidate({ graph, movingNodeId: 'cold_tap', maxDistPx: 36 })
    if (cand) {
      // If any candidate is found, it must not be hot↔cold
      expect(rolesCompatible(
        portAbs(graph.nodes.find(n => n.id === cand.from.nodeId)!, cand.from.portId).role,
        portAbs(graph.nodes.find(n => n.id === cand.to.nodeId)!, cand.to.portId).role,
      )).toBe(true)
    }
  })

  it('returns the closest candidate when multiple are within range', () => {
    // Two radiators near a combi; the closer one should win
    // combi ch_flow_out: abs = (170, 37)
    // rad1 flow_in: x=173, y=0 → abs (173, 37) → dist ≈ 3
    // rad2 flow_in: x=182, y=0 → abs (182, 37) → dist ≈ 12
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      { id: 'rad1', kind: 'radiator_loop', x: 173, y: 0, r: 0 },
      { id: 'rad2', kind: 'radiator_loop', x: 182, y: 0, r: 0 },
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'combi', maxDistPx: 36 })
    expect(cand).not.toBeNull()
    expect(cand!.to.nodeId).toBe('rad1')
  })
})
