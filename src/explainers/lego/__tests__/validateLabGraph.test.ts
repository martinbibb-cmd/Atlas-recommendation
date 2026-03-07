/**
 * Tests for validateLabGraph — LabGraph semantic topology validation (PR3).
 *
 * Covers all five rules:
 *   A. Emitters must only connect on the heating domain.
 *   B. Cylinder domestic ports (cold_in / hot_out) may not be on primary/heating.
 *   C. Cylinder coil ports (coil_flow / coil_return) must be on primary only.
 *   D. If emitters exist, at least one heating-domain edge must exist.
 *   E. Each emitter should have both a flow and return heating connection.
 */

import { describe, it, expect } from 'vitest'
import { validateLabGraph } from '../validation/validateLabGraph'
import type { LabGraph } from '../types/graph'

// ─── Helpers ──────────────────────────────────────────────────────────────────

let edgeSeq = 0
function eid() { return `e${++edgeSeq}` }

// ─── Rule A — emitters must only use the heating domain ──────────────────────

describe('Rule A — emitters must use heating domain', () => {
  it('passes when radiator edges are on heating domain', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_combi', x: 0, y: 0 },
        { id: 'rad',    kind: 'radiator_loop',      x: 100, y: 0 },
      ],
      edges: [
        { id: eid(), fromNodeId: 'boiler', fromPort: 'flow',   toNodeId: 'rad',    toPort: 'flow',   domain: 'heating' },
        { id: eid(), fromNodeId: 'rad',    fromPort: 'return', toNodeId: 'boiler', toPort: 'return', domain: 'heating' },
      ],
    }

    const result = validateLabGraph(graph)
    const ruleA = result.issues.filter(i => i.code === 'EMITTER_WRONG_DOMAIN')
    expect(ruleA).toHaveLength(0)
  })

  it('errors when radiator has an edge on the dhw domain', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'cylinder', kind: 'dhw_unvented_cylinder', x: 0, y: 0 },
        { id: 'rad',      kind: 'radiator_loop',          x: 100, y: 0 },
      ],
      edges: [
        // Intentionally wrong: radiator wired on dhw domain
        { id: eid(), fromNodeId: 'cylinder', fromPort: 'hot_out', toNodeId: 'rad', toPort: 'flow', domain: 'dhw' },
      ],
    }

    const result = validateLabGraph(graph)
    const ruleA = result.issues.filter(i => i.code === 'EMITTER_WRONG_DOMAIN')
    expect(ruleA.length).toBeGreaterThan(0)
    expect(result.ok).toBe(false)
  })

  it('errors when ufh has an edge on the primary domain', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_system_boiler', x: 0, y: 0 },
        { id: 'ufh',    kind: 'ufh_loop',                  x: 100, y: 0 },
      ],
      edges: [
        { id: eid(), fromNodeId: 'boiler', fromPort: 'flow', toNodeId: 'ufh', toPort: 'flow', domain: 'primary' },
      ],
    }

    const result = validateLabGraph(graph)
    const ruleA = result.issues.filter(i => i.code === 'EMITTER_WRONG_DOMAIN')
    expect(ruleA.length).toBeGreaterThan(0)
    expect(result.ok).toBe(false)
  })
})

// ─── Rule B — cylinder domestic ports must not be on primary/heating ──────────

