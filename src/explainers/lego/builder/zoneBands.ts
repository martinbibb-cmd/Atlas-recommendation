/**
 * zoneBands — structural zone layout layer for the builder schematic.
 *
 * Defines the visual bands (labelled horizontal strips) used to group
 * components by their physical context zone.  Both the builder canvas and
 * the Play overlay derive their zone backgrounds from these constants.
 *
 * Zone order (top → bottom):
 *   roof_space      — loft / cistern space
 *   first_floor     — upstairs emitters & outlets
 *   airing_cupboard — cylinder location
 *   plant_room      — boiler, pump, valves
 *   ground_floor    — downstairs emitters & outlets
 *   outside         — heat-pump outdoor unit
 *   ground_loop     — underground GSHP collector
 */

import type { BuildNode } from './types'
import { defaultZoneForKind, type StructuralZone } from './schematicBlocks'

// ─── Layout constants ─────────────────────────────────────────────────────────

/** Height of each zone band in world-coordinate pixels. */
export const ZONE_BAND_HEIGHT = 180

/**
 * Total width of each zone band.  Set wide enough to always cover the visible
 * viewport even after extreme panning.
 */
export const ZONE_BAND_WIDTH = 6000

/** Left edge x of every zone band (centred around x = 0). */
export const ZONE_BAND_X = -(ZONE_BAND_WIDTH / 2)

// ─── Zone ordering ────────────────────────────────────────────────────────────

/**
 * Canonical vertical order of structural zones, from top (roof / loft) to
 * bottom (underground).
 */
export const ZONE_ORDER: StructuralZone[] = [
  'roof_space',
  'first_floor',
  'airing_cupboard',
  'plant_room',
  'ground_floor',
  'outside',
  'ground_loop',
]

// ─── Visual metadata per zone ─────────────────────────────────────────────────

interface ZoneMeta {
  label: string
  /** SVG/CSS fill colour for the band background rectangle. */
  fill: string
  /** SVG stroke colour for the band border. */
  stroke: string
}

const ZONE_META: Record<StructuralZone, ZoneMeta> = {
  roof_space:      { label: 'Roof space',      fill: 'rgba(203,213,225,0.14)', stroke: 'rgba(100,116,139,0.25)' },
  first_floor:     { label: 'First floor',     fill: 'rgba(219,234,254,0.18)', stroke: 'rgba(96,165,250,0.28)' },
  airing_cupboard: { label: 'Airing cupboard', fill: 'rgba(186,230,253,0.18)', stroke: 'rgba(14,165,233,0.28)' },
  plant_room:      { label: 'Plant room',      fill: 'rgba(254,243,199,0.18)', stroke: 'rgba(234,179,8,0.28)' },
  ground_floor:    { label: 'Ground floor',    fill: 'rgba(220,252,231,0.18)', stroke: 'rgba(34,197,94,0.28)' },
  outside:         { label: 'Outside',         fill: 'rgba(209,250,229,0.18)', stroke: 'rgba(16,185,129,0.28)' },
  ground_loop:     { label: 'Ground loop',     fill: 'rgba(178,245,203,0.14)', stroke: 'rgba(5,150,105,0.25)' },
}

// ─── Band definition ──────────────────────────────────────────────────────────

export interface ZoneBandDef {
  zone: StructuralZone
  label: string
  fill: string
  stroke: string
  /** World y-coordinate of the top edge of this band. */
  y: number
  /** World height of this band. */
  height: number
}

/**
 * Return the world-coordinate band definition for a given zone.
 *
 * The y-coordinate is derived from the zone's position in ZONE_ORDER, so
 * the bands tile contiguously from y = 0 downward.
 */
export function zoneBandForZone(zone: StructuralZone): ZoneBandDef {
  const idx = ZONE_ORDER.indexOf(zone)
  const meta = ZONE_META[zone]
  return {
    zone,
    label: meta.label,
    fill: meta.fill,
    stroke: meta.stroke,
    y: idx * ZONE_BAND_HEIGHT,
    height: ZONE_BAND_HEIGHT,
  }
}

/**
 * Return all zone band definitions in order (roof → ground loop).
 */
export function allZoneBands(): ZoneBandDef[] {
  return ZONE_ORDER.map(zoneBandForZone)
}

// ─── Node helpers ─────────────────────────────────────────────────────────────

/**
 * Return the effective structural zone for a BuildNode.
 *
 * Respects the optional `placement.zone` override on the node; falls back to
 * `defaultZoneForKind(node.kind)` when no explicit placement is set.
 */
export function effectiveZone(node: BuildNode): StructuralZone {
  return node.placement?.zone ?? defaultZoneForKind(node.kind)
}

/**
 * Return the default y-coordinate for placing a new component in a given zone.
 *
 * Returns the vertical centre of the zone's band, giving components placed
 * into an empty zone a sensible starting position.
 */
export function defaultYForZone(zone: StructuralZone): number {
  const band = zoneBandForZone(zone)
  return band.y + band.height / 2
}
