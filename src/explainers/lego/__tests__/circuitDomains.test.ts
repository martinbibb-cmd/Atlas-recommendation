// src/explainers/lego/__tests__/circuitDomains.test.ts
//
// Tests for the PR2 circuit domain and typed port helpers introduced in
// src/explainers/lego/types/graph.ts.
//
// Validates:
//   - getAllowedPorts() returns the correct PortRole set for each node kind
//   - isPortAllowedForDomain() enforces the domain/port compatibility matrix
//   - isConnectionSemanticallyValid() detects illegal connections
//   - buildGraphToLabGraph() propagates explicit domains and infers fallback domains

import { describe, it, expect } from 'vitest'
import {
  getAllowedPorts,
  isPortAllowedForDomain,
  isConnectionSemanticallyValid,
  buildGraphToLabGraph,
  type CircuitDomain,
  type PortRole,
} from '../types/graph'
import type { BuildGraph } from '../builder/types'

// ─── getAllowedPorts ──────────────────────────────────────────────────────────

describe('getAllowedPorts', () => {
  it('cylinder has coil_flow, coil_return, cold_in, hot_out', () => {
    const ports = getAllowedPorts('dhw_vented_cylinder')
    expect(ports).toContain('coil_flow')
    expect(ports).toContain('coil_return')
    expect(ports).toContain('cold_in')
    expect(ports).toContain('hot_out')
  })

  it('unvented cylinder has same ports as vented', () => {
    expect(getAllowedPorts('dhw_unvented_cylinder')).toEqual(
      getAllowedPorts('dhw_vented_cylinder'),
    )
  })

  it('radiator_loop only allows flow and return', () => {
    const ports = getAllowedPorts('radiator_loop')
    expect(ports).toContain('flow')
    expect(ports).toContain('return')
    expect(ports).not.toContain('cold_in')
    expect(ports).not.toContain('hot_out')
    expect(ports).not.toContain('coil_flow')
    expect(ports).not.toContain('coil_return')
  })

  it('ufh_loop only allows flow and return', () => {
    const ports = getAllowedPorts('ufh_loop')
    expect(ports).toContain('flow')
    expect(ports).toContain('return')
    expect(ports).not.toContain('cold_in')
    expect(ports).not.toContain('hot_out')
  })

  it('tap_outlet allows cold_in and hot_out', () => {
    const ports = getAllowedPorts('tap_outlet')
    expect(ports).toContain('cold_in')
    expect(ports).toContain('hot_out')
    expect(ports).not.toContain('flow')
    expect(ports).not.toContain('return')
  })

  it('shower_outlet and bath_outlet match tap_outlet', () => {
    expect(getAllowedPorts('shower_outlet')).toEqual(getAllowedPorts('tap_outlet'))
    expect(getAllowedPorts('bath_outlet')).toEqual(getAllowedPorts('tap_outlet'))
  })

  it('heat source boilers include flow and return', () => {
    for (const kind of [
      'heat_source_combi',
      'heat_source_system_boiler',
      'heat_source_regular_boiler',
      'heat_source_heat_pump',
    ]) {
      const ports = getAllowedPorts(kind)
      expect(ports).toContain('flow')
      expect(ports).toContain('return')
    }
  })

  it('unknown kind returns a default set including flow and return', () => {
    const ports = getAllowedPorts('some_unknown_kind')
    expect(ports).toContain('flow')
    expect(ports).toContain('return')
  })
})

// ─── isPortAllowedForDomain ───────────────────────────────────────────────────

describe('isPortAllowedForDomain', () => {
  // heating
  it('heating domain allows flow and return', () => {
    expect(isPortAllowedForDomain('flow',   'heating')).toBe(true)
    expect(isPortAllowedForDomain('return', 'heating')).toBe(true)
  })

  it('heating domain allows transitional in/out', () => {
    expect(isPortAllowedForDomain('in',  'heating')).toBe(true)
    expect(isPortAllowedForDomain('out', 'heating')).toBe(true)
  })

  it('heating domain rejects coil ports', () => {
    expect(isPortAllowedForDomain('coil_flow',   'heating')).toBe(false)
    expect(isPortAllowedForDomain('coil_return', 'heating')).toBe(false)
  })

  it('heating domain rejects dhw ports', () => {
    expect(isPortAllowedForDomain('hot_out', 'heating')).toBe(false)
    expect(isPortAllowedForDomain('cold_in', 'heating')).toBe(false)
  })

  // primary
  it('primary domain allows flow, return, coil_flow, coil_return', () => {
    expect(isPortAllowedForDomain('flow',        'primary')).toBe(true)
    expect(isPortAllowedForDomain('return',      'primary')).toBe(true)
    expect(isPortAllowedForDomain('coil_flow',   'primary')).toBe(true)
    expect(isPortAllowedForDomain('coil_return', 'primary')).toBe(true)
  })

  it('primary domain rejects dhw ports', () => {
    expect(isPortAllowedForDomain('hot_out', 'primary')).toBe(false)
    expect(isPortAllowedForDomain('cold_in', 'primary')).toBe(false)
  })

  // dhw
  it('dhw domain allows hot_out and cold_in', () => {
    expect(isPortAllowedForDomain('hot_out', 'dhw')).toBe(true)
    expect(isPortAllowedForDomain('cold_in', 'dhw')).toBe(true)
  })

  it('dhw domain rejects heating ports', () => {
    expect(isPortAllowedForDomain('flow',        'dhw')).toBe(false)
    expect(isPortAllowedForDomain('return',      'dhw')).toBe(false)
    expect(isPortAllowedForDomain('coil_flow',   'dhw')).toBe(false)
    expect(isPortAllowedForDomain('coil_return', 'dhw')).toBe(false)
  })

  // cold
  it('cold domain allows cold_in and transitional in/out', () => {
    expect(isPortAllowedForDomain('cold_in', 'cold')).toBe(true)
    expect(isPortAllowedForDomain('in',      'cold')).toBe(true)
    expect(isPortAllowedForDomain('out',     'cold')).toBe(true)
  })

  it('cold domain rejects heating and dhw ports', () => {
    expect(isPortAllowedForDomain('flow',    'cold')).toBe(false)
    expect(isPortAllowedForDomain('return',  'cold')).toBe(false)
    expect(isPortAllowedForDomain('hot_out', 'cold')).toBe(false)
  })
})

