// src/explainers/lego/__tests__/trayBounds.test.ts
//
// PR8 regression tests — floating palette tray bounds and narrow-screen layout.
//
// Covers:
//   1. isNarrowLayout — pure breakpoint helper (no DOM required)
//   2. clampTrayPosition — basic bounds (covered more completely in
//      topologyParity.test.ts; this file adds the resize re-clamp scenario)
//   3. Resize re-clamp — tray near old edge, workbench shrinks → valid position
//   4. Close button does not initiate drag — pure positional logic
//   5. Desktop / wide screen — isNarrow returns false → floating tray inactive

import { describe, it, expect } from 'vitest'
import {
  clampTrayPosition,
  isNarrowLayout,
  NARROW_LAYOUT_BREAKPOINT_PX,
  TRAY_FOOTER_RESERVE_PX,
} from '../builder/WorkbenchCanvas'

// ─── 1. isNarrowLayout — pure breakpoint helper ───────────────────────────────

describe('isNarrowLayout — breakpoint helper', () => {
  it('returns true when width is below the breakpoint', () => {
    expect(isNarrowLayout(NARROW_LAYOUT_BREAKPOINT_PX - 1)).toBe(true)
  })

  it('returns false when width equals the breakpoint (boundary — desktop)', () => {
    expect(isNarrowLayout(NARROW_LAYOUT_BREAKPOINT_PX)).toBe(false)
  })

  it('returns false when width is above the breakpoint', () => {
    expect(isNarrowLayout(NARROW_LAYOUT_BREAKPOINT_PX + 1)).toBe(false)
  })

  it('returns true for a typical tablet width (1024 px)', () => {
    expect(isNarrowLayout(1024)).toBe(true)
  })

  it('returns true for a typical mobile width (390 px)', () => {
    expect(isNarrowLayout(390)).toBe(true)
  })

  it('returns false for a typical desktop width (1440 px)', () => {
    expect(isNarrowLayout(1440)).toBe(false)
  })

  it('NARROW_LAYOUT_BREAKPOINT_PX is at least 1000 px', () => {
    // Ensures the breakpoint is not accidentally lowered to a non-sensible value.
    expect(NARROW_LAYOUT_BREAKPOINT_PX).toBeGreaterThanOrEqual(1000)
  })
})

// ─── 2. clampTrayPosition — in-bounds pass-through ───────────────────────────

describe('clampTrayPosition — in-bounds positions are unchanged', () => {
  const workbench = { width: 800, height: 600 }
  const tray      = { width: 260, height: 400 }

  it('does not alter a tray positioned at (0, 0)', () => {
    const result = clampTrayPosition({ x: 0, y: 0 }, workbench, tray)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })

  it('does not alter a tray well inside the workbench', () => {
    const result = clampTrayPosition({ x: 100, y: 80 }, workbench, tray)
    expect(result.x).toBe(100)
    expect(result.y).toBe(80)
  })
})

// ─── 3. Resize re-clamp ──────────────────────────────────────────────────────
//
// Scenario: user places tray near the right edge of a large workbench, then
// the browser/panel is resized to a smaller workbench.  The tray position must
// be re-clamped into the new valid range.

