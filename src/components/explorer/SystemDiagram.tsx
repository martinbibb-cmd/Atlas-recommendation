/**
 * SystemDiagram.tsx
 *
 * Hydraulic schematic — system-topology-aware.
 *
 * Topologies rendered:
 *   combi          → Source ──→ manifold ──→ radiators
 *   stored_vented  → Source → Cylinder → manifold → radiators
 *   stored_unvented→ Source → Cylinder → manifold → radiators
 *   system_unvented→ Source → Cylinder → manifold → radiators
 *   ashp           → ASHP → manifold → oversized rads  + Cylinder (DHW branch)
 *   regular_vented → Source → Cylinder → manifold → radiators (70°C labels)
 */

import type { SystemConfig } from './explorerTypes';
import type { Room, Emitter, Pipe } from './explorerTypes';

interface HighlightSpec {
  roomId?: string;
  emitterId?: string;
}

interface Props {
  rooms: Room[];
  emitters: Emitter[];
  pipes: Pipe[];
  systemConfig: SystemConfig;
  highlight: HighlightSpec;
  onSourceClick: () => void;
  onEmitterClick: (emitterId: string) => void;
  animating?: boolean;
}

// ── Layout ────────────────────────────────────────────────────────────────────

const W = 580;
const H = 250;

const SRC_X  = 18;   // heat source (boiler / heat pump) left edge
const SRC_Y  = 96;
const SRC_W  = 52;
const SRC_H  = 52;

const CYL_X  = 92;   // cylinder — only for stored systems
const CYL_Y  = 86;
const CYL_W  = 36;
const CYL_H  = 72;

const MAN_START_X_DIRECT  = SRC_X + SRC_W + 18;  // no cylinder
const MAN_START_X_STORED  = CYL_X + CYL_W + 14;  // after cylinder

const FLOW_Y   = 62;
const RETURN_Y = 168;

const RAD_Y    = FLOW_Y + 14;
const RAD_W    = 40;
const RAD_H    = 52;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isHighlighted(emitterId: string, highlight: HighlightSpec, rooms: Room[]) {
  if (highlight.emitterId === emitterId) return true;
  if (highlight.roomId) {
    return rooms.find(r => r.id === highlight.roomId)?.emitterId === emitterId;
  }
  return false;
}

// ── Radiator glyph ────────────────────────────────────────────────────────────

function RadiatorGlyph({ x, highlighted, accentColor, label, type, onClick }: {
  x: number;
  highlighted: boolean;
  accentColor: string;
  label: string;
  type: 'radiator' | 'underfloor';
  onClick: () => void;
}) {
  const panels = type === 'underfloor' ? 1 : 4;
  const sW = RAD_W / panels;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }} aria-label={label}>
      {highlighted && (
        <rect x={x - 5} y={RAD_Y - 5} width={RAD_W + 10} height={RAD_H + 10}
          rx={6} fill={`${accentColor}40`} className="sys-diagram__rad-glow--pulse" />
      )}

      {type === 'underfloor' ? (
        // UFH glyph (wavy lines in a panel)
        <g>
          <rect x={x} y={RAD_Y} width={RAD_W} height={RAD_H} rx={3}
            fill={highlighted ? '#e8f8f5' : '#f7f8fa'}
            stroke={highlighted ? accentColor : '#bdc3c7'}
            strokeWidth={highlighted ? 1.5 : 1} />
          {[8, 20, 32, 44].map(yOff => (
            <path key={yOff}
              d={`M${x+4},${RAD_Y+yOff} Q${x+12},${RAD_Y+yOff-5} ${x+20},${RAD_Y+yOff} Q${x+28},${RAD_Y+yOff+5} ${x+36},${RAD_Y+yOff}`}
              fill="none" stroke={highlighted ? accentColor : '#bdc3c7'} strokeWidth={1.2} />
          ))}
          <text x={x+20} y={RAD_Y+RAD_H+14} textAnchor="middle" fontSize={5.5}
            fill="#667085" fontFamily="system-ui, sans-serif">UFH</text>
        </g>
      ) : (
        Array.from({ length: panels }, (_, i) => (
          <rect key={i} x={x + i * sW + 1} y={RAD_Y} width={sW - 2} height={RAD_H} rx={2}
            fill={highlighted ? '#fff3e0' : '#f7f8fa'}
            stroke={highlighted ? accentColor : '#bdc3c7'}
            strokeWidth={highlighted ? 1.5 : 1} />
        ))
      )}

      {/* Connectors */}
      <rect x={x + 2}          y={RAD_Y + RAD_H} width={8} height={6} rx={2}
        fill={highlighted ? accentColor : '#bdc3c7'} />
      <rect x={x + RAD_W - 10} y={RAD_Y + RAD_H} width={8} height={6} rx={2}
        fill={highlighted ? '#3fa7ff' : '#bdc3c7'} />

      {/* Room label */}
      <text x={x + RAD_W / 2} y={RAD_Y + RAD_H + (type === 'underfloor' ? 22 : 16)}
        textAnchor="middle" fontSize={7} fontWeight={highlighted ? 700 : 500}
        fill={highlighted ? accentColor : '#667085'}
        fontFamily="system-ui, sans-serif">
        {label.split(' ')[0].toUpperCase()}
      </text>
    </g>
  );
}

