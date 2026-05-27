/**
 * Regression tests for deriveSystemKindFromGraph.
 *
 * These tests guard the single-source-of-truth system kind classifier against
 * the core bug: Play mode collapsing all built systems to 'combi'.
 */

import { describe, it, expect } from 'vitest'
import { deriveSystemKindFromGraph } from '../builder/deriveSystemKind'
import type { BuildGraph } from '../builder/types'

// ── Graph fixtures ─────────────────────────────────────────────────────────────

function combiGraph(): BuildGraph {
  return {
    nodes: [
      { id: 'hs', kind: 'heat_source_combi', x: 100, y: 100, r: 0 },
    ],
    edges: [],
  }
}

function systemBoilerWithUnventedCylinderGraph(): BuildGraph {
  return {
    nodes: [
      { id: 'hs',  kind: 'heat_source_system_boiler',  x: 100, y: 100, r: 0 },
      { id: 'cyl', kind: 'dhw_unvented_cylinder',      x: 300, y: 100, r: 0 },
      { id: 'rad', kind: 'radiator_loop',              x: 500, y: 100, r: 0 },
    ],
    edges: [],
  }
}

function regularBoilerWithVentedCylinderGraph(): BuildGraph {
  return {
    nodes: [
      { id: 'hs',  kind: 'heat_source_regular_boiler', x: 100, y: 100, r: 0 },
      { id: 'cyl', kind: 'dhw_vented_cylinder',        x: 300, y: 100, r: 0 },
      { id: 'rad', kind: 'radiator_loop',              x: 500, y: 100, r: 0 },
    ],
    edges: [],
  }
}

function mixergyGraph(): BuildGraph {
  return {
    nodes: [
      { id: 'hs',  kind: 'heat_source_system_boiler', x: 100, y: 100, r: 0 },
      { id: 'mix', kind: 'dhw_mixergy',               x: 300, y: 100, r: 0 },
    ],
    edges: [],
  }
}

function heatPumpGraph(): BuildGraph {
  return {
    nodes: [
      { id: 'hp', kind: 'heat_source_heat_pump', x: 100, y: 100, r: 0 },
    ],
    edges: [],
  }
}

function heatPumpWithCylinderGraph(): BuildGraph {
  return {
    nodes: [
      { id: 'hp',  kind: 'heat_source_heat_pump',     x: 100, y: 100, r: 0 },
      { id: 'cyl', kind: 'dhw_unvented_cylinder',     x: 300, y: 100, r: 0 },
    ],
    edges: [],
  }
}

function emptyGraph(): BuildGraph {
  return { nodes: [], edges: [] }
}

// ── Core classification ────────────────────────────────────────────────────────

describe('deriveSystemKindFromGraph — core classification', () => {
  it('classifies a combi boiler graph as combi', () => {
    expect(deriveSystemKindFromGraph(combiGraph())).toBe('combi')
  })

  it('classifies system boiler + unvented cylinder + emitters as stored', () => {
    expect(deriveSystemKindFromGraph(systemBoilerWithUnventedCylinderGraph())).toBe('stored')
  })

  it('classifies regular boiler + vented cylinder + emitters as stored', () => {
    expect(deriveSystemKindFromGraph(regularBoilerWithVentedCylinderGraph())).toBe('stored')
  })

  it('classifies system boiler + Mixergy thermal store as stored', () => {
    expect(deriveSystemKindFromGraph(mixergyGraph())).toBe('stored')
  })

  it('classifies a heat pump graph (no cylinder) as heat_pump', () => {
    expect(deriveSystemKindFromGraph(heatPumpGraph())).toBe('heat_pump')
  })

  it('classifies a heat pump + cylinder graph as heat_pump (heat source takes precedence)', () => {
    expect(deriveSystemKindFromGraph(heatPumpWithCylinderGraph())).toBe('heat_pump')
  })

  it('defaults to combi for an empty graph', () => {
    expect(deriveSystemKindFromGraph(emptyGraph())).toBe('combi')
  })
})

// ── Regression: stored systems must NOT fall through to combi ─────────────────

describe('deriveSystemKindFromGraph — regression: stored must not become combi', () => {
  it('stored system with only a system boiler + cylinder (no emitters) is stored', () => {
    const g: BuildGraph = {
      nodes: [
        { id: 'hs',  kind: 'heat_source_system_boiler', x: 0, y: 0, r: 0 },
        { id: 'cyl', kind: 'dhw_unvented_cylinder',     x: 0, y: 0, r: 0 },
      ],
      edges: [],
    }
    expect(deriveSystemKindFromGraph(g)).toBe('stored')
  })

  it('unvented cylinder graph without a heat source is still stored', () => {
    const g: BuildGraph = {
      nodes: [{ id: 'cyl', kind: 'dhw_unvented_cylinder', x: 0, y: 0, r: 0 }],
      edges: [],
    }
    expect(deriveSystemKindFromGraph(g)).toBe('stored')
  })

  it('vented cylinder graph without a heat source is still stored', () => {
    const g: BuildGraph = {
      nodes: [{ id: 'cyl', kind: 'dhw_vented_cylinder', x: 0, y: 0, r: 0 }],
      edges: [],
    }
    expect(deriveSystemKindFromGraph(g)).toBe('stored')
  })
})
