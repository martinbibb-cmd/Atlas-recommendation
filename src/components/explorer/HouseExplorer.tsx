/**
 * HouseExplorer.tsx
 *
 * Hero component: an SVG cross-section of a 3-bed semi showing all rooms.
 * Clicking a room triggers the layer drill-down.
 *
 * ViewBox: 480 × 340
 * Ground floor  y: 190–335 (two rooms + hallway)
 * First floor   y:  40–185 (three rooms)
 * Roof          y:   0– 40
 */

import type { Room } from './explorerTypes';

// ── Design tokens ─────────────────────────────────────────────────────────────

const PALETTE = {
  roofFill:        '#2c3e50',
  wallFill:        '#ecf0f1',
  wallStroke:      '#bdc3c7',
  windowFill:      '#aed6f1',
  doorFill:        '#d5b895',
  floorDivider:    '#bdc3c7',
  roomHover:       'rgba(255, 122, 0, 0.10)',
  roomSelected:    'rgba(255, 122, 0, 0.22)',
  roomStroke:      '#e67e22',
  labelPrimary:    '#1c2430',
  labelSecondary:  '#667085',
  tempHot:         '#ff7a00',
  tempCool:        '#3fa7ff',
  boilerFill:      '#f39c12',
  boilerStroke:    '#d68910',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function tempColor(temp: number): string {
  // 18°C → blue, 22°C → orange
  if (temp <= 18) return PALETTE.tempCool;
  if (temp >= 22) return PALETTE.tempHot;
  const t = (temp - 18) / 4;
  const r = Math.round(63 + t * (255 - 63));
  const g = Math.round(167 - t * (167 - 122));
  const b = Math.round(255 - t * (255 - 0));
  return `rgb(${r},${g},${b})`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  rooms: Room[];
  selectedRoomId?: string;
  highlightedRoomId?: string;
  onRoomClick: (roomId: string) => void;
}

// ── Room cell ─────────────────────────────────────────────────────────────────

function RoomCell({ room, selected, onRoomClick }: {
  room: Room;
  selected: boolean;
  onRoomClick: (id: string) => void;
}) {
  const { x, y, w, h } = room.svg;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const tc = tempColor(room.designTemp);

  return (
    <g
      className="house-room"
      onClick={() => onRoomClick(room.id)}
      style={{ cursor: 'pointer' }}
      role="button"
      aria-label={`${room.label}, ${room.designTemp}°C`}
    >
      {/* Room fill */}
      <rect
        x={x + 1} y={y + 1} width={w - 2} height={h - 2}
        fill={selected ? PALETTE.roomSelected : 'transparent'}
        className="house-room__fill"
      />

      {/* Hover fill via CSS — transparent by default, orange on hover */}
      <rect
        x={x + 1} y={y + 1} width={w - 2} height={h - 2}
        fill={PALETTE.roomHover}
        opacity={0}
        className="house-room__hover"
      />

      {/* Temperature dot */}
      <circle
        cx={cx} cy={cy - 14}
        r={16}
        fill={tc}
        opacity={0.18}
      />
      <circle
        cx={cx} cy={cy - 14}
        r={9}
        fill={tc}
        opacity={0.9}
      />

      {/* Room label */}
      <text
        x={cx} y={cy + 8}
        textAnchor="middle"
        fontSize={w < 100 ? 8 : 9}
        fontWeight={600}
        fill={PALETTE.labelPrimary}
        fontFamily="system-ui, sans-serif"
        letterSpacing={0.3}
      >
        {room.label.toUpperCase()}
      </text>

      {/* Design temperature */}
      <text
        x={cx} y={cy + 22}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={tc}
        fontFamily="system-ui, sans-serif"
      >
        {room.designTemp}°C
      </text>

      {/* Selection ring */}
      {selected && (
        <rect
          x={x + 2} y={y + 2} width={w - 4} height={h - 4}
          fill="none"
          stroke={PALETTE.roomStroke}
          strokeWidth={2}
          rx={4}
          strokeDasharray="5 3"
        />
      )}

      {/* Tap-to-explore hint on hover */}
      {!selected && (
        <text
          x={cx} y={cy + 38}
          textAnchor="middle"
          fontSize={7}
          fill={PALETTE.labelSecondary}
          fontFamily="system-ui, sans-serif"
          className="house-room__hint"
          opacity={0}
        >
          tap to explore
        </text>
      )}
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HouseExplorer({ rooms, selectedRoomId, onRoomClick }: Props) {
  return (
    <div className="house-explorer">
      <svg
        viewBox="0 0 480 340"
        className="house-explorer__svg"
        aria-label="House cross-section — click a room to explore"
      >
        {/* ── Roof ──────────────────────────────────────────────────────── */}
        <polygon
          points="240,4 460,185 20,185"
          fill={PALETTE.roofFill}
          stroke="#1a252f"
          strokeWidth={1.5}
        />
        {/* Chimney */}
        <rect x={340} y={20} width={28} height={60} fill={PALETTE.roofFill} stroke="#1a252f" strokeWidth={1} />
        <rect x={335} y={16} width={38} height={8} fill="#1a252f" />

        {/* ── Roof tiles (decorative lines) ─────────────────────────────── */}
        {[0.28, 0.42, 0.57, 0.71].map((t, i) => {
          const x1 = 240 + (460 - 240) * t;
          const y1 = 4 + (185 - 4) * t;
          const x2 = 240 - (240 - 20) * t;
          const y2 = 4 + (185 - 4) * t;
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#3d5166" strokeWidth={0.8} opacity={0.6} />
          );
        })}

        {/* ── First floor shell ─────────────────────────────────────────── */}
        <rect x={20} y={42} width={440} height={145}
          fill={PALETTE.wallFill} stroke={PALETTE.wallStroke} strokeWidth={1.5} />

        {/* First floor windows */}
        <rect x={38} y={68} width={60} height={44} rx={2}
          fill={PALETTE.windowFill} stroke="#85c1e9" strokeWidth={1} opacity={0.9} />
        <rect x={68} y={68} width={1} height={44} fill="#85c1e9" opacity={0.5} />
        <rect x={38} y={88} width={60} height={1} fill="#85c1e9" opacity={0.5} />

        <rect x={222} y={68} width={50} height={44} rx={2}
          fill={PALETTE.windowFill} stroke="#85c1e9" strokeWidth={1} opacity={0.9} />
        <rect x={247} y={68} width={1} height={44} fill="#85c1e9" opacity={0.5} />
        <rect x={222} y={88} width={50} height={1} fill="#85c1e9" opacity={0.5} />

        <rect x={370} y={68} width={50} height={44} rx={2}
          fill={PALETTE.windowFill} stroke="#85c1e9" strokeWidth={1} opacity={0.9} />
        <rect x={395} y={68} width={1} height={44} fill="#85c1e9" opacity={0.5} />
        <rect x={370} y={88} width={50} height={1} fill="#85c1e9" opacity={0.5} />

        {/* ── Floor divider ─────────────────────────────────────────────── */}
        <rect x={20} y={187} width={440} height={6}
          fill={PALETTE.floorDivider} stroke={PALETTE.wallStroke} strokeWidth={0.5} />

        {/* ── Ground floor shell ────────────────────────────────────────── */}
        <rect x={20} y={193} width={440} height={140}
          fill={PALETTE.wallFill} stroke={PALETTE.wallStroke} strokeWidth={1.5} />

        {/* Ground floor windows */}
        <rect x={38} y={218} width={80} height={55} rx={2}
          fill={PALETTE.windowFill} stroke="#85c1e9" strokeWidth={1} opacity={0.9} />
        <rect x={78} y={218} width={1} height={55} fill="#85c1e9" opacity={0.5} />
        <rect x={38} y={246} width={80} height={1} fill="#85c1e9" opacity={0.5} />

        <rect x={248} y={218} width={70} height={55} rx={2}
          fill={PALETTE.windowFill} stroke="#85c1e9" strokeWidth={1} opacity={0.9} />
        <rect x={283} y={218} width={1} height={55} fill="#85c1e9" opacity={0.5} />
        <rect x={248} y={246} width={70} height={1} fill="#85c1e9" opacity={0.5} />

        {/* Front door */}
        <rect x={405} y={248} width={42} height={85} rx={2}
          fill={PALETTE.doorFill} stroke="#c0956a" strokeWidth={1.5} />
        <circle cx={414} cy={290} r={3} fill="#8b6914" />

        {/* Room dividers — first floor */}
        <line x1={205} y1={42} x2={205} y2={188} stroke={PALETTE.wallStroke} strokeWidth={1} />
        <line x1={343} y1={42} x2={343} y2={188} stroke={PALETTE.wallStroke} strokeWidth={1} />

        {/* Room dividers — ground floor */}
        <line x1={225} y1={193} x2={225} y2={333} stroke={PALETTE.wallStroke} strokeWidth={1} />
        <line x1={390} y1={193} x2={390} y2={333} stroke={PALETTE.wallStroke} strokeWidth={1} />

        {/* ── Boiler (small icon, bottom-right of ground floor) ─────────── */}
        <g className="house-boiler-icon" style={{ cursor: 'default' }}>
          <rect x={396} y={280} width={50} height={44} rx={4}
            fill={PALETTE.boilerFill} stroke={PALETTE.boilerStroke} strokeWidth={1.5} />
          <text x={421} y={297} textAnchor="middle" fontSize={7} fontWeight={700}
            fill="#fff" fontFamily="system-ui, sans-serif">BOILER</text>
          <text x={421} y={308} textAnchor="middle" fontSize={8} fontWeight={600}
            fill="#fff" fontFamily="system-ui, sans-serif">24 kW</text>
          {/* Pipe connectors */}
          <circle cx={403} cy={316} r={3} fill="#d68910" />
          <circle cx={415} cy={316} r={3} fill="#d68910" />
        </g>

        {/* ── Clickable room cells ─────────────────────────────────────── */}
        {rooms.map(room => (
          <RoomCell
            key={room.id}
            room={room}
            selected={selectedRoomId === room.id}
            onRoomClick={onRoomClick}
          />
        ))}

        {/* ── Floor labels ──────────────────────────────────────────────── */}
        <text x={468} y={118} textAnchor="end" fontSize={7} fill={PALETTE.labelSecondary}
          fontFamily="system-ui, sans-serif" transform="rotate(-90 468 118)">
          FIRST FLOOR
        </text>
        <text x={468} y={268} textAnchor="end" fontSize={7} fill={PALETTE.labelSecondary}
          fontFamily="system-ui, sans-serif" transform="rotate(-90 468 268)">
          GROUND FLOOR
        </text>

        {/* ── Heat loss arrows (subtle decorative) ─────────────────────── */}
        <g opacity={0.18}>
          <line x1={240} y1={4} x2={240} y2={0} stroke={PALETTE.tempHot} strokeWidth={2} markerEnd="url(#arrow)" />
        </g>

        {/* ── Instructions badge ────────────────────────────────────────── */}
        <rect x={152} y={312} width={176} height={20} rx={10}
          fill="rgba(255,122,0,0.09)" stroke="rgba(255,122,0,0.25)" strokeWidth={1} />
        <text x={240} y={325} textAnchor="middle" fontSize={8} fill={PALETTE.tempHot}
          fontFamily="system-ui, sans-serif" fontWeight={600}>
          Tap a room to explore the heating system
        </text>
      </svg>
    </div>
  );
}
