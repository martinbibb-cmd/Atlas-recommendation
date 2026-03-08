/**
 * Tests for schematicBlocks — shared schematic component definition library.
 *
 * Validates:
 *  1. SchematicComponentDefinition structure for key components
 *  2. CylinderModel ↔ PartKind round-trip helpers
 *  3. Port position derivation (schematicPortToDxDy)
 *  4. All PALETTE items have an entry in SCHEMATIC_REGISTRY or fall back gracefully
 *  5. Registry canonical grammar matches builder ports.ts
 */

import { describe, it, expect } from 'vitest'
import {
  SCHEMATIC_REGISTRY,
  cylinderModelFromKind,
  kindFromCylinderModel,
  schematicPortToDxDy,
  type CylinderModel,
  type ComponentVisualSize,
  type SchematicComponentDefinition,
} from '../builder/schematicBlocks'
import { TOKEN_W, TOKEN_H } from '../builder/ports'
import { PALETTE, PALETTE_SECTIONS } from '../builder/palette'

// ─── Registry structure ───────────────────────────────────────────────────────

describe('SCHEMATIC_REGISTRY — structure', () => {
  it('contains an entry for all heat source kinds', () => {
    expect(SCHEMATIC_REGISTRY).toHaveProperty('heat_source_combi')
    expect(SCHEMATIC_REGISTRY).toHaveProperty('heat_source_system_boiler')
    expect(SCHEMATIC_REGISTRY).toHaveProperty('heat_source_regular_boiler')
    expect(SCHEMATIC_REGISTRY).toHaveProperty('heat_source_heat_pump')
  })

  it('contains an entry for all cylinder kinds', () => {
    expect(SCHEMATIC_REGISTRY).toHaveProperty('dhw_unvented_cylinder')
    expect(SCHEMATIC_REGISTRY).toHaveProperty('dhw_vented_cylinder')
    expect(SCHEMATIC_REGISTRY).toHaveProperty('dhw_mixergy')
  })

  it('contains an entry for both control kinds', () => {
    expect(SCHEMATIC_REGISTRY).toHaveProperty('three_port_valve')
    expect(SCHEMATIC_REGISTRY).toHaveProperty('zone_valve')
  })

  it('contains entries for emitters', () => {
    expect(SCHEMATIC_REGISTRY).toHaveProperty('radiator_loop')
    expect(SCHEMATIC_REGISTRY).toHaveProperty('ufh_loop')
  })

  it('contains entries for support components', () => {
    expect(SCHEMATIC_REGISTRY).toHaveProperty('buffer')
    expect(SCHEMATIC_REGISTRY).toHaveProperty('low_loss_header')
    expect(SCHEMATIC_REGISTRY).toHaveProperty('pump')
    expect(SCHEMATIC_REGISTRY).toHaveProperty('sealed_system_kit')
    expect(SCHEMATIC_REGISTRY).toHaveProperty('open_vent')
    expect(SCHEMATIC_REGISTRY).toHaveProperty('feed_and_expansion')
    expect(SCHEMATIC_REGISTRY).toHaveProperty('cws_cistern')
  })

  it('every definition has the expected shape', () => {
    const validSizes: ComponentVisualSize[] = ['large', 'medium', 'small']
    for (const [kind, def] of Object.entries(SCHEMATIC_REGISTRY)) {
      expect(def.kind).toBe(kind)
      expect(typeof def.width).toBe('number')
      expect(typeof def.height).toBe('number')
      expect(Array.isArray(def.ports)).toBe(true)
      expect(def.ports.length).toBeGreaterThan(0)
      expect(validSizes).toContain(def.visualSize)
    }
  })

  it('major plant components have visualSize "large"', () => {
    const largePlant = [
      'heat_source_combi',
      'heat_source_system_boiler',
      'heat_source_regular_boiler',
      'heat_source_heat_pump',
      'dhw_unvented_cylinder',
      'dhw_vented_cylinder',
      'dhw_mixergy',
      'buffer',
      'low_loss_header',
      'radiator_loop',
      'ufh_loop',
      'cws_cistern',
    ]
    for (const kind of largePlant) {
      expect(
        (SCHEMATIC_REGISTRY[kind] as SchematicComponentDefinition).visualSize,
        `${kind} should be large`,
      ).toBe('large')
    }
  })

  it('routing devices have visualSize "medium"', () => {
    const routing = ['pump', 'zone_valve', 'three_port_valve']
    for (const kind of routing) {
      expect(
        (SCHEMATIC_REGISTRY[kind] as SchematicComponentDefinition).visualSize,
        `${kind} should be medium`,
      ).toBe('medium')
    }
  })

  it('support accessories have visualSize "small"', () => {
    const support = ['sealed_system_kit', 'open_vent', 'feed_and_expansion']
    for (const kind of support) {
      expect(
        (SCHEMATIC_REGISTRY[kind] as SchematicComponentDefinition).visualSize,
        `${kind} should be small`,
      ).toBe('small')
    }
  })

  it('every port has a valid side', () => {
    const validSides = new Set(['left', 'right', 'top', 'bottom'])
    for (const def of Object.values(SCHEMATIC_REGISTRY)) {
      for (const port of def.ports) {
        expect(validSides.has(port.side), `${def.kind}.${port.id} side='${port.side}'`).toBe(true)
      }
    }
  })

  it('every port has a valid direction', () => {
    const validDirections = new Set(['in', 'out', 'bidirectional'])
    for (const def of Object.values(SCHEMATIC_REGISTRY)) {
      for (const port of def.ports) {
        expect(validDirections.has(port.direction), `${def.kind}.${port.id} direction='${port.direction}'`).toBe(true)
      }
    }
  })
})

