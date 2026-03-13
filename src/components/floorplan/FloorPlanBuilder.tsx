/**
 * FloorPlanBuilder.tsx
 *
 * Multi-floor plan builder for System Lab.
 *
 * Allows engineers to select a house template (Bungalow, Terrace, Semi,
 * Detached, Flat) and drag heating components (boiler, cylinder, radiators,
 * UFH zones, risers) onto a per-floor canvas to produce a rough system layout.
 *
 * Built with react-konva for performant canvas-based drag-and-drop.
 *
 * Key features:
 *  - Per-floor view: Ground / First floor switcher.
 *  - Semantic placement rules: boiler → plant_room, cylinder → airing_cupboard.
 *  - Riser component: ground-floor riser auto-creates a paired first-floor riser
 *    at the same canvas coordinates, enabling multi-floor pipe continuity.
 *  - Data is local state only — not persisted.
 *
 * Future: Export canvas snapshot as PNG for inclusion in PDF reports.
 */

import { useState, useRef } from 'react';
import { Stage, Layer, Rect, Text, Group, Circle, Line } from 'react-konva';
import type Konva from 'konva';
import type { StructuralZone } from '../../explainers/lego/builder/schematicBlocks';
import { routePipeAligned } from '../../explainers/lego/builder/router';
import './floorplan.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateId = 'bungalow' | 'terrace' | 'semi' | 'detached' | 'flat';
type FloorLevel = 'ground' | 'first';

interface Room {
  id:    string;
  label: string;
  /** Which floor this room is on. */
  floor: FloorLevel;
  x:     number;
  y:     number;
  w:     number;
  h:     number;
  /**
   * Semantic zone — used for component placement validation.
   * Mirrors StructuralZone from schematicBlocks.ts.
   */
  zone?: StructuralZone;
}

interface PlacedComponent {
  id:      string;
  kind:    string;
  icon:    string;
  x:       number;
  y:       number;
  /** Which floor this component lives on. */
  floor:   FloorLevel;
  /** Structural zone the component was placed in (if applicable). */
  zone?:   StructuralZone;
  /**
   * For 'riser' components only — the id of the paired riser on the other
   * floor.  Ground-floor riser and first-floor riser share the same riserId.
   */
  riserId?: string;
}

// ─── Palette item definition ──────────────────────────────────────────────────

interface PaletteItem {
  kind:         string;
  icon:         string;
  label:        string;
  /**
   * When set, placement is restricted to rooms whose zone matches this value.
   * A warning is shown and the component is placed at the matching room anchor
   * rather than the default grid position.
   */
  requiredZone?: StructuralZone;
}

// ─── Template definitions ─────────────────────────────────────────────────────

/**
 * Room coordinates fit a 330×370 canvas.
 *
 * Floor convention for multi-storey templates:
 *   ground — entrance level (kitchen, lounge, utility, hall)
 *   first  — upper floor (bedrooms, bathroom, landing)
 *
 * For single-storey templates (bungalow, flat) all rooms are tagged 'ground'.
 */
