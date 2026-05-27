/**
 * Tests for propertyLayouts — preset house map data model.
 *
 * Validates:
 *  1. All four layouts are present and have valid ids
 *  2. Every layout has rooms, radiatorAnchors, outletAnchors, and plantAnchors
 *  3. Anchor ids are unique within each layout
 *  4. Every anchor references a valid roomId (or null for outdoor anchors)
 *  5. Every layout has at least one boiler anchor and at least one cylinder or
 *     airing_cupboard anchor, and a heat_pump_outside anchor
 *  6. getPropertyLayout throws on unknown id
 *  7. anchorsOfKind, roomById, radiatorsInRoom, outletsInRoom helpers work
 *  8. All coordinates are within the shared 800×560 viewport
 */

import { describe, it, expect } from 'vitest'
import {
  PROPERTY_LAYOUTS,
  PROPERTY_LAYOUT_IDS,
  LAYOUT_VIEW_W,
  LAYOUT_VIEW_H,
  getPropertyLayout,
  anchorsOfKind,
  roomById,
  radiatorsInRoom,
  outletsInRoom,
  type PropertyLayoutId,
  type PlantAnchorKind,
} from '../builder/propertyLayouts'

// ─── Registry completeness ────────────────────────────────────────────────────

describe('PROPERTY_LAYOUTS registry', () => {
  it('contains exactly 4 layouts', () => {
    expect(PROPERTY_LAYOUTS).toHaveLength(4)
  })

  it('includes all four expected layout ids', () => {
    const ids = PROPERTY_LAYOUTS.map(l => l.id)
    expect(ids).toContain('bungalow')
    expect(ids).toContain('flat')
    expect(ids).toContain('2bed_house')
    expect(ids).toContain('3bed_semi')
  })

  it('PROPERTY_LAYOUT_IDS matches the registry ids', () => {
    const registryIds = PROPERTY_LAYOUTS.map(l => l.id)
    expect(PROPERTY_LAYOUT_IDS).toEqual(registryIds)
  })

  it('each layout has a non-empty label and description', () => {
    for (const layout of PROPERTY_LAYOUTS) {
      expect(layout.label.length).toBeGreaterThan(0)
      expect(layout.description.length).toBeGreaterThan(0)
    }
  })

  it('each layout declares the shared viewBox', () => {
    for (const layout of PROPERTY_LAYOUTS) {
      expect(layout.viewBox).toBe('0 0 800 560')
    }
  })
})

// ─── Structural completeness ──────────────────────────────────────────────────

describe('layout structural completeness', () => {
  for (const layout of PROPERTY_LAYOUTS) {
    describe(`layout: ${layout.id}`, () => {
      it('has at least two rooms', () => {
        expect(layout.rooms.length).toBeGreaterThanOrEqual(2)
      })

      it('has at least one radiator anchor', () => {
        expect(layout.radiatorAnchors.length).toBeGreaterThanOrEqual(1)
      })

      it('has at least one outlet anchor', () => {
        expect(layout.outletAnchors.length).toBeGreaterThanOrEqual(1)
      })

      it('has at least two plant anchors', () => {
        expect(layout.plantAnchors.length).toBeGreaterThanOrEqual(2)
      })

      it('has at least one boiler anchor', () => {
        const boilerAnchors = layout.plantAnchors.filter(
          a => a.kind === 'boiler_option_1' || a.kind === 'boiler_option_2',
        )
        expect(boilerAnchors.length).toBeGreaterThanOrEqual(1)
      })

      it('has at least one cylinder or airing_cupboard anchor', () => {
        const cylAnchors = layout.plantAnchors.filter(
          a =>
            a.kind === 'cylinder_option_1' ||
            a.kind === 'cylinder_option_2' ||
            a.kind === 'airing_cupboard',
        )
        expect(cylAnchors.length).toBeGreaterThanOrEqual(1)
      })

      it('has a heat_pump_outside anchor', () => {
        const hp = layout.plantAnchors.find(a => a.kind === 'heat_pump_outside')
        expect(hp).toBeDefined()
      })
    })
  }
})

// ─── ID uniqueness ────────────────────────────────────────────────────────────