// ── Cylinder glyph ────────────────────────────────────────────────────────────

function CylinderNode({ g3Required, volumeLitres }: { g3Required: boolean; volumeLitres: number }) {
  const x = CYL_X;
  const y = CYL_Y;
  const fill = g3Required ? '#d4e8f8' : '#dce8f0';
  const stroke = '#7fb3cc';

  return (
    <g>
      {/* Body */}
      <ellipse cx={x + CYL_W / 2} cy={y + 6}         rx={CYL_W / 2} ry={7}  fill={fill} stroke={stroke} strokeWidth={1.2} />
      <rect    x={x} y={y + 6}      width={CYL_W} height={CYL_H - 12} fill={fill} stroke={stroke} strokeWidth={1.2} />
      <ellipse cx={x + CYL_W / 2} cy={y + CYL_H - 6} rx={CYL_W / 2} ry={7}  fill={`${fill}`} stroke={stroke} strokeWidth={1.2} />

      {/* Label */}
      <text x={x + CYL_W / 2} y={y + CYL_H / 2 - 4} textAnchor="middle" fontSize={6.5}
        fontWeight={700} fill="#3a6e8a" fontFamily="system-ui, sans-serif">CYL</text>
      <text x={x + CYL_W / 2} y={y + CYL_H / 2 + 6} textAnchor="middle" fontSize={6}
        fill="#3a6e8a" fontFamily="system-ui, sans-serif">{volumeLitres}L</text>
      {g3Required && (
        <text x={x + CYL_W / 2} y={y + CYL_H / 2 + 16} textAnchor="middle" fontSize={5.5}
          fill="#ea5455" fontFamily="system-ui, sans-serif" fontWeight={600}>G3</text>
      )}

      {/* Pipe connections: top = flow in from boiler, bottom = return, right = DHW */}
      <line x1={x + CYL_W / 2 - 6} y1={y}       x2={x + CYL_W / 2 - 6} y2={y - 12}  stroke="#ff7a00" strokeWidth={2} />
      <line x1={x + CYL_W / 2 + 6} y1={y + CYL_H} x2={x + CYL_W / 2 + 6} y2={y + CYL_H + 12} stroke="#3fa7ff" strokeWidth={2} />
    </g>
  );
}

// ── Animated flow dots ─────────────────────────────────────────────────────────