// ─── isConnectionSemanticallyValid ────────────────────────────────────────────

describe('isConnectionSemanticallyValid', () => {
  // ── Valid examples from the spec ────────────────────────────────────────────

  it('cylinder coil_flow on primary is valid', () => {
    expect(isConnectionSemanticallyValid({
      fromKind: 'heat_source_system_boiler',
      fromPort: 'flow',
      toKind:   'dhw_unvented_cylinder',
      toPort:   'coil_flow',
      domain:   'primary',
    })).toBe(true)
  })

  it('cylinder hot_out on dhw is valid', () => {
    expect(isConnectionSemanticallyValid({
      fromKind: 'dhw_vented_cylinder',
      fromPort: 'hot_out',
      toKind:   'tap_outlet',
      toPort:   'hot_out',
      domain:   'dhw',
    })).toBe(true)
  })

  it('radiators flow on heating is valid', () => {
    expect(isConnectionSemanticallyValid({
      fromKind: 'heat_source_combi',
      fromPort: 'flow',
      toKind:   'radiator_loop',
      toPort:   'flow',
      domain:   'heating',
    })).toBe(true)
  })

  // ── Invalid examples from the spec ──────────────────────────────────────────

  it('radiators flow on dhw domain is invalid', () => {
    expect(isConnectionSemanticallyValid({
      fromKind: 'heat_source_combi',
      fromPort: 'flow',
      toKind:   'radiator_loop',
      toPort:   'flow',
      domain:   'dhw',
    })).toBe(false)
  })

  it('cylinder hot_out on heating domain is invalid', () => {
    expect(isConnectionSemanticallyValid({
      fromKind: 'dhw_vented_cylinder',
      fromPort: 'hot_out',
      toKind:   'radiator_loop',
      toPort:   'flow',
      domain:   'heating',
    })).toBe(false)
  })

  it('cylinder cold_in on primary domain is invalid', () => {
    expect(isConnectionSemanticallyValid({
      fromKind: 'heat_source_system_boiler',
      fromPort: 'flow',
      toKind:   'dhw_unvented_cylinder',
      toPort:   'cold_in',
      domain:   'primary',
    })).toBe(false)
  })

  it('radiators coil_flow port is not in allowed ports for radiator_loop', () => {
    expect(isConnectionSemanticallyValid({
      fromKind: 'heat_source_system_boiler',
      fromPort: 'flow',
      toKind:   'radiator_loop',
      toPort:   'coil_flow',
      domain:   'heating',
    })).toBe(false)
  })
})

// ─── buildGraphToLabGraph — domain propagation ────────────────────────────────

