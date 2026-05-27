/**
 * Tests for zoneBands — structural zone layout helpers.
 *
 * Validates:
 *  1. ZONE_ORDER is complete and contains all 7 StructuralZone values
 *  2. zoneBandForZone returns correct y-coordinates (contiguous from 0)
 *  3. allZoneBands returns all bands in order with no gaps
 *  4. effectiveZone respects placement override and falls back to defaultZoneForKind
 *  5. defaultYForZone returns the centre of each band
 *  6. ZONE_BAND_WIDTH and ZONE_BAND_X constants are consistent
 */

import { describe, it, expect } from 'vitest'
import {
  ZONE_ORDER,
  ZONE_BAND_HEIGHT,
  ZONE_BAND_WIDTH,
  ZONE_BAND_X,
  zoneBandForZone,
  allZoneBands,
  effectiveZone,
  defaultYForZone,
} from '../builder/zoneBands'
import type { StructuralZone } from '../builder/schematicBlocks'
import type { BuildNode } from '../builder/types'

// ─── ZONE_ORDER completeness ──────────────────────────────────────────────────

describe('ZONE_ORDER', () => {
  it('contains all 7 structural zones', () => {
    const expectedZones: StructuralZone[] = [
      'outside',
      'plant_room',
      'airing_cupboard',
      'ground_floor',
      'first_floor',
      'roof_space',
      'ground_loop',
    ]
    for (const zone of expectedZones) {
      expect(ZONE_ORDER).toContain(zone)
    }
    expect(ZONE_ORDER).toHaveLength(7)
  })

  it('does not contain duplicate zones', () => {
    const unique = new Set(ZONE_ORDER)
    expect(unique.size).toBe(ZONE_ORDER.length)
  })

  it('roof_space is before first_floor (loft above upper floor)', () => {
    expect(ZONE_ORDER.indexOf('roof_space')).toBeLessThan(ZONE_ORDER.indexOf('first_floor'))
  })

  it('first_floor is before ground_floor', () => {
    expect(ZONE_ORDER.indexOf('first_floor')).toBeLessThan(ZONE_ORDER.indexOf('ground_floor'))
  })

  it('ground_loop is the last zone (underground)', () => {
    expect(ZONE_ORDER[ZONE_ORDER.length - 1]).toBe('ground_loop')
  })
})

// ─── zoneBandForZone ──────────────────────────────────────────────────────────

describe('zoneBandForZone', () => {
  it('roof_space band starts at y = 0 (topmost zone)', () => {
    const band = zoneBandForZone('roof_space')
    expect(band.y).toBe(0)
  })

  it('each zone band starts exactly one ZONE_BAND_HEIGHT below the previous', () => {
    for (let i = 1; i < ZONE_ORDER.length; i++) {
      const prev = zoneBandForZone(ZONE_ORDER[i - 1])
      const curr = zoneBandForZone(ZONE_ORDER[i])
      expect(curr.y).toBe(prev.y + ZONE_BAND_HEIGHT)
    }
  })

  it('every band has height === ZONE_BAND_HEIGHT', () => {
    for (const zone of ZONE_ORDER) {
      expect(zoneBandForZone(zone).height).toBe(ZONE_BAND_HEIGHT)
    }
  })

  it('every band has a non-empty label string', () => {
    for (const zone of ZONE_ORDER) {
      const { label } = zoneBandForZone(zone)
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('every band has fill and stroke strings', () => {
    for (const zone of ZONE_ORDER) {
      const { fill, stroke } = zoneBandForZone(zone)
      expect(typeof fill).toBe('string')
      expect(typeof stroke).toBe('string')
    }
  })

  it('returns the correct zone on the band def', () => {
    for (const zone of ZONE_ORDER) {
      expect(zoneBandForZone(zone).zone).toBe(zone)
    }
  })
})

// ─── allZoneBands ─────────────────────────────────────────────────────────────

describe('allZoneBands', () => {
  it('returns one band per zone', () => {
    expect(allZoneBands()).toHaveLength(ZONE_ORDER.length)
  })

  it('bands are in the same order as ZONE_ORDER', () => {
    const bands = allZoneBands()
    for (let i = 0; i < ZONE_ORDER.length; i++) {
      expect(bands[i].zone).toBe(ZONE_ORDER[i])
    }
  })

  it('bands tile contiguously from y = 0 with no gaps', () => {
    const bands = allZoneBands()
    let expectedY = 0
    for (const band of bands) {
      expect(band.y).toBe(expectedY)
      expectedY += band.height
    }
  })
})

// ─── Constants ────────────────────────────────────────────────────────────────

describe('ZONE_BAND constants', () => {
  it('ZONE_BAND_X is the negative half of ZONE_BAND_WIDTH', () => {
    expect(ZONE_BAND_X).toBe(-(ZONE_BAND_WIDTH / 2))
  })

  it('ZONE_BAND_HEIGHT is a positive number', () => {
    expect(ZONE_BAND_HEIGHT).toBeGreaterThan(0)
  })

  it('ZONE_BAND_WIDTH is large (≥ 2000) to cover any viewport pan', () => {
    expect(ZONE_BAND_WIDTH).toBeGreaterThanOrEqual(2000)
  })
})

// ─── effectiveZone ────────────────────────────────────────────────────────────

describe('effectiveZone', () => {
  function makeNode(kind: BuildNode['kind'], zoneOverride?: StructuralZone): BuildNode {
    return {
      id: 'test',
      kind,
      x: 0,
      y: 0,
      r: 0,
      placement: zoneOverride ? { zone: zoneOverride } : undefined,
    }
  }

  it('falls back to defaultZoneForKind when no placement is set', () => {
    expect(effectiveZone(makeNode('heat_source_heat_pump'))).toBe('outside')
    expect(effectiveZone(makeNode('heat_source_combi'))).toBe('plant_room')
    expect(effectiveZone(makeNode('dhw_unvented_cylinder'))).toBe('airing_cupboard')
    expect(effectiveZone(makeNode('cws_cistern'))).toBe('roof_space')
    expect(effectiveZone(makeNode('radiator_loop'))).toBe('first_floor')
    expect(effectiveZone(makeNode('ufh_loop'))).toBe('ground_floor')
  })

  it('uses the placement.zone override when present', () => {
    // Heat pump overridden to plant_room (indoor module)
    expect(effectiveZone(makeNode('heat_source_heat_pump', 'plant_room'))).toBe('plant_room')
  })

  it('override can place any component in any zone', () => {
    const zones: StructuralZone[] = [
      'outside', 'plant_room', 'airing_cupboard',
      'ground_floor', 'first_floor', 'roof_space', 'ground_loop',
    ]
    for (const zone of zones) {
      expect(effectiveZone(makeNode('pump', zone))).toBe(zone)
    }
  })
})

// ─── defaultYForZone ──────────────────────────────────────────────────────────

describe('defaultYForZone', () => {
  it('returns the vertical centre of the band (y + height/2)', () => {
    for (const zone of ZONE_ORDER) {
      const band = zoneBandForZone(zone)
      expect(defaultYForZone(zone)).toBe(band.y + band.height / 2)
    }
  })

  it('roof_space returns a positive y (≥ 0)', () => {
    expect(defaultYForZone('roof_space')).toBeGreaterThanOrEqual(0)
  })

  it('each zone centre is strictly greater than the previous', () => {
    for (let i = 1; i < ZONE_ORDER.length; i++) {
      expect(defaultYForZone(ZONE_ORDER[i])).toBeGreaterThan(defaultYForZone(ZONE_ORDER[i - 1]))
    }
  })
})
