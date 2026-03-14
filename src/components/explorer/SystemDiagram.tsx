/**
 * SystemDiagram.tsx
 *
 * Schematic showing the hydraulic path: Boiler → pipes → radiators.
 * Highlighted path pulses when a room / emitter is selected.
 * Uses CSS keyframe animations for flowing dots and radiator glow.
 *
 * Layout (SVG 560 × 240):
 *   Boiler (left) ─── flow pipe ──→ Radiators (row) ─── return pipe ──→ Boiler
 */

import type { Room, Emitter, Pipe } from './explorerTypes';

interface HighlightSpec {
  roomId?: string;
  emitterId?: string;
}

interface Props {
  rooms: Room[];
  emitters: Emitter[];
  pipes: Pipe[];
  highlight: HighlightSpec;
  onBoilerClick: () => void;
  onEmitterClick: (emitterId: string) => void;
  animating?: boolean;
}

// ── Layout constants ──────────────────────────────────────────────────────────

const W = 560;
const H = 240;
const BOILER_X = 44;
const BOILER_Y = 95;
const BOILER_W = 52;
const BOILER_H = 52;
const FLOW_Y  = 68;   // y of the flow manifold pipe
const RETURN_Y = 168; // y of the return manifold pipe
const RAD_START_X = 130;
const RAD_GAP     = 74;
const RAD_W       = 40;
const RAD_H       = 52;
const LABEL_Y     = 230;

const FLOW_COLOR   = '#ff7a00';
const RETURN_COLOR = '#3fa7ff';
const PIPE_DIM     = '#cbd5e0';
const GLOW_COLOR   = 'rgba(255,120,0,0.35)';

// ── Radiator glyph ────────────────────────────────────────────────────────────

function RadiatorGlyph({ x, y, highlighted, animating, label, onClick }: {
  x: number; y: number;
  highlighted: boolean;
  animating: boolean;
  label: string;
  onClick: () => void;
}) {
  const sections = 4;
  const sW = RAD_W / sections;

  return (
    <g
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      aria-label={`Radiator: ${label}`}
    >
      {/* Glow halo when highlighted */}
      {highlighted && (
        <rect
          x={x - 5} y={y - 5} width={RAD_W + 10} height={RAD_H + 10}
          rx={6}
          fill={GLOW_COLOR}
          className={animating ? 'sys-diagram__rad-glow--pulse' : ''}
        />
      )}

      {/* Radiator body panels */}
      {Array.from({ length: sections }, (_, i) => (
        <rect
          key={i}
          x={x + i * sW + 1} y={y}
          width={sW - 2} height={RAD_H}
          rx={2}
          fill={highlighted ? '#fff3e0' : '#f7f8fa'}
          stroke={highlighted ? FLOW_COLOR : '#bdc3c7'}
          strokeWidth={highlighted ? 1.5 : 1}
        />
      ))}

      {/* Connector nipples */}
      <rect x={x + 2}  y={y + RAD_H} width={8} height={6} rx={2}
        fill={highlighted ? FLOW_COLOR : PIPE_DIM} />
      <rect x={x + RAD_W - 10} y={y + RAD_H} width={8} height={6} rx={2}
        fill={highlighted ? RETURN_COLOR : PIPE_DIM} />

      {/* Room label below */}
      <text x={x + RAD_W / 2} y={LABEL_Y - 10}
        textAnchor="middle" fontSize={7.5} fontWeight={600}
        fill={highlighted ? FLOW_COLOR : '#667085'}
        fontFamily="system-ui, sans-serif">
        {label.toUpperCase()}
      </text>
    </g>
  );
}

// ── Flow dot ──────────────────────────────────────────────────────────────────
// Animated dots travel along flow pipe when `animating` is true.

