/**
 * propertyLayouts — preset house/property floor plans for the House View.
 *
 * Each layout provides:
 *  - rooms:           labelled rectangles per floor (rendered as SVG rects)
 *  - radiatorAnchors: fixed emitter positions mapped to rooms
 *  - outletAnchors:   DHW draw-off fixtures (bath, shower, basin, sink, cold tap)
 *  - plantAnchors:    named snap targets where system plant can be placed
 *
 * All coordinates share a single 800 × 560 SVG viewport so all four layouts
 * render in the same container without reflowing the page.
 *
 * Vertical layout convention (top → bottom in the SVG):
 *   First floor  : y = 20 – 265
 *   Ground floor : y = 285 – 515
 *   Outside      : y = 530 – 555
 *
 * For single-storey layouts (bungalow, flat) rooms are arranged in two rows
 * on a single floor band that occupies y = 30 – 500.
 */

import type { StructuralZone } from './schematicBlocks'

// ─── Shared viewport ──────────────────────────────────────────────────────────

export const LAYOUT_VIEW_BOX = '0 0 800 560'
export const LAYOUT_VIEW_W  = 800
export const LAYOUT_VIEW_H  = 560

/**
 * Y-position and height of the "outside" strip rendered at the bottom of every
 * two-storey layout.  Exported so PropertyLayoutView can render it consistently
 * without duplicating magic numbers.
 */
export const LAYOUT_OUTSIDE_STRIP_Y = 525
export const LAYOUT_OUTSIDE_STRIP_H = 35

// ─── Domain types ─────────────────────────────────────────────────────────────

export type PropertyLayoutId = 'bungalow' | 'flat' | '2bed_house' | '3bed_semi'

export type FloorLevel = 'ground' | 'first' | 'single' | 'outside' | 'roof'

export type OutletKind = 'bath' | 'shower' | 'basin' | 'sink' | 'cold_tap'

/**
 * Semantic role of a plant anchor — identifies what the snap target is for.
 *
 * boiler_option_1 / _2  — alternative positions for the heat source (boiler or
 *                         heat-pump indoor unit).
 * cylinder_option_1 / _2 — alternative positions for a hot-water cylinder.
 * heat_pump_outside      — external ASHP unit position.
 * airing_cupboard        — dedicated linen / airing cupboard position.
 */
export type PlantAnchorKind =
  | 'boiler_option_1'
  | 'boiler_option_2'
  | 'cylinder_option_1'
  | 'cylinder_option_2'
  | 'heat_pump_outside'
  | 'airing_cupboard'

// ─── Data structures ──────────────────────────────────────────────────────────

/** A named room rectangle within the floor plan. */
export interface RoomDef {
  id:    string
  label: string
  floor: FloorLevel
  /** Top-left corner and dimensions in the shared 800×560 viewport. */
  x: number
  y: number
  w: number
  h: number
}

/** A fixed emitter (radiator / towel rail) position within a room. */
export interface RadiatorAnchor {
  id:     string
  roomId: string
  /** Centre of the radiator symbol in the 800×560 viewport. */
  x: number
  y: number
}

/** A DHW draw-off fixture (tap, shower head, bath, etc.). */
export interface OutletAnchor {
  id:     string
  roomId: string
  kind:   OutletKind
  x:      number
  y:      number
  label:  string
}

/**
 * A named snap target where a system plant component can be placed.
 *
 * roomId is null for outdoor anchors (ASHP, GSHP manifold).
 * zone mirrors the StructuralZone used by the schematic builder so that
 * selections here can later be cross-referenced with BuildNode.placement.
 */
export interface PlantAnchor {
  id:     string
  roomId: string | null
  kind:   PlantAnchorKind
  zone:   StructuralZone
  x:      number
  y:      number
  label:  string
}

/** Complete preset house map with all placement anchors. */
export interface PropertyLayout {
  id:          PropertyLayoutId
  label:       string
  description: string
  viewBox:     string
  rooms:           RoomDef[]
  radiatorAnchors: RadiatorAnchor[]
  outletAnchors:   OutletAnchor[]
  plantAnchors:    PlantAnchor[]
}

// ─── Shorthand factory helpers ────────────────────────────────────────────────

const room = (
  id: string, label: string, floor: FloorLevel,
  x: number, y: number, w: number, h: number,
): RoomDef => ({ id, label, floor, x, y, w, h })

const rad = (id: string, roomId: string, x: number, y: number): RadiatorAnchor =>
  ({ id, roomId, x, y })

const outlet = (
  id: string, roomId: string, kind: OutletKind,
  x: number, y: number, label: string,
): OutletAnchor => ({ id, roomId, kind, x, y, label })