describe('buildGraphToLabGraph — domain propagation', () => {
  function makeTestGraph(overrides?: Partial<BuildGraph>): BuildGraph {
    return {
      nodes: [
        { id: 'boiler-1', kind: 'heat_source_system_boiler', x: 100, y: 100, r: 0 },
        { id: 'cyl-1',    kind: 'dhw_unvented_cylinder',     x: 300, y: 100, r: 0 },
        { id: 'rads-1',   kind: 'radiator_loop',             x: 300, y: 300, r: 0 },
      ],
      edges: [],
      ...overrides,
    }
  }

  it('explicit domain on BuildEdge is preserved in LabEdge', () => {
    const graph = makeTestGraph({
      edges: [
        {
          id: 'e1',
          from: { nodeId: 'boiler-1', portId: 'coil_flow' },
          to:   { nodeId: 'cyl-1',    portId: 'coil_flow' },
          domain: 'primary',
        },
      ],
    })
    const lab = buildGraphToLabGraph(graph)
    expect(lab.edges[0].domain).toBe('primary')
  })

  it('infers primary domain from coil port when no explicit domain', () => {
    const graph = makeTestGraph({
      edges: [
        {
          id: 'e1',
          from: { nodeId: 'boiler-1', portId: 'ch_flow_out' },
          to:   { nodeId: 'cyl-1',    portId: 'coil_flow' },
        },
      ],
    })
    const lab = buildGraphToLabGraph(graph)
    expect(lab.edges[0].domain).toBe('primary')
  })

  it('infers dhw domain from hot_out when no explicit domain', () => {
    const graph = makeTestGraph({
      edges: [
        {
          id: 'e1',
          from: { nodeId: 'cyl-1',  portId: 'hot_out' },
          to:   { nodeId: 'rads-1', portId: 'flow_in' },
        },
      ],
    })
    const lab = buildGraphToLabGraph(graph)
    expect(lab.edges[0].domain).toBe('dhw')
  })

  it('infers cold domain from cold_in port when no explicit domain', () => {
    const graph = makeTestGraph({
      edges: [
        {
          id: 'e1',
          from: { nodeId: 'boiler-1', portId: 'cold_out' },
          to:   { nodeId: 'cyl-1',    portId: 'cold_in'  },
        },
      ],
    })
    const lab = buildGraphToLabGraph(graph)
    expect(lab.edges[0].domain).toBe('cold')
  })

  it('infers heating domain for plain flow/return edges with no explicit domain', () => {
    const graph = makeTestGraph({
      edges: [
        {
          id: 'e1',
          from: { nodeId: 'boiler-1', portId: 'ch_flow_out' },
          to:   { nodeId: 'rads-1',   portId: 'flow_in'     },
        },
      ],
    })
    const lab = buildGraphToLabGraph(graph)
    expect(lab.edges[0].domain).toBe('heating')
  })

  it('maps ch_flow_out port ID to flow PortRole', () => {
    const graph = makeTestGraph({
      edges: [
        {
          id: 'e1',
          from: { nodeId: 'boiler-1', portId: 'ch_flow_out' },
          to:   { nodeId: 'rads-1',   portId: 'flow_in'     },
          domain: 'heating',
        },
      ],
    })
    const lab = buildGraphToLabGraph(graph)
    expect(lab.edges[0].fromPort).toBe('flow')
    expect(lab.edges[0].toPort).toBe('flow')
  })

  it('maps coil_flow and coil_return port IDs to typed PortRoles', () => {
    const graph = makeTestGraph({
      edges: [
        {
          id: 'e1',
          from: { nodeId: 'boiler-1', portId: 'coil_flow'   },
          to:   { nodeId: 'cyl-1',    portId: 'coil_flow'   },
          domain: 'primary',
        },
        {
          id: 'e2',
          from: { nodeId: 'cyl-1',    portId: 'coil_return' },
          to:   { nodeId: 'boiler-1', portId: 'coil_return' },
          domain: 'primary',
        },
      ],
    })
    const lab = buildGraphToLabGraph(graph)
    expect(lab.edges[0].fromPort).toBe('coil_flow')
    expect(lab.edges[0].toPort).toBe('coil_flow')
    expect(lab.edges[1].fromPort).toBe('coil_return')
    expect(lab.edges[1].toPort).toBe('coil_return')
  })

  it('maps hot_out and cold_in port IDs to typed PortRoles', () => {
    const graph = makeTestGraph({
      edges: [
        {
          id: 'e1',
          from: { nodeId: 'cyl-1',    portId: 'hot_out' },
          to:   { nodeId: 'rads-1',   portId: 'hot_in'  },
          domain: 'dhw',
        },
        {
          id: 'e2',
          from: { nodeId: 'boiler-1', portId: 'cold_out' },
          to:   { nodeId: 'cyl-1',    portId: 'cold_in'  },
          domain: 'cold',
        },
      ],
    })
    const lab = buildGraphToLabGraph(graph)
    expect(lab.edges[0].fromPort).toBe('hot_out')
    expect(lab.edges[0].toPort).toBe('hot_out')
    expect(lab.edges[1].fromPort).toBe('cold_in')
    expect(lab.edges[1].toPort).toBe('cold_in')
  })
})

// ─── Type exhaustiveness checks ───────────────────────────────────────────────

describe('type exhaustiveness', () => {
  it('all CircuitDomain values are distinct strings', () => {
    const domains: CircuitDomain[] = ['primary', 'heating', 'dhw', 'cold']
    const unique = new Set(domains)
    expect(unique.size).toBe(4)
  })

  it('all PortRole values are distinct strings', () => {
    const roles: PortRole[] = [
      'flow', 'return', 'coil_flow', 'coil_return', 'cold_in', 'hot_out', 'in', 'out',
    ]
    const unique = new Set(roles)
    expect(unique.size).toBe(8)
  })
})
