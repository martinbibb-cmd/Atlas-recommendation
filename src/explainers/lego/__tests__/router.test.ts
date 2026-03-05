/**
 * Tests for router.ts — orthogonal elbow pipe routing.
 */

import { describe, it, expect } from 'vitest'
import { routePipe } from '../builder/router'

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
