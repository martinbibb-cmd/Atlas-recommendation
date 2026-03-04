// src/explainers/lego/animation/render/pathMap.ts

export type Pt = { x: number; y: number }

/**
 * Map a scalar s (0..1) to a (x, y) coordinate along a polyline.
 *
 * The polyline is defined as an ordered array of Pt vertices.
 * s = 0 corresponds to pts[0]; s = 1 corresponds to pts[pts.length-1].
 */
export function mapSToPath(s: number, pts: Pt[]): Pt {
  if (pts.length === 0) return { x: 0, y: 0 }
  if (pts.length === 1) return pts[0]

  const segs: Array<{ a: Pt; b: Pt; len: number }> = []
  let total = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    segs.push({ a, b, len })
    total += len
  }

  if (total === 0) return pts[0]

  let d = s * total
  for (const seg of segs) {
    if (d <= seg.len) {
      const u = seg.len === 0 ? 0 : d / seg.len
      return {
        x: seg.a.x + (seg.b.x - seg.a.x) * u,
        y: seg.a.y + (seg.b.y - seg.a.y) * u,
      }
    }
    d -= seg.len
  }

  return pts[pts.length - 1]
}

// ─── Schematic node positions (single source of truth for the DHW schematic) ──

export const SCHEMATIC_P = {
  mainsX: 90,  mainsY: 130,
  boilerX: 420, boilerY: 130,
  splitX: 700,  splitY: 130,
  outlet1X: 900, outlet1Y: 75,   // Outlet A (top)
  outlet2X: 900, outlet2Y: 130,  // Outlet B (middle)
  outlet3X: 900, outlet3Y: 185,  // Outlet C (bottom)
}

export type SchematicPolylines = {
  main: Pt[]
  branchA: Pt[]
  branchB: Pt[]
  branchC: Pt[]
}

/**
 * Build the main flow polyline and three outlet branch polylines.
 *
 * The trunk (main) runs from mains → boiler → splitter.
 * Each branch runs from the splitter to its respective outlet endpoint.
 * Branches are always defined so TokensLayer can route A/B/C unconditionally.
 */
export function buildPolylines(): SchematicPolylines {
  const trunk: Pt[] = [
    { x: SCHEMATIC_P.mainsX, y: SCHEMATIC_P.mainsY },
    { x: SCHEMATIC_P.boilerX - 60, y: SCHEMATIC_P.boilerY },   // boiler entry
    { x: SCHEMATIC_P.boilerX + 120, y: SCHEMATIC_P.boilerY },  // boiler exit
    { x: SCHEMATIC_P.splitX, y: SCHEMATIC_P.splitY },
  ]

  return {
    main: trunk,
    branchA: [
      { x: SCHEMATIC_P.splitX, y: SCHEMATIC_P.splitY },
      { x: SCHEMATIC_P.outlet1X, y: SCHEMATIC_P.outlet1Y },
    ],
    branchB: [
      { x: SCHEMATIC_P.splitX, y: SCHEMATIC_P.splitY },
      { x: SCHEMATIC_P.outlet2X, y: SCHEMATIC_P.outlet2Y },
    ],
    branchC: [
      { x: SCHEMATIC_P.splitX, y: SCHEMATIC_P.splitY },
      { x: SCHEMATIC_P.outlet3X, y: SCHEMATIC_P.outlet3Y },
    ],
  }
}