const TEMPLATES: Record<TemplateId, { label: string; rooms: Room[] }> = {
  bungalow: {
    label: 'Bungalow',
    rooms: [
      { id: 'lounge',   label: 'Lounge',    floor: 'ground', x: 10,  y: 10,  w: 160, h: 120 },
      { id: 'kitchen',  label: 'Kitchen',   floor: 'ground', x: 180, y: 10,  w: 110, h: 80,  zone: 'plant_room'      },
      { id: 'bed1',     label: 'Bed 1',     floor: 'ground', x: 10,  y: 140, w: 120, h: 100 },
      { id: 'bed2',     label: 'Bed 2',     floor: 'ground', x: 140, y: 140, w: 100, h: 100 },
      { id: 'bathroom', label: 'Bathroom',  floor: 'ground', x: 250, y: 100, w: 80,  h: 80,  zone: 'airing_cupboard' },
      { id: 'hall',     label: 'Hall',      floor: 'ground', x: 180, y: 100, w: 60,  h: 40  },
    ],
  },
  terrace: {
    label: 'Terrace',
    rooms: [
      { id: 'lounge',   label: 'Lounge',    floor: 'ground', x: 10,  y: 10,  w: 140, h: 100 },
      { id: 'dining',   label: 'Dining',    floor: 'ground', x: 10,  y: 120, w: 140, h: 80  },
      { id: 'kitchen',  label: 'Kitchen',   floor: 'ground', x: 10,  y: 210, w: 140, h: 80,  zone: 'plant_room'      },
      { id: 'bed1',     label: 'Bed 1',     floor: 'first',  x: 10,  y: 10,  w: 130, h: 90  },
      { id: 'bed2',     label: 'Bed 2',     floor: 'first',  x: 150, y: 10,  w: 130, h: 90  },
      { id: 'bathroom', label: 'Bathroom',  floor: 'first',  x: 10,  y: 110, w: 130, h: 80,  zone: 'airing_cupboard' },
    ],
  },
  semi: {
    label: 'Semi-detached',
    rooms: [
      // Ground floor
      { id: 'lounge',   label: 'Lounge',    floor: 'ground', x: 10,  y: 10,  w: 160, h: 110 },
      { id: 'dining',   label: 'Dining',    floor: 'ground', x: 180, y: 10,  w: 120, h: 110 },
      { id: 'kitchen',  label: 'Kitchen',   floor: 'ground', x: 180, y: 130, w: 120, h: 90,  zone: 'plant_room'      },
      { id: 'utility',  label: 'Utility',   floor: 'ground', x: 180, y: 230, w: 120, h: 60,  zone: 'plant_room'      },
      // First floor
      { id: 'bed1',     label: 'Bed 1',     floor: 'first',  x: 10,  y: 10,  w: 140, h: 110 },
      { id: 'bed2',     label: 'Bed 2',     floor: 'first',  x: 160, y: 10,  w: 140, h: 110 },
      { id: 'bathroom', label: 'Bathroom',  floor: 'first',  x: 10,  y: 130, w: 100, h: 90,  zone: 'airing_cupboard' },
      { id: 'landing',  label: 'Landing',   floor: 'first',  x: 120, y: 130, w: 80,  h: 90  },
    ],
  },
  detached: {
    label: 'Detached',
    rooms: [
      // Ground floor
      { id: 'lounge',   label: 'Lounge',    floor: 'ground', x: 10,  y: 10,  w: 160, h: 120 },
      { id: 'dining',   label: 'Dining',    floor: 'ground', x: 180, y: 10,  w: 130, h: 120 },
      { id: 'kitchen',  label: 'Kitchen',   floor: 'ground', x: 180, y: 140, w: 130, h: 100, zone: 'plant_room'      },
      { id: 'utility',  label: 'Utility',   floor: 'ground', x: 180, y: 250, w: 130, h: 60,  zone: 'plant_room'      },
      { id: 'study',    label: 'Study',     floor: 'ground', x: 10,  y: 140, w: 90,  h: 80  },
      // First floor
      { id: 'bed1',     label: 'Bed 1',     floor: 'first',  x: 10,  y: 10,  w: 130, h: 100 },
      { id: 'bed2',     label: 'Bed 2',     floor: 'first',  x: 150, y: 10,  w: 130, h: 100 },
      { id: 'bed3',     label: 'Bed 3',     floor: 'first',  x: 10,  y: 120, w: 130, h: 90  },
      { id: 'bathroom', label: 'Bathroom',  floor: 'first',  x: 150, y: 120, w: 130, h: 90,  zone: 'airing_cupboard' },
    ],
  },
  flat: {
    label: 'Flat',
    rooms: [
      { id: 'lounge',   label: 'Lounge',    floor: 'ground', x: 10,  y: 10,  w: 160, h: 120 },
      { id: 'kitchen',  label: 'Kitchen',   floor: 'ground', x: 180, y: 10,  w: 110, h: 80,  zone: 'plant_room'      },
      { id: 'bed1',     label: 'Bed 1',     floor: 'ground', x: 10,  y: 140, w: 140, h: 100 },
      { id: 'bathroom', label: 'Bathroom',  floor: 'ground', x: 180, y: 100, w: 110, h: 80,  zone: 'airing_cupboard' },
      { id: 'hall',     label: 'Hall',      floor: 'ground', x: 160, y: 140, w: 40,  h: 60  },
    ],
  },
};

