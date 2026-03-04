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
  mainsX: 90, mainsY: 120,
  boilerX: 420, boilerY: 120,
  splitX: 700, splitY: 120,
  outlet1X: 900, outlet1Y: 90,
  outlet2X: 900, outlet2Y: 150,
}

export type SchematicPolylines = { main: Pt[]; branch1: Pt[]; branch2: Pt[] }

/**
 * Build the main flow polyline (used to animate tokens along the schematic).
 *
 * For single-outlet scenarios the polyline ends at the outlet directly.
 * For multi-outlet scenarios it ends at the splitter node; TokensLayer
 * branches tokens from there based on token-id parity.
 */
export function buildPolylines(outlets: number): SchematicPolylines {
  const trunk: Pt[] = [
    { x: SCHEMATIC_P.mainsX, y: SCHEMATIC_P.mainsY },
    { x: SCHEMATIC_P.boilerX - 60, y: SCHEMATIC_P.boilerY },   // boiler entry
    { x: SCHEMATIC_P.boilerX + 120, y: SCHEMATIC_P.boilerY },  // boiler exit
    { x: SCHEMATIC_P.splitX, y: SCHEMATIC_P.splitY },
  ]

  if (outlets === 1) {
    return {
      main: [...trunk, { x: SCHEMATIC_P.outlet1X, y: SCHEMATIC_P.splitY }],
      branch1: [],
      branch2: [],
    }
  }

  return {
    main: trunk,
    branch1: [{ x: SCHEMATIC_P.splitX, y: SCHEMATIC_P.splitY }, { x: SCHEMATIC_P.outlet1X, y: SCHEMATIC_P.outlet1Y }],
    branch2: [{ x: SCHEMATIC_P.splitX, y: SCHEMATIC_P.splitY }, { x: SCHEMATIC_P.outlet2X, y: SCHEMATIC_P.outlet2Y }],
  }
}