describe('anchor id uniqueness', () => {
  for (const layout of PROPERTY_LAYOUTS) {
    it(`all anchor ids in ${layout.id} are unique`, () => {
      const ids = [
        ...layout.rooms.map(r => r.id),
        ...layout.radiatorAnchors.map(r => r.id),
        ...layout.outletAnchors.map(o => o.id),
        ...layout.plantAnchors.map(p => p.id),
      ]
      const unique = new Set(ids)
      expect(unique.size).toBe(ids.length)
    })
  }
})

// ─── roomId referential integrity ─────────────────────────────────────────────

describe('roomId referential integrity', () => {
  for (const layout of PROPERTY_LAYOUTS) {
    describe(`layout: ${layout.id}`, () => {
      const roomIds = new Set(layout.rooms.map(r => r.id))

      it('all radiator anchor roomIds reference existing rooms', () => {
        for (const r of layout.radiatorAnchors) {
          expect(roomIds.has(r.roomId)).toBe(true)
        }
      })

      it('all outlet anchor roomIds reference existing rooms', () => {
        for (const o of layout.outletAnchors) {
          expect(roomIds.has(o.roomId)).toBe(true)
        }
      })

      it('plant anchor roomIds are null (outdoor) or reference existing rooms', () => {
        for (const p of layout.plantAnchors) {
          if (p.roomId !== null) {
            expect(roomIds.has(p.roomId)).toBe(true)
          }
        }
      })

      it('heat_pump_outside anchor has roomId === null', () => {
        const hp = layout.plantAnchors.find(a => a.kind === 'heat_pump_outside')
        if (hp) {
          expect(hp.roomId).toBeNull()
        }
      })
    })
  }
})

// ─── Coordinate bounds ────────────────────────────────────────────────────────

describe('coordinate bounds (all within 800×560 viewport)', () => {
  for (const layout of PROPERTY_LAYOUTS) {
    describe(`layout: ${layout.id}`, () => {
      it('all room rects are within viewport', () => {
        for (const room of layout.rooms) {
          expect(room.x).toBeGreaterThanOrEqual(0)
          expect(room.y).toBeGreaterThanOrEqual(0)
          expect(room.x + room.w).toBeLessThanOrEqual(LAYOUT_VIEW_W)
          expect(room.y + room.h).toBeLessThanOrEqual(LAYOUT_VIEW_H)
        }
      })

      it('all radiator anchor positions are within viewport', () => {
        for (const r of layout.radiatorAnchors) {
          expect(r.x).toBeGreaterThanOrEqual(0)
          expect(r.y).toBeGreaterThanOrEqual(0)
          expect(r.x).toBeLessThanOrEqual(LAYOUT_VIEW_W)
          expect(r.y).toBeLessThanOrEqual(LAYOUT_VIEW_H)
        }
      })

      it('all outlet anchor positions are within viewport', () => {
        for (const o of layout.outletAnchors) {
          expect(o.x).toBeGreaterThanOrEqual(0)
          expect(o.y).toBeGreaterThanOrEqual(0)
          expect(o.x).toBeLessThanOrEqual(LAYOUT_VIEW_W)
          expect(o.y).toBeLessThanOrEqual(LAYOUT_VIEW_H)
        }
      })

      it('all plant anchor positions are within viewport', () => {
        for (const p of layout.plantAnchors) {
          expect(p.x).toBeGreaterThanOrEqual(0)
          expect(p.y).toBeGreaterThanOrEqual(0)
          expect(p.x).toBeLessThanOrEqual(LAYOUT_VIEW_W)
          expect(p.y).toBeLessThanOrEqual(LAYOUT_VIEW_H)
        }
      })
    })
  }
})

// ─── Plant anchor structural zone correctness ─────────────────────────────────

describe('plant anchor structural zones', () => {
  const BOILER_KINDS: PlantAnchorKind[] = ['boiler_option_1', 'boiler_option_2']
  const CYLINDER_KINDS: PlantAnchorKind[] = ['cylinder_option_1', 'cylinder_option_2', 'airing_cupboard']

  for (const layout of PROPERTY_LAYOUTS) {
    describe(`layout: ${layout.id}`, () => {
      it('boiler anchors have zone === plant_room', () => {
        for (const anchor of layout.plantAnchors) {
          if (BOILER_KINDS.includes(anchor.kind)) {
            expect(anchor.zone).toBe('plant_room')
          }
        }
      })

      it('cylinder anchors have zone === airing_cupboard', () => {
        for (const anchor of layout.plantAnchors) {
          if (CYLINDER_KINDS.includes(anchor.kind)) {
            expect(anchor.zone).toBe('airing_cupboard')
          }
        }
      })

      it('heat_pump_outside anchor has zone === outside', () => {
        const hp = layout.plantAnchors.find(a => a.kind === 'heat_pump_outside')
        if (hp) {
          expect(hp.zone).toBe('outside')
        }
      })
    })
  }
})