const plant = (
  id: string, roomId: string | null, kind: PlantAnchorKind, zone: StructuralZone,
  x: number, y: number, label: string,
): PlantAnchor => ({ id, roomId, kind, zone, x, y, label })

// ─── Preset layouts ───────────────────────────────────────────────────────────

/**
 * 2-bedroom house — two floors, three rooms per floor.
 *
 * First floor  y: 20 – 265  (Bedroom 1 | Bedroom 2 | Bathroom)
 * Ground floor y: 285 – 515 (Kitchen | Living Room | Hall / WC)
 * Outside      y: 525 – 560
 *
 * UK convention: the first floor is the upper floor (bedrooms); the ground
 * floor is the entrance level (kitchen, living room).  The SVG renders higher
 * floors toward the top (smaller y values).
 */
const LAYOUT_2BED_HOUSE: PropertyLayout = {
  id:          '2bed_house',
  label:       '2-bed house',
  description: 'Two-bedroom terraced or semi-detached house, two floors.',
  viewBox:     LAYOUT_VIEW_BOX,
  rooms: [
    // — First floor (upper) —
    room('bd1',  'Bedroom 1',    'first',   40,  20, 280, 245),
    room('bd2',  'Bedroom 2',    'first',  320,  20, 210, 245),
    room('bth',  'Bathroom',     'first',  530,  20, 230, 245),
    // — Ground floor (entrance level) —
    room('kit',  'Kitchen',      'ground',  40, 285, 200, 230),
    room('liv',  'Living Room',  'ground', 240, 285, 290, 230),
    room('hal',  'Hall / WC',    'ground', 530, 285, 230, 230),
  ],
  radiatorAnchors: [
    rad('rad_bd1', 'bd1', 150,  30),   // top wall, Bedroom 1
    rad('rad_bd2', 'bd2', 410,  30),   // top wall, Bedroom 2
    rad('rad_bth', 'bth', 735, 155),   // right wall, towel rail
    rad('rad_kit', 'kit',  90, 295),   // top wall, Kitchen
    rad('rad_liv', 'liv', 375, 295),   // top wall, Living Room
  ],
  outletAnchors: [
    outlet('out_bth_bath',  'bth', 'bath',    545, 120, 'Bath'),
    outlet('out_bth_shwr',  'bth', 'shower',  610, 185, 'Shower'),
    outlet('out_bth_bsn',   'bth', 'basin',   695, 255, 'Bathroom basin'),
    outlet('out_kit_sink',  'kit', 'sink',     55, 507, 'Kitchen sink'),
    outlet('out_kit_cold',  'kit', 'cold_tap', 90, 507, 'Kitchen cold tap'),
    outlet('out_hal_basin', 'hal', 'basin',   548, 507, 'WC basin'),
  ],
  plantAnchors: [
    plant('pa_boil_1', 'kit',  'boiler_option_1',  'plant_room',       125, 309, 'Boiler — kitchen'),
    plant('pa_boil_2', 'hal',  'boiler_option_2',  'plant_room',       650, 309, 'Boiler — hall cupboard'),
    plant('pa_cyl_1',  'bd1',  'cylinder_option_1','airing_cupboard',  275,  35, 'Cylinder — landing cupboard'),
    plant('pa_cyl_2',  'bth',  'cylinder_option_2','airing_cupboard',  545,  35, 'Cylinder — bathroom'),
    plant('pa_hp',     null,   'heat_pump_outside', 'outside',         200, 542, 'Heat pump — outside'),
  ],
}

/**
 * 3-bedroom semi-detached house — two floors.
 *
 * First floor  y: 20 – 265  (Bedroom 1 | Bedroom 2 | Bedroom 3 | Bathroom)
 * Ground floor y: 285 – 515 (Kitchen | Utility/Dining | Living Room | Hall)
 * Outside      y: 525 – 560
 */
