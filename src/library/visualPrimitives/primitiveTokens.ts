/**
 * primitiveTokens.ts
 *
 * Canonical design tokens for all visual primitive SVG drawings.
 *
 * Every raw number or colour literal that appears across the 14 canonical
 * primitives and the topology pipe layer must derive from this module.
 * Do not hard-code stroke widths, pipe colours, font sizes, gauge geometry,
 * or cylinder dimensions anywhere else.
 *
 * ─── Usage rules ────────────────────────────────────────────────────────────
 * • Pipe colours  — import FLOW_COLOUR / RETURN_COLOUR / AUX_COLOUR.
 * • Stroke widths — PIPE_STROKE_MAIN for the primary circuit ring;
 *                   PIPE_STROKE_BRANCH for radiator drops / cylinder spurs;
 *                   PIPE_STROKE_GAS for gas-supply stubs.
 * • Valve bodies  — VALVE_W / VALVE_H define the canonical 5:3 rectangle.
 * • Gauge shapes  — GAUGE_NEEDLE_PIVOT_R / GAUGE_READING_FONT_SIZE /
 *                   GAUGE_TICK_FONT_SIZE keep all gauge-type primitives
 *                   pixel-consistent so a future TemperatureGaugePrimitive
 *                   matches PressureGaugePrimitive automatically.
 * • Cylinder SVG  — CYLINDER_SVG_W / CYLINDER_SVG_H are the shared viewBox
 *                   dimensions used by both CylinderPrimitive and
 *                   MixergyCylinderPrimitive so they remain pixel-aligned
 *                   when placed side by side in topologies.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Canonical equipment heights at `md` scale (viewBox height × scale 1.0):
 *   Boiler     ≈ 110 px   (BoilerPrimitive   100 × 110 viewBox)
 *   Cylinder   ≈ 132 px   (CylinderPrimitive 84  × 132 viewBox)
 *   Radiator   ≈  60 px   (RadiatorPrimitive 120 × 60  viewBox)
 *   Pump       ≈  60 px   (PumpPrimitive     100 × 60  viewBox)
 *
 * These heights are intentionally mismatched — the topology layout grid
 * (TOPOLOGY_LAYOUT_GRID.md) specifies equipment anchor zones that account
 * for each component's natural height.
 */

// ─── Pipe colours ─────────────────────────────────────────────────────────────

/** Hot flow pipe — red. */
export const FLOW_COLOUR = '#ef4444';

/** Cooler return pipe — blue. */
export const RETURN_COLOUR = '#3b82f6';

/** Auxiliary pipe (vent, gas stub, ABV bridge, etc.) — slate. */
export const AUX_COLOUR = '#475569';

// ─── Print-safe overrides ─────────────────────────────────────────────────────

/** Flow pipe colour in monochrome print mode. */
export const PRINT_FLOW_COLOUR = '#000000';

/** Return pipe colour in monochrome print mode. */
export const PRINT_RETURN_COLOUR = '#475569';

// ─── Pipe stroke widths ───────────────────────────────────────────────────────

/** Primary circuit ring — main flow/return loop. */
export const PIPE_STROKE_MAIN = 3;

/** Branch spurs — radiator drops, cylinder connections, short stubs. */
export const PIPE_STROKE_BRANCH = 2;

/** Gas supply stub. */
export const PIPE_STROKE_GAS = 2;

// ─── Colour-blind-safe return-pipe dash ───────────────────────────────────────

/**
 * Secondary shape cue for return pipes in colour mode.
 *
 * Flow pipes: continuous stroke (no dasharray).
 * Return pipes: `RETURN_PIPE_DASH` — a recognisable dash even at small size.
 *
 * In print mode use PRINT_RETURN_DASH (tighter for black-on-white contrast).
 */
export const RETURN_PIPE_DASH = '7 4';
export const PRINT_RETURN_DASH = '5 2';

// ─── Label / text ─────────────────────────────────────────────────────────────

/** Standard component name label below equipment SVG. */
export const LABEL_FONT_SIZE = 11;

