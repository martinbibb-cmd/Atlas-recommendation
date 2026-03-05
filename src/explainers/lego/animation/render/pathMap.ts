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
  outlet2X: 900, outlet2Y: 130,  // Outlet B (middle — same level as main trunk)
  outlet3X: 900, outlet3Y: 185,  // Outlet C (bottom)
  /** Corner radius used for the 90°-off-take + swept-bend geometry on branches A and C. */
  branchBendR: 25,
  /**
   * Pre-boiler tee position — where the cold supply bypass branches off before
   * the boiler heat exchanger.  Only rendered when a TMV outlet is active.
   */
  teeX: 280, teeY: 130,
  /**
   * Thermostatic mixer valve (TMV) position for outlet A — where the cold supply
   * bypass meets the hot supply branch.  The mixed-water outlet continues from here
   * to the shower terminal (outlet1X, outlet1Y).
   */
  mixerAX: 845, mixerAY: 75,
  /**
   * Y-coordinate for the cold supply bypass horizontal run above the boiler.
   * Must be above the boiler box top (boilerY − 44 = 86) to avoid overlap.
   */
  coldBypassY: 55,
}

export type SchematicPolylines = {
  main: Pt[]
  branchA: Pt[]
  branchB: Pt[]
  branchC: Pt[]
  /**
   * Cold supply bypass polyline for outlet A's thermostatic mixer valve (TMV).
   * Runs from the pre-boiler tee, above the boiler, to the mixer node.
   * Empty array when `tmvOutletA` is false — always build but conditionally render.
   */
  coldBypassA: Pt[]
}

/**
 * Build the main flow polyline and three outlet branch polylines, plus the
 * optional cold supply bypass for outlet A's thermostatic mixer valve (TMV).
 *
 * The trunk (main) runs from mains → boiler → splitter.
 * Each branch uses a 90° off-take (perpendicular to the trunk) followed by a
 * swept bend that transitions back to horizontal before reaching the outlet.
 * Branch B (same elevation as the trunk) is a plain horizontal extension.
 * All three branches are always defined. The caller (LabCanvas/TokensLayer) is
 * responsible for dimming or hiding disabled outlets — the path geometry is
 * always present.
 *
 * When `tmvOutletA` is true, outlet A's branch ends at the mixer node (mixerAX,
 * mixerAY) rather than the full outlet terminal.  The mixed-water segment from
 * mixer to terminal is rendered separately by LabCanvas.
 */
export function buildPolylines(opts?: { tmvOutletA?: boolean }): SchematicPolylines {
  const {
    splitX, splitY, outlet1X, outlet1Y, outlet2X, outlet2Y, outlet3X, outlet3Y,
    branchBendR: R, teeX, teeY, mixerAX, mixerAY, coldBypassY,
  } = SCHEMATIC_P

  const tmvA = opts?.tmvOutletA ?? false
  // Outlet A terminal: full terminal if no TMV; mixer node if TMV active.
  const a1X = tmvA ? mixerAX : outlet1X
  const a1Y = tmvA ? mixerAY : outlet1Y

  const trunk: Pt[] = [
    { x: SCHEMATIC_P.mainsX, y: SCHEMATIC_P.mainsY },
    { x: SCHEMATIC_P.boilerX - 60, y: SCHEMATIC_P.boilerY },   // boiler entry
    { x: SCHEMATIC_P.boilerX + 120, y: SCHEMATIC_P.boilerY },  // boiler exit
    { x: splitX, y: splitY },
  ]

  // Branch A: 90° up then swept bend right → horizontal to outlet (or mixer when TMV).
  //   Vertical leg:  (splitX, splitY) → (splitX, a1Y + R)
  //   Bend corner:   elbow at (splitX, a1Y)
  //   Bend end:      (splitX + R, a1Y)
  //   Horizontal:    → (a1X, a1Y)
  const branchA: Pt[] = [
    { x: splitX,         y: splitY       },
    { x: splitX,         y: a1Y + R      },  // foot of vertical leg
    { x: splitX + R,     y: a1Y          },  // end of swept bend
    { x: a1X,            y: a1Y          },
  ]

  // Branch B: same elevation as trunk — simple horizontal run
  const branchB: Pt[] = [
    { x: splitX,   y: splitY   },
    { x: outlet2X, y: outlet2Y },
  ]

  // Branch C: 90° down then swept bend right → horizontal to outlet
  //   Vertical leg:  (splitX, splitY) → (splitX, outlet3Y - R)
  //   Bend corner:   elbow at (splitX, outlet3Y)
  //   Bend end:      (splitX + R, outlet3Y)
  //   Horizontal:    → (outlet3X, outlet3Y)
  const branchC: Pt[] = [
    { x: splitX,         y: splitY         },
    { x: splitX,         y: outlet3Y - R   },  // foot of vertical leg
    { x: splitX + R,     y: outlet3Y       },  // end of swept bend
    { x: outlet3X,       y: outlet3Y       },
  ]

  // Cold supply bypass for TMV outlet A:
  //   Tee (teeX, teeY) → UP to (teeX, coldBypassY) → RIGHT to (mixerAX, coldBypassY)
  //   → DOWN to mixer (mixerAX, mixerAY)
  const coldBypassA: Pt[] = tmvA ? [
    { x: teeX,    y: teeY         },
    { x: teeX,    y: coldBypassY  },
    { x: mixerAX, y: coldBypassY  },
    { x: mixerAX, y: mixerAY      },
  ] : []

  return { main: trunk, branchA, branchB, branchC, coldBypassA }
}

/**
 * Build an SVG path `d` string for a branch with a 90° off-take and a
 * quadratic-bezier swept bend.  Used by LabCanvas for smooth pipe rendering.
 *
 *   From split (sx, sy):
 *     – straight 90° vertical leg to the bend start
 *     – quadratic bezier to the horizontal tangent
 *     – straight horizontal to the outlet
 *
 * @param sx       X of the split/tee point
 * @param sy       Y of the split/tee point
 * @param ox       X of the outlet endpoint
 * @param oy       Y of the outlet endpoint
 * @param R        Bend corner radius
 */
export function branchSvgPath(sx: number, sy: number, ox: number, oy: number, R: number): string {
  if (oy === sy) {
    // Same elevation — plain horizontal run (branch B)
    return `M ${sx} ${sy} L ${ox} ${oy}`
  }
  const sign = oy > sy ? 1 : -1          // +1 = branch goes down, −1 = up
  const bendStartY  = oy - sign * R       // bottom/top of straight vertical leg
  const bendEndX    = sx + R              // end of arc, start of horizontal leg
  // Quadratic bezier: control point at the elbow corner (sx, oy)
  return (
    `M ${sx} ${sy} ` +
    `L ${sx} ${bendStartY} ` +
    `Q ${sx} ${oy} ${bendEndX} ${oy} ` +
    `L ${ox} ${oy}`
  )
}
