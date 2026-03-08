/**
 * PropertyLayoutView — interactive preset house map for the House View.
 *
 * Renders a selected property layout as an SVG floor plan and allows the user
 * to place system plant components (boiler, cylinder, heat pump) at predefined
 * anchor points.  Radiator and outlet fixtures are shown as fixed decorations
 * so the user can see where emitters and draw-off points belong.
 *
 * This is Phase 1 of the property context layer:
 *   - layout selector (tabs) above the map
 *   - SVG floor plan: rooms, radiators, outlets, plant anchors
 *   - plant placement: click an anchor to place / deselect a component
 *   - placement summary panel below the map
 *
 * Custom floor-plan editing is intentionally out of scope here — that is a
 * later phase.  This view "looks impressive, feels contextual" without
 * requiring a geometry engine.
 */

import { useState } from 'react'
import {
  PROPERTY_LAYOUTS,
  getPropertyLayout,
  LAYOUT_OUTSIDE_STRIP_Y,
  LAYOUT_OUTSIDE_STRIP_H,
  type PropertyLayoutId,
  type PropertyLayout,
  type PlantAnchor,
  type PlantAnchorKind,
  type OutletKind,
} from './propertyLayouts'
import './builder.css'

// ─── Placement state ──────────────────────────────────────────────────────────

/**
 * Tracks which anchor is currently selected for each plant category.
 * null means "not yet placed" (or combi — no separate cylinder).
 */
interface PlacementState {
  boilerAnchorId:   string | null
  cylinderAnchorId: string | null
  heatPumpAnchorId: string | null
}

const EMPTY_PLACEMENT: PlacementState = {
  boilerAnchorId:   null,
  cylinderAnchorId: null,
  heatPumpAnchorId: null,
}

// ─── Visual constants ─────────────────────────────────────────────────────────

/** Fill colours for each floor level band label. */
const FLOOR_BAND_FILL: Record<string, string> = {
  first:   'rgba(235,248,255,0.9)',  // cool blue — upper floor
  ground:  'rgba(240,255,244,0.9)',  // soft green — ground level
  single:  'rgba(240,255,244,0.9)',  // same as ground for single-storey
  outside: 'rgba(254,252,232,0.9)', // warm yellow — outside
  roof:    'rgba(250,240,255,0.9)',  // light purple — loft
}

/** Room rectangle fill. */
const ROOM_FILL  = '#ffffff'
const ROOM_STROKE = '#cbd5e0'

/** Anchor fill colours by kind. */
const ANCHOR_FILLS: Record<PlantAnchorKind, string> = {
  boiler_option_1:  '#ed8936',
  boiler_option_2:  '#ed8936',
  cylinder_option_1:'#2b6cb0',
  cylinder_option_2:'#2b6cb0',
  heat_pump_outside:'#276749',
  airing_cupboard:  '#553c9a',
}

/** Scale factor applied to the anchor glow ring when the anchor is active. */
const ACTIVE_ANCHOR_SCALE = 1.5

/** Single-character abbreviation rendered inside each outlet icon circle. */
const OUTLET_LETTER: Record<OutletKind, string> = {
  bath:     'B',
  shower:   'S',
  basin:    'Bs',
  sink:     'K',
  cold_tap: 'C',
}

/** Size (half-width/height) of the diamond anchor symbol. */
const ANCHOR_SIZE = 13

/** Outlet icon colours by kind. */
const OUTLET_COLORS: Record<OutletKind, string> = {
  bath:     '#4299e1',
  shower:   '#63b3ed',
  basin:    '#90cdf4',
  sink:     '#4a5568',
  cold_tap: '#718096',
}

/** Outlet unicode glyphs (supplementary label). */
const OUTLET_GLYPHS: Record<OutletKind, string> = {
  bath:     '🛁',
  shower:   '🚿',
  basin:    '🪥',
  sink:     '🚰',
  cold_tap: '💧',
}

// ─── Floor band helper ────────────────────────────────────────────────────────

interface BandInfo {
  floor: string
  label: string
  yMin: number
  yMax: number
}

/**
 * Derive visible floor bands from the rooms in the layout so the SVG can draw
 * a labelled background stripe per storey level.
 */