describe('Rule B — cylinder domestic ports must not be on primary/heating', () => {
  it('passes when cold_in is on cold domain', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'mains', kind: 'cws_cistern',           x: 0, y: 0 },
        { id: 'cyl',   kind: 'dhw_unvented_cylinder', x: 100, y: 0 },
      ],
      edges: [
        { id: eid(), fromNodeId: 'mains', fromPort: 'cold_in', toNodeId: 'cyl', toPort: 'cold_in', domain: 'cold' },
      ],
    }

    const result = validateLabGraph(graph)
    const ruleB = result.issues.filter(i => i.code === 'CYLINDER_DOMESTIC_PORT_ON_HEATING')
    expect(ruleB).toHaveLength(0)
  })

  it('passes when hot_out is on dhw domain', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'cyl',    kind: 'dhw_unvented_cylinder', x: 0, y: 0 },
        { id: 'outlet', kind: 'tap_outlet',              x: 100, y: 0 },
      ],
      edges: [
        { id: eid(), fromNodeId: 'cyl', fromPort: 'hot_out', toNodeId: 'outlet', toPort: 'hot_out', domain: 'dhw' },
      ],
    }

    const result = validateLabGraph(graph)
    const ruleB = result.issues.filter(i => i.code === 'CYLINDER_DOMESTIC_PORT_ON_HEATING')
    expect(ruleB).toHaveLength(0)
  })

  it('errors when hot_out is on heating domain', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'cyl', kind: 'dhw_unvented_cylinder', x: 0, y: 0 },
        { id: 'rad', kind: 'radiator_loop',          x: 100, y: 0 },
      ],
      edges: [
        // Intentionally wrong: hot_out feeding radiator on heating domain
        { id: eid(), fromNodeId: 'cyl', fromPort: 'hot_out', toNodeId: 'rad', toPort: 'flow', domain: 'heating' },
      ],
    }

    const result = validateLabGraph(graph)
    const ruleB = result.issues.filter(i => i.code === 'CYLINDER_DOMESTIC_PORT_ON_HEATING')
    expect(ruleB.length).toBeGreaterThan(0)
    expect(result.ok).toBe(false)
    expect(ruleB[0].message).toContain('hot_out')
  })

  it('errors when cold_in is on primary domain', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_system_boiler', x: 0, y: 0 },
        { id: 'cyl',    kind: 'dhw_unvented_cylinder',     x: 100, y: 0 },
      ],
      edges: [
        // Wrong: boiler primary flow fed into cold_in
        { id: eid(), fromNodeId: 'boiler', fromPort: 'flow', toNodeId: 'cyl', toPort: 'cold_in', domain: 'primary' },
      ],
    }

    const result = validateLabGraph(graph)
    const ruleB = result.issues.filter(i => i.code === 'CYLINDER_DOMESTIC_PORT_ON_HEATING')
    expect(ruleB.length).toBeGreaterThan(0)
    expect(result.ok).toBe(false)
    expect(ruleB[0].message).toContain('cold_in')
  })
})

// ─── Rule C — cylinder coil ports must only be on primary domain ──────────────

describe('Rule C — cylinder coil ports must belong to primary domain', () => {
  it('passes when coil_flow is on primary domain', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_system_boiler', x: 0, y: 0 },
        { id: 'cyl',    kind: 'dhw_unvented_cylinder',     x: 100, y: 0 },
      ],
      edges: [
        { id: eid(), fromNodeId: 'boiler', fromPort: 'flow',       toNodeId: 'cyl', toPort: 'coil_flow',   domain: 'primary' },
        { id: eid(), fromNodeId: 'cyl',    fromPort: 'coil_return', toNodeId: 'boiler', toPort: 'return', domain: 'primary' },
      ],
    }

    const result = validateLabGraph(graph)
    const ruleC = result.issues.filter(i => i.code === 'CYLINDER_COIL_PORT_WRONG_DOMAIN')
    expect(ruleC).toHaveLength(0)
  })

  it('errors when coil_flow is on heating domain', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_system_boiler', x: 0, y: 0 },
        { id: 'cyl',    kind: 'dhw_unvented_cylinder',     x: 100, y: 0 },
      ],
      edges: [
        // Wrong: coil port used on heating domain
        { id: eid(), fromNodeId: 'boiler', fromPort: 'flow',      toNodeId: 'cyl', toPort: 'coil_flow', domain: 'heating' },
      ],
    }

    const result = validateLabGraph(graph)
    const ruleC = result.issues.filter(i => i.code === 'CYLINDER_COIL_PORT_WRONG_DOMAIN')
    expect(ruleC.length).toBeGreaterThan(0)
    expect(result.ok).toBe(false)
    expect(ruleC[0].message).toContain('coil_flow')
  })

  it('errors when coil_return is on dhw domain', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'cyl',    kind: 'dhw_vented_cylinder', x: 0, y: 0 },
        { id: 'outlet', kind: 'tap_outlet',           x: 100, y: 0 },
      ],
      edges: [
        // Wrong: coil_return on dhw domain
        { id: eid(), fromNodeId: 'cyl', fromPort: 'coil_return', toNodeId: 'outlet', toPort: 'hot_out', domain: 'dhw' },
      ],
    }

    const result = validateLabGraph(graph)
    const ruleC = result.issues.filter(i => i.code === 'CYLINDER_COIL_PORT_WRONG_DOMAIN')
    expect(ruleC.length).toBeGreaterThan(0)
    expect(ruleC[0].message).toContain('coil_return')
  })
})