// ─── getPropertyLayout ────────────────────────────────────────────────────────

describe('getPropertyLayout', () => {
  it('returns the correct layout for each valid id', () => {
    for (const id of PROPERTY_LAYOUT_IDS) {
      const layout = getPropertyLayout(id as PropertyLayoutId)
      expect(layout.id).toBe(id)
    }
  })

  it('throws for an unknown id', () => {
    expect(() => getPropertyLayout('unknown_id' as PropertyLayoutId)).toThrow()
  })
})

// ─── anchorsOfKind ────────────────────────────────────────────────────────────

describe('anchorsOfKind', () => {
  it('returns only anchors of the requested kind', () => {
    const layout = getPropertyLayout('2bed_house')
    const boilerAnchors = anchorsOfKind(layout, 'boiler_option_1')
    for (const a of boilerAnchors) {
      expect(a.kind).toBe('boiler_option_1')
    }
  })

  it('returns empty array when no anchors of kind exist', () => {
    const layout = getPropertyLayout('flat')
    // flat has no boiler_option_2
    const result = anchorsOfKind(layout, 'boiler_option_2')
    expect(result).toHaveLength(0)
  })
})

// ─── roomById ─────────────────────────────────────────────────────────────────

describe('roomById', () => {
  it('returns the room with the matching id', () => {
    const layout = getPropertyLayout('2bed_house')
    const room = roomById(layout, 'kit')
    expect(room).not.toBeNull()
    expect(room!.label).toBe('Kitchen')
  })

  it('returns null for an unknown room id', () => {
    const layout = getPropertyLayout('2bed_house')
    expect(roomById(layout, 'nonexistent')).toBeNull()
  })
})

// ─── radiatorsInRoom ──────────────────────────────────────────────────────────

describe('radiatorsInRoom', () => {
  it('returns radiators belonging to the specified room', () => {
    const layout = getPropertyLayout('2bed_house')
    const rads = radiatorsInRoom(layout, 'kit')
    expect(rads.length).toBeGreaterThanOrEqual(1)
    for (const r of rads) {
      expect(r.roomId).toBe('kit')
    }
  })

  it('returns empty array for a room with no radiator', () => {
    // No layout has a radiator in a non-existent room
    const layout = getPropertyLayout('2bed_house')
    expect(radiatorsInRoom(layout, 'nonexistent')).toHaveLength(0)
  })
})

// ─── outletsInRoom ────────────────────────────────────────────────────────────

describe('outletsInRoom', () => {
  it('returns outlets belonging to the specified room', () => {
    const layout = getPropertyLayout('2bed_house')
    const outs = outletsInRoom(layout, 'bth')
    expect(outs.length).toBeGreaterThanOrEqual(1)
    for (const o of outs) {
      expect(o.roomId).toBe('bth')
    }
  })

  it('returns only sink/cold_tap outlets for Kitchen', () => {
    const layout = getPropertyLayout('2bed_house')
    const outs = outletsInRoom(layout, 'kit')
    const kinds = outs.map(o => o.kind)
    expect(kinds).toContain('sink')
    expect(kinds).toContain('cold_tap')
  })
})

// ─── outlet kind coverage ─────────────────────────────────────────────────────

describe('outlet kind coverage', () => {
  it('every two-floor layout includes a bath outlet', () => {
    for (const id of ['2bed_house', '3bed_semi'] as PropertyLayoutId[]) {
      const layout = getPropertyLayout(id)
      const hasBath = layout.outletAnchors.some(o => o.kind === 'bath')
      expect(hasBath).toBe(true)
    }
  })

  it('every layout has at least one kitchen sink outlet', () => {
    for (const layout of PROPERTY_LAYOUTS) {
      const hasSink = layout.outletAnchors.some(o => o.kind === 'sink' || o.kind === 'cold_tap')
      expect(hasSink).toBe(true)
    }
  })
})