const LAYOUT_3BED_SEMI: PropertyLayout = {
  id:          '3bed_semi',
  label:       '3-bed semi',
  description: 'Three-bedroom semi-detached house, two floors.',
  viewBox:     LAYOUT_VIEW_BOX,
  rooms: [
    // — First floor (upper) —
    room('bd1',  'Bedroom 1',     'first',   40,  20, 215, 245),
    room('bd2',  'Bedroom 2',     'first',  255,  20, 195, 245),
    room('bd3',  'Bedroom 3',     'first',  450,  20, 145, 245),
    room('bth',  'Bathroom',      'first',  595,  20, 165, 245),
    // — Ground floor (entrance level) —
    room('kit',  'Kitchen',       'ground',  40, 285, 175, 230),
    room('uti',  'Utility/Dining','ground', 215, 285, 155, 230),
    room('liv',  'Living Room',   'ground', 370, 285, 225, 230),
    room('hal',  'Hall',          'ground', 595, 285, 165, 230),
  ],
  radiatorAnchors: [
    rad('rad_bd1', 'bd1',  130,  30),
    rad('rad_bd2', 'bd2',  335,  30),
    rad('rad_bd3', 'bd3',  515,  30),
    rad('rad_bth', 'bth',  750, 160),  // towel rail
    rad('rad_kit', 'kit',   85, 295),
    rad('rad_uti', 'uti',  280, 295),
    rad('rad_liv', 'liv',  470, 295),
    rad('rad_hal', 'hal',  650, 295),
  ],
  outletAnchors: [
    outlet('out_bth_bath',  'bth', 'bath',    600, 120, 'Bath'),
    outlet('out_bth_shwr',  'bth', 'shower',  660, 185, 'Shower'),
    outlet('out_bth_bsn',   'bth', 'basin',   730, 255, 'Bathroom basin'),
    outlet('out_kit_sink',  'kit', 'sink',     55, 507, 'Kitchen sink'),
    outlet('out_kit_cold',  'kit', 'cold_tap', 90, 507, 'Kitchen cold tap'),
    outlet('out_uti_sink',  'uti', 'sink',    230, 507, 'Utility sink'),
  ],
  plantAnchors: [
    plant('pa_boil_1', 'kit',  'boiler_option_1',  'plant_room',        95, 309, 'Boiler — kitchen'),
    plant('pa_boil_2', 'uti',  'boiler_option_2',  'plant_room',       280, 309, 'Boiler — utility room'),
    plant('pa_cyl_1',  'bd2',  'cylinder_option_1','airing_cupboard',  245,  35, 'Cylinder — landing cupboard'),
    plant('pa_cyl_2',  'bd3',  'cylinder_option_2','airing_cupboard',  445,  35, 'Cylinder — bedroom 3 corner'),
    plant('pa_hp',     null,   'heat_pump_outside', 'outside',         200, 542, 'Heat pump — outside'),
  ],
}

/**
 * Bungalow — single storey with loft space above.
 *
 * Because there is only one floor, rooms are arranged in two rows within a
 * single floor band that spans y = 25 – 495.
 *
 * Top row    y: 25 – 215  (Kitchen | Living Room | Bedroom 1)
 * Bottom row y: 230 – 490 (Bedroom 2 | Bathroom | Hall / WC)
 * Outside    y: 510 – 540
 */
const LAYOUT_BUNGALOW: PropertyLayout = {
  id:          'bungalow',
  label:       'Bungalow',
  description: 'Single-storey bungalow with loft space.',
  viewBox:     LAYOUT_VIEW_BOX,
  rooms: [
    // — Top row (north) —
    room('kit',  'Kitchen',     'single',  40,  25, 195, 190),
    room('liv',  'Living Room', 'single', 235,  25, 280, 190),
    room('bd1',  'Bedroom 1',   'single', 515,  25, 245, 190),
    // — Bottom row (south) —
    room('bd2',  'Bedroom 2',   'single',  40, 230, 230, 220),
    room('bth',  'Bathroom',    'single', 270, 230, 200, 220),
    room('hal',  'Hall / WC',   'single', 470, 230, 130, 220),
    room('bd3',  'Bedroom 3',   'single', 600, 230, 160, 220),
  ],
  radiatorAnchors: [
    rad('rad_kit', 'kit',  130,  37),
    rad('rad_liv', 'liv',  375,  37),
    rad('rad_bd1', 'bd1',  635,  37),
    rad('rad_bd2', 'bd2',  140, 242),
    rad('rad_bth', 'bth',  455, 395),  // towel rail
    rad('rad_bd3', 'bd3',  680, 242),
  ],
  outletAnchors: [
    outlet('out_kit_sink', 'kit', 'sink',     55,  205, 'Kitchen sink'),
    outlet('out_kit_cold', 'kit', 'cold_tap', 90,  205, 'Kitchen cold tap'),
    outlet('out_bth_bath', 'bth', 'bath',    275,  380, 'Bath'),
    outlet('out_bth_shwr', 'bth', 'shower',  335,  430, 'Shower'),
    outlet('out_bth_bsn',  'bth', 'basin',   405,  440, 'Bathroom basin'),
    outlet('out_hal_bsn',  'hal', 'basin',   480,  430, 'WC basin'),
  ],
  plantAnchors: [
    plant('pa_boil_1', 'kit',  'boiler_option_1',  'plant_room',       130,  45, 'Boiler — kitchen'),
    plant('pa_boil_2', 'hal',  'boiler_option_2',  'plant_room',       520, 250, 'Boiler — hall cupboard'),
    plant('pa_cyl_1',  'bth',  'cylinder_option_1','airing_cupboard',  265, 245, 'Cylinder — airing cupboard'),
    plant('pa_cyl_2',  'bd2',  'cylinder_option_2','airing_cupboard',  262, 250, 'Cylinder — bedroom 2 corner'),
    plant('pa_airing', 'hal',  'airing_cupboard',  'airing_cupboard',  595, 250, 'Airing cupboard'),
    plant('pa_hp',     null,   'heat_pump_outside', 'outside',         300, 525, 'Heat pump — outside'),
  ],
}