/** Pipe annotation label inside PipeLayer SVG. */
export const PIPE_LABEL_FONT_SIZE = 11;

/** Pipe label standoff from the pipe line in SVG user units. */
export const PIPE_LABEL_STANDOFF = 8;

// ─── Valve proportions ───────────────────────────────────────────────────────

/**
 * Canonical valve body rectangle: 5:3 ratio at md scale.
 *
 * TRV bodies, lockshield caps, and inline ABV valve bodies all derive
 * from this. Scale these by PrimitiveSize multiplier where needed.
 */
export const VALVE_W = 10;
export const VALVE_H = 6;

// ─── Gauge geometry ───────────────────────────────────────────────────────────

/** Needle pivot circle radius. Shared by pressure and temperature gauges. */
export const GAUGE_NEEDLE_PIVOT_R = 3;

/** Pressure/temperature reading text size inside the gauge face. */
export const GAUGE_READING_FONT_SIZE = 9;

/** Scale-tick label size around the gauge arc. */
export const GAUGE_TICK_FONT_SIZE = 6;

// ─── Cylinder SVG geometry ───────────────────────────────────────────────────

/**
 * Shared viewBox dimensions for CylinderPrimitive and MixergyCylinderPrimitive.
 *
 * Both cylinders use the same 46×110 body (≈ 1:2.4) inside a 84×132 viewBox so they
 * occupy exactly the same space when placed in topology layouts.
 */
export const CYLINDER_SVG_W = 84;
export const CYLINDER_SVG_H = 132;
export const CYLINDER_BODY_X = 19;
export const CYLINDER_BODY_Y = 10;
export const CYLINDER_BODY_W = 46;
export const CYLINDER_BODY_H = 110;

// ─── Routing rails ────────────────────────────────────────────────────────────

/**
 * Canonical pipe routing rail identifiers.
 *
 * Each rail maps to a specific pipe function in a domestic heating system.
 * Pipe segments must be annotated with one of these roles so topology
 * validation can verify hydraulic connectivity.
 *
 * Usage: assign to `data-pipe-rail` on SVG <line> elements.
 */
export const ROUTING_RAILS = {
  /** Central heating flow (hot, from boiler to emitters). */
  CH_FLOW: 'ch_flow',
  /** Central heating return (cooled, from emitters back to boiler). */
  CH_RETURN: 'ch_return',
  /** Domestic hot water distribution (to DHW outlets). */
  DHW: 'dhw',
  /** Cold water mains supply. */
  CW_MAINS: 'cw_mains',
  /** Gas supply to boiler burner. */
  GAS: 'gas',
  /** Discharge pipe to tundish and external air (safety/D2). */
  D2_DISCHARGE: 'd2_discharge',
} as const;

export type RoutingRail = (typeof ROUTING_RAILS)[keyof typeof ROUTING_RAILS];

// ─── Installation zones ───────────────────────────────────────────────────────

/**
 * Canonical installation zone identifiers for the topology layout grid.
 *
 * Equipment anchors in every topology template must be assigned to one of
 * these zones.  The zone assignment drives visual placement and
 * templateCompliance.ts validation.
 *
 * Corresponds to the zones defined in TOPOLOGY_LAYOUT_GRID.md.
 */
export const INSTALLATION_ZONES = {
  /** Primary heat source (boiler, heat pump, hybrid unit). */
  HEAT_SOURCE: 'heat_source',
  /** Hot water storage (cylinder, thermal store, buffer). */
  STORAGE: 'storage',
  /** Heat emitters (radiators, underfloor loops). */
  EMITTERS: 'emitters',
  /** Controls (programmer, thermostat, zone valves, weather comp). */
  CONTROLS: 'controls',
  /** System protection (expansion vessel, ABV, pressure gauge, PRV). */
  PROTECTION: 'protection',
  /** Service access (filling loop, magnetic filter, powerflush ports). */
  SERVICE: 'service',
} as const;

export type InstallationZone = (typeof INSTALLATION_ZONES)[keyof typeof INSTALLATION_ZONES];
