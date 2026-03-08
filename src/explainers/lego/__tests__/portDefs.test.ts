/**
 * Regression tests for portDefs — registry-first port definition resolver.
 *
 * These tests verify that:
 *  1. Migrated component kinds always return port positions from SCHEMATIC_REGISTRY
 *     geometry (not from the legacy portsForKind fallback).
 *  2. Non-migrated kinds (tees, manifolds, outlets) still get valid port defs
 *     through the fallback path.
 *  3. The port geometry used by snapping/routing matches what the renderer sees.
 */

import { describe, it, expect } from 'vitest'
import { getPortDefs } from '../builder/portDefs'
import { SCHEMATIC_REGISTRY, schematicPortToDxDy } from '../builder/schematicBlocks'
import type { PartKind } from '../builder/types'

// ─── Registry-first resolution ────────────────────────────────────────────────

describe('getPortDefs — registry-first for migrated kinds', () => {
  const registeredKinds = Object.keys(SCHEMATIC_REGISTRY) as PartKind[]

  it('returns the same number of ports as the registry for every registered kind', () => {
    for (const kind of registeredKinds) {
      const reg = SCHEMATIC_REGISTRY[kind]
      const defs = getPortDefs(kind)
      expect(defs).toHaveLength(reg.ports.length)
    }
  })

  it('returns dx/dy positions derived from registry geometry (not legacy px table)', () => {
    for (const kind of registeredKinds) {
      const reg = SCHEMATIC_REGISTRY[kind]
      const defs = getPortDefs(kind)

      for (const def of defs) {
        const regPort = reg.ports.find(p => p.id === def.id)
        expect(regPort).toBeDefined()
        const expected = schematicPortToDxDy(regPort!, reg.width, reg.height)
        expect(def.dx).toBe(expected.dx)
        expect(def.dy).toBe(expected.dy)
      }
    }
  })

  it('preserves port ids, labels and directions from the registry', () => {
    for (const kind of registeredKinds) {
      const reg = SCHEMATIC_REGISTRY[kind]
      const defs = getPortDefs(kind)

      for (const def of defs) {
        const regPort = reg.ports.find(p => p.id === def.id)
        expect(regPort).toBeDefined()
        expect(def.label).toBe(regPort!.label)
        expect(def.direction).toBe(regPort!.direction)
      }
    }
  })

  it('maps semanticRole to role correctly for migrated kinds', () => {
    const combiPorts = getPortDefs('heat_source_combi')
    expect(combiPorts.find(p => p.id === 'flow_out')?.role).toBe('flow')
    expect(combiPorts.find(p => p.id === 'return_in')?.role).toBe('return')
    expect(combiPorts.find(p => p.id === 'cold_in')?.role).toBe('cold')
    expect(combiPorts.find(p => p.id === 'hot_out')?.role).toBe('hot')
  })
})

// ─── Key port coordinate spot-checks ─────────────────────────────────────────

describe('getPortDefs — key component spot-checks', () => {
  it('heat_source_combi: flow_out on right mid-Y, return_in on left mid-Y', () => {
    const ports = getPortDefs('heat_source_combi')
    const flow = ports.find(p => p.id === 'flow_out')!
    const ret  = ports.find(p => p.id === 'return_in')!
    expect(flow.dx).toBe(170)   // right edge
    expect(flow.dy).toBe(37)    // mid-height (74 * 0.5)
    expect(ret.dx).toBe(0)      // left edge
    expect(ret.dy).toBe(37)
  })

  it('cylinder: coil ports on left, hot_out on top-centre, cold_in on bottom-centre', () => {
    for (const kind of ['dhw_unvented_cylinder', 'dhw_vented_cylinder', 'dhw_mixergy'] as PartKind[]) {
      const ports = getPortDefs(kind)
      const coilFlow   = ports.find(p => p.id === 'coil_flow')!
      const coilReturn = ports.find(p => p.id === 'coil_return')!
      const hotOut     = ports.find(p => p.id === 'hot_out')!
      const coldIn     = ports.find(p => p.id === 'cold_in')!

      expect(coilFlow.dx).toBe(0)       // left edge
      expect(coilFlow.dy).toBe(18)      // 18/74 * 74 = 18
      expect(coilReturn.dx).toBe(0)     // left edge
      expect(coilReturn.dy).toBe(56)    // (74-18)/74 * 74 = 56

      expect(hotOut.dx).toBe(85)        // mid-width (170 * 0.5)
      expect(hotOut.dy).toBe(0)         // top edge
      expect(coldIn.dx).toBe(85)        // mid-width
      expect(coldIn.dy).toBe(74)        // bottom edge
    }
  })

  it('zone_valve: 2 ports only (in left-mid, out_a right-mid)', () => {
    const ports = getPortDefs('zone_valve')
    expect(ports).toHaveLength(2)
    const inlet  = ports.find(p => p.id === 'in')!
    const outlet = ports.find(p => p.id === 'out_a')!
    expect(inlet.dx).toBe(0)
    expect(inlet.dy).toBe(37)
    expect(outlet.dx).toBe(170)
    expect(outlet.dy).toBe(37)
    // Ensure legacy 3-port out_b is NOT present
    expect(ports.find(p => p.id === 'out_b')).toBeUndefined()
  })

  it('three_port_valve: in on left-mid, out_a and out_b staggered on right', () => {
    const ports = getPortDefs('three_port_valve')
    expect(ports).toHaveLength(3)
    const inlet  = ports.find(p => p.id === 'in')!
    const outA   = ports.find(p => p.id === 'out_a')!
    const outB   = ports.find(p => p.id === 'out_b')!
    expect(inlet.dx).toBe(0)
    expect(inlet.dy).toBe(37)
    expect(outA.dx).toBe(170)
    expect(outA.dy).toBe(18)
    expect(outB.dx).toBe(170)
    expect(outB.dy).toBe(56)
  })
})

// ─── Fallback for non-migrated kinds ─────────────────────────────────────────

describe('getPortDefs — fallback for unregistered kinds', () => {
  it('tee_hot returns at least 3 ports', () => {
    const ports = getPortDefs('tee_hot')
    expect(ports.length).toBeGreaterThanOrEqual(3)
  })

  it('tap_outlet returns hot_in and cold_in ports', () => {
    const ports = getPortDefs('tap_outlet')
    expect(ports.find(p => p.id === 'hot_in')).toBeDefined()
    expect(ports.find(p => p.id === 'cold_in')).toBeDefined()
  })

  it('manifold_hot returns at least 5 ports', () => {
    const ports = getPortDefs('manifold_hot')
    expect(ports.length).toBeGreaterThanOrEqual(5)
  })
})