// ─── Available components palette ────────────────────────────────────────────

/**
 * Palette items with optional `requiredZone` placement constraints.
 *
 * Rules (per problem statement §2):
 *   Boiler    → restricted to rooms with zone: 'plant_room'
 *   Cylinder  → restricted to rooms with zone: 'airing_cupboard'
 *   All others → no zone restriction
 */
const PALETTE_ITEMS: PaletteItem[] = [
  { kind: 'boiler',     icon: '🔥', label: 'Boiler',    requiredZone: 'plant_room'      },
  { kind: 'cylinder',   icon: '🛢',  label: 'Cylinder',  requiredZone: 'airing_cupboard' },
  { kind: 'radiator',   icon: '📡', label: 'Radiator'                                   },
  { kind: 'ufh',        icon: '〰️', label: 'UFH Zone'                                   },
  { kind: 'pump',       icon: '⚙️',  label: 'Pump'                                       },
  { kind: 'thermostat', icon: '🌡️', label: 'T-stat'                                     },
  { kind: 'riser',      icon: '↕️',  label: 'Riser'                                      },
];

// ─── Room colours ─────────────────────────────────────────────────────────────

const ROOM_FILL            = '#edf2f7';
const ROOM_FILL_PLANT      = '#fef3c7'; // warm yellow — plant_room zone
const ROOM_FILL_AIRING     = '#dbeafe'; // light blue  — airing_cupboard zone
const ROOM_STROKE          = '#cbd5e0';
const RISER_LINK_COLOR    = '#a78bfa'; // violet — highlights riser continuity

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pick a fill colour for a room based on its zone. */
function roomFill(room: Room): string {
  if (room.zone === 'plant_room')       return ROOM_FILL_PLANT;
  if (room.zone === 'airing_cupboard')  return ROOM_FILL_AIRING;
  return ROOM_FILL;
}

/**
 * Find the first room on the given floor whose zone matches `requiredZone`.
 * Returns the room centre if found, null otherwise.
 */
function findZoneAnchor(
  rooms: Room[],
  floor: FloorLevel,
  requiredZone: StructuralZone,
): { x: number; y: number; room: Room } | null {
  const match = rooms.find(r => r.floor === floor && r.zone === requiredZone);
  if (!match) return null;
  return {
    x: match.x + Math.floor(match.w / 2),
    y: match.y + Math.floor(match.h / 2),
    room: match,
  };
}

/**
 * Return the room that contains the canvas point (px, py), or null.
 * Used for zone-checking when a component is dropped.
 */