function deriveFloorBands(layout: PropertyLayout): BandInfo[] {
  const PADDING = 5
  const byFloor = new Map<string, { yMin: number; yMax: number }>()

  for (const room of layout.rooms) {
    const cur = byFloor.get(room.floor)
    if (!cur) {
      byFloor.set(room.floor, { yMin: room.y, yMax: room.y + room.h })
    } else {
      cur.yMin = Math.min(cur.yMin, room.y)
      cur.yMax = Math.max(cur.yMax, room.y + room.h)
    }
  }

  const FLOOR_LABELS: Record<string, string> = {
    first:  'First floor',
    ground: 'Ground floor',
    single: 'Ground floor',
    outside:'Outside',
    roof:   'Loft',
  }

  return Array.from(byFloor.entries())
    .map(([floor, { yMin, yMax }]) => ({
      floor,
      label: FLOOR_LABELS[floor] ?? floor,
      yMin:  yMin - PADDING,
      yMax:  yMax + PADDING,
    }))
    .sort((a, b) => a.yMin - b.yMin)
}

// ─── SVG sub-components ───────────────────────────────────────────────────────

function RadiatorIcon({ x, y }: { x: number; y: number }) {
  const W = 22
  const H = 10
  return (
    <g transform={`translate(${x - W / 2}, ${y - H / 2})`} aria-label="Radiator">
      <rect width={W} height={H} rx={2} fill="rgba(237,137,54,0.18)" stroke="#ed8936" strokeWidth={1.2} />
      {[4, 8, 12, 16, 20].map(cx => (
        <line key={cx} x1={cx} y1={1} x2={cx} y2={H - 1} stroke="#ed8936" strokeWidth={0.8} opacity={0.7} />
      ))}
    </g>
  )
}

function OutletIcon({ x, y, kind }: { x: number; y: number; kind: OutletKind }) {
  const color = OUTLET_COLORS[kind]
  return (
    <g aria-label={OUTLET_GLYPHS[kind]}>
      <circle cx={x} cy={y} r={6} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1.5} />
      <text x={x} y={y + 4} fontSize={7} textAnchor="middle" fill={color} fontWeight="600">
        {OUTLET_LETTER[kind]}
      </text>
    </g>
  )
}

function PlantAnchorShape({
  anchor,
  isActive,
  onClick,
}: {
  anchor:   PlantAnchor
  isActive: boolean
  onClick:  (id: string) => void
}) {
  const { x, y, label, kind } = anchor
  const fill   = ANCHOR_FILLS[kind]
  const size   = ANCHOR_SIZE
  const points = `${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`

  return (
    <g
      onClick={() => onClick(anchor.id)}
      role="button"
      aria-label={label}
      aria-pressed={isActive}
      style={{ cursor: 'pointer' }}
    >
      {isActive && (
        <polygon
          points={points}
          fill="none"
          stroke={fill}
          strokeWidth={4}
          strokeOpacity={0.35}
          transform={`scale(${ACTIVE_ANCHOR_SCALE}) translate(${x * (1 - 1 / ACTIVE_ANCHOR_SCALE)},${y * (1 - 1 / ACTIVE_ANCHOR_SCALE)})`}
        />
      )}
      <polygon
        points={points}
        fill={isActive ? fill : 'white'}
        stroke={fill}
        strokeWidth={isActive ? 2 : 1.5}
        fillOpacity={isActive ? 0.9 : 0.5}
      />
      <text
        x={x}
        y={y + 4}
        fontSize={8}
        textAnchor="middle"
        fill={isActive ? 'white' : fill}
        fontWeight="700"
        pointerEvents="none"
      >
        {kind === 'boiler_option_1' || kind === 'boiler_option_2'
          ? '🔥'
          : kind === 'cylinder_option_1' || kind === 'cylinder_option_2'
          ? '💧'
          : kind === 'heat_pump_outside'
          ? '♻'
          : '○'}
      </text>
    </g>
  )
}

// ─── Floor plan SVG ───────────────────────────────────────────────────────────

interface FloorPlanProps {
  layout:    PropertyLayout
  placement: PlacementState
  onAnchorClick: (anchorId: string, kind: PlantAnchorKind) => void
}