// ─── Rule D — emitters require a heating circuit ──────────────────────────────

describe('Rule D — emitters require a heating circuit', () => {
  it('passes when emitters exist and heating edges exist', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_combi', x: 0,   y: 0 },
        { id: 'rad',    kind: 'radiator_loop',      x: 100, y: 0 },
      ],
      edges: [
        { id: eid(), fromNodeId: 'boiler', fromPort: 'flow',   toNodeId: 'rad',    toPort: 'flow',   domain: 'heating' },
        { id: eid(), fromNodeId: 'rad',    fromPort: 'return', toNodeId: 'boiler', toPort: 'return', domain: 'heating' },
      ],
    }

    const result = validateLabGraph(graph)
    const ruleD = result.issues.filter(i => i.code === 'EMITTERS_NO_HEATING_CIRCUIT')
    expect(ruleD).toHaveLength(0)
  })

  it('errors when emitters exist but no heating-domain edge is present', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_combi', x: 0,   y: 0 },
        { id: 'rad',    kind: 'radiator_loop',      x: 100, y: 0 },
      ],
      edges: [
        // Only a primary-domain edge — no heating edges
        { id: eid(), fromNodeId: 'boiler', fromPort: 'flow', toNodeId: 'rad', toPort: 'flow', domain: 'primary' },
      ],
    }

    const result = validateLabGraph(graph)
    const ruleD = result.issues.filter(i => i.code === 'EMITTERS_NO_HEATING_CIRCUIT')
    expect(ruleD.length).toBeGreaterThan(0)
    expect(result.ok).toBe(false)
    expect(ruleD[0].message).toContain('heating circuit')
  })

  it('does not fire when no emitters are present', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_combi',    x: 0, y: 0 },
        { id: 'cyl',    kind: 'dhw_unvented_cylinder', x: 100, y: 0 },
      ],
      edges: [
        { id: eid(), fromNodeId: 'boiler', fromPort: 'flow',       toNodeId: 'cyl',    toPort: 'coil_flow',   domain: 'primary' },
        { id: eid(), fromNodeId: 'cyl',    fromPort: 'coil_return', toNodeId: 'boiler', toPort: 'return',      domain: 'primary' },
      ],
    }

    const result = validateLabGraph(graph)
    const ruleD = result.issues.filter(i => i.code === 'EMITTERS_NO_HEATING_CIRCUIT')
    expect(ruleD).toHaveLength(0)
  })
})

// ─── Rule E — emitter flow/return sanity ─────────────────────────────────────

describe('Rule E — emitter flow/return sanity', () => {
  it('passes when emitter has both flow and return heating edges', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_combi', x: 0,   y: 0 },
        { id: 'rad',    kind: 'radiator_loop',      x: 100, y: 0 },
      ],
      edges: [
        { id: eid(), fromNodeId: 'boiler', fromPort: 'flow',   toNodeId: 'rad',    toPort: 'flow',   domain: 'heating' },
        { id: eid(), fromNodeId: 'rad',    fromPort: 'return', toNodeId: 'boiler', toPort: 'return', domain: 'heating' },
      ],
    }

    const result = validateLabGraph(graph)
    const ruleE = result.issues.filter(i => i.code === 'EMITTER_MISSING_FLOW_OR_RETURN')
    expect(ruleE).toHaveLength(0)
  })

  it('warns when emitter has only a flow connection (no return)', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_combi', x: 0,   y: 0 },
        { id: 'rad',    kind: 'radiator_loop',      x: 100, y: 0 },
      ],
      edges: [
        { id: eid(), fromNodeId: 'boiler', fromPort: 'flow', toNodeId: 'rad', toPort: 'flow', domain: 'heating' },
        // return edge missing
      ],
    }

    const result = validateLabGraph(graph)
    const ruleE = result.issues.filter(i => i.code === 'EMITTER_MISSING_FLOW_OR_RETURN')
    expect(ruleE.length).toBeGreaterThan(0)
    expect(ruleE[0].severity).toBe('warning')
    expect(ruleE[0].nodeId).toBe('rad')
  })

  it('warns when emitter has only a return connection (no flow)', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_combi', x: 0,   y: 0 },
        { id: 'rad',    kind: 'radiator_loop',      x: 100, y: 0 },
      ],
      edges: [
        // flow edge missing
        { id: eid(), fromNodeId: 'rad', fromPort: 'return', toNodeId: 'boiler', toPort: 'return', domain: 'heating' },
      ],
    }

    const result = validateLabGraph(graph)
    const ruleE = result.issues.filter(i => i.code === 'EMITTER_MISSING_FLOW_OR_RETURN')
    expect(ruleE.length).toBeGreaterThan(0)
    expect(ruleE[0].severity).toBe('warning')
  })
})

