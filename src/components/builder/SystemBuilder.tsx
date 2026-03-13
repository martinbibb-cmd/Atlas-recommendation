/**
 * SystemBuilder.tsx
 *
 * System Builder over a simple house layout.
 *
 * Provides a stacked house shell (Loft / First Floor / Ground Floor) with
 * optional room subdivisions.  Engineers drag-select heating components from
 * a per-system palette and place them onto the layout by clicking a room.
 *
 * An "Apply preset" button populates the canvas with a typical placement for
 * the selected system type (Combi, System + Cylinder, Mixergy, Heat Pump).
 *
 * Pipework is auto-routed as orthogonal SVG paths that follow building lines:
 *  - horizontal runs stay within a level band
 *  - vertical risers travel at the horizontal mid-point between two components
 *  - DHW pipes are rendered as dashed blue lines
 *  - primary / secondary heating circuits are solid red / orange lines
 *
 * This is NOT a generic floor-plan editor.  The house structure exists solely
 * to give system placement a realistic spatial context.
 */

import { useState, useMemo, useRef } from 'react';
import './builder.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SystemType = 'combi' | 'system_cylinder' | 'mixergy' | 'heat_pump';

type LevelId = 'loft' | 'first' | 'ground';

export type ComponentKind =
  | 'boiler'
  | 'cylinder'
  | 'radiator'
  | 'hot_outlet'
  | 'controls'
  | 'pump'
  | 'mixergy_unit'
  | 'heat_pump_unit'
  | 'buffer';

type PipeKind = 'primary' | 'secondary' | 'dhw';

interface LevelDef {
  id:    LevelId;
  label: string;
  y:     number;
  h:     number;
}

interface RoomDef {
  id:      string;
  label:   string;
  levelId: LevelId;
  x:       number;
  y:       number;
  w:       number;
  h:       number;
}

interface ComponentDef {
  kind:  ComponentKind;
  icon:  string;
  label: string;
}

export interface PlacedComponent {
  id:     string;
  kind:   ComponentKind;
  icon:   string;
  label:  string;
  roomId: string;
}

interface PipeConnection {
  fromId: string;
  toId:   string;
  kind:   PipeKind;
}

// ─── SVG layout constants ─────────────────────────────────────────────────────

const SVG_W = 680;
const SVG_H = 430;

/**
 * Level bands — rendered top-to-bottom matching a real building cross-section.
 * Each level is a horizontal band occupying a fixed y-range.
 */
const LEVEL_DEFS: LevelDef[] = [
  { id: 'loft',   label: 'Loft',         y: 10,  h: 70  },
  { id: 'first',  label: 'First Floor',  y: 90,  h: 145 },
  { id: 'ground', label: 'Ground Floor', y: 245, h: 155 },
];

/**
 * Room subdivisions within each level.
 *
 * Coordinates are SVG units inside the same viewBox as the level bands.
 * Ground floor rooms span x=75–665 (width 590), as do first floor and loft.
 */
const ROOM_DEFS: RoomDef[] = [
  // Loft
  { id: 'loft_space', label: 'Loft Space',     levelId: 'loft',   x: 75,  y: 10,  w: 590, h: 70  },
  // First floor
  { id: 'bed1',       label: 'Bedroom 1',       levelId: 'first',  x: 75,  y: 90,  w: 185, h: 145 },
  { id: 'bed2',       label: 'Bedroom 2',       levelId: 'first',  x: 260, y: 90,  w: 165, h: 145 },
  { id: 'airing',     label: 'Airing Cupboard', levelId: 'first',  x: 425, y: 90,  w: 100, h: 145 },
  { id: 'bathroom',   label: 'Bathroom',        levelId: 'first',  x: 525, y: 90,  w: 140, h: 145 },
  // Ground floor
  { id: 'kitchen',    label: 'Kitchen',         levelId: 'ground', x: 75,  y: 245, w: 155, h: 155 },
  { id: 'lounge',     label: 'Lounge',          levelId: 'ground', x: 230, y: 245, w: 180, h: 155 },
  { id: 'utility',    label: 'Utility',         levelId: 'ground', x: 410, y: 245, w: 115, h: 155 },
  { id: 'hall',       label: 'Hall',            levelId: 'ground', x: 525, y: 245, w: 140, h: 155 },
];

