/**
 * Tests for router.ts — orthogonal elbow pipe routing.
 */

import { describe, it, expect } from 'vitest'
import {
  routePipe,
  parsePoints,
  findCrossings,
  buildPathWithBumps,
  offsetParallelPipes,
  BUMP_RADIUS,
  LANE_PITCH,
} from '../builder/router'

describe('routePipe', () => {
  it('returns a string of 4 space-separated coordinate pairs', () => {
    const pts = routePipe({ x: 0, y: 0 }, { x: 100, y: 50 })
    const pairs = pts.trim().split(/\s+/)
    expect(pairs).toHaveLength(4)
  })

  it('uses horizontal-first when |dx| >= |dy|', () => {
    // from (0,0) to (100,20): dx=100 >= dy=20 → horizontal first
    const pts = routePipe({ x: 0, y: 0 }, { x: 100, y: 20 })
    const pairs = pts.trim().split(/\s+/)
    // Point 1 = from (0,0)
    // Point 2 = (midX, from.y) = (50, 0) — same Y as from
    // Point 3 = (midX, to.y)  = (50, 20)
    // Point 4 = to (100, 20)
    expect(pairs[0]).toBe('0,0')
    expect(pairs[1]).toBe('50,0')
    expect(pairs[2]).toBe('50,20')
    expect(pairs[3]).toBe('100,20')
  })

  it('uses vertical-first when |dy| > |dx|', () => {
    // from (0,0) to (20,100): dy=100 > dx=20 → vertical first
    const pts = routePipe({ x: 0, y: 0 }, { x: 20, y: 100 })
    const pairs = pts.trim().split(/\s+/)
    // Point 1 = from (0,0)
    // Point 2 = (from.x, midY) = (0, 50)
    // Point 3 = (to.x, midY)   = (20, 50)
    // Point 4 = to (20, 100)
    expect(pairs[0]).toBe('0,0')
    expect(pairs[1]).toBe('0,50')
    expect(pairs[2]).toBe('20,50')
    expect(pairs[3]).toBe('20,100')
  })

  it('handles equal dx and dy (uses horizontal-first)', () => {
    const pts = routePipe({ x: 0, y: 0 }, { x: 100, y: 100 })
    const pairs = pts.trim().split(/\s+/)
    expect(pairs[1]).toBe('50,0')
    expect(pairs[2]).toBe('50,100')
  })

  it('handles reversed direction (to is left/up of from)', () => {
    const pts = routePipe({ x: 200, y: 100 }, { x: 0, y: 0 })
    const pairs = pts.trim().split(/\s+/)
    expect(pairs[0]).toBe('200,100')
    expect(pairs[3]).toBe('0,0')
  })

  it('handles same-point source and destination', () => {
    const pts = routePipe({ x: 50, y: 50 }, { x: 50, y: 50 })
    const pairs = pts.trim().split(/\s+/)
    expect(pairs).toHaveLength(4)
    pairs.forEach(p => expect(p).toBe('50,50'))
  })
})

// ── parsePoints ───────────────────────────────────────────────────────────────

describe('parsePoints', () => {
  it('parses a 4-point polyline string into coordinate objects', () => {
    const pts = parsePoints('0,0 50,0 50,100 200,100')
    expect(pts).toHaveLength(4)
    expect(pts[0]).toEqual({ x: 0, y: 0 })
    expect(pts[1]).toEqual({ x: 50, y: 0 })
    expect(pts[2]).toEqual({ x: 50, y: 100 })
    expect(pts[3]).toEqual({ x: 200, y: 100 })
  })

  it('handles extra whitespace', () => {
    const pts = parsePoints('  10,20   30,40  ')
    expect(pts).toHaveLength(2)
    expect(pts[0]).toEqual({ x: 10, y: 20 })
  })
})

// ── findCrossings ─────────────────────────────────────────────────────────────

describe('findCrossings', () => {
  it('finds a single crossing between a horizontal and a vertical pipe', () => {
    // Horizontal pipe: (0,50) → (midX=50,50) → (50,50) → (200,50)
    // Vertical pipe:   (100,0) → (100,0) → (100,200) → (100,200)  [straight vertical]
    const hPipe = '0,50 100,50 100,50 200,50'
    const vPipe = '100,0 100,0 100,200 100,200'
    // These share x=100, but hPipe starts at x=0, ends x=200; vPipe starts y=0, ends y=200
    // Real crossing test: an L-shaped horizontal crossing a vertical
    const h = '0,50 150,50 150,50 300,50'   // straight horizontal at y=50
    const v = '100,0 100,0 100,100 100,100'  // straight vertical at x=100, y 0→100
    const xings = findCrossings(h, v)
    expect(xings).toHaveLength(1)
    expect(xings[0]).toEqual({ x: 100, y: 50 })
  })

  it('detects no crossing when pipes do not intersect', () => {
    // Horizontal pipe going x=0→200, vertical pipe at x=300 (outside x range)
    const h = '0,50 100,50 100,50 200,50'   // x range [0,200]
    const v = '300,0 300,0 300,100 300,100'  // x=300, beyond h range
    const xings = findCrossings(h, v)
    expect(xings).toHaveLength(0)
  })

  it('does not count endpoint touches as crossings', () => {
    // Pipes whose segments share an endpoint but don't cross in the interior
    const h = `0,50 ${BUMP_RADIUS},50 ${BUMP_RADIUS},50 100,50`  // short horizontal
    const v = `${BUMP_RADIUS},0 ${BUMP_RADIUS},0 ${BUMP_RADIUS},50 ${BUMP_RADIUS},50`  // vertical ending exactly at h start
    const xings = findCrossings(h, v)
    // x=BUMP_RADIUS is the start of h, so crossing is outside the strict interior margin
    expect(xings).toHaveLength(0)
  })

  it('finds crossing for L-shaped routes that cross in the middle', () => {
    // routeA: horizontal-first from (0,0) to (200,100)
    //   points: 0,0  100,0  100,100  200,100
    // routeB: vertical-first from (50,150) to (150,-50)
    //   points: 50,150  50,50  150,50  150,-50
    // The vertical segment of A (x=100, y=0→100) should cross
    // the horizontal segment of B (y=50, x=50→150)
    const routeA = '0,0 100,0 100,100 200,100'
    const routeB = '50,150 50,50 150,50 150,-50'
    const xings = findCrossings(routeA, routeB)
    expect(xings).toHaveLength(1)
    expect(xings[0]).toEqual({ x: 100, y: 50 })
  })
})