function FlowDots({ fromX, toX, y, color, animating }: {
  fromX: number; toX: number; y: number; color: string; animating: boolean;
}) {
  if (!animating) return null;
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <circle key={i} r={3} fill={color} opacity={0.85}
          className="sys-diagram__dot"
          style={{ animationDelay: `${i * 0.6}s` }}>
          <animate attributeName="cx" from={fromX} to={toX} dur="3s" begin={`${i * 0.75}s`} repeatCount="indefinite" />
          <animate attributeName="cy" values={`${y}`} dur="3s" repeatCount="indefinite" />
        </circle>
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SystemDiagram({
  rooms,
  emitters,
  systemConfig,
  highlight,
  onSourceClick,
  onEmitterClick,
  animating = false,
}: Props) {
  const { hasCylinder, cylinder, heatSource, designFlowTempC, designReturnTempC, accentColor, category } = systemConfig;

  const isHP = heatSource.isHeatPump;
  const manStartX = hasCylinder ? MAN_START_X_STORED : MAN_START_X_DIRECT;
  const manEndX   = W - 16;
  const anyHL     = !!(highlight.emitterId || highlight.roomId);

  // Distribute radiators evenly between manStartX and manEndX
  const numRads = rooms.length;
  const radSpacing = (manEndX - manStartX) / numRads;

  const flowColor   = accentColor;
  const returnColor = '#3fa7ff';

  // Source icon
  const srcFill   = isHP ? '#eafaf1' : '#f39c12';
  const srcStroke = isHP ? accentColor : '#d68910';
  const srcLabel  = isHP ? 'HEAT PUMP' : 'BOILER';
  const srcKw     = isHP
    ? `${heatSource.ratedOutputKw ?? 7} kW`
    : `${heatSource.outputKw ?? 24} kW`;
  const srcSub    = isHP
    ? `COP ${heatSource.cop ?? 2.8}`
    : `η ${heatSource.efficiencyPct ?? 89}%`;

  return (
    <div className="sys-diagram">
      <svg viewBox={`0 0 ${W} ${H}`} className="sys-diagram__svg"
        aria-label={`${systemConfig.label} heating schematic`}>

        {/* ── Flow manifold ─────────────────────────────────────────── */}
        <line x1={SRC_X + SRC_W + 6} y1={FLOW_Y} x2={manEndX} y2={FLOW_Y}
          stroke={anyHL ? flowColor : '#cbd5e0'}
          strokeWidth={anyHL ? 4 : 3} strokeLinecap="round"
          opacity={anyHL ? 1 : 0.6} />
        <text x={manStartX + 4} y={FLOW_Y - 6} fontSize={7} fill={flowColor}
          fontFamily="system-ui, sans-serif" fontWeight={600}>
          FLOW {designFlowTempC}°C
        </text>

        {/* ── Return manifold ───────────────────────────────────────── */}
        <line x1={SRC_X + SRC_W + 6} y1={RETURN_Y} x2={manEndX} y2={RETURN_Y}
          stroke={anyHL ? returnColor : '#cbd5e0'}
          strokeWidth={anyHL ? 4 : 3} strokeLinecap="round"
          opacity={anyHL ? 1 : 0.6} />
        <text x={manStartX + 4} y={RETURN_Y + 14} fontSize={7} fill={returnColor}
          fontFamily="system-ui, sans-serif" fontWeight={600}>
          RETURN {designReturnTempC}°C
        </text>

        {/* ── Animated dots ─────────────────────────────────────────── */}
        <FlowDots fromX={manStartX} toX={manEndX} y={FLOW_Y}   color={flowColor}   animating={animating && anyHL} />
        <FlowDots fromX={manEndX}   toX={manStartX} y={RETURN_Y} color={returnColor} animating={animating && anyHL} />

        {/* ── Radiators ─────────────────────────────────────────────── */}
        {rooms.map((room, i) => {
          const emitter = emitters.find(e => e.id === room.emitterId);
          if (!emitter) return null;
          const hl  = isHighlighted(emitter.id, highlight, rooms);
          const rx  = manStartX + i * radSpacing + 6;

          return (
            <g key={room.id}>
              <line x1={rx + RAD_W / 2 - 8} y1={FLOW_Y}     x2={rx + RAD_W / 2 - 8} y2={RAD_Y}
                stroke={hl ? flowColor : '#cbd5e0'} strokeWidth={hl ? 2.5 : 1.5} />
              <line x1={rx + RAD_W / 2 + 8} y1={RAD_Y + RAD_H} x2={rx + RAD_W / 2 + 8} y2={RETURN_Y}
                stroke={hl ? returnColor : '#cbd5e0'} strokeWidth={hl ? 2.5 : 1.5} />
              <RadiatorGlyph
                x={rx} highlighted={hl} accentColor={accentColor}
                label={room.label} type={emitter.type}
                onClick={() => onEmitterClick(emitter.id)} />
            </g>
          );
        })}

        {/* ── Cylinder (stored systems only) ────────────────────────── */}
        {hasCylinder && cylinder && (
          <g>
            {/* Flow pipe: source → cylinder */}
            <line x1={SRC_X + SRC_W} y1={SRC_Y + 14}
              x2={CYL_X} y2={CYL_Y + 14}
              stroke={flowColor} strokeWidth={3} />
            {/* Return pipe: cylinder → source */}
            <line x1={SRC_X + SRC_W} y1={SRC_Y + SRC_H - 14}
              x2={CYL_X} y2={CYL_Y + CYL_H - 14}
              stroke={returnColor} strokeWidth={3} />
            {/* Cylinder → manifold flow */}
            <line x1={CYL_X + CYL_W} y1={FLOW_Y} x2={manStartX} y2={FLOW_Y}
              stroke={flowColor} strokeWidth={3} />
            <line x1={CYL_X + CYL_W} y1={RETURN_Y} x2={manStartX} y2={RETURN_Y}
              stroke={returnColor} strokeWidth={3} />
            {/* Vertical connections from cylinder to manifolds */}
            <line x1={CYL_X + CYL_W / 2 - 6} y1={CYL_Y} x2={CYL_X + CYL_W / 2 - 6} y2={FLOW_Y}
              stroke={flowColor} strokeWidth={2} />
            <line x1={CYL_X + CYL_W / 2 + 6} y1={CYL_Y + CYL_H} x2={CYL_X + CYL_W / 2 + 6} y2={RETURN_Y}
              stroke={returnColor} strokeWidth={2} />

            <CylinderNode g3Required={cylinder.g3Required} volumeLitres={cylinder.volumeLitres} />

            {/* DHW label */}
            <text x={CYL_X + CYL_W / 2} y={H - 8} textAnchor="middle" fontSize={6.5}
              fill="#3a6e8a" fontFamily="system-ui, sans-serif">
              {cylinder.g3Required ? 'Unvented DHW' : 'Vented DHW'}
            </text>
          </g>
        )}

        {/* ── ASHP: DHW cylinder shown separately to the right ──────── */}
        {isHP && cylinder && (
          <g>
            <rect x={W - 54} y={FLOW_Y - 2} width={42} height={RETURN_Y - FLOW_Y + 4}
              rx={4} fill="#eafaf1" stroke={accentColor} strokeWidth={1} />
            <text x={W - 33} y={FLOW_Y + 22} textAnchor="middle" fontSize={6.5}
              fontWeight={700} fill={accentColor} fontFamily="system-ui, sans-serif">DHW</text>
            <text x={W - 33} y={FLOW_Y + 33} textAnchor="middle" fontSize={6}
              fill={accentColor} fontFamily="system-ui, sans-serif">{cylinder.volumeLitres}L</text>
            <text x={W - 33} y={FLOW_Y + 44} textAnchor="middle" fontSize={5.5}
              fill="#667085" fontFamily="system-ui, sans-serif">Immersion</text>
            {/* Connection line from manifold area */}
            <line x1={manEndX - 2} y1={RETURN_Y - 20} x2={W - 54} y2={RETURN_Y - 20}
              stroke={accentColor} strokeWidth={1.5} strokeDasharray="4 3" />
            {/* Source to manifold main pipes */}
            <line x1={SRC_X + SRC_W} y1={SRC_Y + 10} x2={manStartX} y2={FLOW_Y}
              stroke={flowColor} strokeWidth={3} />
            <line x1={SRC_X + SRC_W} y1={SRC_Y + SRC_H - 10} x2={manStartX} y2={RETURN_Y}
              stroke={returnColor} strokeWidth={3} />
          </g>
        )}

        {/* Direct source → manifold pipes (no cylinder) */}
        {!hasCylinder && !isHP && (
          <>
            <line x1={SRC_X + SRC_W} y1={SRC_Y + 10}
              x2={SRC_X + SRC_W + 6} y2={FLOW_Y}
              stroke={flowColor} strokeWidth={3} />
            <line x1={SRC_X + SRC_W} y1={SRC_Y + SRC_H - 10}
              x2={SRC_X + SRC_W + 6} y2={RETURN_Y}
              stroke={returnColor} strokeWidth={3} />
          </>
        )}

        {/* ── Heat source (boiler / heat pump) ──────────────────────── */}
        <g onClick={onSourceClick} style={{ cursor: 'pointer' }}
          aria-label={`${srcLabel} — click to view details`}>
          <rect x={SRC_X} y={SRC_Y} width={SRC_W} height={SRC_H} rx={6}
            fill={srcFill} stroke={srcStroke} strokeWidth={2}
            className={animating ? 'sys-diagram__boiler--active' : ''} />

          {isHP ? (
            <>
              {/* Heat pump icon */}
              <circle cx={SRC_X + SRC_W / 2} cy={SRC_Y + 18} r={10}
                fill="none" stroke={accentColor} strokeWidth={1.5} />
              <text x={SRC_X + SRC_W / 2} y={SRC_Y + 22} textAnchor="middle"
                fontSize={8} fill={accentColor} fontFamily="system-ui, sans-serif">HP</text>
              <text x={SRC_X + SRC_W / 2} y={SRC_Y + 35} textAnchor="middle"
                fontSize={6.5} fontWeight={700} fill={accentColor} fontFamily="system-ui, sans-serif">
                {srcKw}
              </text>
              <text x={SRC_X + SRC_W / 2} y={SRC_Y + 45} textAnchor="middle"
                fontSize={6} fill={accentColor} fontFamily="system-ui, sans-serif">
                {srcSub}
              </text>
            </>
          ) : (
            <>
              <text x={SRC_X + SRC_W / 2} y={SRC_Y + 18} textAnchor="middle"
                fontSize={7} fontWeight={700} fill="#fff" fontFamily="system-ui, sans-serif">
                BOILER
              </text>
              <text x={SRC_X + SRC_W / 2} y={SRC_Y + 30} textAnchor="middle"
                fontSize={9} fontWeight={700} fill="#fff" fontFamily="system-ui, sans-serif">
                {srcKw}
              </text>
              <text x={SRC_X + SRC_W / 2} y={SRC_Y + 42} textAnchor="middle"
                fontSize={6.5} fill="rgba(255,255,255,0.85)" fontFamily="system-ui, sans-serif">
                {srcSub}
              </text>
            </>
          )}
          <text x={SRC_X + SRC_W / 2} y={SRC_Y + SRC_H + 12} textAnchor="middle"
            fontSize={6.5} fill="#667085" fontFamily="system-ui, sans-serif">tap to view</text>
        </g>

        {/* ── Condensing / status badge ──────────────────────────────── */}
        {!isHP && heatSource.condensing !== undefined && (
          <rect x={SRC_X - 2} y={SRC_Y + SRC_H + 18} width={56} height={14} rx={7}
            fill={heatSource.condensing ? 'rgba(40,199,111,0.12)' : 'rgba(234,84,85,0.12)'}
            stroke={heatSource.condensing ? 'rgba(40,199,111,0.3)' : 'rgba(234,84,85,0.3)'}
            strokeWidth={1} />
        )}
        {!isHP && heatSource.condensing !== undefined && (
          <text x={SRC_X + 26} y={SRC_Y + SRC_H + 29} textAnchor="middle" fontSize={7}
            fill={heatSource.condensing ? '#28c76f' : '#ea5455'}
            fontFamily="system-ui, sans-serif" fontWeight={600}>
            {heatSource.condensing ? 'CONDENSING' : 'NOT CONDENSING'}
          </text>
        )}

        {/* ASHP: pipe size warning */}
        {isHP && (
          <rect x={SRC_X - 2} y={SRC_Y + SRC_H + 18} width={56} height={14} rx={7}
            fill="rgba(255,176,32,0.12)" stroke="rgba(255,176,32,0.3)" strokeWidth={1} />
        )}
        {isHP && (
          <text x={SRC_X + 26} y={SRC_Y + SRC_H + 29} textAnchor="middle" fontSize={7}
            fill="#ffb020" fontFamily="system-ui, sans-serif" fontWeight={600}>
            28mm PRIMARY
          </text>
        )}

        {/* ── Category badge ─────────────────────────────────────────── */}
        <rect x={W / 2 - 60} y={H - 18} width={120} height={14} rx={7}
          fill={`${accentColor}12`} stroke={`${accentColor}30`} strokeWidth={1} />
        <text x={W / 2} y={H - 7} textAnchor="middle" fontSize={7}
          fill={accentColor} fontFamily="system-ui, sans-serif" fontWeight={600}>
          {systemConfig.label}
        </text>
      </svg>
    </div>
  );
}