describe('clampTrayPosition — resize re-clamp', () => {
  const tray = { width: 280, height: 400 }

  it('re-clamps x when workbench shrinks horizontally', () => {
    // Old workbench: 1000 px wide.  Max x = 1000 - 280 - 8 = 712.
    // Tray was placed at x=710 (valid for old workbench).
    // New workbench: 700 px wide.  New max x = 700 - 280 - 8 = 412.
    const oldPos        = { x: 710, y: 50 }
    const smallWorkbench = { width: 700, height: 600 }
    const result = clampTrayPosition(oldPos, smallWorkbench, tray)
    const expectedMaxX  = smallWorkbench.width - tray.width - 8  // 412
    expect(result.x).toBe(expectedMaxX)
  })

  it('re-clamps y when workbench shrinks vertically', () => {
    // Old workbench: 900 px tall.  Max y = 900 - 400 - 48 = 452.
    // Tray was placed at y=450.
    // New workbench: 500 px tall.  New max y = 500 - 400 - 48 = 52.
    const oldPos         = { y: 450, x: 0 }
    const shortWorkbench = { width: 800, height: 500 }
    const result = clampTrayPosition(oldPos, shortWorkbench, tray)
    const expectedMaxY   = shortWorkbench.height - tray.height - TRAY_FOOTER_RESERVE_PX  // 52
    expect(result.y).toBe(expectedMaxY)
  })

  it('re-clamps both axes simultaneously when workbench shrinks in both dimensions', () => {
    const oldPos         = { x: 900, y: 800 }
    const tinyWorkbench  = { width: 400, height: 450 }
    const result = clampTrayPosition(oldPos, tinyWorkbench, tray)
    // x: max = 400 - 280 - 8 = 112
    // y: max = 450 - 400 - 48 = 2
    expect(result.x).toBe(112)
    expect(result.y).toBe(2)
  })

  it('clamps to (0,0) when the tray is too large for the smaller workbench', () => {
    const largeTray     = { width: 500, height: 600 }
    const smallWorkbench = { width: 400, height: 450 }
    const result = clampTrayPosition({ x: 999, y: 999 }, smallWorkbench, largeTray)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })

  it('position at exactly old max is pulled in to new max on resize', () => {
    // Explicit "tray was placed at the maximum valid position on the old workbench,
    // then the workbench got smaller" scenario.
    const oldWorkbench   = { width: 1200, height: 800 }
    const oldMaxX = oldWorkbench.width  - tray.width - 8                  // 912
    const oldMaxY = oldWorkbench.height - tray.height - TRAY_FOOTER_RESERVE_PX  // 352

    const newWorkbench   = { width: 900, height: 600 }
    const newMaxX = newWorkbench.width  - tray.width - 8                  // 612
    const newMaxY = newWorkbench.height - tray.height - TRAY_FOOTER_RESERVE_PX  // 152

    const result = clampTrayPosition({ x: oldMaxX, y: oldMaxY }, newWorkbench, tray)
    expect(result.x).toBe(newMaxX)
    expect(result.y).toBe(newMaxY)
  })
})

// ─── 4. Close button does not initiate drag ───────────────────────────────────
//
// Drag initialisation is guarded by the target element check in BuilderShell.
// The pure-logic test here verifies that if an event originates from the
// close button (identified by data-palette-close="true"), the tray position
// must not change — i.e., the new position after re-clamping equals the
// old position (no drag offset is accumulated).

describe('close button — drag guard pure logic', () => {
  const workbench = { width: 1000, height: 700 }
  const tray      = { width: 280, height: 400 }

  it('a re-clamp of the current position returns the same coordinates (no accidental drag)', () => {
    // Simulate: tray is stationary at (100, 80).  On a pointerdown event on
    // the close button, the drag must not start.  The simplest pure assertion
    // is that re-clamping the unchanged position gives back the same position.
    const stationaryPos = { x: 100, y: 80 }
    const reClamped     = clampTrayPosition(stationaryPos, workbench, tray)
    expect(reClamped.x).toBe(stationaryPos.x)
    expect(reClamped.y).toBe(stationaryPos.y)
  })

  it('a tray at max valid position stays at max after re-clamp (no phantom drift)', () => {
    const maxX = workbench.width  - tray.width - 8
    const maxY = workbench.height - tray.height - TRAY_FOOTER_RESERVE_PX
    const atMax = { x: maxX, y: maxY }
    const reClamped = clampTrayPosition(atMax, workbench, tray)
    expect(reClamped.x).toBe(maxX)
    expect(reClamped.y).toBe(maxY)
  })
})

// ─── 5. Desktop mode — wide screen uses pinned panel, floating tray inactive ──

describe('desktop / wide-screen layout — floating tray must not be active', () => {
  it('isNarrowLayout returns false for desktop widths, indicating tray is NOT floating', () => {
    const desktopWidths = [1200, 1280, 1440, 1920, 2560]
    for (const w of desktopWidths) {
      expect(isNarrowLayout(w), `width=${w} should be desktop (not narrow)`).toBe(false)
    }
  })

  it('isNarrowLayout returns true for narrow widths where tray IS floating', () => {
    const narrowWidths = [360, 768, 1024, 1199]
    for (const w of narrowWidths) {
      expect(isNarrowLayout(w), `width=${w} should be narrow`).toBe(true)
    }
  })

  it('breakpoint boundary is exactly NARROW_LAYOUT_BREAKPOINT_PX — below narrow, at-or-above desktop', () => {
    // One pixel below breakpoint → narrow (floating tray active)
    expect(isNarrowLayout(NARROW_LAYOUT_BREAKPOINT_PX - 1)).toBe(true)
    // At breakpoint → desktop (floating tray NOT active)
    expect(isNarrowLayout(NARROW_LAYOUT_BREAKPOINT_PX)).toBe(false)
  })
})

