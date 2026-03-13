/**
 * planRooms — top-view house plan scaffold for the builder canvas.
 *
 * Defines the room layout used as the background scaffold in the workbench.
 * Replaces the stacked section-style zone bands with a floor-plan view
 * that shows the house from above.
 *
 * Room coordinates are in world-canvas units (same space as BuildNode x/y).
 * The plan covers the typical component placement range used by presets
 * and the smart-attach auto-layout.
 *
 * Floor organisation (top → bottom in y):
 *   Loft / Roof Space        (y ≈ 20–140)
 *   First floor rooms        (y ≈ 150–390)
 *   Ground floor rooms       (y ≈ 400–620)
 *   Outside / plant unit     (y ≈ 630–760)
 *   Ground loop (GSHP)       (y ≈ 770–900)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanRoom {
  id:     string
  label:  string
  x:      number
  y:      number
  w:      number
  h:      number
  fill:   string
  stroke: string
}

// ─── Room definitions ─────────────────────────────────────────────────────────

/**
 * Top-view house plan rooms.
 *
 * Colours are chosen to echo the semantic palette used for zone bands
 * so engineers retain spatial familiarity while gaining plan-view context.
 */
export const PLAN_ROOMS: readonly PlanRoom[] = [
  // ── Loft / roof space ────────────────────────────────────────────────────
  {
    id:     'loft',
    label:  'Loft / Roof Space',
    x:      30,  y:  20, w: 730, h: 120,
    fill:   'rgba(203,213,225,0.20)',
    stroke: 'rgba(100,116,139,0.35)',
  },

  // ── First floor ──────────────────────────────────────────────────────────
  {
    id:     'airing_cupboard',
    label:  'Airing Cupboard',
    x:      30,  y: 150, w: 180, h: 240,
    fill:   'rgba(186,230,253,0.25)',
    stroke: 'rgba(14,165,233,0.40)',
  },
  {
    id:     'bathroom',
    label:  'Bathroom',
    x:     220,  y: 150, w: 220, h: 240,
    fill:   'rgba(219,234,254,0.25)',
    stroke: 'rgba(96,165,250,0.40)',
  },
  {
    id:     'bedrooms',
    label:  'Bedrooms',
    x:     450,  y: 150, w: 310, h: 240,
    fill:   'rgba(219,234,254,0.22)',
    stroke: 'rgba(96,165,250,0.35)',
  },

  // ── Ground floor ─────────────────────────────────────────────────────────
  {
    id:     'kitchen',
    label:  'Kitchen / Plant Room',
    x:      30,  y: 400, w: 290, h: 220,
    fill:   'rgba(254,243,199,0.28)',
    stroke: 'rgba(234,179,8,0.42)',
  },
  {
    id:     'hall',
    label:  'Hall',
    x:     330,  y: 400, w: 110, h: 220,
    fill:   'rgba(203,213,225,0.22)',
    stroke: 'rgba(100,116,139,0.35)',
  },
  {
    id:     'lounge',
    label:  'Lounge / Dining',
    x:     450,  y: 400, w: 310, h: 220,
    fill:   'rgba(220,252,231,0.25)',
    stroke: 'rgba(34,197,94,0.40)',
  },

  // ── Outside (heat pump outdoor unit / ASHP) ──────────────────────────────
  {
    id:     'outside',
    label:  'Outside',
    x:      30,  y: 630, w: 730, h: 130,
    fill:   'rgba(209,250,229,0.20)',
    stroke: 'rgba(16,185,129,0.35)',
  },

  // ── Ground loop (GSHP underground collector) ─────────────────────────────
  {
    id:     'ground_loop',
    label:  'Ground Loop',
    x:      30,  y: 770, w: 730, h: 120,
    fill:   'rgba(178,245,203,0.16)',
    stroke: 'rgba(5,150,105,0.28)',
  },
]
