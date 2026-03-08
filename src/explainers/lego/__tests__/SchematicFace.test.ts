/**
 * Tests for the shared SchematicFace module.
 *
 * Validates that:
 *  1. All three exports (SchematicFaceContent, SchematicFace, SchematicFaceToken) exist.
 *  2. SchematicFaceContent renders for all key PartKind values without throwing.
 *  3. SchematicFaceToken accepts play-mode dimensions and renders correctly.
 *  4. SchematicFace and SchematicFaceToken share the same canonical 170×74 viewBox.
 *
 * These tests ensure the shared visual language is consistent between builder
 * tokens and play-mode component faces.
 */

import { describe, it, expect } from 'vitest'
import { SchematicFace, SchematicFaceToken, SchematicFaceContent } from '../builder/SchematicFace'
import type { PartKind } from '../builder/types'

// ─── Export surface ───────────────────────────────────────────────────────────

describe('SchematicFace exports', () => {
  it('exports SchematicFaceContent', () => {
    expect(typeof SchematicFaceContent).toBe('function')
  })

  it('exports SchematicFace', () => {
    expect(typeof SchematicFace).toBe('function')
  })

  it('exports SchematicFaceToken', () => {
    expect(typeof SchematicFaceToken).toBe('function')
  })
})

// ─── All key component kinds produce a renderable element ────────────────────

const KEY_KINDS: PartKind[] = [
  'heat_source_combi',
  'heat_source_system_boiler',
  'heat_source_regular_boiler',
  'heat_source_heat_pump',
  'dhw_unvented_cylinder',
  'dhw_vented_cylinder',
  'dhw_mixergy',
  'three_port_valve',
  'zone_valve',
  'radiator_loop',
  'ufh_loop',
]

describe('SchematicFaceContent — renders for all key PartKinds', () => {
  KEY_KINDS.forEach(kind => {
    it(`renders without throwing for kind="${kind}"`, () => {
      expect(() => SchematicFaceContent({ kind, label: kind })).not.toThrow()
      const el = SchematicFaceContent({ kind, label: kind })
      expect(el).not.toBeNull()
    })
  })
})

// ─── SchematicFace — standalone SVG ──────────────────────────────────────────

describe('SchematicFace — standalone builder token', () => {
  it('returns a React element for heat_source_combi', () => {
    const el = SchematicFace({ kind: 'heat_source_combi', label: 'Combi' })
    expect(el).not.toBeNull()
    // Check it's a React element (has a type property)
    expect(el).toHaveProperty('type')
  })

  it('renders slot badge when slot prop is provided', () => {
    const el = SchematicFace({ kind: 'tap_outlet', label: 'Tap', slot: 'A' })
    // The element renders without error
    expect(el).not.toBeNull()
  })

  it('renders a fallback for an unknown PartKind', () => {
    // Generic fallback branch — should not throw
    const el = SchematicFace({ kind: 'tap_outlet', label: 'Tap' })
    expect(el).not.toBeNull()
  })
})

// ─── SchematicFaceToken — positioned play-mode token ─────────────────────────

describe('SchematicFaceToken — play-mode positioned token', () => {
  it('returns a React element with the given position props', () => {
    const el = SchematicFaceToken({
      kind: 'heat_source_combi',
      label: 'Combi',
      x: 360,
      y: 86,
      width: 180,
      height: 88,
    })
    expect(el).not.toBeNull()
    expect(el).toHaveProperty('type')
    // The nested SVG element should carry position props
    expect(el.props.x).toBe(360)
    expect(el.props.y).toBe(86)
    expect(el.props.width).toBe(180)
    expect(el.props.height).toBe(88)
  })

  it('always uses the canonical 170×74 viewBox', () => {
    const el = SchematicFaceToken({
      kind: 'dhw_unvented_cylinder',
      label: 'Cylinder',
      x: 0,
      y: 0,
      width: 180,
      height: 88,
    })
    // The inner SVG preserves the canonical 170×74 coordinate space
    expect(el.props.viewBox).toBe('0 0 170 74')
  })

  it('renders all cylinder face variants', () => {
    const kinds: PartKind[] = ['dhw_unvented_cylinder', 'dhw_vented_cylinder', 'dhw_mixergy']
    kinds.forEach(kind => {
      const el = SchematicFaceToken({ kind, label: kind, x: 0, y: 0, width: 180, height: 88 })
      expect(el).not.toBeNull()
    })
  })

  it('renders both valve kinds', () => {
    const valveKinds: PartKind[] = ['three_port_valve', 'zone_valve']
    valveKinds.forEach(kind => {
      const el = SchematicFaceToken({ kind, label: kind, x: 200, y: 170, width: 110, height: 46 })
      expect(el).not.toBeNull()
    })
  })
})

// ─── Visual identity: SchematicFace and SchematicFaceToken use the same viewBox ─

describe('visual identity — Builder and Play share the same viewBox', () => {
  it('SchematicFace has viewBox 0 0 170 74', () => {
    const el = SchematicFace({ kind: 'heat_source_combi', label: 'Combi' })
    expect(el.props.viewBox).toBe('0 0 170 74')
  })

  it('SchematicFaceToken has viewBox 0 0 170 74 regardless of width/height', () => {
    const tokenSmall = SchematicFaceToken({ kind: 'zone_valve', label: 'Zone', x: 0, y: 0, width: 56, height: 40 })
    const tokenLarge = SchematicFaceToken({ kind: 'zone_valve', label: 'Zone', x: 0, y: 0, width: 170, height: 74 })
    expect(tokenSmall.props.viewBox).toBe('0 0 170 74')
    expect(tokenLarge.props.viewBox).toBe('0 0 170 74')
  })
})
