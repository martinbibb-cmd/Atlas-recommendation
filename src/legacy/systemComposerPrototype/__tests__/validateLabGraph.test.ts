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

// ─── PR8 regression: original bug-class bad graphs ────────────────────────────
//
// These three graphs mirror the exact topology mistakes that triggered the
// original bug report.  Each must produce a specific validation error so that
// a regression will surface as a test failure rather than a silent bad render.

describe('PR8 regression — Bad Graph A: radiators connected to cylinder.hot_out', () => {
  // The original bug: emitters were wired to the cylinder domestic port (hot_out)
  // on the DHW domain.  This makes radiators appear to emit from stored hot water
  // rather than from the heating circuit — completely wrong hydraulic semantics.
  it('reports CYLINDER_DOMESTIC_PORT_ON_HEATING when hot_out feeds a radiator on heating domain', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'cyl', kind: 'dhw_unvented_cylinder', x: 0,   y: 0 },
        { id: 'rad', kind: 'radiator_loop',          x: 100, y: 0 },
      ],
      edges: [
        // Bug: radiator flow arrives from hot_out on the heating domain
        { id: 'bad-a-1', fromNodeId: 'cyl', fromPort: 'hot_out', toNodeId: 'rad', toPort: 'flow', domain: 'heating' },
      ],
    }
    const result = validateLabGraph(graph)
    expect(result.ok).toBe(false)
    expect(result.issues.some(i => i.code === 'CYLINDER_DOMESTIC_PORT_ON_HEATING')).toBe(true)
  })

  it('reports EMITTER_WRONG_DOMAIN when radiator is wired on dhw domain (to hot_out)', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'cyl', kind: 'dhw_unvented_cylinder', x: 0,   y: 0 },
        { id: 'rad', kind: 'radiator_loop',          x: 100, y: 0 },
      ],
      edges: [
        // Bug: radiator wired directly on DHW domain — emitter on wrong domain
        { id: 'bad-a-2', fromNodeId: 'cyl', fromPort: 'hot_out', toNodeId: 'rad', toPort: 'flow', domain: 'dhw' },
      ],
    }
    const result = validateLabGraph(graph)
    expect(result.ok).toBe(false)
    // Either EMITTER_WRONG_DOMAIN or CYLINDER_DOMESTIC_PORT_ON_HEATING should fire
    const hasBugError = result.issues.some(
      i => i.code === 'EMITTER_WRONG_DOMAIN' || i.code === 'CYLINDER_DOMESTIC_PORT_ON_HEATING',
    )
    expect(hasBugError).toBe(true)
  })
})

describe('PR8 regression — Bad Graph B: cylinder coil_flow on dhw domain', () => {
  // The original bug: the coil port was wired on the dhw domain instead of
  // primary.  This conflates the plate-exchange path with the domestic draw
  // path — a semantic error that produces incorrect activation logic.
  it('reports CYLINDER_COIL_PORT_WRONG_DOMAIN when coil_flow is on dhw domain', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_system_boiler', x: 0,   y: 0 },
        { id: 'cyl',    kind: 'dhw_unvented_cylinder',     x: 100, y: 0 },
      ],
      edges: [
        // Bug: coil_flow wired on dhw instead of primary
        { id: 'bad-b-1', fromNodeId: 'boiler', fromPort: 'flow', toNodeId: 'cyl', toPort: 'coil_flow', domain: 'dhw' },
      ],
    }
    const result = validateLabGraph(graph)
    expect(result.ok).toBe(false)
    const ruleC = result.issues.filter(i => i.code === 'CYLINDER_COIL_PORT_WRONG_DOMAIN')
    expect(ruleC.length).toBeGreaterThan(0)
    expect(ruleC[0].message).toContain('coil_flow')
  })

  it('reports CYLINDER_COIL_PORT_WRONG_DOMAIN when coil_return is on dhw domain', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'cyl',    kind: 'dhw_vented_cylinder', x: 0,   y: 0 },
        { id: 'outlet', kind: 'tap_outlet',           x: 100, y: 0 },
      ],
      edges: [
        // Bug: coil_return on dhw domain
        { id: 'bad-b-2', fromNodeId: 'cyl', fromPort: 'coil_return', toNodeId: 'outlet', toPort: 'hot_out', domain: 'dhw' },
      ],
    }
    const result = validateLabGraph(graph)
    expect(result.ok).toBe(false)
    const ruleC = result.issues.filter(i => i.code === 'CYLINDER_COIL_PORT_WRONG_DOMAIN')
    expect(ruleC.length).toBeGreaterThan(0)
    expect(ruleC[0].message).toContain('coil_return')
  })

  it('coil_flow on heating domain is also an error (not just dhw)', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_system_boiler', x: 0,   y: 0 },
        { id: 'cyl',    kind: 'dhw_unvented_cylinder',     x: 100, y: 0 },
      ],
      edges: [
        { id: 'bad-b-3', fromNodeId: 'boiler', fromPort: 'flow', toNodeId: 'cyl', toPort: 'coil_flow', domain: 'heating' },
      ],
    }
    const result = validateLabGraph(graph)
    expect(result.ok).toBe(false)
    expect(result.issues.some(i => i.code === 'CYLINDER_COIL_PORT_WRONG_DOMAIN')).toBe(true)
  })
})

describe('PR8 regression — Bad Graph C: emitters present but no heating-domain edges', () => {
  // The original bug: emitters existed in the graph but no heating-domain edge
  // connected them.  The validation check prevents this from silently producing
  // a schematic that shows radiators with no heat source path.
  it('reports EMITTERS_NO_HEATING_CIRCUIT when radiator has no heating edges at all', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_combi', x: 0,   y: 0 },
        { id: 'rad',    kind: 'radiator_loop',      x: 100, y: 0 },
      ],
      edges: [
        // Only a cold-domain edge — no heating domain
        { id: 'bad-c-1', fromNodeId: 'boiler', fromPort: 'flow', toNodeId: 'rad', toPort: 'flow', domain: 'cold' },
      ],
    }
    const result = validateLabGraph(graph)
    expect(result.ok).toBe(false)
    const ruleD = result.issues.filter(i => i.code === 'EMITTERS_NO_HEATING_CIRCUIT')
    expect(ruleD.length).toBeGreaterThan(0)
    expect(ruleD[0].message).toContain('heating circuit')
  })

  it('reports EMITTERS_NO_HEATING_CIRCUIT when ufh emitter has only primary edges', () => {
    const graph: LabGraph = {
      nodes: [
        { id: 'boiler', kind: 'heat_source_system_boiler', x: 0,   y: 0 },
        { id: 'ufh',    kind: 'ufh_loop',                  x: 100, y: 0 },
      ],
      edges: [
        // Bug: UFH only connected on primary, not on heating
        { id: 'bad-c-2', fromNodeId: 'boiler', fromPort: 'flow', toNodeId: 'ufh', toPort: 'flow', domain: 'primary' },
      ],
    }
    const result = validateLabGraph(graph)
    expect(result.ok).toBe(false)
    expect(result.issues.some(i => i.code === 'EMITTERS_NO_HEATING_CIRCUIT')).toBe(true)
  })
})
