/**
 * Tests for graphDerive — deriveFacts() outlet model logic.
 *
 * Validates the dual domestic cold-source model:
 *   - outletModels.serviceClass (mixed / cold_only / hot_only)
 *   - outletModels.coldSourceKind (mains / cws / undefined)
 *
 * System configurations tested:
 *   1. Combi (mains-fed hot + mains cold tap) → mains cold source
 *   2. Open-vented with CWS-fed outlets → cws cold source
 *   3. Open-vented with mains-fed outlet → mains cold source
 *   4. cold_tap_outlet always cold_only
 *   5. Mixed outlet with both hot and cold → mixed service class
 *   6. Hot-only outlet (hot connected, no cold) → hot_only service class
 *   7. Disconnected outlet → cold_only with no coldSourceKind
 *   8. Backward-compat: hotFedOutletNodeIds / coldOnlyOutletNodeIds unchanged
 */

import { describe, it, expect } from 'vitest'
import { deriveFacts } from '../builder/graphDerive'
import type { BuildGraph } from '../builder/types'

// ── Graph builder helpers ──────────────────────────────────────────────────────

function node(id: string, kind: BuildGraph['nodes'][number]['kind']) {
  return { id, kind, x: 0, y: 0, r: 0 }
}

function edge(
  id: string,
  fromNode: string,
  fromPort: string,
  toNode: string,
  toPort: string,
) {
  return { id, from: { nodeId: fromNode, portId: fromPort }, to: { nodeId: toNode, portId: toPort } }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('deriveFacts — combi system (mains cold)', () => {
  /**
   * combi.hot_out → shower.hot_in
   * combi.cold_in  ← (mains entry) → shower.cold_in
   */
  it('outlet fed from combi hot_out has mains coldSourceKind', () => {
    const graph: BuildGraph = {
      nodes: [
        node('combi', 'heat_source_combi'),
        node('sh', 'shower_outlet'),
      ],
      edges: [
        edge('e1', 'combi', 'hot_out', 'sh', 'hot_in'),
        edge('e2', 'combi', 'cold_in', 'sh', 'cold_in'),
      ],
    }
    const facts = deriveFacts(graph)
    expect(facts.outletModels['sh']).toEqual({
      serviceClass: 'mixed',
      coldSourceKind: 'mains',
    })
  })

  it('combi system: outlet in hotFedOutletNodeIds', () => {
    const graph: BuildGraph = {
      nodes: [
        node('combi', 'heat_source_combi'),
        node('sh', 'shower_outlet'),
      ],
      edges: [
        edge('e1', 'combi', 'hot_out', 'sh', 'hot_in'),
        edge('e2', 'combi', 'cold_in', 'sh', 'cold_in'),
      ],
    }
    const facts = deriveFacts(graph)
    expect(facts.hotFedOutletNodeIds).toContain('sh')
    expect(facts.coldOnlyOutletNodeIds).not.toContain('sh')
  })
})

describe('deriveFacts — open-vented system (CWS cold rail)', () => {
  /**
   * cws.cold_out → cyl.cold_in (vented cylinder supply)
   * cws.cold_out → shower.cold_in (pressure-matched cold outlet)
   * cyl.hot_out  → shower.hot_in
   */
  function ventedGraph(): BuildGraph {
    return {
      nodes: [
        node('boiler', 'heat_source_regular_boiler'),
        node('cyl', 'dhw_vented_cylinder'),
        node('cws', 'cws_cistern'),
        node('sh', 'shower_outlet'),
      ],
      edges: [
        edge('e1', 'cws', 'cold_out', 'cyl', 'cold_in'),
        edge('e2', 'cyl', 'hot_out', 'sh', 'hot_in'),
        edge('e3', 'cws', 'cold_out', 'sh', 'cold_in'),
      ],
    }
  }

  it('shower outlet in open-vented system has cws coldSourceKind', () => {
    const facts = deriveFacts(ventedGraph())
    expect(facts.outletModels['sh']).toEqual({
      serviceClass: 'mixed',
      coldSourceKind: 'cws',
    })
  })

  it('shower outlet is in hotFedOutletNodeIds', () => {
    const facts = deriveFacts(ventedGraph())
    expect(facts.hotFedOutletNodeIds).toContain('sh')
  })
})

describe('deriveFacts — open-vented system with mains-cold outlet', () => {
  /**
   * A kitchen sink connected to mains cold (manifold_cold acting as mains entry)
   * in an otherwise open-vented system.
   */
  it('outlet fed from manifold_cold has mains coldSourceKind', () => {
    const graph: BuildGraph = {
      nodes: [
        node('boiler', 'heat_source_regular_boiler'),
        node('cyl', 'dhw_vented_cylinder'),
        node('cws', 'cws_cistern'),
        node('manifold', 'manifold_cold'),
        node('kitchen', 'tap_outlet'),
      ],
      edges: [
        edge('e1', 'cws', 'cold_out', 'cyl', 'cold_in'),
        edge('e2', 'cyl', 'hot_out', 'kitchen', 'hot_in'),
        // cold side comes from mains manifold, not CWS
        edge('e3', 'manifold', 'out1', 'kitchen', 'cold_in'),
      ],
    }
    const facts = deriveFacts(graph)
    expect(facts.outletModels['kitchen']).toEqual({
      serviceClass: 'mixed',
      coldSourceKind: 'mains',
    })
  })
})

describe('deriveFacts — cold_tap_outlet is always cold_only', () => {
  it('cold_tap_outlet fed from CWS is cold_only with cws coldSourceKind', () => {
    const graph: BuildGraph = {
      nodes: [
        node('cws', 'cws_cistern'),
        node('ct', 'cold_tap_outlet'),
      ],
      edges: [
        edge('e1', 'cws', 'cold_out', 'ct', 'cold_in'),
      ],
    }
    const facts = deriveFacts(graph)
    expect(facts.outletModels['ct']).toEqual({
      serviceClass: 'cold_only',
      coldSourceKind: 'cws',
    })
    expect(facts.coldOnlyOutletNodeIds).toContain('ct')
  })

  it('cold_tap_outlet fed from combi mains cold is cold_only with mains coldSourceKind', () => {
    const graph: BuildGraph = {
      nodes: [
        node('combi', 'heat_source_combi'),
        node('ct', 'cold_tap_outlet'),
      ],
      edges: [
        edge('e1', 'combi', 'cold_in', 'ct', 'cold_in'),
      ],
    }
    const facts = deriveFacts(graph)
    expect(facts.outletModels['ct']).toEqual({
      serviceClass: 'cold_only',
      coldSourceKind: 'mains',
    })
  })
})

describe('deriveFacts — hot_only service class', () => {
  it('outlet with hot_in reachable but no cold_in connection is hot_only', () => {
    const graph: BuildGraph = {
      nodes: [
        node('combi', 'heat_source_combi'),
        node('sh', 'shower_outlet'),
      ],
      edges: [
        edge('e1', 'combi', 'hot_out', 'sh', 'hot_in'),
        // cold_in is deliberately left disconnected
      ],
    }
    const facts = deriveFacts(graph)
    expect(facts.outletModels['sh']).toEqual({
      serviceClass: 'hot_only',
      coldSourceKind: undefined,
    })
    // hot_only still lands in hotFedOutletNodeIds (backward compat)
    expect(facts.hotFedOutletNodeIds).toContain('sh')
  })
})

describe('deriveFacts — disconnected outlet', () => {
  it('outlet with no connections has cold_only serviceClass and no coldSourceKind', () => {
    const graph: BuildGraph = {
      nodes: [
        node('sh', 'shower_outlet'),
      ],
      edges: [],
    }
    const facts = deriveFacts(graph)
    expect(facts.outletModels['sh']).toEqual({ serviceClass: 'cold_only', coldSourceKind: undefined })
    expect(facts.hotFedOutletNodeIds).not.toContain('sh')
    expect(facts.coldOnlyOutletNodeIds).not.toContain('sh')
  })
})

describe('deriveFacts — CWS preferred over mains when both reach outlet', () => {
  /**
   * If somehow both CWS and mains can reach the outlet's cold_in (e.g. during
   * a transitional build state), the CWS rail takes precedence so open-vented
   * systems are classified correctly.
   */
  it('prefers cws when both CWS and mains cold reach the outlet', () => {
    const graph: BuildGraph = {
      nodes: [
        node('combi', 'heat_source_combi'),
        node('cws', 'cws_cistern'),
        node('bath', 'bath_outlet'),
      ],
      edges: [
        edge('e1', 'combi', 'hot_out', 'bath', 'hot_in'),
        edge('e2', 'combi', 'cold_in', 'bath', 'cold_in'),
        edge('e3', 'cws', 'cold_out', 'bath', 'cold_in'),
      ],
    }
    const facts = deriveFacts(graph)
    expect(facts.outletModels['bath'].coldSourceKind).toBe('cws')
  })
})

describe('deriveFacts — outletModels includes all outlet kinds', () => {
  it('returns an outletModels entry for every outlet kind', () => {
    const outletKinds: BuildGraph['nodes'][number]['kind'][] = [
      'tap_outlet', 'bath_outlet', 'shower_outlet', 'cold_tap_outlet',
    ]
    for (const kind of outletKinds) {
      const graph: BuildGraph = {
        nodes: [node('outlet', kind)],
        edges: [],
      }
      const facts = deriveFacts(graph)
      expect(facts.outletModels).toHaveProperty('outlet')
    }
  })
})

describe('deriveFacts — non-outlet nodes excluded from outletModels', () => {
  it('heat sources and cylinders do not appear in outletModels', () => {
    const graph: BuildGraph = {
      nodes: [
        node('combi', 'heat_source_combi'),
        node('cyl', 'dhw_unvented_cylinder'),
      ],
      edges: [],
    }
    const facts = deriveFacts(graph)
    expect(Object.keys(facts.outletModels)).toHaveLength(0)
  })
})