function FlowDots({ y, highlighted, animating }: {
  y: number; highlighted: boolean; animating: boolean;
}) {
  if (!animating) return null;
  const color = y === FLOW_Y ? FLOW_COLOR : RETURN_COLOR;
  const direction = y === FLOW_Y ? 1 : -1;
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <circle
          key={i}
          r={3}
          fill={color}
          opacity={highlighted ? 0.9 : 0.3}
          className="sys-diagram__dot"
          style={{
            animationDelay: `${i * 0.6}s`,
            animationDirection: direction === 1 ? 'normal' : 'reverse',
          }}
        >
          {/* Animate along the x-axis of the manifold */}
          <animate
            attributeName="cx"
            from={direction === 1 ? BOILER_X + BOILER_W : W - 20}
            to={direction === 1 ? W - 20 : BOILER_X + BOILER_W}
            dur="3s"
            begin={`${i * 0.75}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="cy"
            values={`${y}`}
            dur="3s"
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SystemDiagram({
  rooms,
  emitters,
  highlight,
  onBoilerClick,
  onEmitterClick,
  animating = false,
}: Props) {
  // Build display order: match rooms to their emitters
  const displayItems = rooms.map((room, i) => {
    const emitter = emitters.find(e => e.id === room.emitterId);
    const radX = RAD_START_X + i * RAD_GAP;
    return { room, emitter, radX };
  });

  const isHighlighted = (emitterId: string) =>
    highlight.emitterId === emitterId || highlight.roomId
      ? rooms.find(r => r.id === highlight.roomId)?.emitterId === emitterId
      : false;

  const anyHighlight = !!(highlight.emitterId || highlight.roomId);

  return (
    <div className="sys-diagram">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="sys-diagram__svg"
        aria-label="Heating system schematic"
      >
        {/* ── Background ────────────────────────────────────────────────── */}
        <rect x={0} y={0} width={W} height={H} fill="transparent" />

        {/* ── Flow manifold pipe ─────────────────────────────────────────── */}
        <line
          x1={BOILER_X + BOILER_W} y1={FLOW_Y}
          x2={W - 20} y2={FLOW_Y}
          stroke={anyHighlight ? FLOW_COLOR : PIPE_DIM}
          strokeWidth={anyHighlight ? 4 : 3}
          strokeLinecap="round"
          opacity={anyHighlight ? 1 : 0.6}
        />
        {/* Flow label */}
        <text x={BOILER_X + BOILER_W + 6} y={FLOW_Y - 6}
          fontSize={7} fill={FLOW_COLOR} fontFamily="system-ui, sans-serif" fontWeight={600}>
          FLOW {anyHighlight ? '75°C' : ''}
        </text>

        {/* ── Return manifold pipe ──────────────────────────────────────── */}
        <line
          x1={BOILER_X + BOILER_W} y1={RETURN_Y}
          x2={W - 20} y2={RETURN_Y}
          stroke={anyHighlight ? RETURN_COLOR : PIPE_DIM}
          strokeWidth={anyHighlight ? 4 : 3}
          strokeLinecap="round"
          opacity={anyHighlight ? 1 : 0.6}
        />
        <text x={BOILER_X + BOILER_W + 6} y={RETURN_Y + 14}
          fontSize={7} fill={RETURN_COLOR} fontFamily="system-ui, sans-serif" fontWeight={600}>
          RETURN {anyHighlight ? '65°C' : ''}
        </text>

        {/* ── Animated flow dots ────────────────────────────────────────── */}
        <FlowDots y={FLOW_Y}   highlighted={anyHighlight} animating={animating} />
        <FlowDots y={RETURN_Y} highlighted={anyHighlight} animating={animating} />

        {/* ── Radiators with drop pipes ─────────────────────────────────── */}
        {displayItems.map(({ room, emitter, radX }) => {
          if (!emitter) return null;
          const hl = isHighlighted(emitter.id);
          const RAD_Y = FLOW_Y + 14;

          return (
            <g key={room.id}>
              {/* Drop pipe: flow manifold → radiator top */}
              <line
                x1={radX + RAD_W / 2 - 8} y1={FLOW_Y}
                x2={radX + RAD_W / 2 - 8} y2={RAD_Y}
                stroke={hl ? FLOW_COLOR : PIPE_DIM}
                strokeWidth={hl ? 2.5 : 1.5}
              />
              {/* Rise pipe: radiator bottom → return manifold */}
              <line
                x1={radX + RAD_W / 2 + 8} y1={RAD_Y + RAD_H}
                x2={radX + RAD_W / 2 + 8} y2={RETURN_Y}
                stroke={hl ? RETURN_COLOR : PIPE_DIM}
                strokeWidth={hl ? 2.5 : 1.5}
              />

              <RadiatorGlyph
                x={radX} y={RAD_Y}
                highlighted={hl}
                animating={animating && hl}
                label={room.label}
                onClick={() => onEmitterClick(emitter.id)}
              />
            </g>
          );
        })}

        {/* ── Boiler ────────────────────────────────────────────────────── */}
        <g
          onClick={onBoilerClick}
          style={{ cursor: 'pointer' }}
          aria-label="Boiler — click to view details"
        >
          <rect
            x={BOILER_X} y={BOILER_Y}
            width={BOILER_W} height={BOILER_H}
            rx={6}
            fill="#f39c12"
            stroke="#d68910"
            strokeWidth={2}
            className={animating ? 'sys-diagram__boiler--active' : ''}
          />
          {/* Boiler pipe connections */}
          <line x1={BOILER_X + BOILER_W} y1={BOILER_Y + 12}
            x2={BOILER_X + BOILER_W + 8} y2={BOILER_Y + 12}
            stroke={FLOW_COLOR} strokeWidth={3} />
          <line x1={BOILER_X + BOILER_W} y1={BOILER_Y + BOILER_H - 12}
            x2={BOILER_X + BOILER_W + 8} y2={BOILER_Y + BOILER_H - 12}
            stroke={RETURN_COLOR} strokeWidth={3} />
          {/* Connect boiler ports to manifolds */}
          <line x1={BOILER_X + BOILER_W + 8} y1={BOILER_Y + 12}
            x2={BOILER_X + BOILER_W + 8} y2={FLOW_Y}
            stroke={FLOW_COLOR} strokeWidth={3} />
          <line x1={BOILER_X + BOILER_W + 8} y1={BOILER_Y + BOILER_H - 12}
            x2={BOILER_X + BOILER_W + 8} y2={RETURN_Y}
            stroke={RETURN_COLOR} strokeWidth={3} />
          {/* Label */}
          <text x={BOILER_X + BOILER_W / 2} y={BOILER_Y + 22}
            textAnchor="middle" fontSize={7} fontWeight={700} fill="#fff"
            fontFamily="system-ui, sans-serif">BOILER</text>
          <text x={BOILER_X + BOILER_W / 2} y={BOILER_Y + 34}
            textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff"
            fontFamily="system-ui, sans-serif">24 kW</text>
          <text x={BOILER_X + BOILER_W / 2} y={BOILER_Y + 46}
            textAnchor="middle" fontSize={6.5} fill="rgba(255,255,255,0.8)"
            fontFamily="system-ui, sans-serif">tap to view</text>
        </g>

        {/* ── Condensing status indicator ────────────────────────────────── */}
        <rect x={8} y={BOILER_Y + BOILER_H + 8} width={82} height={14} rx={7}
          fill="rgba(234,84,85,0.12)" stroke="rgba(234,84,85,0.3)" strokeWidth={1} />
        <text x={49} y={BOILER_Y + BOILER_H + 19}
          textAnchor="middle" fontSize={7} fill="#ea5455"
          fontFamily="system-ui, sans-serif" fontWeight={600}>
          NOT CONDENSING
        </text>
      </svg>
    </div>
  );
}