// ── buildPathWithBumps ────────────────────────────────────────────────────────

describe('buildPathWithBumps', () => {
  it('returns a simple M…L path when there are no crossings', () => {
    const d = buildPathWithBumps('0,0 50,0 50,100 200,100', [])
    expect(d).toMatch(/^M 0,0/)
    expect(d).not.toContain('A ')
  })

  it('inserts an arc (A command) at a crossing on a horizontal segment', () => {
    // Horizontal segment from (0,50) to (200,50), crossing at (100,50)
    const pts = '0,50 200,50 200,50 400,50'
    const d = buildPathWithBumps(pts, [{ x: 100, y: 50 }])
    expect(d).toContain('A ')
    // The bump moves away from the crossing by BUMP_RADIUS
    expect(d).toContain(`${100 - BUMP_RADIUS},50`)
    expect(d).toContain(`${100 + BUMP_RADIUS},50`)
  })

  it('inserts an arc on a vertical segment', () => {
    // Vertical segment going down: (50,0) to (50,200), crossing at (50,100)
    const pts = '50,0 50,0 50,200 50,200'
    const d = buildPathWithBumps(pts, [{ x: 50, y: 100 }])
    expect(d).toContain('A ')
    expect(d).toContain(`50,${100 - BUMP_RADIUS}`)
    expect(d).toContain(`50,${100 + BUMP_RADIUS}`)
  })

  it('handles multiple crossings on the same segment in travel order', () => {
    const pts = '0,50 400,50 400,50 800,50'
    const d = buildPathWithBumps(pts, [{ x: 200, y: 50 }, { x: 300, y: 50 }])
    const arcCount = (d.match(/\bA\b/g) ?? []).length
    expect(arcCount).toBe(2)
    // First bump should appear before second in the path string
    expect(d.indexOf(`${200 - BUMP_RADIUS},50`)).toBeLessThan(d.indexOf(`${300 - BUMP_RADIUS},50`))
  })
})

// ── offsetParallelPipes ───────────────────────────────────────────────────────

describe('offsetParallelPipes', () => {
  it('does not modify routes when there is no overlap', () => {
    const a = '0,0 50,0 50,100 200,100'
    const b = '0,200 50,200 50,300 200,300'
    const result = offsetParallelPipes([a, b])
    expect(result[0]).toBe(a)
    expect(result[1]).toBe(b)
  })

  it('offsets the later route when middle segments share the same vertical corridor', () => {
    // Both routes share a vertical middle segment at x=50
    const a = '0,0 50,0 50,100 200,100'     // midSeg: x=50 y=0→100
    const b = '10,0 50,0 50,80 210,80'      // midSeg: x=50 y=0→80  ← overlaps a
    const result = offsetParallelPipes([a, b])
    expect(result[0]).toBe(a)               // first route unchanged
    const bPts = parsePoints(result[1])
    // Middle points (idx 1 and 2) should be shifted by LANE_PITCH in x
    expect(bPts[1].x).toBe(50 + LANE_PITCH)
    expect(bPts[2].x).toBe(50 + LANE_PITCH)
    // Port endpoints are unchanged
    expect(bPts[0]).toEqual({ x: 10, y: 0 })
    expect(bPts[3]).toEqual({ x: 210, y: 80 })
  })

  it('offsets the later route when middle segments share the same horizontal corridor', () => {
    // Vertical-first routes: middle segment horizontal at y=50
    const a = '0,0 0,50 100,50 100,200'
    const b = '0,10 0,50 80,50 80,190'
    const result = offsetParallelPipes([a, b])
    const bPts = parsePoints(result[1])
    expect(bPts[1].y).toBe(50 + LANE_PITCH)
    expect(bPts[2].y).toBe(50 + LANE_PITCH)
    expect(bPts[0]).toEqual({ x: 0, y: 10 })
    expect(bPts[3]).toEqual({ x: 80, y: 190 })
  })
})