function roomAtPoint(
  rooms: Room[],
  floor: FloorLevel,
  px: number,
  py: number,
): Room | null {
  return (
    rooms.find(
      r =>
        r.floor === floor &&
        px >= r.x && px <= r.x + r.w &&
        py >= r.y && py <= r.y + r.h,
    ) ?? null
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface FloorPlanOutput {
  placed: PlacedComponent[];
  template: TemplateId;
}

interface Props {
  /** Pre-populated placed components (e.g. from a survey adapter). */
  initialPlaced?: PlacedComponent[];
  /** Called whenever the layout changes, with the current placed set. */
  onChange?: (output: FloorPlanOutput) => void;
}

export default function FloorPlanBuilder({ initialPlaced, onChange }: Props = {}) {
  const [template,      setTemplate]      = useState<TemplateId>('terrace');
  const [currentFloor,  setCurrentFloor]  = useState<FloorLevel>('ground');
  const [placed,        setPlaced]        = useState<PlacedComponent[]>(initialPlaced ?? []);
  const [lastWarning,   setLastWarning]   = useState<string | null>(null);
  const stageRef  = useRef<Konva.Stage>(null);
  /** Monotonically increasing ID counter — useRef ensures stability across renders. */
  const nextIdRef = useRef(0);

  const { rooms } = TEMPLATES[template];

  /** Rooms visible on the current floor. */
  const visibleRooms = rooms.filter(r => r.floor === currentFloor);

  /** Components placed on the current floor. */
  const visiblePlaced = placed.filter(c => c.floor === currentFloor);

  /** Notify parent of the current layout. */
  function notifyChange(next: PlacedComponent[]) {
    onChange?.({ placed: next, template });
  }

  /**
   * Drop a new component onto the canvas.
   *
   * Semantic placement rules (per problem statement §2):
   *   - If the palette item has a `requiredZone`, we find the first matching
   *     room on the current floor and place the component at its centre.
   *   - If no matching room exists on this floor, a warning is shown and the
   *     component is NOT placed (prevents illegal placement).
   *   - For 'riser' components, a paired riser on the opposite floor is
   *     automatically created at the same canvas position.
   */
  function handlePaletteClick(item: PaletteItem) {
    const { kind, icon, requiredZone } = item;
    setLastWarning(null);

    let spawnX: number;
    let spawnY: number;
    let spawnZone: StructuralZone | undefined = undefined;

    if (requiredZone) {
      const anchor = findZoneAnchor(rooms, currentFloor, requiredZone);
      if (!anchor) {
        // No matching zone on this floor — switch floor hint
        const otherFloor: FloorLevel = currentFloor === 'ground' ? 'first' : 'ground';
        const otherAnchor = findZoneAnchor(rooms, otherFloor, requiredZone);
        if (otherAnchor) {
          setLastWarning(
            `${item.label} must be placed in a ${requiredZone.replace(/_/g, ' ')} room. ` +
            `Switch to the ${otherFloor} floor.`,
          );
        } else {
          setLastWarning(
            `No ${requiredZone.replace(/_/g, ' ')} room in this template for ${item.label}.`,
          );
        }
        return;
      }
      spawnX    = anchor.x;
      spawnY    = anchor.y;
      spawnZone = requiredZone;
    } else {
      const idx   = visiblePlaced.filter(c => c.kind !== 'riser').length;
      spawnX      = 30 + (idx % 5) * 48;
      spawnY      = 30 + Math.floor(idx / 5) * 48;
    }

    const id = `c-${nextIdRef.current++}`;

    if (kind === 'riser') {
      // Riser: place one on this floor and auto-create a twin on the other floor.
      // riserId is derived from the primary component id — no extra counter increment.
      const riserId = `riser-${id}`;
      const otherFloor: FloorLevel = currentFloor === 'ground' ? 'first' : 'ground';
      const twinId = `c-${nextIdRef.current++}`;
      const next = [
        ...placed,
        { id, kind, icon, x: spawnX, y: spawnY, floor: currentFloor, riserId },
        { id: twinId, kind, icon, x: spawnX, y: spawnY, floor: otherFloor, riserId },
      ];
      setPlaced(next);
      notifyChange(next);
    } else {
      const next = [
        ...placed,
        { id, kind, icon, x: spawnX, y: spawnY, floor: currentFloor, zone: spawnZone },
      ];
      setPlaced(next);
      notifyChange(next);
    }
  }

  /** Remove a placed component from the canvas (and its riser twin, if any). */
  function removeComponent(id: string) {
    const target = placed.find(c => c.id === id);
    const next = placed.filter(
      c => c.id !== id && (target?.riserId == null || c.riserId !== target.riserId),
    );
    setPlaced(next);
    notifyChange(next);
  }

  /** Export the canvas as a PNG download. */
  function handleExport() {
    const uri = stageRef.current?.toDataURL({ pixelRatio: 2 });
    if (!uri) return;
    const a = document.createElement('a');
    a.href     = uri;
    a.download = 'floor-plan.png';
    a.click();
  }

  /** Whether the current template has a first floor. */
  const hasFirstFloor = rooms.some(r => r.floor === 'first');

  // Riser pairs visible on the current floor
  const visibleRisers = visiblePlaced.filter(c => c.kind === 'riser');

  return (
    <div className="floor-plan">
      <div className="floor-plan__header">
        <h2 className="floor-plan__title">🏠 Floor Plan Builder</h2>
        <p className="floor-plan__subtitle">
          Select a template and drag heating components onto the plan.
        </p>
      </div>

      {/* ── Template selector ─────────────────────────────────────── */}
      <div className="floor-plan__templates" role="group" aria-label="House templates">
        {(Object.entries(TEMPLATES) as [TemplateId, { label: string }][]).map(([id, t]) => (
          <button
            key={id}
            className={`floor-plan__template-btn${template === id ? ' floor-plan__template-btn--active' : ''}`}
            onClick={() => { setTemplate(id); setPlaced([]); setCurrentFloor('ground'); setLastWarning(null); }}
            aria-pressed={template === id}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Floor switcher ────────────────────────────────────────── */}
      {hasFirstFloor && (
        <div className="floor-plan__floor-switcher" role="group" aria-label="Floor selector">
          <span className="floor-plan__floor-label">Floor:</span>
          {(['ground', 'first'] as FloorLevel[]).map(floor => (
            <button
              key={floor}
              className={`floor-plan__floor-btn${currentFloor === floor ? ' floor-plan__floor-btn--active' : ''}`}
              onClick={() => { setCurrentFloor(floor); setLastWarning(null); }}
              aria-pressed={currentFloor === floor}
            >
              {floor === 'ground' ? 'Ground' : 'First'}
            </button>
          ))}
        </div>
      )}

      {/* ── Placement warning ─────────────────────────────────────── */}
      {lastWarning && (
        <div className="floor-plan__warning" role="alert">
          ⚠️ {lastWarning}
        </div>
      )}

      <div className="floor-plan__workspace">
        {/* ── Component palette ───────────────────────────────────── */}
        <div className="floor-plan__palette" aria-label="Component palette">
          <div className="floor-plan__palette-title">Components</div>
          {PALETTE_ITEMS.map(item => (
            <button
              key={item.kind}
              className="floor-plan__palette-item"
              onClick={() => handlePaletteClick(item)}
              aria-label={`Add ${item.label}`}
              title={item.requiredZone
                ? `Add ${item.label} (${item.requiredZone.replace(/_/g, ' ')} only)`
                : `Add ${item.label}`}
            >
              <span className="floor-plan__palette-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="floor-plan__palette-label">{item.label}</span>
              {item.requiredZone && (
                <span className="floor-plan__palette-zone" aria-hidden="true">
                  {item.requiredZone === 'plant_room' ? '🔑' : '💧'}
                </span>
              )}
            </button>
          ))}
          <div className="floor-plan__palette-legend">
            <span className="floor-plan__legend-swatch floor-plan__legend-swatch--plant" />
            <span>Plant room</span>
            <span className="floor-plan__legend-swatch floor-plan__legend-swatch--airing" />
            <span>Airing cupboard</span>
          </div>
        </div>

        {/* ── Canvas ──────────────────────────────────────────────── */}
        <div className="floor-plan__canvas-wrap">
          <div className="floor-plan__floor-badge">
            {currentFloor === 'ground' ? 'Ground Floor' : 'First Floor'}
          </div>
          <Stage
            ref={stageRef}
            width={340}
            height={380}
            style={{ background: '#fff', border: '1px solid #cbd5e0', borderRadius: 8 }}
          >
            <Layer>
              {/* Rooms — current floor only */}
              {visibleRooms.map(room => (
                <Group key={room.id}>
                  <Rect
                    x={room.x} y={room.y}
                    width={room.w} height={room.h}
                    fill={roomFill(room)}
                    stroke={ROOM_STROKE}
                    strokeWidth={1}
                    cornerRadius={4}
                  />
                  <Text
                    x={room.x + 4} y={room.y + 4}
                    text={room.label}
                    fontSize={10}
                    fill="#4a5568"
                    width={room.w - 8}
                    wrap="word"
                  />
                </Group>
              ))}

              {/* Riser link lines — connect riser pairs on the current floor to
                  their counterpart on the other floor (dotted line from riser to
                  the canvas edge hints at the vertical connection). */}
              {visibleRisers.map(riser => {
                // Draw a short dotted vertical "pipe" above or below the riser symbol
                // to indicate the riser continues to the other floor.
                const isGround = riser.floor === 'ground';
                const linePoints = isGround
                  ? [riser.x, riser.y, riser.x, riser.y - 30]
                  : [riser.x, riser.y, riser.x, riser.y + 30];
                return (
                  <Line
                    key={`rlink-${riser.id}`}
                    points={linePoints}
                    stroke={RISER_LINK_COLOR}
                    strokeWidth={2}
                    dash={[4, 3]}
                  />
                );
              })}

              {/* Placed components — current floor only */}
              {visiblePlaced.map(comp => (
                <Group
                  key={comp.id}
                  x={comp.x}
                  y={comp.y}
                  draggable
                  onDragEnd={e => {
                    const nx = e.target.x();
                    const ny = e.target.y();
                    // Re-validate zone on drop: if component has a requiredZone,
                    // check that the new position is within a valid room.
                    const paletteItem = PALETTE_ITEMS.find(p => p.kind === comp.kind);
                    const req = paletteItem?.requiredZone;
                    if (req) {
                      const room = roomAtPoint(rooms, currentFloor, nx, ny);
                      if (!room || room.zone !== req) {
                        // Snap back to original position
                        e.target.x(comp.x);
                        e.target.y(comp.y);
                        setLastWarning(
                          `${paletteItem?.label ?? comp.kind} must stay in a ` +
                          `${req.replace(/_/g, ' ')} room (highlighted in color).`,
                        );
                        return;
                      }
                    }
                    const next = placed.map(c =>
                      c.id === comp.id ? { ...c, x: nx, y: ny } : c,
                    );
                    setPlaced(next);
                    notifyChange(next);
                  }}
                >
                  <Circle
                    radius={14}
                    fill={comp.kind === 'riser' ? RISER_LINK_COLOR : '#6366f1'}
                    opacity={0.9}
                  />
                  <Text
                    text={comp.icon}
                    fontSize={14}
                    x={-8}
                    y={-8}
                  />
                </Group>
              ))}
            </Layer>
          </Stage>

          {/* Remove last / clear buttons */}
          <div className="floor-plan__canvas-actions">
            <button
              className="floor-plan__action-btn"
              onClick={() => {
                const next = placed.slice(0, -1);
                setPlaced(next);
                notifyChange(next);
              }}
              disabled={placed.length === 0}
            >
              Undo last
            </button>
            <button
              className="floor-plan__action-btn"
              onClick={() => { setPlaced([]); notifyChange([]); }}
              disabled={placed.length === 0}
            >
              Clear all
            </button>
            <button
              className="floor-plan__action-btn floor-plan__action-btn--export"
              onClick={handleExport}
            >
              Export PNG
            </button>
          </div>
        </div>
      </div>

      {/* ── Placed component list ──────────────────────────────────── */}
      {placed.length > 0 && (
        <div className="floor-plan__placed-list" aria-label="Placed components">
          <div className="floor-plan__placed-title">Placed components</div>
          <div className="floor-plan__placed-chips">
            {placed.map(comp => (
              <span
                key={comp.id}
                className={`floor-plan__placed-chip${comp.floor === currentFloor ? '' : ' floor-plan__placed-chip--other-floor'}`}
                title={`${comp.kind} — ${comp.floor} floor${comp.riserId ? ' (riser)' : ''}`}
              >
                {comp.icon} {comp.kind}
                {comp.floor !== currentFloor && (
                  <em className="floor-plan__placed-floor"> ({comp.floor})</em>
                )}
                <button
                  className="floor-plan__placed-remove"
                  onClick={() => removeComponent(comp.id)}
                  aria-label={`Remove ${comp.kind}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Wall-snapping pipe export (thin wrapper for consumers) ──────────────────

/**
 * Generate an SVG `points` string for a pipe between two canvas points,
 * snapping the bend to nearby room walls or hall centrelines.
 *
 * Thin wrapper around routePipeAligned; re-exported here so downstream
 * consumers (e.g. future pipe-drawing mode) can access it from the same
 * import path as FloorPlanBuilder.
 */
export function buildPipeRoute(
  from: { x: number; y: number },
  to:   { x: number; y: number },
  rooms: Array<{ x: number; y: number; w: number; h: number; label?: string }>,
): string {
  return routePipeAligned(from, to, rooms);
}