// ─── Component catalogue ──────────────────────────────────────────────────────

const ALL_COMPONENTS: ComponentDef[] = [
  { kind: 'boiler',         icon: '🔥', label: 'Boiler'       },
  { kind: 'cylinder',       icon: '🛢',  label: 'Cylinder'     },
  { kind: 'radiator',       icon: '♨',  label: 'Radiator'     },
  { kind: 'hot_outlet',     icon: '🚿', label: 'Hot outlet'   },
  { kind: 'controls',       icon: '🎛',  label: 'Controls'     },
  { kind: 'pump',           icon: '⚙',  label: 'Pump'         },
  { kind: 'mixergy_unit',   icon: '⚡',  label: 'Mixergy unit' },
  { kind: 'heat_pump_unit', icon: '❄',  label: 'Heat pump'    },
  { kind: 'buffer',         icon: '🗄',  label: 'Buffer tank'  },
];

/**
 * Component kinds available in each system's palette.
 * Keeps the palette focused on the relevant components for each system type.
 */
const SYSTEM_PALETTE: Record<SystemType, ComponentKind[]> = {
  combi:           ['boiler', 'radiator', 'hot_outlet', 'controls', 'pump'],
  system_cylinder: ['boiler', 'cylinder', 'radiator', 'hot_outlet', 'controls', 'pump'],
  mixergy:         ['boiler', 'mixergy_unit', 'radiator', 'hot_outlet', 'controls'],
  heat_pump:       ['heat_pump_unit', 'buffer', 'radiator', 'hot_outlet', 'controls'],
};

/** Human-readable labels for each system type. */
export const SYSTEM_TYPE_LABELS: Record<SystemType, string> = {
  combi:           'Combi',
  system_cylinder: 'System + Cylinder',
  mixergy:         'Mixergy',
  heat_pump:       'Heat Pump',
};

// ─── Preset placements ────────────────────────────────────────────────────────

type PresetEntry = { kind: ComponentKind; roomId: string };

/**
 * Typical component placements per system type.
 *
 * Used by "Apply preset" to populate a plausible baseline layout that engineers
 * can then adjust by placing or removing individual components.
 */
export const PRESETS: Record<SystemType, PresetEntry[]> = {
  combi: [
    { kind: 'boiler',     roomId: 'kitchen'  },
    { kind: 'radiator',   roomId: 'lounge'   },
    { kind: 'radiator',   roomId: 'bed1'     },
    { kind: 'radiator',   roomId: 'bed2'     },
    { kind: 'hot_outlet', roomId: 'bathroom' },
    { kind: 'hot_outlet', roomId: 'kitchen'  },
  ],
  system_cylinder: [
    { kind: 'boiler',     roomId: 'kitchen'  },
    { kind: 'cylinder',   roomId: 'airing'   },
    { kind: 'controls',   roomId: 'airing'   },
    { kind: 'radiator',   roomId: 'lounge'   },
    { kind: 'radiator',   roomId: 'bed1'     },
    { kind: 'radiator',   roomId: 'bed2'     },
    { kind: 'hot_outlet', roomId: 'bathroom' },
  ],
  mixergy: [
    { kind: 'boiler',       roomId: 'kitchen'  },
    { kind: 'mixergy_unit', roomId: 'airing'   },
    { kind: 'radiator',     roomId: 'lounge'   },
    { kind: 'radiator',     roomId: 'bed1'     },
    { kind: 'hot_outlet',   roomId: 'bathroom' },
  ],
  heat_pump: [
    { kind: 'heat_pump_unit', roomId: 'loft_space' },
    { kind: 'buffer',         roomId: 'utility'    },
    { kind: 'radiator',       roomId: 'lounge'     },
    { kind: 'radiator',       roomId: 'bed1'       },
    { kind: 'hot_outlet',     roomId: 'bathroom'   },
  ],
};

// ─── Connection logic ─────────────────────────────────────────────────────────

/**
 * Derive the pipe connections between placed components based on the selected
 * system type.  Returns a list of (fromId, toId, kind) tuples used to render
 * the auto-routed pipe paths in the SVG.
 */
