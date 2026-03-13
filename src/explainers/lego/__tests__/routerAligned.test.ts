// src/explainers/lego/__tests__/routerAligned.test.ts
//
// Tests for routePipeAligned — wall-aware pipe routing in builder/router.ts.
//
// Coverage:
//   - routePipe: existing behaviour (horizontal-first, vertical-first)
//   - routePipeAligned: no rooms → same result as routePipe
//   - routePipeAligned: horizontal-first bend snaps to room's left/right wall
//   - routePipeAligned: vertical-first bend snaps to room's top/bottom wall
//   - routePipeAligned: bend snaps to hall centreline when within snap range
//   - routePipeAligned: no snap when bend is farther than WALL_SNAP_PX
//   - routePipeAligned: returns valid points string (4 coordinate pairs)

import { describe, it, expect } from 'vitest'
import { routePipe, routePipeAligned } from '../builder/router'
import type { RouterRoom } from '../builder/router'

// ─── helpers ─────────────────────────────────────────────────────────────────

function parsePoints(points: string): number[][] {
  return points.trim().split(/\s+/).map(pair => pair.split(',').map(Number))
}

// ─── routePipe (existing) ─────────────────────────────────────────────────────

describe('routePipe', () => {
  it('horizontal-first when dx >= dy', () => {
    const pts = parsePoints(routePipe({ x: 0, y: 0 }, { x: 100, y: 40 }))
    // 4 points for a 2-segment elbow
    expect(pts).toHaveLength(4)
    // First segment is horizontal: from.y stays the same
    expect(pts[0][1]).toBe(0)
    expect(pts[1][1]).toBe(0)
    // Bend at midX = 50
    expect(pts[1][0]).toBe(50)
  })

  it('vertical-first when dy > dx', () => {
    const pts = parsePoints(routePipe({ x: 0, y: 0 }, { x: 20, y: 100 }))
    expect(pts).toHaveLength(4)
    // First segment is vertical: from.x stays the same
    expect(pts[0][0]).toBe(0)
    expect(pts[1][0]).toBe(0)
    // Bend at midY = 50
    expect(pts[1][1]).toBe(50)
  })
})

// ─── routePipeAligned ─────────────────────────────────────────────────────────

describe('routePipeAligned — no rooms', () => {
  it('produces the same result as routePipe when rooms is empty', () => {
    const from = { x: 10, y: 20 }
    const to   = { x: 110, y: 60 }
    expect(routePipeAligned(from, to, [])).toBe(routePipe(from, to))
  })
})

describe('routePipeAligned — wall snapping', () => {
  const rooms: RouterRoom[] = [
    { x: 40, y: 0, w: 120, h: 100 },    // walls at x=40, x=160, y=0, y=100
    { x: 200, y: 50, w: 80, h: 80 },    // walls at x=200, x=280, y=50, y=130
  ]

  it('snaps horizontal-first bend X to a nearby room left-wall edge', () => {
    // from=(10,20), to=(50,60): dx=40 >= dy=40 → horizontal-first
    // raw midX = 30; room left wall at x=40 is only 10px away → snaps if within 16px
    const pts = parsePoints(routePipeAligned({ x: 10, y: 20 }, { x: 50, y: 60 }, rooms))
    expect(pts).toHaveLength(4)
    // bend X should be 40 (snapped to room left wall), not 30
    expect(pts[1][0]).toBe(40)
  })

  it('snaps vertical-first bend Y to a nearby room bottom-wall edge', () => {
    // from=(10,10), to=(30,115): dy=105 > dx=20 → vertical-first
    // raw midY = 62.5; room bottom wall at y=100 is 37.5px away → outside snap range (16px)
    // raw midY = 62.5; room top wall at y=0 is 62.5px away → also out of range
    // Now choose points so midY is close to y=100:
    // from=(10,90), to=(30,115): raw midY=(90+115)/2=102.5; wall at y=100 is 2.5px → snaps
    const pts = parsePoints(
      routePipeAligned({ x: 10, y: 90 }, { x: 30, y: 115 }, rooms),
    )
    expect(pts).toHaveLength(4)
    // bend Y should be 100 (snapped to room bottom wall)
    expect(pts[1][1]).toBe(100)
  })

  it('does NOT snap when bend is farther than snap tolerance', () => {
    // from=(10,10), to=(50,60): raw midX=30; nearest wall x=40 is 10px away
    // That IS within 16px so it will snap — use a case that's > 16px away
    // from=(0,10), to=(10,60): dx=10 < dy=50 → vertical-first
    // raw midY = 35; nearest wall edges: y=0 (35px away), y=100 (65px), y=50 (15px snaps!)
    // Choose rooms without a close candidate:
    const fewRooms: RouterRoom[] = [{ x: 0, y: 200, w: 100, h: 100 }]
    // from=(0,0), to=(100,40): dx=100 >= dy=40 → horizontal-first; raw midX=50
    // walls at x=0, x=100; midX=50 is 50px from x=0 and 50px from x=100 — both out of range
    const pts = parsePoints(routePipeAligned({ x: 0, y: 0 }, { x: 100, y: 40 }, fewRooms))
    // No snap: midX remains 50
    expect(pts[1][0]).toBe(50)
  })
})

describe('routePipeAligned — hall centreline snapping', () => {
  it('snaps bend to hall centreline when within snap tolerance', () => {
    // Hall room: x=80, y=0, w=40, h=200 → centreline x = 80 + 20 = 100
    const hallRoom: RouterRoom = { x: 80, y: 0, w: 40, h: 200, label: 'Hall' }
    // from=(90,50), to=(115,60): dx=25 >= dy=10 → horizontal-first
    // raw midX = (90+115)/2 = 102.5; hall centreline at x=100 is 2.5px → snaps
    const pts = parsePoints(
      routePipeAligned({ x: 90, y: 50 }, { x: 115, y: 60 }, [hallRoom]),
    )
    // bend X should snap to hall centreline x=100
    expect(pts[1][0]).toBe(100)
  })

  it('Landing room label is treated as hall', () => {
    const landingRoom: RouterRoom = { x: 100, y: 30, w: 60, h: 40, label: 'Landing' }
    // Centreline y = 30 + 20 = 50
    // from=(10,40), to=(12,55): dx=2 < dy=15 → vertical-first; raw midY=47.5
    // centreline y=50 is 2.5px away → snaps
    const pts = parsePoints(
      routePipeAligned({ x: 10, y: 40 }, { x: 12, y: 55 }, [landingRoom]),
    )
    expect(pts[1][1]).toBe(50)
  })
})
