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
   * Must be < 86 (= boilerY − 44, the top edge of the boiler box) to avoid overlap.
   */
  coldBypassY: 55,

  // ── Cylinder layout for stored / heat_pump systems ────────────────────────
  // Derived from boilerX / boilerY.  LabCanvas derives its local cylinder
  // constants from these values so the two files are always in sync.
  /** Left edge of the cylinder box (= boilerX − 60). */
  cylX: 360,
  /** Top edge of the cylinder box (= boilerY − 44). */
  cylY: 86,
  /** Width of the cylinder box. */
  cylW: 180,
  /** Height of the cylinder box. */
  cylH: 88,
  /**
   * Y-coordinate of the cold-supply rail for stored / heat-pump systems.
   * Runs just below both appliance boxes (= cylY + cylH + 6 = 180).
   * All cold-water paths branch from this rail.
   * Note: in SVG coordinates, higher Y = lower on screen. coldRailY (180) is
   * numerically greater than the cylinder bottom (cylY + cylH = 174), meaning
   * the rail sits visually below the cylinder box.
   */
  coldRailY: 180,
  /**
   * Horizontal offset from cylX to the cold_in entry point on the cylinder.
   * Cold supply enters 30 px from the left edge of the cylinder box.
   */
  cylColdInOffsetX: 30,
  /**
   * Vertical offset from cylY to the hot_out port on the cylinder.
   * Hot water exits 12 px below the top edge of the cylinder box.
   */
  cylHotOutOffsetY: 12,
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
  /**
   * Dynamic outlet branches beyond the first three (D, E, F, …).
   * Keyed by slot label.  Always present — empty array when no extra outlets exist.
   */
  extraBranches: Record<string, Pt[]>
}

// ── Stored-system HEX-equivalent threshold ────────────────────────────────────
//
// For stored (cylinder) systems the "heat exchange" is the cylinder itself:
//   cold particles travel along the cold rail and enter the cylinder at the
//   bottom (cold_in), rise through the store, and exit hot from the top (hot_out).
//
// STORED_HEX_END is the s-fraction along the stored trunk at which particles
// exit the cylinder interior and begin the hot-output run to the splitter.
// TokensLayer uses this to colour MAIN particles correctly for stored systems:
//   s < STORED_HEX_END  → cold (blue) — cold rail + cylinder interior
//   s ≥ STORED_HEX_END  → postHexThermalColor (hot) — cylinder top → splitter
//
// Geometry (see buildPolylines `isStoredCylinder` branch below):
//   Seg 1: mainsX(90) → cylColdInX(390) along coldRailY(180)      len = 300
//   Seg 2: (390,180)  → cylColdIn(390,174)  [entry to cyl bottom]  len = 6
//   Seg 3: (390,174)  → cylTopLeft(390,98)  [rise inside cylinder]  len = 76
//   Seg 4: (390,98)   → cylHotOut(540,98)   [across cyl to hot_out] len = 150
//   Seg 5: (540,98)   → (540,130)           [down to trunk level]   len = 32
//   Seg 6: (540,130)  → splitter(700,130)                           len = 160
//                                                             total = 724
//
// STORED_HEX_END = (seg1 + seg2 + seg3) / total = 382 / 724 ≈ 0.527
// This positions the colour transition right at the cylinder top exit.
export const STORED_HEX_END: number = (() => {
  const { mainsX, boilerY, splitX, cylX, cylY, cylW, cylH, coldRailY,
          cylColdInOffsetX, cylHotOutOffsetY } = SCHEMATIC_P
  const cylColdInX  = cylX + cylColdInOffsetX  // 390 — cold_in entry X
  const cylColdInY  = cylY + cylH              // 174 — bottom of cylinder
  const cylHotOutX  = cylX + cylW              // 540 — hot_out X (right edge)
  const cylHotOutY  = cylY + cylHotOutOffsetY  //  98 — hot_out Y (near top)

  // In SVG coordinates Y increases downward, so:
  //   coldRailY (180) > cylColdInY (174): rail is numerically larger → visually below cyl bottom
  //   cylColdInY (174) > cylHotOutY (98): bottom is numerically larger → particles rise (Y decreases)
  const seg1 = cylColdInX - mainsX           // 300 — cold rail horizontal
  const seg2 = coldRailY  - cylColdInY       //   6 — short rise into cyl bottom
  const seg3 = cylColdInY - cylHotOutY       //  76 — rise through cylinder interior
  const seg4 = cylHotOutX - cylColdInX       // 150 — across cyl to hot_out
  const seg5 = boilerY    - cylHotOutY       //  32 — drop to trunk level
  const seg6 = splitX     - cylHotOutX       // 160 — to splitter
  const total = seg1 + seg2 + seg3 + seg4 + seg5 + seg6  // 724

  return (seg1 + seg2 + seg3) / total        // ≈ 0.527
})()

