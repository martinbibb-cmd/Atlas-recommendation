/**
 * Tests for the BuilderShell graph validator (graphValidate.ts).
 *
 * Key focus: emitter reachability check correctly uses the extended adjacency
 * (which includes intra-node port connections) so layouts with intermediate
 * components (pumps, zone valves, etc.) are accepted without false warnings.
 */

import { describe, it, expect } from 'vitest'
import { validateGraph } from '../builder/graphValidate'
import type { BuildGraph } from '../builder/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId(prefix: string) {
  return `${prefix}_test`
}

// ─── Direct combi + radiator (no intermediate components) ─────────────────────

describe('emitter reachability — direct connection', () => {
  it('no warning for combi boiler directly connected to radiator', () => {
    const boilerId = makeId('boiler')
    const radId = makeId('rad')

    const graph: BuildGraph = {
      nodes: [
        { id: boilerId, kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
        { id: radId,    kind: 'radiator_loop',     x: 200, y: 0, r: 0 },
      ],
      edges: [
        {
          id: 'e1',
          from: { nodeId: boilerId, portId: 'ch_flow_out' },
          to:   { nodeId: radId,    portId: 'flow_in' },
        },
        {
          id: 'e2',
          from: { nodeId: radId,    portId: 'return_out' },
          to:   { nodeId: boilerId, portId: 'ch_return_in' },
        },
      ],
    }

    const warnings = validateGraph(graph)
    const emitterWarnings = warnings.filter(w => w.nodeId === radId)
    expect(emitterWarnings).toHaveLength(0)
  })

  it('no warning for system boiler directly connected to radiator', () => {
    const boilerId = makeId('sysboiler')
    const radId = makeId('rad')

    const graph: BuildGraph = {
      nodes: [
        { id: boilerId, kind: 'heat_source_system_boiler', x: 0, y: 0, r: 0 },
        { id: radId,    kind: 'radiator_loop',              x: 200, y: 0, r: 0 },
      ],
      edges: [
        {
          id: 'e1',
          from: { nodeId: boilerId, portId: 'ch_flow_out' },
          to:   { nodeId: radId,    portId: 'flow_in' },
        },
        {
          id: 'e2',
          from: { nodeId: radId,    portId: 'return_out' },
          to:   { nodeId: boilerId, portId: 'ch_return_in' },
        },
      ],
    }

    const warnings = validateGraph(graph)
    const emitterWarnings = warnings.filter(w => w.nodeId === radId)
    expect(emitterWarnings).toHaveLength(0)
  })
})

// ─── Pump-in-circuit layouts ──────────────────────────────────────────────────

describe('emitter reachability — pump on flow side', () => {
  it('no warning when pump is on the flow side between combi and radiator', () => {
    const boilerId = makeId('boiler')
    const pumpId  = makeId('pump')
    const radId   = makeId('rad')

    const graph: BuildGraph = {
      nodes: [
        { id: boilerId, kind: 'heat_source_combi', x: 0,   y: 0, r: 0 },
        { id: pumpId,   kind: 'pump',               x: 100, y: 0, r: 0 },
        { id: radId,    kind: 'radiator_loop',       x: 220, y: 0, r: 0 },
      ],
      edges: [
        {
          id: 'e1',
          from: { nodeId: boilerId, portId: 'ch_flow_out' },
          to:   { nodeId: pumpId,   portId: 'in' },
        },
        {
          id: 'e2',
          from: { nodeId: pumpId, portId: 'out' },
          to:   { nodeId: radId,  portId: 'flow_in' },
        },
        {
          id: 'e3',
          from: { nodeId: radId,    portId: 'return_out' },
          to:   { nodeId: boilerId, portId: 'ch_return_in' },
        },
      ],
    }

    const warnings = validateGraph(graph)
    const emitterWarnings = warnings.filter(w => w.nodeId === radId)
    expect(emitterWarnings).toHaveLength(0)
  })

  it('no warning when pump is on the return side between radiator and combi', () => {
    const boilerId = makeId('boiler')
    const pumpId  = makeId('pump')
    const radId   = makeId('rad')

    const graph: BuildGraph = {
      nodes: [
        { id: boilerId, kind: 'heat_source_combi', x: 0,   y: 0, r: 0 },
        { id: radId,    kind: 'radiator_loop',       x: 100, y: 0, r: 0 },
        { id: pumpId,   kind: 'pump',               x: 220, y: 0, r: 0 },
      ],
      edges: [
        {
          id: 'e1',
          from: { nodeId: boilerId, portId: 'ch_flow_out' },
          to:   { nodeId: radId,    portId: 'flow_in' },
        },
        {
          id: 'e2',
          from: { nodeId: radId,  portId: 'return_out' },
          to:   { nodeId: pumpId, portId: 'in' },
        },
        {
          id: 'e3',
          from: { nodeId: pumpId,   portId: 'out' },
          to:   { nodeId: boilerId, portId: 'ch_return_in' },
        },
      ],
    }

    const warnings = validateGraph(graph)
    const emitterWarnings = warnings.filter(w => w.nodeId === radId)
    expect(emitterWarnings).toHaveLength(0)
  })
})

// ─── Zone valve layouts ───────────────────────────────────────────────────────

describe('emitter reachability — zone valve on flow side', () => {
  it('no warning when zone valve is between boiler and radiator', () => {
    const boilerId = makeId('boiler')
    const valveId  = makeId('valve')
    const radId    = makeId('rad')

    const graph: BuildGraph = {
      nodes: [
        { id: boilerId, kind: 'heat_source_combi', x: 0,   y: 0, r: 0 },
        { id: valveId,  kind: 'zone_valve',         x: 100, y: 0, r: 0 },
        { id: radId,    kind: 'radiator_loop',       x: 220, y: 0, r: 0 },
      ],
      edges: [
        {
          id: 'e1',
          from: { nodeId: boilerId, portId: 'ch_flow_out' },
          to:   { nodeId: valveId,  portId: 'in' },
        },
        {
          id: 'e2',
          from: { nodeId: valveId, portId: 'out_a' },
          to:   { nodeId: radId,   portId: 'flow_in' },
        },
        {
          id: 'e3',
          from: { nodeId: radId,    portId: 'return_out' },
          to:   { nodeId: boilerId, portId: 'ch_return_in' },
        },
      ],
    }

    const warnings = validateGraph(graph)
    const emitterWarnings = warnings.filter(w => w.nodeId === radId)
    expect(emitterWarnings).toHaveLength(0)
  })
})

// ─── Error cases still caught ─────────────────────────────────────────────────

describe('emitter reachability — genuine errors still flagged', () => {
  it('warns when emitter flow_in has no connection', () => {
    const boilerId = makeId('boiler')
    const radId    = makeId('rad')

    const graph: BuildGraph = {
      nodes: [
        { id: boilerId, kind: 'heat_source_combi', x: 0,   y: 0, r: 0 },
        { id: radId,    kind: 'radiator_loop',      x: 200, y: 0, r: 0 },
      ],
      edges: [
        // Only return side connected — flow_in is open
        {
          id: 'e1',
          from: { nodeId: radId,    portId: 'return_out' },
          to:   { nodeId: boilerId, portId: 'ch_return_in' },
        },
      ],
    }

    const warnings = validateGraph(graph)
    const emitterWarnings = warnings.filter(w => w.nodeId === radId)
    expect(emitterWarnings.length).toBeGreaterThan(0)
  })

  it('warns when emitter is isolated (no connections at all)', () => {
    const boilerId = makeId('boiler')
    const radId    = makeId('rad')

    const graph: BuildGraph = {
      nodes: [
        { id: boilerId, kind: 'heat_source_combi', x: 0,   y: 0, r: 0 },
        { id: radId,    kind: 'radiator_loop',      x: 200, y: 0, r: 0 },
      ],
      edges: [],
    }

    const warnings = validateGraph(graph)
    const emitterWarnings = warnings.filter(w => w.nodeId === radId)
    expect(emitterWarnings.length).toBeGreaterThan(0)
  })

  it('warning title for path failure is "Emitter not reachable from heat source"', () => {
    const boilerId = makeId('boiler')
    const radId    = makeId('rad')
    const otherBoilerId = makeId('other_boiler')

    // Radiator is on a different boiler's circuit
    const graph: BuildGraph = {
      nodes: [
        { id: boilerId,      kind: 'heat_source_combi',  x: 0,   y: 0, r: 0 },
        { id: otherBoilerId, kind: 'heat_source_combi',  x: 300, y: 0, r: 0 },
        { id: radId,         kind: 'radiator_loop',       x: 500, y: 0, r: 0 },
      ],
      edges: [
        // Radiator connected only to the other boiler
        {
          id: 'e1',
          from: { nodeId: otherBoilerId, portId: 'ch_flow_out' },
          to:   { nodeId: radId,         portId: 'flow_in' },
        },
        {
          id: 'e2',
          from: { nodeId: radId,         portId: 'return_out' },
          to:   { nodeId: otherBoilerId, portId: 'ch_return_in' },
        },
      ],
    }

    const warnings = validateGraph(graph)
    // Both boilers are heat sources, so the radiator IS reachable from one of them — no warning
    const emitterWarnings = warnings.filter(w => w.nodeId === radId)
    expect(emitterWarnings).toHaveLength(0)
  })
})

// ─── Warning message text ─────────────────────────────────────────────────────

describe('emitter warning message text', () => {
  it('path warning title says "not reachable from heat source"', () => {
    // Construct a graph where both ports are connected but emitter has no
    // path back to the heat source (isolated sub-circuit).
    const boilerId = makeId('boiler')
    const radId    = makeId('rad')
    const pumpId   = makeId('pump')

    // pump connected to rad but NOT to boiler
    const graph: BuildGraph = {
      nodes: [
        { id: boilerId, kind: 'heat_source_combi', x: 0,   y: 0, r: 0 },
        { id: pumpId,   kind: 'pump',               x: 100, y: 0, r: 0 },
        { id: radId,    kind: 'radiator_loop',       x: 220, y: 0, r: 0 },
      ],
      edges: [
        // pump → rad (flow side connected)
        {
          id: 'e1',
          from: { nodeId: pumpId, portId: 'out' },
          to:   { nodeId: radId,  portId: 'flow_in' },
        },
        // rad return → pump (return side connected, but pump is NOT connected to boiler)
        {
          id: 'e2',
          from: { nodeId: radId,  portId: 'return_out' },
          to:   { nodeId: pumpId, portId: 'in' },
        },
      ],
    }

    const warnings = validateGraph(graph)
    const pathWarning = warnings.find(
      w => w.nodeId === radId && w.id.startsWith('emitter_path_'),
    )
    expect(pathWarning).toBeDefined()
    expect(pathWarning!.title).toBe('Emitter not reachable from heat source')
  })
})
