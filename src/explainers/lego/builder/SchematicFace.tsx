/**
 * SchematicFace — shared schematic component face renderer.
 *
 * Exports three forms of the same component face:
 *
 *   SchematicFaceContent   Inner SVG elements only (no <svg> wrapper).
 *                          Use when embedding inside a parent <svg> or <g>.
 *
 *   SchematicFace          Standalone 170×74 SVG element.
 *                          Used by the builder token renderer (WorkbenchCanvas).
 *
 *   SchematicFaceToken     Positioned nested <svg> for embedding inside the
 *                          Play mode LabCanvas SVG at a given (x, y, w, h).
 *                          The 170×74 viewBox is preserved; content is scaled
 *                          to fit the requested dimensions.
 *
 * Both Builder and Play must render the same face for a given component kind so
 * that "Play" looks like "running the built schematic", not a separate diagram.
 *
 * Visual grammar
 * ──────────────
 *  Heat sources  : warm orange fill + casing, both CH ports on right, flame symbol
 *  Cylinders     : blue fill + casing, coil on left, hot-out top, cold-in bottom
 *  Controls      : purple fill, routing-device visuals (Y-plan ≠ S-plan)
 *  Emitters      : indigo fill, recognisable radiator fins / UFH serpentine
 *  Support       : neutral grey fill, component-specific schematic shapes
 *  Port dots     : half-visible filled circles at canonical edge positions
 */

import React from 'react';
import type { PartKind } from './types';
import { PALETTE } from './palette';

// ─── Shared sub-components ───────────────────────────────────────────────────

function kindEmoji(kind: PartKind): string {
  return PALETTE.find(p => p.kind === kind)?.emoji ?? '🧩';
}

/**
 * Filled port-dot at an exact edge position.
 * Half the circle sits outside the viewBox to visually indicate "connection here".
 */
function PortDot({
  cx, cy, fill, stroke,
}: {
  cx: number; cy: number; fill: string; stroke: string;
}): React.ReactElement {
  return <circle cx={cx} cy={cy} r="3.5" fill={fill} stroke={stroke} strokeWidth="1" />;
}

/**
 * SVG-only flame symbol (no emoji).
 * Centre point is (cx, cy); total height ~18px, width ~14px.
 */
function Flame({ cx = 85, cy = 28 }: { cx?: number; cy?: number }): React.ReactElement {
  const x = cx; const y = cy;
  return (
    <g>
      {/* Outer flame body */}
      <path
        d={`M${x},${y+9} Q${x-8},${y+2} ${x-5},${y-6} Q${x-2},${y-13} ${x},${y-11} Q${x+2},${y-13} ${x+5},${y-6} Q${x+8},${y+2} ${x},${y+9} Z`}
        fill="#f6ad55" stroke="#c05621" strokeWidth="0.8" opacity="0.9"
      />
      {/* Inner highlight */}
      <path
        d={`M${x},${y+4} Q${x-3},${y} ${x-2},${y-5} Q${x},${y-8} ${x+2},${y-5} Q${x+3},${y} ${x},${y+4} Z`}
        fill="#fbd38d" opacity="0.75"
      />
    </g>
  );
}

// ─── SchematicFaceContent ─────────────────────────────────────────────────────

interface SchematicFaceProps {
  kind: PartKind;
  label: string;
  slot?: string;
}

/**
 * Inner SVG content for a component schematic face.
 * Returns SVG child elements only — no outer <svg> wrapper.
 * The coordinate space is 170×74 (TOKEN_W × TOKEN_H).
 *
 * Port dots sit at the exact canonical port positions from SCHEMATIC_REGISTRY
 * so that what the builder shows matches what Play animates.
 */