export function deriveConnections(
  systemType: SystemType,
  placed: PlacedComponent[],
): PipeConnection[] {
  const byKind  = (k: ComponentKind) => placed.filter(p => p.kind === k);
  const firstOf = (k: ComponentKind) => placed.find(p => p.kind === k);

  const boiler  = firstOf('boiler');
  const hpUnit  = firstOf('heat_pump_unit');
  const source  = boiler ?? hpUnit;

  const cylinder = firstOf('cylinder');
  const mixergy  = firstOf('mixergy_unit');
  const buffer   = firstOf('buffer');
  const radiators = byKind('radiator');
  const outlets   = byKind('hot_outlet');

  const conns: PipeConnection[] = [];

  const connect = (
    a: PlacedComponent | undefined,
    b: PlacedComponent | undefined,
    kind: PipeKind,
  ) => {
    if (a && b) conns.push({ fromId: a.id, toId: b.id, kind });
  };

  switch (systemType) {
    case 'combi':
      // Boiler → each radiator (primary heating circuit)
      for (const rad of radiators) connect(source, rad, 'primary');
      // Boiler → outlets (on-demand hot water)
      for (const out of outlets)   connect(source, out, 'dhw');
      break;

    case 'system_cylinder':
      // Boiler → cylinder (primary circuit)
      connect(source, cylinder, 'primary');
      // Cylinder → each radiator (secondary circuit)
      for (const rad of radiators) connect(cylinder, rad, 'secondary');
      // Cylinder → outlets (stored hot water)
      for (const out of outlets)   connect(cylinder, out, 'dhw');
      break;

    case 'mixergy':
      // Boiler → Mixergy unit (primary — feeds both heating and DHW storage)
      connect(source, mixergy, 'primary');
      // Boiler → each radiator (space-heating secondary loop)
      for (const rad of radiators) connect(source, rad, 'secondary');
      // Mixergy → outlets (stored hot water with active stratification)
      for (const out of outlets)   connect(mixergy, out, 'dhw');
      break;

    case 'heat_pump': {
      // Heat pump → buffer (primary)
      connect(source, buffer, 'primary');
      const heatDist = buffer ?? source;
      // Buffer (or HP) → radiators (secondary heating circuit)
      for (const rad of radiators) connect(heatDist, rad, 'secondary');
      // Buffer (or HP) → outlets (stored hot water)
      for (const out of outlets)   connect(heatDist, out, 'dhw');
      break;
    }
  }

  return conns;
}

// ─── Pipe routing ─────────────────────────────────────────────────────────────

/**
 * Compute an orthogonal SVG path between two anchor points.
 *
 * For same-level components (same y ± 4 px) the pipe runs straight across.
 * For inter-level connections the route goes horizontal to the x-midpoint,
 * then vertical along that midpoint (acting as a wall riser), then horizontal
 * to the destination — mimicking how pipes follow wall/floor voids in a real
 * building.
 */