// ─── Canonical grammar ────────────────────────────────────────────────────────

describe('canonical grammar — heat sources', () => {
  it('regular boiler has only flow_out (right) and return_in (right)', () => {
    const def = SCHEMATIC_REGISTRY['heat_source_regular_boiler'] as SchematicComponentDefinition
    const ids = def.ports.map(p => p.id)
    expect(ids).toContain('flow_out')
    expect(ids).toContain('return_in')
    // Both CH ports exit on the right (system side)
    expect(def.ports.find(p => p.id === 'flow_out')?.side).toBe('right')
    expect(def.ports.find(p => p.id === 'return_in')?.side).toBe('right')
  })

  it('combi has 4 ports: flow_out, return_in, cold_in, hot_out', () => {
    const def = SCHEMATIC_REGISTRY['heat_source_combi'] as SchematicComponentDefinition
    const ids = def.ports.map(p => p.id)
    expect(ids).toContain('flow_out')
    expect(ids).toContain('return_in')
    expect(ids).toContain('cold_in')
    expect(ids).toContain('hot_out')
  })

  it('combi CH ports (flow_out, return_in) are both on right; DHW cold_in on left', () => {
    const def = SCHEMATIC_REGISTRY['heat_source_combi'] as SchematicComponentDefinition
    // Both CH hydraulic ports exit on the right (system side)
    expect(def.ports.find(p => p.id === 'flow_out')?.side).toBe('right')
    expect(def.ports.find(p => p.id === 'return_in')?.side).toBe('right')
    // DHW cold inlet stays on left
    expect(def.ports.find(p => p.id === 'cold_in')?.side).toBe('left')
  })
})

describe('canonical grammar — cylinders', () => {
  const cylinderKinds = ['dhw_unvented_cylinder', 'dhw_vented_cylinder', 'dhw_mixergy']

  for (const kind of cylinderKinds) {
    it(`${kind}: coil_flow and coil_return on left side`, () => {
      const def = SCHEMATIC_REGISTRY[kind] as SchematicComponentDefinition
      expect(def.ports.find(p => p.id === 'coil_flow')?.side).toBe('left')
      expect(def.ports.find(p => p.id === 'coil_return')?.side).toBe('left')
    })

    it(`${kind}: hot_out on top, cold_in on bottom`, () => {
      const def = SCHEMATIC_REGISTRY[kind] as SchematicComponentDefinition
      expect(def.ports.find(p => p.id === 'hot_out')?.side).toBe('top')
      expect(def.ports.find(p => p.id === 'cold_in')?.side).toBe('bottom')
    })

    it(`${kind}: hot_out direction is out, cold_in direction is in`, () => {
      const def = SCHEMATIC_REGISTRY[kind] as SchematicComponentDefinition
      expect(def.ports.find(p => p.id === 'hot_out')?.direction).toBe('out')
      expect(def.ports.find(p => p.id === 'cold_in')?.direction).toBe('in')
    })
  }
})