// ─── ok flag correctness ──────────────────────────────────────────────────────

describe('GraphValidationResult.ok', () => {
  it('is true when there are no errors (only warnings)', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_combi', x: 0,   y: 0 },
        { id: 'rad',    kind: 'radiator_loop',      x: 100, y: 0 },
      ],
      edges: [
        // flow only — triggers Rule E warning but not an error
        { id: eid(), fromNodeId: 'boiler', fromPort: 'flow', toNodeId: 'rad', toPort: 'flow', domain: 'heating' },
      ],
    }

    const result = validateLabGraph(graph)
    expect(result.ok).toBe(true)
    expect(result.issues.some(i => i.severity === 'warning')).toBe(true)
  })

  it('is false when any error is present', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'cyl', kind: 'dhw_unvented_cylinder', x: 0,   y: 0 },
        { id: 'rad', kind: 'radiator_loop',          x: 100, y: 0 },
      ],
      edges: [
        { id: eid(), fromNodeId: 'cyl', fromPort: 'hot_out', toNodeId: 'rad', toPort: 'flow', domain: 'heating' },
      ],
    }

    const result = validateLabGraph(graph)
    expect(result.ok).toBe(false)
  })

  it('is true for an empty graph', () => {
    const graph: LabGraph = { nodes: [], edges: [] }
    const result = validateLabGraph(graph)
    expect(result.ok).toBe(true)
    expect(result.issues).toHaveLength(0)
  })
})

// ─── Correct stored-system graph passes ───────────────────────────────────────

describe('Correct stored system — no false positives', () => {
  it('passes for a boiler + cylinder + emitters with correct domains', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_system_boiler', x: 0, y: 0 },
        { id: 'cyl',    kind: 'dhw_unvented_cylinder',     x: 100, y: 0 },
        { id: 'rad',    kind: 'radiator_loop',              x: 200, y: 0 },
        { id: 'mains',  kind: 'cws_cistern',                x: 0, y: 100 },
      ],
      edges: [
        // Primary coil circuit
        { id: eid(), fromNodeId: 'boiler', fromPort: 'flow',       toNodeId: 'cyl',    toPort: 'coil_flow',   domain: 'primary' },
        { id: eid(), fromNodeId: 'cyl',    fromPort: 'coil_return', toNodeId: 'boiler', toPort: 'return',      domain: 'primary' },
        // Heating circuit
        { id: eid(), fromNodeId: 'boiler', fromPort: 'flow',   toNodeId: 'rad',    toPort: 'flow',   domain: 'heating' },
        { id: eid(), fromNodeId: 'rad',    fromPort: 'return', toNodeId: 'boiler', toPort: 'return', domain: 'heating' },
        // Domestic cold supply
        { id: eid(), fromNodeId: 'mains', fromPort: 'cold_in', toNodeId: 'cyl', toPort: 'cold_in', domain: 'cold' },
        // DHW draw-off
        { id: eid(), fromNodeId: 'cyl', fromPort: 'hot_out', toNodeId: 'mains', toPort: 'out', domain: 'dhw' },
      ],
    }

    const result = validateLabGraph(graph)
    const errors = result.issues.filter(i => i.severity === 'error')
    expect(errors).toHaveLength(0)
    expect(result.ok).toBe(true)
  })
})