export function SchematicFaceContent({
  kind,
  label,
  slot,
}: SchematicFaceProps): React.ReactElement {
  const slotBadge = slot ? (
    <text x="85" y="69" textAnchor="middle" fontSize="7" fill="#805ad5" fontWeight="700">
      Outlet {slot}
    </text>
  ) : null;

  // ── Combi boiler: CH zone (top) / DHW zone (bottom) ──────────────────────
  if (kind === 'heat_source_combi') {
    return (
      <>
        {/* CH zone fill (top) */}
        <rect x="1" y="1" width="168" height="40" rx="6" fill="rgba(237,137,54,0.10)" />
        {/* DHW zone fill (bottom) */}
        <rect x="1" y="38" width="168" height="35" rx="6" fill="rgba(43,108,176,0.10)" />
        {/* Casing outline */}
        <rect x="1" y="1" width="168" height="72" rx="6" fill="none" stroke="#c05621" strokeWidth="1.8" />
        {/* CH / DHW zone divider */}
        <line x1="6" y1="40" x2="164" y2="40" stroke="#93c5fd" strokeWidth="1" strokeDasharray="3 2" opacity="0.8" />
        {/* Flame in CH zone */}
        <Flame cx={78} cy={22} />
        {/* CH label */}
        <text x="23" y="18" fontSize="8" fontWeight="800" fill="#7b341e">CH</text>
        {/* COMBI sub-label */}
        <text x="85" y="35" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#9c4221" opacity="0.85">COMBI BOILER</text>
        {/* DCW IN label (DHW zone, left) */}
        <text x="11" y="57" fontSize="6.5" fontWeight="700" fill="#2b6cb0">▶ DCW IN</text>
        {/* DHW OUT label (DHW zone, right) */}
        <text x="159" y="57" textAnchor="end" fontSize="6.5" fontWeight="700" fill="#c05621">DHW OUT ▶</text>
        {/* CH flow port (right, y=18) */}
        <PortDot cx={170} cy={18} fill="#f6ad55" stroke="#c05621" />
        {/* CH return port (right, y=56) */}
        <PortDot cx={170} cy={56} fill="#90cdf4" stroke="#2b6cb0" />
        {/* cold_in port (left, y=74) */}
        <PortDot cx={0} cy={74} fill="#90cdf4" stroke="#2b6cb0" />
        {/* hot_out port (right, y=74) */}
        <PortDot cx={170} cy={74} fill="#fbd38d" stroke="#c05621" />
        {slotBadge}
      </>
    );
  }

  // ── System boiler ─────────────────────────────────────────────────────────
  if (kind === 'heat_source_system_boiler') {
    return (
      <>
        <rect x="1" y="1" width="168" height="72" rx="6" fill="rgba(237,137,54,0.08)" />
        <rect x="1" y="1" width="168" height="72" rx="6" fill="none" stroke="#c05621" strokeWidth="1.8" />
        <Flame cx={70} cy={32} />
        {/* Expansion vessel (sealed system indicator) */}
        <ellipse cx="126" cy="32" rx="13" ry="18" fill="rgba(237,137,54,0.12)" stroke="#c05621" strokeWidth="1.1" opacity="0.55" />
        <line x1="113" y1="32" x2="139" y2="32" stroke="#c05621" strokeWidth="1" strokeDasharray="2 2" opacity="0.45" />
        <text x="126" y="28" textAnchor="middle" fontSize="5.5" fill="#9c4221" opacity="0.7">EXP</text>
        <text x="126" y="37" textAnchor="middle" fontSize="5.5" fill="#9c4221" opacity="0.7">VES</text>
        <text x="85" y="59" textAnchor="middle" fontSize="8" fontWeight="800" fill="#7b341e">SYSTEM BOILER</text>
        {/* CH flow port (right, y=18) */}
        <PortDot cx={170} cy={18} fill="#f6ad55" stroke="#c05621" />
        {/* CH return port (right, y=56) */}
        <PortDot cx={170} cy={56} fill="#90cdf4" stroke="#2b6cb0" />
        {slotBadge}
      </>
    );
  }

  // ── Regular boiler (open-vented) ──────────────────────────────────────────
  if (kind === 'heat_source_regular_boiler') {
    return (
      <>
        <rect x="1" y="1" width="168" height="72" rx="6" fill="rgba(237,137,54,0.08)" />
        <rect x="1" y="1" width="168" height="72" rx="6" fill="none" stroke="#c05621" strokeWidth="1.8" />
        <Flame cx={70} cy={32} />
        {/* F&E tank indicator (open-vented circuit) */}
        <rect x="116" y="7" width="28" height="24" rx="3" fill="rgba(74,85,104,0.12)" stroke="#4a5568" strokeWidth="1" opacity="0.6" />
        <path d="M130 7 V3" stroke="#4a5568" strokeWidth="1.2" opacity="0.6" />
        <circle cx="130" cy="2" r="2" fill="none" stroke="#4a5568" strokeWidth="1" opacity="0.6" />
        <text x="130" y="23" textAnchor="middle" fontSize="5.5" fill="#4a5568" opacity="0.7">F&E</text>
        <text x="85" y="58" textAnchor="middle" fontSize="8" fontWeight="800" fill="#7b341e">REGULAR BOILER</text>
        {/* CH flow port (right, y=18) */}
        <PortDot cx={170} cy={18} fill="#f6ad55" stroke="#c05621" />
        {/* CH return port (right, y=56) */}
        <PortDot cx={170} cy={56} fill="#90cdf4" stroke="#2b6cb0" />
        {slotBadge}
      </>
    );
  }

  // ── Heat pump ─────────────────────────────────────────────────────────────
  if (kind === 'heat_source_heat_pump') {
    return (
      <>
        <rect x="1" y="1" width="168" height="72" rx="6" fill="rgba(39,103,73,0.09)" />
        <rect x="1" y="1" width="168" height="72" rx="6" fill="none" stroke="#276749" strokeWidth="1.8" />
        {/* Compressor body */}
        <circle cx="66" cy="35" r="20" fill="rgba(39,103,73,0.12)" stroke="#276749" strokeWidth="1.4" />
        {/* Rotation arcs (suggest compressor motion) */}
        <path d="M60 21 Q48 35 60 49" fill="none" stroke="#276749" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M72 21 Q84 35 72 49" fill="none" stroke="#276749" strokeWidth="1.3" strokeLinecap="round" />
        <text x="66" y="34" textAnchor="middle" fontSize="7" fontWeight="800" fill="#22543d">COP</text>
        <text x="66" y="43" textAnchor="middle" fontSize="6" fill="#22543d" opacity="0.8">3–4 ×</text>
        {/* Outdoor coil / fin grid */}
        <rect x="104" y="12" width="54" height="42" rx="4" fill="none" stroke="#276749" strokeWidth="1.1" opacity="0.5" />
        {Array.from({ length: 6 }, (_, i) => 16 + i * 6).map((yy) => (
          <line key={yy} x1="108" y1={yy} x2="154" y2={yy} stroke="#276749" strokeWidth="0.9" opacity="0.35" />
        ))}
        <text x="131" y="60" textAnchor="middle" fontSize="5.5" fill="#22543d" opacity="0.7">AIR SOURCE</text>
        <text x="85" y="67" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#22543d">HEAT PUMP</text>
        {/* CH flow port (right, y=18) */}
        <PortDot cx={170} cy={18} fill="#68d391" stroke="#276749" />
        {/* CH return port (right, y=56) */}
        <PortDot cx={170} cy={56} fill="#c6f6d5" stroke="#276749" />
        {slotBadge}
      </>
    );
  }

  // ── Cylinders ──────────────────────────────────────────────────────────────
  if (
    kind === 'dhw_unvented_cylinder' ||
    kind === 'dhw_vented_cylinder' ||
    kind === 'dhw_mixergy'
  ) {
    const isMixergy = kind === 'dhw_mixergy';
    const isVented  = kind === 'dhw_vented_cylinder';
    const supplyLabel = isMixergy ? 'MIXERGY' : isVented ? 'TANK-FED' : 'MAINS-FED';
    const typeLabel   = isVented  ? 'VENTED'  : 'UNVENTED';
    const mainLabelY  = isMixergy ? 40 : 34;
    return (
      <>
        {/* Cylinder body (inset left to leave room for coil path) */}
        <rect x="26" y="2" width="122" height="70" rx="18" fill="rgba(43,108,176,0.09)" stroke="#2b6cb0" strokeWidth="1.6" />
        {/* Mixergy top-entry HX band */}
        {isMixergy && (
          <>
            <rect x="26" y="2" width="122" height="20" rx="14"
              fill="rgba(192,86,33,0.13)" stroke="#c05621" strokeWidth="1.1" strokeDasharray="3 2" />
            <text x="87" y="16" textAnchor="middle" fontSize="5.5" fontWeight="800" fill="#9c4221">TOP-ENTRY HX</text>
          </>
        )}
        {/* Coil path on left face (matches coil_flow y=18 / coil_return y=56) */}
        <path d="M26,20 Q12,24 26,30 Q12,36 26,42 Q12,48 26,54"
          fill="none" stroke="#c05621" strokeWidth="2" opacity="0.7" />
        {/* Supply type label */}
        <text x="87" y={mainLabelY} textAnchor="middle" fontSize="8" fontWeight="800" fill="#2c5282">
          {supplyLabel}
        </text>
        {/* Vented / unvented badge */}
        {!isMixergy && (
          <text x="87" y={mainLabelY + 12} textAnchor="middle" fontSize="6.5" fill="#2b6cb0" fontWeight="600">
            {typeLabel}
          </text>
        )}
        {/* Supply-pressure decoration */}
        {isVented ? (
          /* Vented: gravity droplet (tank-fed / CWS) */
          <>
            <circle cx="143" cy="16" r="5" fill="rgba(43,108,176,0.25)" stroke="#2b6cb0" strokeWidth="1" opacity="0.65" />
            <path d="M143 11 V7" stroke="#2b6cb0" strokeWidth="1" opacity="0.6" />
            <text x="143" y="29" textAnchor="middle" fontSize="5" fill="#2b6cb0" opacity="0.6">CWS</text>
          </>
        ) : !isMixergy ? (
          /* Unvented: mains pressure wavy lines */
          <>
            <path d="M134 18 Q138 15 142 18 Q146 21 150 18" fill="none" stroke="#2b6cb0" strokeWidth="1" opacity="0.6" />
            <path d="M134 24 Q138 21 142 24 Q146 27 150 24" fill="none" stroke="#2b6cb0" strokeWidth="1" opacity="0.6" />
            <text x="142" y="34" textAnchor="middle" fontSize="5" fill="#2b6cb0" opacity="0.6">MAINS</text>
          </>
        ) : null}
        {/* hot_out label + port (top, x=85, y=0) */}
        <text x="85" y="12" textAnchor="middle" fontSize="5.5" fill="#9c4221">HOT OUT ↑</text>
        <PortDot cx={85} cy={0} fill="#fbd38d" stroke="#c05621" />
        {/* cold_in label + port (bottom, x=85, y=74) */}
        <text x="85" y="67" textAnchor="middle" fontSize="5.5" fill="#2c5282">↓ COLD IN</text>
        <PortDot cx={85} cy={74} fill="#90cdf4" stroke="#2b6cb0" />
        {/* coil_flow port (left, y=18) */}
        <PortDot cx={0} cy={18} fill="#f6ad55" stroke="#c05621" />
        {/* coil_return port (left, y=56) */}
        <PortDot cx={0} cy={56} fill="#90cdf4" stroke="#2b6cb0" />
        {slotBadge}
      </>
    );
  }

  // ── Three-port valve (Y-plan, compact inline symbol) ─────────────────────
  if (kind === 'three_port_valve') {
    return (
      <>
        {/* Input pipe spine (left → valve body) */}
        <line x1="1" y1="37" x2="70" y2="37" stroke="#6b46c1" strokeWidth="2" opacity="0.45" />
        {/* Upper output pipe (valve body → right, toward y=18) */}
        <line x1="100" y1="37" x2="169" y2="18" stroke="#6b46c1" strokeWidth="2" opacity="0.45" />
        {/* Lower output pipe (valve body → right, toward y=56) */}
        <line x1="100" y1="37" x2="169" y2="56" stroke="#6b46c1" strokeWidth="2" opacity="0.45" />
        {/* Valve body — compact circle */}
        <circle cx="85" cy="37" r="18" fill="rgba(107,70,193,0.10)" stroke="#6b46c1" strokeWidth="1.5" />
        {/* Actuator stem */}
        <line x1="85" y1="19" x2="85" y2="12" stroke="#6b46c1" strokeWidth="1.5" opacity="0.7" />
        {/* Actuator cap */}
        <rect x="78" y="9" width="14" height="6" rx="1.5"
          fill="rgba(107,70,193,0.15)" stroke="#6b46c1" strokeWidth="1" />
        {/* Junction dot */}
        <circle cx="100" cy="37" r="3" fill="#6b46c1" opacity="0.65" />
        {/* Route labels */}
        <text x="161" y="16" textAnchor="end" fontSize="5.5" fill="#553c9a" opacity="0.85">HW</text>
        <text x="161" y="54" textAnchor="end" fontSize="5.5" fill="#553c9a" opacity="0.85">CH</text>
        {/* 3-PORT VALVE label */}
        <text x="85" y="67" textAnchor="middle" fontSize="7" fontWeight="700" fill="#553c9a">3-PORT VALVE</text>
        {/* Port indicators */}
        <PortDot cx={0}   cy={37} fill="#b794f4" stroke="#6b46c1" />
        <PortDot cx={170} cy={18} fill="#b794f4" stroke="#6b46c1" />
        <PortDot cx={170} cy={56} fill="#b794f4" stroke="#6b46c1" />
        {slotBadge}
      </>
    );
  }

  // ── Zone valve (S-plan, compact inline symbol) ────────────────────────────
  if (kind === 'zone_valve') {
    return (
      <>
        {/* Pipe spine through full token width */}
        <line x1="1" y1="37" x2="169" y2="37" stroke="#6b46c1" strokeWidth="2" opacity="0.45" />
        {/* Valve body — compact circle */}
        <circle cx="85" cy="37" r="18" fill="rgba(107,70,193,0.10)" stroke="#6b46c1" strokeWidth="1.5" />
        {/* Actuator stem */}
        <line x1="85" y1="19" x2="85" y2="12" stroke="#6b46c1" strokeWidth="1.5" opacity="0.7" />
        {/* Actuator cap */}
        <rect x="78" y="9" width="14" height="6" rx="1.5"
          fill="rgba(107,70,193,0.15)" stroke="#6b46c1" strokeWidth="1" />
        {/* Gate indicator (diagonal slash inside disc = open state) */}
        <line x1="76" y1="30" x2="94" y2="44" stroke="#6b46c1" strokeWidth="1" strokeDasharray="3 2" opacity="0.45" />
        {/* ZONE VALVE label */}
        <text x="85" y="67" textAnchor="middle" fontSize="7" fontWeight="700" fill="#553c9a">ZONE VALVE</text>
        {/* Port indicators */}
        <PortDot cx={0}   cy={37} fill="#b794f4" stroke="#6b46c1" />
        <PortDot cx={170} cy={37} fill="#b794f4" stroke="#6b46c1" />
        {slotBadge}
      </>
    );
  }

  // ── Radiator loop: classic fin-panel emitter ──────────────────────────────
  if (kind === 'radiator_loop') {
    return (
      <>
        <rect x="1" y="1" width="168" height="72" rx="6" fill="rgba(85,60,154,0.06)" />
        {/* Top header pipe — connects from left flow port (y=18) across the top */}
        <line x1="16" y1="18" x2="154" y2="18" stroke="#6b46c1" strokeWidth="2.2" opacity="0.65" strokeLinecap="round" />
        {/* Bottom header pipe — connects from left return port (y=56) across the bottom */}
        <line x1="16" y1="56" x2="154" y2="56" stroke="#6b46c1" strokeWidth="2.2" opacity="0.65" strokeLinecap="round" />
        {/* Six fins spanning between headers */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <rect key={i} x={20 + i * 22} y="18" width="14" height="38" rx="3"
            fill="rgba(107,70,193,0.12)" stroke="#6b46c1" strokeWidth="1.2" opacity="0.7" />
        ))}
        {/* RADIATORS label */}
        <text x="95" y="67" textAnchor="middle" fontSize="7" fontWeight="800" fill="#553c9a">RADIATORS</text>
        {/* Port indicators — both on left: flow at y=18 (warm), return at y=56 (cool) */}
        <PortDot cx={0} cy={18} fill="#f6ad55" stroke="#c05621" />
        <PortDot cx={0} cy={56} fill="#90cdf4" stroke="#2b6cb0" />
        {slotBadge}
      </>
    );
  }

  // ── UFH loop: serpentine-coil emitter ─────────────────────────────────────
  if (kind === 'ufh_loop') {
    return (
      <>
        <rect x="1" y="1" width="168" height="72" rx="6" fill="rgba(85,60,154,0.06)" />
        {/* Serpentine coil — shifted right to leave room for left-side ports */}
        {/* Run 1: left → right */}
        <line x1="22" y1="20" x2="148" y2="20" stroke="#6b46c1" strokeWidth="1.6" opacity="0.65" />
        {/* Right U-bend */}
        <path d="M148 20 Q156 20 156 28 Q156 36 148 36"
          fill="none" stroke="#6b46c1" strokeWidth="1.6" opacity="0.65" />
        {/* Run 2: right → left */}
        <line x1="148" y1="36" x2="22" y2="36" stroke="#6b46c1" strokeWidth="1.6" opacity="0.65" />
        {/* Left U-bend */}
        <path d="M22 36 Q14 36 14 44 Q14 52 22 52"
          fill="none" stroke="#6b46c1" strokeWidth="1.6" opacity="0.65" />
        {/* Run 3: left → right */}
        <line x1="22" y1="52" x2="148" y2="52" stroke="#6b46c1" strokeWidth="1.6" opacity="0.65" />
        {/* Flow port stub (y=18 → top of coil at y=20) */}
        <line x1="0" y1="18" x2="22" y2="18" stroke="#6b46c1" strokeWidth="1.6" opacity="0.5" />
        <line x1="22" y1="18" x2="22" y2="20" stroke="#6b46c1" strokeWidth="1.6" opacity="0.5" />
        {/* Return port stub (bottom of coil at y=52 → return port at y=56) */}
        <line x1="22" y1="52" x2="22" y2="56" stroke="#6b46c1" strokeWidth="1.6" opacity="0.5" />
        <line x1="22" y1="56" x2="0" y2="56" stroke="#6b46c1" strokeWidth="1.6" opacity="0.5" />
        {/* UFH label */}
        <text x="95" y="68" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#553c9a">UNDERFLOOR HEATING</text>
        {/* Port indicators — both on left: flow at y=18 (warm), return at y=56 (cool) */}
        <PortDot cx={0} cy={18} fill="#f6ad55" stroke="#c05621" />
        <PortDot cx={0} cy={56} fill="#90cdf4" stroke="#2b6cb0" />
        {slotBadge}
      </>
    );
  }

  // ── Pump (compact inline symbol) ──────────────────────────────────────────
  if (kind === 'pump') {
    return (
      <>
        {/* Pipe spine through full token width — keeps ports connected visually */}
        <line x1="1" y1="37" x2="169" y2="37" stroke="#4a5568" strokeWidth="2" opacity="0.35" />
        {/* Flow direction arrowhead */}
        <polygon points="152,37 144,33 144,41" fill="#4a5568" opacity="0.45" />
        {/* Pump body — compact circle */}
        <circle cx="85" cy="37" r="20" fill="rgba(74,85,104,0.10)" stroke="#4a5568" strokeWidth="1.5" />
        {/* Impeller blades */}
        <path d="M80 29 Q85 33 80 45" fill="none" stroke="#4a5568" strokeWidth="1.2" opacity="0.55" />
        <path d="M90 29 Q85 33 90 45" fill="none" stroke="#4a5568" strokeWidth="1.2" opacity="0.55" />
        {/* Impeller hub */}
        <circle cx="85" cy="37" r="3" fill="#4a5568" opacity="0.35" />
        {/* PUMP label */}
        <text x="85" y="66" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#4a5568">PUMP</text>
        {/* Port indicators */}
        <PortDot cx={0}   cy={37} fill="#a0aec0" stroke="#4a5568" />
        <PortDot cx={170} cy={37} fill="#a0aec0" stroke="#4a5568" />
        {slotBadge}
      </>
    );
  }


  // ── Buffer / Low-loss header ───────────────────────────────────────────────
  if (kind === 'buffer' || kind === 'low_loss_header') {
    const kindLabel = kind === 'buffer' ? 'BUFFER' : 'LLH';
    return (
      <>
        <rect x="1" y="1" width="168" height="72" rx="6" fill="rgba(74,85,104,0.07)" />
        <rect x="1" y="1" width="168" height="72" rx="6" fill="none" stroke="#4a5568" strokeWidth="1.5" />
        {/* Primary / secondary separator */}
        <line x1="85" y1="6" x2="85" y2="68" stroke="#4a5568" strokeWidth="1" strokeDasharray="3 2" opacity="0.45" />
        {/* Zone labels */}
        <text x="43" y="38" textAnchor="middle" fontSize="6" fill="#4a5568" opacity="0.7">PRIMARY</text>
        <text x="127" y="38" textAnchor="middle" fontSize="6" fill="#4a5568" opacity="0.7">SECONDARY</text>
        {/* Component label */}
        <text x="85" y="65" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#2d3748">{kindLabel}</text>
        {/* Port indicators: primary (left) — flow y=18, return y=56 */}
        <PortDot cx={0}   cy={18} fill="#f6ad55" stroke="#c05621" />
        <PortDot cx={0}   cy={56} fill="#90cdf4" stroke="#2b6cb0" />
        {/* Port indicators: secondary (right) — flow y=18, return y=56 */}
        <PortDot cx={170} cy={18} fill="#f6ad55" stroke="#c05621" />
        <PortDot cx={170} cy={56} fill="#90cdf4" stroke="#2b6cb0" />
        {slotBadge}
      </>
    );
  }

  // ── Sealed system kit (small support symbol) ──────────────────────────────
  if (kind === 'sealed_system_kit') {
    return (
      <>
        {/* Expansion vessel (compact ellipse) */}
        <ellipse cx="72" cy="31" rx="22" ry="16"
          fill="rgba(74,85,104,0.10)" stroke="#4a5568" strokeWidth="1.2" />
        <line x1="50" y1="31" x2="94" y2="31" stroke="#4a5568" strokeWidth="0.9" strokeDasharray="3 2" opacity="0.45" />
        <text x="72" y="28" textAnchor="middle" fontSize="5.5" fill="#4a5568">EXP. VES.</text>
        {/* PRV — small circle beside vessel */}
        <line x1="94" y1="31" x2="108" y2="22" stroke="#e53e3e" strokeWidth="1.1" opacity="0.65" />
        <circle cx="114" cy="19" r="8"
          fill="rgba(229,62,62,0.08)" stroke="#e53e3e" strokeWidth="1" opacity="0.7" />
        <text x="114" y="16" textAnchor="middle" fontSize="5" fontWeight="700" fill="#c53030">PRV</text>
        {/* Fill loop stub */}
        <path d="M108 31 L122 31 L122 43" fill="none" stroke="#2b6cb0" strokeWidth="1" opacity="0.45" />
        <text x="136" y="47" fontSize="5" fill="#2b6cb0" opacity="0.6">FILL</text>
        {/* SEALED KIT label */}
        <text x="85" y="58" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#4a5568">SEALED KIT</text>
        {/* Port indicator (right, y=37) */}
        <PortDot cx={170} cy={37} fill="#a0aec0" stroke="#4a5568" />
        {slotBadge}
      </>
    );
  }

  // ── Open vent (small support symbol — vent stub rising from flow spine) ───
  if (kind === 'open_vent') {
    return (
      <>
        {/* Horizontal pipe spine (port level y=37) */}
        <line x1="1" y1="37" x2="169" y2="37" stroke="#4a5568" strokeWidth="2" opacity="0.35" />
        {/* Vent pipe rising from centre */}
        <line x1="85" y1="37" x2="85" y2="14" stroke="#4a5568" strokeWidth="1.5" opacity="0.6" />
        {/* Open top indicator (arc) */}
        <path d="M80 16 Q85 10 90 16" fill="none" stroke="#4a5568" strokeWidth="1.3" opacity="0.6" />
        {/* OPEN VENT label */}
        <text x="85" y="57" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#4a5568">OPEN VENT</text>
        {/* Port indicators (both y=37) */}
        <PortDot cx={0}   cy={37} fill="#a0aec0" stroke="#4a5568" />
        <PortDot cx={170} cy={37} fill="#a0aec0" stroke="#4a5568" />
        {slotBadge}
      </>
    );
  }

  // ── Feed & expansion tank (small support symbol) ──────────────────────────
  if (kind === 'feed_and_expansion') {
    return (
      <>
        {/* F&E tank body (compact) */}
        <rect x="30" y="6" width="76" height="44" rx="4"
          fill="rgba(74,85,104,0.10)" stroke="#4a5568" strokeWidth="1.2" />
        {/* Water level line inside tank */}
        <line x1="30" y1="32" x2="106" y2="32" stroke="#2b6cb0" strokeWidth="0.9" opacity="0.4" />
        {/* Float ball arm and ball */}
        <line x1="96" y1="26" x2="114" y2="18" stroke="#4a5568" strokeWidth="1" opacity="0.5" />
        <circle cx="118" cy="15" r="6"
          fill="rgba(74,85,104,0.15)" stroke="#4a5568" strokeWidth="1" opacity="0.55" />
        {/* Feed pipe (right at y=37) */}
        <line x1="106" y1="37" x2="169" y2="37" stroke="#4a5568" strokeWidth="1.5" opacity="0.55" />
        {/* FEED & EXP. label */}
        <text x="68" y="62" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#4a5568">F&amp;E TANK</text>
        <PortDot cx={170} cy={37} fill="#a0aec0" stroke="#4a5568" />
        {slotBadge}
      </>
    );
  }

  // ── CWS cistern ───────────────────────────────────────────────────────────
  if (kind === 'cws_cistern') {
    return (
      <>
        <rect x="1" y="1" width="168" height="72" rx="6" fill="rgba(43,108,176,0.08)" />
        {/* Cistern body */}
        <rect x="12" y="4" width="120" height="54" rx="4" fill="rgba(43,108,176,0.12)" stroke="#2b6cb0" strokeWidth="1.4" />
        {/* Water surface (undulating line) */}
        <path d="M12 30 Q32 26 52 30 Q72 34 92 30 Q112 26 132 30"
          fill="none" stroke="#2b6cb0" strokeWidth="1" opacity="0.55" />
        {/* Float valve arm */}
        <line x1="108" y1="26" x2="130" y2="18" stroke="#4a5568" strokeWidth="1.1" opacity="0.55" />
        <circle cx="133" cy="16" r="6" fill="rgba(43,108,176,0.20)" stroke="#2b6cb0" strokeWidth="1" opacity="0.6" />
        {/* Cold outlet pipe (right at y=37) */}
        <line x1="132" y1="37" x2="169" y2="37" stroke="#2b6cb0" strokeWidth="1.8" opacity="0.65" />
        {/* CWS CISTERN label */}
        <text x="66" y="69" textAnchor="middle" fontSize="7" fontWeight="800" fill="#2c5282">CWS CISTERN</text>
        {/* Port indicator (right, y=37) */}
        <PortDot cx={170} cy={37} fill="#90cdf4" stroke="#2b6cb0" />
        {slotBadge}
      </>
    );
  }

  // ── Tees / branch-point junctions (compact inline symbols) ──────────────
  // These render as tiny schematic T-junction nodes — NOT big rectangles.
  // tee_cold / tee_hot / tee_ch_flow: one inbound left, two outbound right.
  // tee_ch_return: two inbound left, one outbound right (return spine merge).
  if (
    kind === 'tee_cold' ||
    kind === 'tee_hot' ||
    kind === 'tee_ch_flow' ||
    kind === 'tee_ch_return'
  ) {
    const isReturn = kind === 'tee_ch_return';
    const isHot    = kind === 'tee_hot';
    const isCold   = kind === 'tee_cold';
    const color    = isHot  ? '#c05621' :
                     isCold ? '#2b6cb0' :
                     isReturn ? '#2b6cb0' : '#6b46c1';
    const fill     = isHot  ? 'rgba(237,137,54,0.12)' :
                     isCold ? 'rgba(43,108,176,0.12)' :
                     isReturn ? 'rgba(43,108,176,0.10)' : 'rgba(107,70,193,0.10)';
    const dotFill  = isHot  ? '#fbd38d' :
                     isCold || isReturn ? '#90cdf4' : '#b794f4';
    // For return tee the inbound port is on the right, two outbound on left.
    // For all others: inbound left, two outbound right.
    if (isReturn) {
      return (
        <>
          {/* Spine from right inbound to branch centre */}
          <line x1="169" y1="37" x2="85" y2="37" stroke={color} strokeWidth="2" opacity="0.5" />
          {/* Branch up-left to out1 */}
          <line x1="85" y1="37" x2="1" y2="18" stroke={color} strokeWidth="2" opacity="0.5" />
          {/* Branch down-left to out2 */}
          <line x1="85" y1="37" x2="1" y2="56" stroke={color} strokeWidth="2" opacity="0.5" />
          {/* Junction body */}
          <circle cx="85" cy="37" r="7" fill={fill} stroke={color} strokeWidth="1.4" />
          {/* Label */}
          <text x="85" y="67" textAnchor="middle" fontSize="6" fontWeight="700" fill={color}>RETURN TEE</text>
          {/* Ports: in (right), out1 (left y=18), out2 (left y=56) */}
          <PortDot cx={170} cy={37} fill={dotFill} stroke={color} />
          <PortDot cx={0}   cy={18} fill={dotFill} stroke={color} />
          <PortDot cx={0}   cy={56} fill={dotFill} stroke={color} />
          {slotBadge}
        </>
      );
    }
    const shortLabel = isHot ? 'HOT TEE' : isCold ? 'COLD TEE' : 'FLOW TEE';
    return (
      <>
        {/* Spine from left inbound to branch centre */}
        <line x1="1" y1="37" x2="85" y2="37" stroke={color} strokeWidth="2" opacity="0.5" />
        {/* Branch up-right to out1 */}
        <line x1="85" y1="37" x2="169" y2="18" stroke={color} strokeWidth="2" opacity="0.5" />
        {/* Branch down-right to out2 */}
        <line x1="85" y1="37" x2="169" y2="56" stroke={color} strokeWidth="2" opacity="0.5" />
        {/* Junction body */}
        <circle cx="85" cy="37" r="7" fill={fill} stroke={color} strokeWidth="1.4" />
        {/* Label */}
        <text x="85" y="67" textAnchor="middle" fontSize="6" fontWeight="700" fill={color}>{shortLabel}</text>
        {/* Ports: in (left), out1 (right y=18), out2 (right y=56) */}
        <PortDot cx={0}   cy={37} fill={dotFill} stroke={color} />
        <PortDot cx={170} cy={18} fill={dotFill} stroke={color} />
        <PortDot cx={170} cy={56} fill={dotFill} stroke={color} />
        {slotBadge}
      </>
    );
  }

  // ── Generic fallback: emoji + label ──────────────────────────────────────
  const emoji = kindEmoji(kind);
  return (
    <>
      <text x="85" y="30" textAnchor="middle" fontSize="20">{emoji}</text>
      <text x="85" y="50" textAnchor="middle" fontSize="9" fontWeight="800" fill="#2d3748">{label}</text>
      {slotBadge}
    </>
  );
}