function FloorPlanSvg({ layout, placement, onAnchorClick }: FloorPlanProps) {
  const bands = deriveFloorBands(layout)

  const isAnchorActive = (anchor: PlantAnchor) => {
    const k = anchor.kind
    if (k === 'boiler_option_1' || k === 'boiler_option_2')
      return placement.boilerAnchorId === anchor.id
    if (k === 'cylinder_option_1' || k === 'cylinder_option_2')
      return placement.cylinderAnchorId === anchor.id
    if (k === 'heat_pump_outside')
      return placement.heatPumpAnchorId === anchor.id
    if (k === 'airing_cupboard')
      return placement.cylinderAnchorId === anchor.id
    return false
  }

  return (
    <svg
      viewBox={layout.viewBox}
      style={{ width: '100%', maxWidth: 800, display: 'block' }}
      aria-label={`Floor plan — ${layout.label}`}
    >
      {/* Floor bands */}
      {bands.map(band => (
        <rect
          key={band.floor}
          x={0}
          y={band.yMin}
          width={800}
          height={band.yMax - band.yMin}
          fill={FLOOR_BAND_FILL[band.floor] ?? '#f7fafc'}
          rx={4}
        />
      ))}

      {/* Floor labels (right-aligned) */}
      {bands.map(band => (
        <text
          key={`lbl-${band.floor}`}
          x={793}
          y={band.yMin + 14}
          fontSize={10}
          textAnchor="end"
          fill="#718096"
          fontWeight="600"
          letterSpacing={0.3}
        >
          {band.label.toUpperCase()}
        </text>
      ))}

      {/* Outside strip at bottom */}
      <rect x={0} y={LAYOUT_OUTSIDE_STRIP_Y} width={800} height={LAYOUT_OUTSIDE_STRIP_H} fill={FLOOR_BAND_FILL['outside']} rx={4} />
      <text x={793} y={LAYOUT_OUTSIDE_STRIP_Y + 14} fontSize={10} textAnchor="end" fill="#718096" fontWeight="600" letterSpacing={0.3}>
        OUTSIDE
      </text>

      {/* Rooms */}
      {layout.rooms.map(room => (
        <g key={room.id}>
          <rect
            x={room.x} y={room.y}
            width={room.w} height={room.h}
            fill={ROOM_FILL}
            stroke={ROOM_STROKE}
            strokeWidth={1.5}
            rx={4}
          />
          <text
            x={room.x + room.w / 2}
            y={room.y + room.h / 2 + 5}
            fontSize={11}
            textAnchor="middle"
            fill="#4a5568"
            fontWeight="500"
          >
            {room.label}
          </text>
        </g>
      ))}

      {/* Radiators */}
      {layout.radiatorAnchors.map(r => (
        <RadiatorIcon key={r.id} x={r.x} y={r.y} />
      ))}

      {/* Outlets */}
      {layout.outletAnchors.map(o => (
        <OutletIcon key={o.id} x={o.x} y={o.y} kind={o.kind} />
      ))}

      {/* Plant anchors */}
      {layout.plantAnchors.map(anchor => (
        <PlantAnchorShape
          key={anchor.id}
          anchor={anchor}
          isActive={isAnchorActive(anchor)}
          onClick={id => onAnchorClick(id, anchor.kind)}
        />
      ))}
    </svg>
  )
}

// ─── Placement summary ────────────────────────────────────────────────────────