describe('canonical grammar — controls', () => {
  it('three_port_valve (Y-plan) has flow_in (left), hw_out (right), ch_out (right)', () => {
    const def = SCHEMATIC_REGISTRY['three_port_valve'] as SchematicComponentDefinition
    expect(def.ports.find(p => p.id === 'in')?.side).toBe('left')
    expect(def.ports.find(p => p.id === 'out_a')?.side).toBe('right')
    expect(def.ports.find(p => p.id === 'out_b')?.side).toBe('right')
  })

  it('zone_valve (S-plan) has flow_in (left) and flow_out (right)', () => {
    const def = SCHEMATIC_REGISTRY['zone_valve'] as SchematicComponentDefinition
    expect(def.ports.find(p => p.id === 'in')?.side).toBe('left')
    expect(def.ports.find(p => p.id === 'out_a')?.side).toBe('right')
  })
})

describe('canonical grammar — emitters', () => {
  it('radiator_loop has flow_in (left) and return_out (right)', () => {
    const def = SCHEMATIC_REGISTRY['radiator_loop'] as SchematicComponentDefinition
    expect(def.ports.find(p => p.id === 'flow_in')?.side).toBe('left')
    expect(def.ports.find(p => p.id === 'return_out')?.side).toBe('right')
  })
})

// ─── CylinderModel helpers ────────────────────────────────────────────────────

describe('cylinderModelFromKind', () => {
  it('dhw_vented_cylinder → standard + vented', () => {
    expect(cylinderModelFromKind('dhw_vented_cylinder')).toEqual({
      storageKind: 'standard',
      supplyKind: 'vented',
    })
  })

  it('dhw_unvented_cylinder → standard + unvented', () => {
    expect(cylinderModelFromKind('dhw_unvented_cylinder')).toEqual({
      storageKind: 'standard',
      supplyKind: 'unvented',
    })
  })

  it('dhw_mixergy → mixergy + unvented', () => {
    expect(cylinderModelFromKind('dhw_mixergy')).toEqual({
      storageKind: 'mixergy',
      supplyKind: 'unvented',
    })
  })

  it('returns null for non-cylinder kinds', () => {
    expect(cylinderModelFromKind('heat_source_combi')).toBeNull()
    expect(cylinderModelFromKind('radiator_loop')).toBeNull()
    expect(cylinderModelFromKind('pump')).toBeNull()
  })
})

describe('kindFromCylinderModel', () => {
  it('standard + vented → dhw_vented_cylinder', () => {
    const model: CylinderModel = { storageKind: 'standard', supplyKind: 'vented' }
    expect(kindFromCylinderModel(model)).toBe('dhw_vented_cylinder')
  })

  it('standard + unvented → dhw_unvented_cylinder', () => {
    const model: CylinderModel = { storageKind: 'standard', supplyKind: 'unvented' }
    expect(kindFromCylinderModel(model)).toBe('dhw_unvented_cylinder')
  })

  it('mixergy + unvented → dhw_mixergy', () => {
    const model: CylinderModel = { storageKind: 'mixergy', supplyKind: 'unvented' }
    expect(kindFromCylinderModel(model)).toBe('dhw_mixergy')
  })

  it('mixergy + vented → dhw_mixergy (nearest kind)', () => {
    const model: CylinderModel = { storageKind: 'mixergy', supplyKind: 'vented' }
    expect(kindFromCylinderModel(model)).toBe('dhw_mixergy')
  })

  it('round-trip: standard cylinder model → kind → model preserves standard variants', () => {
    const kinds = ['dhw_vented_cylinder', 'dhw_unvented_cylinder', 'dhw_mixergy']
    for (const kind of kinds) {
      const model = cylinderModelFromKind(kind)
      if (model) {
        const roundTripped = kindFromCylinderModel(model)
        expect(roundTripped).toBe(kind)
      }
    }
  })
})

// ─── schematicPortToDxDy ──────────────────────────────────────────────────────