/**
 * Flat — single storey with balcony for ASHP placement.
 *
 * Top row    y: 25 – 230  (Kitchen / Living | Bedroom 1)
 * Bottom row y: 250 – 470 (Hall | Bathroom | Storage | Bedroom 2)
 * Balcony    y: 490 – 520
 */
const LAYOUT_FLAT: PropertyLayout = {
  id:          'flat',
  label:       'Flat',
  description: 'Ground-floor or upper-floor flat with balcony.',
  viewBox:     LAYOUT_VIEW_BOX,
  rooms: [
    // — Top row —
    room('kli',  'Kitchen / Living', 'single',  40,  25, 400, 205),
    room('bd1',  'Bedroom 1',        'single', 440,  25, 320, 205),
    // — Bottom row —
    room('hal',  'Hall',             'single',  40, 250, 155, 220),
    room('bth',  'Bathroom',         'single', 195, 250, 195, 220),
    room('sto',  'Storage',          'single', 390, 250, 145, 220),
    room('bd2',  'Bedroom 2',        'single', 535, 250, 225, 220),
  ],
  radiatorAnchors: [
    rad('rad_kli', 'kli', 230,  37),
    rad('rad_bd1', 'bd1', 595,  37),
    rad('rad_hal', 'hal',  85, 262),
    rad('rad_bth', 'bth', 375, 415),  // towel rail
    rad('rad_bd2', 'bd2', 640, 262),
  ],
  outletAnchors: [
    outlet('out_kli_sink', 'kli', 'sink',     60,  220, 'Kitchen sink'),
    outlet('out_kli_cold', 'kli', 'cold_tap', 95,  220, 'Kitchen cold tap'),
    outlet('out_bth_bath', 'bth', 'bath',    200,  395, 'Bath'),
    outlet('out_bth_shwr', 'bth', 'shower',  260,  445, 'Shower'),
    outlet('out_bth_bsn',  'bth', 'basin',   340,  460, 'Bathroom basin'),
  ],
  plantAnchors: [
    plant('pa_boil_1', 'kli', 'boiler_option_1',  'plant_room',       200,  45, 'Boiler — kitchen'),
    plant('pa_cyl_1',  'sto', 'cylinder_option_1','airing_cupboard',  395, 265, 'Cylinder — storage cupboard'),
    plant('pa_cyl_2',  'bth', 'cylinder_option_2','airing_cupboard',  190, 265, 'Cylinder — bathroom'),
    plant('pa_hp',     null,  'heat_pump_outside', 'outside',         150, 505, 'Heat pump — balcony'),
  ],
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const PROPERTY_LAYOUTS: PropertyLayout[] = [
  LAYOUT_2BED_HOUSE,
  LAYOUT_3BED_SEMI,
  LAYOUT_BUNGALOW,
  LAYOUT_FLAT,
]

export const PROPERTY_LAYOUT_IDS: PropertyLayoutId[] = PROPERTY_LAYOUTS.map(l => l.id)

/** Look up a layout by id. Throws if id is not found. */
export function getPropertyLayout(id: PropertyLayoutId): PropertyLayout {
  const layout = PROPERTY_LAYOUTS.find(l => l.id === id)
  if (!layout) throw new Error(`Unknown property layout id: ${id}`)
  return layout
}

// ─── Anchor helpers ───────────────────────────────────────────────────────────

/** Return all plant anchors of a given kind within a layout. */
export function anchorsOfKind(
  layout: PropertyLayout,
  kind: PlantAnchorKind,
): PlantAnchor[] {
  return layout.plantAnchors.filter(a => a.kind === kind)
}

/** Return the room for a given roomId, or null if not found. */
export function roomById(layout: PropertyLayout, roomId: string): RoomDef | null {
  return layout.rooms.find(r => r.id === roomId) ?? null
}

/** Return all radiator anchors that belong to a given room. */
export function radiatorsInRoom(layout: PropertyLayout, roomId: string): RadiatorAnchor[] {
  return layout.radiatorAnchors.filter(r => r.roomId === roomId)
}

/** Return all outlet anchors that belong to a given room. */
export function outletsInRoom(layout: PropertyLayout, roomId: string): OutletAnchor[] {
  return layout.outletAnchors.filter(o => o.roomId === roomId)
}
