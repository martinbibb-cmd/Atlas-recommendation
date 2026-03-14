/**
 * HouseExplorer.tsx
 *
 * Hero component: SVG cross-section of a 3-bed semi showing all rooms.
 * System-specific elements are rendered conditionally:
 *   - Cylinder glyph in airing cupboard (stored systems)
 *   - Loft tanks (open-vented systems)
 *   - Outdoor unit (ASHP)
 */

import type { Room } from './explorerTypes';
import type { SystemConfig } from './explorerTypes';

// ── Design tokens ─────────────────────────────────────────────────────────────

const PALETTE = {
  roofFill:       '#2c3e50',
  wallFill:       '#ecf0f1',
  wallStroke:     '#bdc3c7',
  windowFill:     '#aed6f1',
  doorFill:       '#d5b895',
  floorDivider:   '#bdc3c7',
  roomHover:      'rgba(255, 122, 0, 0.10)',
  roomSelected:   'rgba(255, 122, 0, 0.22)',
  roomStroke:     '#e67e22',
  labelPrimary:   '#1c2430',
  labelSecondary: '#667085',
  tempHot:        '#ff7a00',
  tempCool:       '#3fa7ff',
  boilerFill:     '#f39c12',
  boilerStroke:   '#d68910',
};

function tempColor(temp: number): string {
  if (temp <= 18) return PALETTE.tempCool;
  if (temp >= 22) return PALETTE.tempHot;
  const t = (temp - 18) / 4;
  const r = Math.round(63 + t * (255 - 63));
  const g = Math.round(167 - t * (167 - 122));
  const b = Math.round(255 - t * 255);
  return `rgb(${r},${g},${b})`;
}

// ── Room cell ─────────────────────────────────────────────────────────────────

function RoomCell({ room, selected, accentColor, onRoomClick }: {
  room: Room;
  selected: boolean;
  accentColor: string;
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
      <rect x={x+1} y={y+1} width={w-2} height={h-2}
        fill={selected ? `${accentColor}22` : 'transparent'}
        className="house-room__fill" />
      <rect x={x+1} y={y+1} width={w-2} height={h-2}
        fill={PALETTE.roomHover} opacity={0} className="house-room__hover" />

      <circle cx={cx} cy={cy - 14} r={16} fill={tc} opacity={0.18} />
      <circle cx={cx} cy={cy - 14} r={9}  fill={tc} opacity={0.9} />

      <text x={cx} y={cy + 8} textAnchor="middle"
        fontSize={w < 100 ? 8 : 9} fontWeight={600} fill={PALETTE.labelPrimary}
        fontFamily="system-ui, sans-serif" letterSpacing={0.3}>
        {room.label.toUpperCase()}
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle"
        fontSize={10} fontWeight={700} fill={tc} fontFamily="system-ui, sans-serif">
        {room.designTemp}°C
      </text>

      {selected && (
        <rect x={x+2} y={y+2} width={w-4} height={h-4}
          fill="none" stroke={accentColor} strokeWidth={2} rx={4} strokeDasharray="5 3" />
      )}
      {!selected && (
        <text x={cx} y={cy + 38} textAnchor="middle" fontSize={7}
          fill={PALETTE.labelSecondary} fontFamily="system-ui, sans-serif"
          className="house-room__hint" opacity={0}>
          tap to explore
        </text>
      )}
    </g>
  );
}

// ── System-specific elements ──────────────────────────────────────────────────

function CylinderGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {/* Cylinder body */}
      <ellipse cx={x + 14} cy={y + 4} rx={13} ry={5} fill="#d5e8f0" stroke="#7fb3cc" strokeWidth={1.2} />
      <rect x={x + 1} y={y + 4} width={26} height={38} fill="#d5e8f0" stroke="#7fb3cc" strokeWidth={1.2} />
      <ellipse cx={x + 14} cy={y + 42} rx={13} ry={5} fill="#b8d4e5" stroke="#7fb3cc" strokeWidth={1.2} />
      {/* Label */}
      <text x={x + 14} y={y + 25} textAnchor="middle" fontSize={6.5} fontWeight={700}
        fill="#3a6e8a" fontFamily="system-ui, sans-serif">CYLINDER</text>
      <text x={x + 14} y={y + 34} textAnchor="middle" fontSize={5.5}
        fill="#3a6e8a" fontFamily="system-ui, sans-serif">DHW</text>
      {/* Pipe connections */}
      <line x1={x} y1={y + 12} x2={x - 8} y2={y + 12} stroke="#7fb3cc" strokeWidth={2} />
      <line x1={x} y1={y + 30} x2={x - 8} y2={y + 30} stroke="#7fb3cc" strokeWidth={2} />
    </g>
  );
}

function LoftTankGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {/* CWS tank */}
      <rect x={x} y={y} width={30} height={18} rx={2} fill="#d0e8f5" stroke="#7fb3cc" strokeWidth={1} />
      <text x={x + 15} y={y + 11} textAnchor="middle" fontSize={5.5} fontWeight={700}
        fill="#3a6e8a" fontFamily="system-ui, sans-serif">CWS TANK</text>
      {/* F&E tank smaller */}
      <rect x={x + 34} y={y + 2} width={20} height={14} rx={2} fill="#e0d5f0" stroke="#9b7fc0" strokeWidth={1} />
      <text x={x + 44} y={y + 11} textAnchor="middle" fontSize={4.5} fontWeight={700}
        fill="#5b3d8a" fontFamily="system-ui, sans-serif">F&E</text>
      {/* Pipe drops */}
      <line x1={x + 15} y1={y + 18} x2={x + 15} y2={y + 28} stroke="#7fb3cc" strokeWidth={1.5} />
    </g>
  );
}

function OutdoorUnitGlyph({ x, y, accentColor }: { x: number; y: number; accentColor: string }) {
  return (
    <g>
      {/* Unit casing */}
      <rect x={x} y={y} width={50} height={36} rx={4}
        fill="#ecf0f1" stroke={accentColor} strokeWidth={1.5} />
      {/* Fan circle */}
      <circle cx={x + 18} cy={y + 18} r={12} fill="#dce9ec" stroke={accentColor} strokeWidth={1} />
      <circle cx={x + 18} cy={y + 18} r={4} fill={accentColor} opacity={0.6} />
      {/* Fan blades */}
      {[0, 90, 180, 270].map(deg => (
        <line key={deg}
          x1={x + 18} y1={y + 18}
          x2={x + 18 + Math.cos(deg * Math.PI / 180) * 9}
          y2={y + 18 + Math.sin(deg * Math.PI / 180) * 9}
          stroke={accentColor} strokeWidth={2} />
      ))}
      {/* Label */}
      <text x={x + 38} y={y + 14} textAnchor="middle" fontSize={5.5} fontWeight={700}
        fill={accentColor} fontFamily="system-ui, sans-serif">ASHP</text>
      <text x={x + 38} y={y + 23} textAnchor="middle" fontSize={5}
        fill={accentColor} fontFamily="system-ui, sans-serif">7 kW</text>
      <text x={x + 38} y={y + 32} textAnchor="middle" fontSize={5}
        fill="#667085" fontFamily="system-ui, sans-serif">COP 2.8</text>
      {/* Pipe to house */}
      <line x1={x + 50} y1={y + 18} x2={x + 60} y2={y + 18}
        stroke={accentColor} strokeWidth={2} />
    </g>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  rooms: Room[];
  systemConfig: SystemConfig;
  selectedRoomId?: string;
  onRoomClick: (roomId: string) => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HouseExplorer({ rooms, systemConfig, selectedRoomId, onRoomClick }: Props) {
  const { hasCylinder, hasLoftTank, hasOutdoorUnit, accentColor, heatSource, isHeatPump: _ } = systemConfig as SystemConfig & { isHeatPump?: boolean };

  const isHP = heatSource.isHeatPump;
  // Boiler icon colour matches accent
  const boilerFill   = isHP ? '#ecf0f1' : PALETTE.boilerFill;
  const boilerStroke = isHP ? accentColor : PALETTE.boilerStroke;
  const boilerLabel  = isHP ? 'HEAT\nPUMP' : 'BOILER';
  const boilerKw     = isHP ? `${heatSource.ratedOutputKw ?? 7} kW` : `${heatSource.outputKw ?? 24} kW`;

  return (
    <div className="house-explorer">
      <svg viewBox="0 0 500 360" className="house-explorer__svg"
        aria-label="House cross-section — click a room to explore">

        {/* ── Outdoor unit (ASHP only) — left of house ────────────────── */}
        {hasOutdoorUnit && (
          <OutdoorUnitGlyph x={-60} y={240} accentColor={accentColor} />
        )}

        {/* ── Roof ──────────────────────────────────────────────────────── */}
        <polygon points="240,4 460,185 20,185"
          fill={PALETTE.roofFill} stroke="#1a252f" strokeWidth={1.5} />
        <rect x={340} y={20} width={28} height={60}
          fill={PALETTE.roofFill} stroke="#1a252f" strokeWidth={1} />
        <rect x={335} y={16} width={38} height={8} fill="#1a252f" />

        {/* Roof tile lines */}
        {[0.28, 0.42, 0.57, 0.71].map((t, i) => (
          <line key={i}
            x1={240 + (460 - 240) * t} y1={4 + (185 - 4) * t}
            x2={240 - (240 - 20) * t}  y2={4 + (185 - 4) * t}
            stroke="#3d5166" strokeWidth={0.8} opacity={0.6} />
        ))}

        {/* ── Loft space (open-vented systems) ──────────────────────────── */}
        {hasLoftTank && (
          <g>
            <rect x={35} y={100} width={170} height={60} rx={3}
              fill="rgba(208,232,245,0.3)" stroke="#7fb3cc" strokeWidth={0.8} strokeDasharray="4 3" />
            <text x={120} y={116} textAnchor="middle" fontSize={7} fill="#3a6e8a"
              fontFamily="system-ui, sans-serif" fontWeight={600}>LOFT SPACE</text>
            <LoftTankGlyph x={50} y={118} />
          </g>
        )}

        {/* ── First floor shell ──────────────────────────────────────────── */}
        <rect x={20} y={42} width={440} height={145}
          fill={PALETTE.wallFill} stroke={PALETTE.wallStroke} strokeWidth={1.5} />

        {/* First floor windows */}
        <rect x={38} y={68} width={60} height={44} rx={2}
          fill={PALETTE.windowFill} stroke="#85c1e9" strokeWidth={1} opacity={0.9} />
        <line x1={68} y1={68} x2={68} y2={112} stroke="#85c1e9" opacity={0.5} />
        <line x1={38} y1={88} x2={98} y2={88} stroke="#85c1e9" opacity={0.5} />

        <rect x={222} y={68} width={50} height={44} rx={2}
          fill={PALETTE.windowFill} stroke="#85c1e9" strokeWidth={1} opacity={0.9} />
        <line x1={247} y1={68} x2={247} y2={112} stroke="#85c1e9" opacity={0.5} />
        <line x1={222} y1={88} x2={272} y2={88}  stroke="#85c1e9" opacity={0.5} />

        <rect x={370} y={68} width={50} height={44} rx={2}
          fill={PALETTE.windowFill} stroke="#85c1e9" strokeWidth={1} opacity={0.9} />
        <line x1={395} y1={68} x2={395} y2={112} stroke="#85c1e9" opacity={0.5} />
        <line x1={370} y1={88} x2={420} y2={88}  stroke="#85c1e9" opacity={0.5} />

        {/* ── Floor divider ──────────────────────────────────────────────── */}
        <rect x={20} y={187} width={440} height={6}
          fill={PALETTE.floorDivider} stroke={PALETTE.wallStroke} strokeWidth={0.5} />

        {/* ── Ground floor shell ─────────────────────────────────────────── */}
        <rect x={20} y={193} width={440} height={140}
          fill={PALETTE.wallFill} stroke={PALETTE.wallStroke} strokeWidth={1.5} />

        {/* Ground floor windows */}
        <rect x={38} y={218} width={80} height={55} rx={2}
          fill={PALETTE.windowFill} stroke="#85c1e9" strokeWidth={1} opacity={0.9} />
        <line x1={78} y1={218} x2={78} y2={273} stroke="#85c1e9" opacity={0.5} />
        <line x1={38} y1={246} x2={118} y2={246} stroke="#85c1e9" opacity={0.5} />

        <rect x={248} y={218} width={70} height={55} rx={2}
          fill={PALETTE.windowFill} stroke="#85c1e9" strokeWidth={1} opacity={0.9} />
        <line x1={283} y1={218} x2={283} y2={273} stroke="#85c1e9" opacity={0.5} />
        <line x1={248} y1={246} x2={318} y2={246} stroke="#85c1e9" opacity={0.5} />

        {/* Front door */}
        <rect x={405} y={248} width={42} height={85} rx={2}
          fill={PALETTE.doorFill} stroke="#c0956a" strokeWidth={1.5} />
        <circle cx={414} cy={290} r={3} fill="#8b6914" />

        {/* Room dividers — first floor */}
        <line x1={205} y1={42}  x2={205} y2={188} stroke={PALETTE.wallStroke} strokeWidth={1} />
        <line x1={343} y1={42}  x2={343} y2={188} stroke={PALETTE.wallStroke} strokeWidth={1} />

        {/* Room dividers — ground floor */}
        <line x1={225} y1={193} x2={225} y2={333} stroke={PALETTE.wallStroke} strokeWidth={1} />
        <line x1={390} y1={193} x2={390} y2={333} stroke={PALETTE.wallStroke} strokeWidth={1} />

        {/* ── Airing cupboard cylinder (stored systems) ─────────────────── */}
        {hasCylinder && (
          <g>
            <rect x={393} y={195} width={65} height={70} rx={0}
              fill="rgba(213,232,240,0.25)" />
            <text x={426} y={208} textAnchor="middle" fontSize={5.5}
              fill="#667085" fontFamily="system-ui, sans-serif">AIRING</text>
            <CylinderGlyph x={412} y={212} />
          </g>
        )}

        {/* ── Heat source icon (bottom-right or replace cylinder area) ──── */}
        {!hasCylinder && (
          <g className="house-boiler-icon" style={{ cursor: 'default' }}>
            <rect x={396} y={280} width={50} height={44} rx={4}
              fill={boilerFill} stroke={boilerStroke} strokeWidth={1.5} />
            {boilerLabel.split('\n').map((line, i) => (
              <text key={i} x={421} y={297 + i * 10} textAnchor="middle"
                fontSize={7} fontWeight={700} fill={isHP ? accentColor : '#fff'}
                fontFamily="system-ui, sans-serif">{line}</text>
            ))}
            <text x={421} y={318} textAnchor="middle" fontSize={8} fontWeight={600}
              fill={isHP ? accentColor : '#fff'} fontFamily="system-ui, sans-serif">
              {boilerKw}
            </text>
          </g>
        )}

        {/* ── Clickable room cells ──────────────────────────────────────── */}
        {rooms.map(room => (
          <RoomCell
            key={room.id}
            room={room}
            selected={selectedRoomId === room.id}
            accentColor={accentColor}
            onRoomClick={onRoomClick}
          />
        ))}

        {/* ── Floor labels ───────────────────────────────────────────────── */}
        <text x={468} y={118} textAnchor="end" fontSize={7} fill={PALETTE.labelSecondary}
          fontFamily="system-ui, sans-serif" transform="rotate(-90 468 118)">
          FIRST FLOOR
        </text>
        <text x={468} y={268} textAnchor="end" fontSize={7} fill={PALETTE.labelSecondary}
          fontFamily="system-ui, sans-serif" transform="rotate(-90 468 268)">
          GROUND FLOOR
        </text>

        {/* ── Instructions badge ─────────────────────────────────────────── */}
        <rect x={152} y={330} width={176} height={20} rx={10}
          fill={`${accentColor}15`} stroke={`${accentColor}40`} strokeWidth={1} />
        <text x={240} y={343} textAnchor="middle" fontSize={8} fill={accentColor}
          fontFamily="system-ui, sans-serif" fontWeight={600}>
          Tap a room to explore the heating system
        </text>
      </svg>
    </div>
  );
}