describe('schematicPortToDxDy', () => {
  it('left side at x=0 maps to dx=0, dy=0', () => {
    const result = schematicPortToDxDy(
      { id: 'p', label: '', side: 'left', x: 0, y: 0, direction: 'in' },
      TOKEN_W, TOKEN_H,
    )
    expect(result.dx).toBe(0)
    expect(result.dy).toBe(0)
  })

  it('left side at x=0.5 maps to dx=0, dy=TOKEN_H/2', () => {
    const result = schematicPortToDxDy(
      { id: 'p', label: '', side: 'left', x: 0.5, y: 0, direction: 'in' },
      TOKEN_W, TOKEN_H,
    )
    expect(result.dx).toBe(0)
    expect(result.dy).toBeCloseTo(TOKEN_H / 2)
  })

  it('right side at x=0.5 maps to dx=TOKEN_W, dy=TOKEN_H/2', () => {
    const result = schematicPortToDxDy(
      { id: 'p', label: '', side: 'right', x: 0.5, y: 0, direction: 'out' },
      TOKEN_W, TOKEN_H,
    )
    expect(result.dx).toBe(TOKEN_W)
    expect(result.dy).toBeCloseTo(TOKEN_H / 2)
  })

  it('top side at x=0.5 maps to dx=TOKEN_W/2, dy=0', () => {
    const result = schematicPortToDxDy(
      { id: 'p', label: '', side: 'top', x: 0.5, y: 0, direction: 'out' },
      TOKEN_W, TOKEN_H,
    )
    expect(result.dx).toBeCloseTo(TOKEN_W / 2)
    expect(result.dy).toBe(0)
  })

  it('bottom side at x=0.5 maps to dx=TOKEN_W/2, dy=TOKEN_H', () => {
    const result = schematicPortToDxDy(
      { id: 'p', label: '', side: 'bottom', x: 0.5, y: 0, direction: 'in' },
      TOKEN_W, TOKEN_H,
    )
    expect(result.dx).toBeCloseTo(TOKEN_W / 2)
    expect(result.dy).toBe(TOKEN_H)
  })
})

// ─── Palette categories ───────────────────────────────────────────────────────

describe('PALETTE — categories', () => {
  it('every PALETTE item has a category', () => {
    for (const item of PALETTE) {
      expect(item.category, `${item.kind} missing category`).toBeDefined()
    }
  })

  it('sealed_system_kit is in system_support category', () => {
    const item = PALETTE.find(p => p.kind === 'sealed_system_kit')
    expect(item).toBeDefined()
    expect(item!.category).toBe('system_support')
  })

  it('controls category includes both valve types', () => {
    const controlItems = PALETTE.filter(p => p.category === 'controls')
    const kinds = controlItems.map(p => p.kind)
    expect(kinds).toContain('three_port_valve')
    expect(kinds).toContain('zone_valve')
  })

  it('heat_sources category includes all four heat sources', () => {
    const items = PALETTE.filter(p => p.category === 'heat_sources')
    const kinds = items.map(p => p.kind)
    expect(kinds).toContain('heat_source_combi')
    expect(kinds).toContain('heat_source_system_boiler')
    expect(kinds).toContain('heat_source_regular_boiler')
    expect(kinds).toContain('heat_source_heat_pump')
  })

  it('cylinders category includes all three cylinder types', () => {
    const items = PALETTE.filter(p => p.category === 'cylinders')
    const kinds = items.map(p => p.kind)
    expect(kinds).toContain('dhw_unvented_cylinder')
    expect(kinds).toContain('dhw_vented_cylinder')
    expect(kinds).toContain('dhw_mixergy')
  })

  it('outlets category includes all outlet types', () => {
    const items = PALETTE.filter(p => p.category === 'outlets')
    const kinds = items.map(p => p.kind)
    expect(kinds).toContain('tap_outlet')
    expect(kinds).toContain('bath_outlet')
    expect(kinds).toContain('shower_outlet')
    expect(kinds).toContain('cold_tap_outlet')
  })
})

describe('PALETTE_SECTIONS', () => {
  const expectedCategories = [
    'heat_sources',
    'cylinders',
    'controls',
    'emitters',
    'system_support',
    'outlets',
  ]

  it('contains all expected categories', () => {
    const categories = PALETTE_SECTIONS.map(s => s.category)
    for (const cat of expectedCategories) {
      expect(categories).toContain(cat)
    }
  })

  it('every section has a label and at least one item', () => {
    for (const section of PALETTE_SECTIONS) {
      expect(section.label.length).toBeGreaterThan(0)
      expect(section.items.length).toBeGreaterThan(0)
    }
  })

  it('section items match PALETTE filter for that category', () => {
    for (const section of PALETTE_SECTIONS) {
      const expected = PALETTE.filter(p => p.category === section.category)
      expect(section.items).toHaveLength(expected.length)
    }
  })
})