/**
 * Build the main flow polyline and outlet branch polylines, plus the optional
 * cold supply bypass for the first outlet's TMV.
 *
 * Combi / heat-pump-no-cylinder trunk:
 *   mains → boiler entry → boiler exit → splitter.
 *
 * Stored-cylinder trunk (`isStoredCylinder: true`):
 *   mains (at cold-rail Y) → cold rail → cylinder cold_in (bottom) →
 *   up through cylinder interior → cylinder hot_out (top-right) →
 *   trunk level → splitter.
 *
 * The first three branches (A, B, C) use the legacy named SCHEMATIC_P positions
 * so existing geometry stays unchanged.  Any additional outlets (D, E, …) are
 * stacked below outlet C with a fixed 55 px vertical spacing and land at the
 * same X as outlet C.
 *
 * When `tmvOutletA` is true, outlet A's branch ends at the mixer node (mixerAX,
 * mixerAY) rather than the full outlet terminal.  The mixed-water segment from
 * mixer to terminal is rendered separately by LabCanvas.
 */
export function buildPolylines(opts?: {
  tmvOutletA?: boolean
  /**
   * When true, builds a stored-cylinder domestic trunk that routes cold supply
   * through the cold rail → cylinder (not through the boiler/heat-pump box).
   * Set to `true` when `isCylinder && isStoredLayout` in LabCanvas.
   */
  isStoredCylinder?: boolean
  /**
   * Slot labels for additional outlets beyond the first three (A, B, C).
   * Each label (e.g. 'D', 'E', …) produces a branch polyline stored in
   * `extraBranches` keyed by the label.
   */
  extraOutletSlots?: string[]
}): SchematicPolylines {
  const {
    splitX, splitY, outlet1X, outlet1Y, outlet2X, outlet2Y, outlet3X, outlet3Y,
    branchBendR: R, teeX, teeY, mixerAX, mixerAY, coldBypassY,
  } = SCHEMATIC_P

  const tmvA = opts?.tmvOutletA ?? false
  // Outlet A terminal: full terminal if no TMV; mixer node if TMV active.
  const a1X = tmvA ? mixerAX : outlet1X
  const a1Y = tmvA ? mixerAY : outlet1Y

  // ── Main trunk ─────────────────────────────────────────────────────────────
  let trunk: Pt[]

  if (opts?.isStoredCylinder) {
    // Stored-cylinder domestic trunk: cold supply never passes through the heat source.
    const { mainsX, boilerY, cylX, cylY, cylW, cylH, coldRailY,
            cylColdInOffsetX, cylHotOutOffsetY } = SCHEMATIC_P
    const cylColdInX = cylX + cylColdInOffsetX  // 390
    const cylColdInY = cylY + cylH              // 174
    const cylHotOutX = cylX + cylW              // 540
    const cylHotOutY = cylY + cylHotOutOffsetY  //  98
    trunk = [
      { x: mainsX,      y: coldRailY  },   // (90,  180) — mains at cold-rail level
      { x: cylColdInX,  y: coldRailY  },   // (390, 180) — cold rail to below cylinder
      { x: cylColdInX,  y: cylColdInY },   // (390, 174) — cylinder cold_in (bottom)
      { x: cylColdInX,  y: cylHotOutY },   // (390,  98) — rise through cylinder interior
      { x: cylHotOutX,  y: cylHotOutY },   // (540,  98) — across cylinder to hot_out
      { x: cylHotOutX,  y: boilerY    },   // (540, 130) — drop to trunk level
      { x: splitX,      y: splitY     },   // (700, 130) — splitter
    ]
  } else {
    // Combi / heat-pump-without-cylinder trunk: mains → heat-source → splitter.
    trunk = [
      { x: SCHEMATIC_P.mainsX, y: SCHEMATIC_P.mainsY },
      { x: SCHEMATIC_P.boilerX - 60, y: SCHEMATIC_P.boilerY },   // boiler/HP entry
      { x: SCHEMATIC_P.boilerX + 120, y: SCHEMATIC_P.boilerY },  // boiler/HP exit
      { x: splitX, y: splitY },
    ]
  }

  // Branch A: 90° up then swept bend right → horizontal to outlet (or mixer when TMV).
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
  const branchC: Pt[] = [
    { x: splitX,         y: splitY         },
    { x: splitX,         y: outlet3Y - R   },  // foot of vertical leg
    { x: splitX + R,     y: outlet3Y       },  // end of swept bend
    { x: outlet3X,       y: outlet3Y       },
  ]

  // Cold supply bypass for TMV outlet A:
  const coldBypassA: Pt[] = tmvA ? [
    { x: teeX,    y: teeY         },
    { x: teeX,    y: coldBypassY  },
    { x: mixerAX, y: coldBypassY  },
    { x: mixerAX, y: mixerAY      },
  ] : []

  // ── Extra outlet branches (D, E, F, …) ─────────────────────────────────────
  // Stacked below outlet C, spaced 55 px apart vertically.
  // Each extra branch uses the same X position as outlet C.
  const EXTRA_BRANCH_SPACING = 55
  const extraBranches: Record<string, Pt[]> = {}
  const extraSlots = opts?.extraOutletSlots ?? []
  for (let i = 0; i < extraSlots.length; i++) {
    const label = extraSlots[i]
    const oy = outlet3Y + (i + 1) * EXTRA_BRANCH_SPACING
    const ox = outlet3X
    extraBranches[label] = [
      { x: splitX,         y: splitY  },
      { x: splitX,         y: oy - R  },   // foot of vertical leg
      { x: splitX + R,     y: oy      },   // end of swept bend
      { x: ox,             y: oy      },
    ]
  }

  return { main: trunk, branchA, branchB, branchC, coldBypassA, extraBranches }
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
