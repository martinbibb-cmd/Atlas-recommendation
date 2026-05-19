/**
 * layoutZones.ts
 *
 * Canonical zone bounds and anchor constants for the 860 × 430 topology canvas.
 *
 * All values here correspond to TOPOLOGY_LAYOUT_GRID.md §1–3.
 * This is the single source of truth — templates and the layout engine
 * import from here; they must not duplicate these literals.
 *
 * ─── Zone hierarchy ──────────────────────────────────────────────────────────
 *   heat_source  — boiler / heat pump (left side)
 *   storage      — cylinder / thermal store (right side)
 *   emitters     — radiators (top centre band)
 *   protection   — expansion vessel, pressure gauge, PRV
 *   service      — magnetic filter, filling loop, powerflush ports
 *   controls     — (not rendered in current nine topologies)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { InstallationZone } from '../../visualPrimitives/primitiveTokens';

// ─── Canvas ───────────────────────────────────────────────────────────────────

export const DESKTOP_CANVAS = { width: 860, height: 430 } as const;

// ─── Rail heights by flow-rail mode ──────────────────────────────────────────

export const RAIL_HEIGHTS = {
  /** Standard sealed/combi/open-vented topologies. */
  standard:         { flowY: 140, returnY: 300 },
  /** Thermal store — elevated flow rail to reach store primary-in port. */
  elevated_thermal: { flowY: 176, returnY: 286 },
  /** Mixergy — flow rail at cylinder charging input height. */
  elevated_mixergy: { flowY: 190, returnY: 290 },
} as const;

// ─── Emitter zone y anchors ───────────────────────────────────────────────────

/** Top of the emitter zone — radiator SVG top-left y anchor. */
export const EMITTER_TOP_Y = 70;

/**
 * y where the radiator body ends and flow/return spurs tee off.
 * = EMITTER_TOP_Y + RadiatorPrimitive height at sm scale (60 × 0.7 = 42).
 */
export const EMITTER_SPUR_Y = 112;

// ─── Loft zone ────────────────────────────────────────────────────────────────

/** Header tank top y — loft position, far right. */
export const HEADER_TANK_TOP = 18;

// ─── Heat source zone x anchor ────────────────────────────────────────────────

/**
 * Default left x for heat-source zone components (boiler, heat pump).
 * Combi boilers use a wider offset due to DHW stubs on the left.
 */
export const HEAT_SOURCE_DEFAULT_LEFT = 56;

// ─── Zone bounds (from TOPOLOGY_LAYOUT_GRID.md §2) ───────────────────────────

/**
 * Canonical bounding boxes for the six installation zones.
 * All equipment anchors (top-left corner of primitive SVG) must fall within
 * their zone bounds unless listed in KNOWN_OUT_OF_ZONE.
 */
export const ZONE_BOUNDS: Record<InstallationZone, { xMin: number; xMax: number; yMin: number; yMax: number }> = {
  heat_source: { xMin: 44,  xMax: 175, yMin: 140, yMax: 225 },
  // xMin is 430 (not 460) to accommodate thermal stores, which are wider than
  // standard cylinders and legitimately anchor at x=430 in the storage zone.
  // yMin is 110 to accommodate thermal stores, which are taller and start
  // higher (y=114) on the elevated_thermal flowRailMode (flowY=176, offset -62).
  storage:     { xMin: 430, xMax: 725, yMin: 110, yMax: 225 },
  emitters:    { xMin: 240, xMax: 720, yMin: 60,  yMax: 135 },
  protection:  { xMin: 440, xMax: 760, yMin: 50,  yMax: 310 },
  service:     { xMin: 140, xMax: 600, yMin: 130, yMax: 310 },
  controls:    { xMin: 240, xMax: 720, yMin: 60,  yMax: 135 },
} as const;