function PlacementSummary({
  layout,
  placement,
}: {
  layout:    PropertyLayout
  placement: PlacementState
}) {
  function anchorLabel(anchorId: string | null): string {
    if (!anchorId) return '—'
    const a = layout.plantAnchors.find(p => p.id === anchorId)
    return a ? a.label : anchorId
  }

  const rows: Array<{ label: string; value: string; color: string }> = [
    {
      label: 'Heat source',
      value: anchorLabel(placement.boilerAnchorId),
      color: '#ed8936',
    },
    {
      label: 'Hot-water cylinder',
      value: anchorLabel(placement.cylinderAnchorId),
      color: '#2b6cb0',
    },
    {
      label: 'Heat pump',
      value: anchorLabel(placement.heatPumpAnchorId),
      color: '#276749',
    },
  ]

  return (
    <div className="property-placement-summary">
      <div className="property-placement-title">Placement summary</div>
      {rows.map(row => (
        <div key={row.label} className="property-placement-row">
          <span
            className="property-placement-dot"
            style={{ background: row.color }}
            aria-hidden="true"
          />
          <span className="property-placement-label">{row.label}</span>
          <span className="property-placement-value">{row.value}</span>
        </div>
      ))}
      <div className="property-placement-hint">
        Click a ◇ anchor on the map to place or move a component.
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function MapLegend() {
  return (
    <div className="property-legend" aria-label="Map legend">
      <span className="property-legend-item">
        <svg width={20} height={10} style={{ verticalAlign: 'middle' }}>
          <rect width={20} height={10} rx={2} fill="rgba(237,137,54,0.18)" stroke="#ed8936" strokeWidth={1.2} />
        </svg>
        Radiator
      </span>
      <span className="property-legend-item">
        <svg width={14} height={14} style={{ verticalAlign: 'middle' }}>
          <circle cx={7} cy={7} r={6} fill="#4299e1" fillOpacity={0.25} stroke="#4299e1" strokeWidth={1.5} />
        </svg>
        Outlet
      </span>
      <span className="property-legend-item">
        <svg width={20} height={20} style={{ verticalAlign: 'middle' }}>
          <polygon points="10,1 19,10 10,19 1,10" fill="white" stroke="#ed8936" strokeWidth={1.5} />
        </svg>
        Plant anchor
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * PropertyLayoutView — the top-level "House View" component.
 *
 * Exposed at the ExplainersHubPage level and accessible via the "House View"
 * tab in the demo lab.  The component is self-contained; it owns its own
 * selected-layout and placement state.
 */
export default function PropertyLayoutView() {
  const [selectedId, setSelectedId] = useState<PropertyLayoutId>('2bed_house')
  const [placement, setPlacement]   = useState<PlacementState>(EMPTY_PLACEMENT)

  const layout = getPropertyLayout(selectedId)

  function handleLayoutChange(id: PropertyLayoutId) {
    setSelectedId(id)
    setPlacement(EMPTY_PLACEMENT)
  }

  function handleAnchorClick(anchorId: string, kind: PlantAnchorKind) {
    setPlacement(prev => {
      // Boiler anchors — exclusive within the boiler group
      if (kind === 'boiler_option_1' || kind === 'boiler_option_2') {
        return {
          ...prev,
          boilerAnchorId: prev.boilerAnchorId === anchorId ? null : anchorId,
        }
      }
      // Cylinder anchors — exclusive within the cylinder group
      if (kind === 'cylinder_option_1' || kind === 'cylinder_option_2' || kind === 'airing_cupboard') {
        return {
          ...prev,
          cylinderAnchorId: prev.cylinderAnchorId === anchorId ? null : anchorId,
        }
      }
      // Heat pump — toggle on/off
      if (kind === 'heat_pump_outside') {
        return {
          ...prev,
          heatPumpAnchorId: prev.heatPumpAnchorId === anchorId ? null : anchorId,
        }
      }
      return prev
    })
  }

  return (
    <div className="property-layout-view">
      {/* ── Layout selector ──────────────────────────────────────────────── */}
      <div className="property-layout-tabs" role="tablist" aria-label="Property layout">
        {PROPERTY_LAYOUTS.map(l => (
          <button
            key={l.id}
            role="tab"
            aria-selected={l.id === selectedId}
            className={`property-layout-tab${l.id === selectedId ? ' property-layout-tab--active' : ''}`}
            onClick={() => handleLayoutChange(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="property-layout-description">{layout.description}</div>

      {/* ── Floor plan + summary ─────────────────────────────────────────── */}
      <div className="property-layout-body">
        <div className="property-plan-wrap">
          <FloorPlanSvg
            layout={layout}
            placement={placement}
            onAnchorClick={handleAnchorClick}
          />
          <MapLegend />
        </div>
        <PlacementSummary layout={layout} placement={placement} />
      </div>
    </div>
  )
}
