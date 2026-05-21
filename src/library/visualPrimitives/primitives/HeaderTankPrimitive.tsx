/**
 * HeaderTankPrimitive.tsx
 *
 * Canonical physical primitive for a feed-and-expansion header tank.
 *
 * Open-vented heating systems use this small cistern in the loft to:
 *   - provide an open vent (safety overflow) for the primary circuit,
 *   - feed cold water into the primary circuit as it expands and contracts,
 *   - maintain a gravity head above the boiler.
 *
 * Recognisable features rendered:
 *   - Rectangular open-top cistern body (distinct from a sealed vessel)
 *   - Float ball (ball-cock arm + ball) on the right — mains cold supply
 *   - Water level line inside the body
 *   - Overflow pipe stub on the left side (exits horizontally)
 *   - Feed pipe stub at the bottom-left (cold feed to primary circuit)
 *   - Vent/expansion pipe stub at the bottom-right (vent from primary circuit)
 *
 * Canonical port positions (see HEADER_TANK_PORTS):
 *   cold_feed    — bottom-left, feeds primary circuit
 *   vent_in      — bottom-right, open vent from primary circuit
 *   overflow_out — left side, horizontal overflow to outside
 */

import { AUX_COLOUR, LABEL_FONT_SIZE, PIPE_STROKE_BRANCH, PIPE_STROKE_MAIN } from '../primitiveTokens';
import type { PrimitiveSize } from './BoilerPrimitive';

export interface HeaderTankPrimitiveProps {
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

/** Canonical bounding box of the HeaderTankPrimitive SVG at md scale (viewBox units). */
export const HEADER_TANK_FOOTPRINT = { width: 120, height: 100 } as const;
const HEADER_TANK_VENT_X = HEADER_TANK_FOOTPRINT.width - 28;

/**
 * Canonical port coordinates for HeaderTankPrimitive (viewBox units, md scale).
 */
export const HEADER_TANK_PORTS = {
  cold_feed:    { x: 28,  y: 100, side: 'bottom' as const },
  vent_in:      { x: HEADER_TANK_VENT_X,  y: 100, side: 'bottom' as const },
  overflow_out: { x: 4,   y: 44,  side: 'left'   as const },
} as const;

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

// SVG authored at 120×100
// Tank body: x=10, y=16, width=90, height=52 (open top — no top rect line)
const BODY_X = 10;
const BODY_Y = 16;
const BODY_W = 90;
const BODY_H = 52;
const BODY_BOTTOM = BODY_Y + BODY_H;  // 68
const WATER_Y = BODY_Y + 16;          // 32 (water level line)

export function HeaderTankPrimitive({
  showLabel = true,
  printSafe = false,
  size = 'md',
}: HeaderTankPrimitiveProps) {
  const scale = SCALE[size];
  const waterFill = printSafe ? '#e5e7eb' : '#bfdbfe';
  const bodyStroke = '#334155';

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label="Feed-and-expansion header tank"
    >
      <svg
        width={Math.round(120 * scale)}
        height={Math.round(100 * scale)}
        viewBox="0 0 120 100"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Water fill inside tank */}
        <rect
          x={BODY_X + 2}
          y={WATER_Y}
          width={BODY_W - 4}
          height={BODY_BOTTOM - WATER_Y - 2}
          fill={waterFill}
          data-testid="header-tank-water-fill"
        />

        {/* Tank body — open top (three sides only) */}
        <path
          d={`M ${BODY_X} ${BODY_Y} L ${BODY_X} ${BODY_BOTTOM} L ${BODY_X + BODY_W} ${BODY_BOTTOM} L ${BODY_X + BODY_W} ${BODY_Y}`}
          stroke={bodyStroke}
          strokeWidth={2.5}
          fill="none"
          strokeLinejoin="round"
          data-testid="header-tank-body"
        />

        {/* Water level line */}
        <line
          x1={BODY_X + 4}
          y1={WATER_Y}
          x2={BODY_X + BODY_W - 4}
          y2={WATER_Y}
          stroke={printSafe ? '#9ca3af' : '#60a5fa'}
          strokeWidth={1.5}
          strokeDasharray={printSafe ? '5 3' : undefined}
          data-testid="header-tank-water-level"
        />

        {/* Float-ball arm — horizontal from right wall, angled down to ball */}
        <line
          x1={BODY_X + BODY_W - 4}
          y1={WATER_Y - 4}
          x2={BODY_X + BODY_W - 20}
          y2={WATER_Y + 6}
          stroke={bodyStroke}
          strokeWidth={1.5}
        />
        {/* Float ball at end of arm */}
        <circle
          cx={BODY_X + BODY_W - 22}
          cy={WATER_Y + 8}
          r={5}
          fill={printSafe ? '#d1d5db' : '#fbbf24'}
          stroke={bodyStroke}
          strokeWidth={1.5}
          data-testid="header-tank-float-ball"
        />

        {/* Overflow stub — exits left side at mid-height */}
        <line
          x1={BODY_X}
          y1={BODY_Y + 28}
          x2={4}
          y2={BODY_Y + 28}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="header-tank-overflow-port"
          data-port-position="left"
          data-port-role="header_tank_overflow_out"
        />
        {/* Overflow label cue */}
        <text
          x={5}
          y={BODY_Y + 24}
          fontSize={6}
          fontFamily="system-ui, sans-serif"
          fill={printSafe ? '#6b7280' : AUX_COLOUR}
          textAnchor="start"
        >
          OV
        </text>

        {/* Cold feed pipe stub — bottom-left, feeds primary circuit */}
        <line
          x1={28}
          y1={BODY_BOTTOM}
          x2={28}
          y2={100}
          stroke={printSafe ? '#374151' : '#334155'}
          strokeWidth={PIPE_STROKE_MAIN}
          data-testid="header-tank-cold-feed-port"
          data-port-position="bottom"
          data-port-role="header_tank_cold_feed"
        />

        {/* Vent/expansion pipe stub — bottom-right, open vent from primary circuit */}
        <line
          x1={HEADER_TANK_VENT_X}
          y1={BODY_BOTTOM}
          x2={HEADER_TANK_VENT_X}
          y2={100}
          stroke={printSafe ? '#374151' : '#334155'}
          strokeWidth={PIPE_STROKE_MAIN}
          data-testid="header-tank-vent-port"
          data-port-position="bottom"
          data-port-role="header_tank_vent_in"
        />

        {/* Port labels */}
        <text x={24} y={95} fontSize={6} fontFamily="system-ui, sans-serif" fill="#6b7280" textAnchor="middle">CF</text>
        <text x={96} y={95} fontSize={6} fontFamily="system-ui, sans-serif" fill="#6b7280" textAnchor="middle">VT</text>
      </svg>

      {showLabel && (
        <span style={{ fontSize: LABEL_FONT_SIZE, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          Header tank
        </span>
      )}
    </div>
  );
}

export default HeaderTankPrimitive;