export function orthoPath(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(y1 - y2) < 4) {
    // Same horizontal band — direct horizontal run
    return `M ${x1} ${y1} H ${x2}`;
  }
  // Route via horizontal midpoint so the vertical riser follows a wall line
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`;
}

// ─── Anchor positions ────────────────────────────────────────────────────────

/**
 * Compute the SVG anchor point for a placed component.
 *
 * Components are evenly distributed across the width of their room.  When
 * multiple components occupy the same room they are spaced horizontally so
 * pipe routes stay visually distinct.
 */
function getAnchor(
  comp: PlacedComponent,
  roomCompsMap: Map<string, PlacedComponent[]>,
): { x: number; y: number } {
  const room = ROOM_DEFS.find(r => r.id === comp.roomId);
  if (!room) return { x: 0, y: 0 };
  const siblings = roomCompsMap.get(comp.roomId) ?? [];
  const n   = siblings.length;
  const idx = siblings.findIndex(s => s.id === comp.id);
  const spacing = room.w / (n + 1);
  return { x: room.x + spacing * (idx + 1), y: room.y + room.h / 2 };
}

// ─── Pipe colour palette ──────────────────────────────────────────────────────

const PIPE_COLOURS: Record<PipeKind, string> = {
  primary:   '#e53e3e', // red — primary heating circuit
  secondary: '#dd6b20', // orange — secondary heating circuit
  dhw:       '#3182ce', // blue — domestic hot water
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SystemBuilder() {
  const [systemType,   setSystemType]   = useState<SystemType>('combi');
  const [placed,       setPlaced]       = useState<PlacedComponent[]>([]);
  const [selectedKind, setSelectedKind] = useState<ComponentKind | null>(null);
  const nextIdRef = useRef(0);

  function nextId() { return `sb-${nextIdRef.current++}`; }

  // ── Preset ──────────────────────────────────────────────────────────────────

  function applyPreset() {
    const entries = PRESETS[systemType];
    const next: PlacedComponent[] = entries.map(entry => {
      const def = ALL_COMPONENTS.find(d => d.kind === entry.kind)!;
      return { id: nextId(), kind: entry.kind, icon: def.icon, label: def.label, roomId: entry.roomId };
    });
    setPlaced(next);
    setSelectedKind(null);
  }

  // ── Manual placement ────────────────────────────────────────────────────────

  function handleRoomClick(roomId: string) {
    if (!selectedKind) return;
    const def = ALL_COMPONENTS.find(d => d.kind === selectedKind);
    if (!def) return;
    setPlaced(prev => [
      ...prev,
      { id: nextId(), kind: selectedKind, icon: def.icon, label: def.label, roomId },
    ]);
    setSelectedKind(null);
  }

  function removeComponent(id: string) {
    setPlaced(prev => prev.filter(c => c.id !== id));
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  /** Map roomId → ordered list of components in that room. */
  const roomCompsMap = useMemo<Map<string, PlacedComponent[]>>(() => {
    const map = new Map<string, PlacedComponent[]>();
    for (const comp of placed) {
      const list = map.get(comp.roomId) ?? [];
      list.push(comp);
      map.set(comp.roomId, list);
    }
    return map;
  }, [placed]);

  /** Anchor coordinates for every placed component. */
  const anchors = useMemo<Map<string, { x: number; y: number }>>(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const comp of placed) map.set(comp.id, getAnchor(comp, roomCompsMap));
    return map;
  }, [placed, roomCompsMap]);

  /** Pipe connections for the current system type. */
  const connections = useMemo(
    () => deriveConnections(systemType, placed),
    [systemType, placed],
  );

  const paletteItems = SYSTEM_PALETTE[systemType].map(
    k => ALL_COMPONENTS.find(d => d.kind === k)!,
  );

  const selectedLabel = selectedKind
    ? ALL_COMPONENTS.find(d => d.kind === selectedKind)?.label
    : null;

  return (
    <div className="sb-wrap">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="sb-header">
        <h2 className="sb-title">System Builder</h2>
        <p className="sb-subtitle">
          Place heating system components on a simple house layout.
          Pipework auto-routes along building lines.
        </p>
      </div>

      {/* ── System type selector ────────────────────────────────────────────── */}
      <div className="sb-system-row" role="group" aria-label="System type">
        {(Object.keys(SYSTEM_TYPE_LABELS) as SystemType[]).map(st => (
          <button
            key={st}
            className={`sb-system-btn${systemType === st ? ' sb-system-btn--active' : ''}`}
            aria-pressed={systemType === st}
            onClick={() => { setSystemType(st); setPlaced([]); setSelectedKind(null); }}
          >
            {SYSTEM_TYPE_LABELS[st]}
          </button>
        ))}
      </div>

      <div className="sb-workspace">

        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <aside className="sb-sidebar" aria-label="Component palette">

          <button
            className="sb-preset-btn"
            onClick={applyPreset}
            aria-label={`Apply ${SYSTEM_TYPE_LABELS[systemType]} preset`}
          >
            ⚡ Apply preset
          </button>

          <div className="sb-palette-title">Components</div>

          {paletteItems.map(item => (
            <button
              key={item.kind}
              className={`sb-palette-item${selectedKind === item.kind ? ' sb-palette-item--active' : ''}`}
              aria-pressed={selectedKind === item.kind}
              onClick={() => setSelectedKind(selectedKind === item.kind ? null : item.kind)}
              aria-label={`Select ${item.label}`}
            >
              <span className="sb-palette-icon" aria-hidden="true">{item.icon}</span>
              <span className="sb-palette-label">{item.label}</span>
            </button>
          ))}

          {selectedLabel && (
            <p className="sb-place-hint" role="status" aria-live="polite">
              Click a room to place the {selectedLabel}.
            </p>
          )}

          <button
            className="sb-clear-btn"
            onClick={() => { setPlaced([]); setSelectedKind(null); }}
            disabled={placed.length === 0}
            aria-label="Clear all components"
          >
            Clear all
          </button>

          {/* Pipe legend */}
          <div className="sb-legend" aria-label="Pipe route legend">
            <div className="sb-legend-title">Pipe routes</div>
            <div className="sb-legend-item">
              <svg width="28" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="28" y2="4" stroke={PIPE_COLOURS.primary} strokeWidth="2.5" />
              </svg>
              <span>Primary circuit</span>
            </div>
            <div className="sb-legend-item">
              <svg width="28" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="28" y2="4" stroke={PIPE_COLOURS.secondary} strokeWidth="2.5" />
              </svg>
              <span>Secondary circuit</span>
            </div>
            <div className="sb-legend-item">
              <svg width="28" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="28" y2="4" stroke={PIPE_COLOURS.dhw} strokeWidth="2" strokeDasharray="5 3" />
              </svg>
              <span>Hot water</span>
            </div>
          </div>

        </aside>

        {/* ── House canvas ──────────────────────────────────────────────────── */}
        <div className="sb-canvas-wrap">
          <svg
            className="sb-svg"
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            aria-label="House layout with placed system components"
            role="img"
          >
            {/* Level band outlines */}
            {LEVEL_DEFS.map(level => (
              <g key={level.id} aria-label={level.label}>
                <rect
                  x={75} y={level.y}
                  width={590} height={level.h}
                  fill="none"
                  stroke="#a0aec0"
                  strokeWidth={2}
                  rx={4}
                />
                <text
                  x={68} y={level.y + level.h / 2 + 5}
                  textAnchor="end"
                  fontSize={11}
                  fill="#718096"
                  fontWeight={600}
                >
                  {level.label}
                </text>
              </g>
            ))}

            {/* Room subdivisions */}
            {ROOM_DEFS.map(room => (
              <g
                key={room.id}
                data-room={room.id}
                className={`sb-room${selectedKind ? ' sb-room--clickable' : ''}`}
                onClick={() => handleRoomClick(room.id)}
                role={selectedKind ? 'button' : undefined}
                aria-label={selectedKind ? `Place in ${room.label}` : room.label}
                tabIndex={selectedKind ? 0 : undefined}
                onKeyDown={e => {
                  if (selectedKind && (e.key === 'Enter' || e.key === ' ')) {
                    handleRoomClick(room.id);
                  }
                }}
              >
                <rect
                  x={room.x} y={room.y}
                  width={room.w} height={room.h}
                  fill="#f7fafc"
                  stroke="#cbd5e0"
                  strokeWidth={1}
                  rx={2}
                />
                <text
                  x={room.x + room.w / 2}
                  y={room.y + 14}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#718096"
                >
                  {room.label}
                </text>
              </g>
            ))}

            {/* Auto-routed pipe paths */}
            {connections.map((conn, i) => {
              const a = anchors.get(conn.fromId);
              const b = anchors.get(conn.toId);
              if (!a || !b) return null;
              return (
                <path
                  key={i}
                  d={orthoPath(a.x, a.y, b.x, b.y)}
                  stroke={PIPE_COLOURS[conn.kind]}
                  strokeWidth={conn.kind === 'dhw' ? 2 : 2.5}
                  strokeDasharray={conn.kind === 'dhw' ? '5 3' : undefined}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

            {/* Placed component icons */}
            {placed.map(comp => {
              const pos = anchors.get(comp.id);
              if (!pos) return null;
              return (
                <g
                  key={comp.id}
                  className="sb-comp"
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={() => removeComponent(comp.id)}
                  role="button"
                  aria-label={`${comp.label} — click to remove`}
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') removeComponent(comp.id);
                  }}
                >
                  <circle r={16} fill="#6366f1" opacity={0.92} />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={14}
                  >
                    {comp.icon}
                  </text>
                </g>
              );
            })}
          </svg>

          {placed.length === 0 && !selectedKind && (
            <p className="sb-empty-hint">
              Click <strong>Apply preset</strong> for a typical{' '}
              {SYSTEM_TYPE_LABELS[systemType]} layout, or select a component
              from the palette to place it manually.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