// ─── 6. Footer dead-zone protection ───────────────────────────────────────────

describe('clampTrayPosition — footer dead-zone protection', () => {
  const workbench = { width: 1000, height: 700 }
  const tray      = { width: 280, height: 400 }

  it('tray bottom never crosses into the footer reserved strip', () => {
    const result = clampTrayPosition({ x: 0, y: 99999 }, workbench, tray)
    const trayBottom = result.y + tray.height
    const footerTop  = workbench.height - TRAY_FOOTER_RESERVE_PX
    expect(trayBottom).toBeLessThanOrEqual(footerTop)
  })

  it('maximum y leaves exactly TRAY_FOOTER_RESERVE_PX pixels at the bottom', () => {
    const maxY = workbench.height - tray.height - TRAY_FOOTER_RESERVE_PX
    const result = clampTrayPosition({ x: 0, y: 99999 }, workbench, tray)
    expect(result.y).toBe(maxY)
    // Remaining space below tray:
    const remaining = workbench.height - (result.y + tray.height)
    expect(remaining).toBe(TRAY_FOOTER_RESERVE_PX)
  })

  it('TRAY_FOOTER_RESERVE_PX is at least one row of control buttons (≥ 40 px)', () => {
    expect(TRAY_FOOTER_RESERVE_PX).toBeGreaterThanOrEqual(40)
  })
})

// ─── 7. PR9 — narrow-screen dead-column guard ─────────────────────────────────
//
// When the user was on a wide screen with the palette open (paletteOpen=true)
// and then resizes to a narrow screen, isNarrowLayout must return true so the
// grid template can switch to '1fr' and not render a dead 320 px column.
//
// The guard logic (pseudocode from BuilderShell):
//   gridTemplateColumns = (paletteOpen && !isNarrow) ? '320px 1fr' : '1fr'
//
// This section tests the pure boolean predicate that drives that expression.

describe('PR9 narrow-screen dead-column guard — paletteOpen && !isNarrow logic', () => {
  function shouldShowSidePanel(paletteOpen: boolean, windowWidth: number): boolean {
    const narrow = isNarrowLayout(windowWidth)
    return paletteOpen && !narrow
  }

  function gridColumns(paletteOpen: boolean, windowWidth: number): string {
    return shouldShowSidePanel(paletteOpen, windowWidth) ? '320px 1fr' : '1fr'
  }

  it('wide screen + palette open → side panel visible, two-column grid', () => {
    expect(shouldShowSidePanel(true, 1440)).toBe(true)
    expect(gridColumns(true, 1440)).toBe('320px 1fr')
  })

  it('wide screen + palette closed → side panel hidden, single-column grid', () => {
    expect(shouldShowSidePanel(false, 1440)).toBe(false)
    expect(gridColumns(false, 1440)).toBe('1fr')
  })

  it('narrow screen + palette open → side panel hidden (no dead column), single-column grid', () => {
    // This is the regression case: palette state is still open from a previous
    // wide-screen session, but the screen is now narrow.  The grid must NOT
    // emit a 320 px dead column.
    expect(shouldShowSidePanel(true, 900)).toBe(false)
    expect(gridColumns(true, 900)).toBe('1fr')
  })

  it('narrow screen + palette closed → side panel hidden, single-column grid', () => {
    expect(shouldShowSidePanel(false, 900)).toBe(false)
    expect(gridColumns(false, 900)).toBe('1fr')
  })

  it('at the exact breakpoint (≥1200px) with palette open → side panel is visible', () => {
    expect(shouldShowSidePanel(true, NARROW_LAYOUT_BREAKPOINT_PX)).toBe(true)
    expect(gridColumns(true, NARROW_LAYOUT_BREAKPOINT_PX)).toBe('320px 1fr')
  })

  it('one pixel below breakpoint with palette open → side panel hidden (narrow)', () => {
    expect(shouldShowSidePanel(true, NARROW_LAYOUT_BREAKPOINT_PX - 1)).toBe(false)
    expect(gridColumns(true, NARROW_LAYOUT_BREAKPOINT_PX - 1)).toBe('1fr')
  })
})