// ─── SchematicFace (standalone builder token) ─────────────────────────────────

/**
 * Renders a component-specific schematic face inside a standalone 170×74 SVG.
 * Used by the builder token renderer (WorkbenchCanvas) to represent each placed
 * component on the workbench canvas.
 */
export function SchematicFace({
  kind,
  label,
  slot,
}: SchematicFaceProps): React.ReactElement {
  return (
    <svg viewBox="0 0 170 74" width="170" height="74" aria-hidden="true" className="token-face">
      <SchematicFaceContent kind={kind} label={label} slot={slot} />
    </svg>
  )
}

// ─── SchematicFaceToken (positioned play-mode token) ─────────────────────────

interface SchematicFaceTokenProps {
  kind: PartKind;
  label: string;
  /** Left edge of the token in the parent SVG coordinate space. */
  x: number;
  /** Top edge of the token in the parent SVG coordinate space. */
  y: number;
  /** Rendered width of the token (content is scaled from 170 to this width). */
  width: number;
  /** Rendered height of the token (content is scaled from 74 to this height). */
  height: number;
}

/**
 * Renders a schematic face as a positioned nested <svg> for embedding inside
 * the Play mode LabCanvas SVG.
 *
 * The face uses the canonical 170×74 viewBox so the visual language is
 * identical to the builder — the token is simply scaled to fit the requested
 * width/height in the play scene coordinate space.
 *
 * Animation / state overlays should be rendered by the caller on top of this
 * element (e.g. glow rects, fill bars, status text).
 */
export function SchematicFaceToken({
  kind,
  label,
  x,
  y,
  width,
  height,
}: SchematicFaceTokenProps): React.ReactElement {
  return (
    <svg
      x={x}
      y={y}
      width={width}
      height={height}
      viewBox="0 0 170 74"
      overflow="visible"
      aria-hidden="true"
    >
      <SchematicFaceContent kind={kind} label={label} />
    </svg>
  )
}
