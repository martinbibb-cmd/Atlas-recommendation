// src/explainers/lego/__tests__/workbenchPanClamp.test.ts
//
// Unit tests for the WorkbenchCanvas pan-clamp utility.
//
// The clamp prevents the canvas from being panned so far that all placed
// components disappear behind dead UI space (toolbar, hint overlay, or
// completely off-screen in any direction).

import { describe, it, expect } from 'vitest'
import { clampPan, PAN_CLAMP_PX } from '../builder/WorkbenchCanvas'

describe('clampPan — pan bounds for workbench canvas', () => {
  it('passes through a pan value within bounds unchanged', () => {
    const result = clampPan({ x: 100, y: -200 })
    expect(result.x).toBe(100)
    expect(result.y).toBe(-200)
  })

  it('clamps positive x to PAN_CLAMP_PX', () => {
    const result = clampPan({ x: PAN_CLAMP_PX + 500, y: 0 })
    expect(result.x).toBe(PAN_CLAMP_PX)
  })

  it('clamps negative x to -PAN_CLAMP_PX', () => {
    const result = clampPan({ x: -(PAN_CLAMP_PX + 1), y: 0 })
    expect(result.x).toBe(-PAN_CLAMP_PX)
  })

  it('clamps positive y to PAN_CLAMP_PX', () => {
    const result = clampPan({ x: 0, y: PAN_CLAMP_PX + 1 })
    expect(result.y).toBe(PAN_CLAMP_PX)
  })

  it('clamps negative y to -PAN_CLAMP_PX', () => {
    const result = clampPan({ x: 0, y: -(PAN_CLAMP_PX + 100) })
    expect(result.y).toBe(-PAN_CLAMP_PX)
  })

  it('clamps both axes simultaneously when both exceed bounds', () => {
    const result = clampPan({ x: PAN_CLAMP_PX * 2, y: -(PAN_CLAMP_PX * 3) })
    expect(result.x).toBe(PAN_CLAMP_PX)
    expect(result.y).toBe(-PAN_CLAMP_PX)
  })

  it('allows pan at exactly the max bound (boundary inclusive)', () => {
    const result = clampPan({ x: PAN_CLAMP_PX, y: -PAN_CLAMP_PX })
    expect(result.x).toBe(PAN_CLAMP_PX)
    expect(result.y).toBe(-PAN_CLAMP_PX)
  })

  it('PAN_CLAMP_PX is a large enough value for any typical schematic', () => {
    // Typical schematic nodes are placed at x,y in the 0–1500 range.
    // Pan offset needed to centre a node at (1500, 1500) in a 1200×800 viewport
    // is roughly (-300, -700) — well within the clamp.
    expect(PAN_CLAMP_PX).toBeGreaterThanOrEqual(2000)
  })
})
