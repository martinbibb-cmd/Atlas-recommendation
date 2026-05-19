/**
 * CylinderPrimitive.tsx
 *
 * Canonical physical primitive for a hot-water storage cylinder.
 *
 * Renders a schematic cylinder cross-section: rounded-rectangle body with
 * a hot/cold fill indicator, inlet/outlet pipe stubs, and optional PRV symbol.
 *
 * Variants:
 *   variant="vented"    — tank-fed, low pressure, vent pipe at top
 *   variant="unvented"  — mains-pressure, PRV at top, expansion vessel stub
 *
 * fillLevel (0–1) controls how much of the body is shown as heated.
 */

import {
  AUX_COLOUR,
  CYLINDER_BODY_H,
  CYLINDER_BODY_W,
  CYLINDER_BODY_X,
  CYLINDER_BODY_Y,
  CYLINDER_SVG_H,
  CYLINDER_SVG_W,
  FLOW_COLOUR,
  LABEL_FONT_SIZE,
  PIPE_STROKE_BRANCH,
  PRINT_FLOW_COLOUR,
  PRINT_RETURN_COLOUR,
  RETURN_COLOUR,
} from '../primitiveTokens';
import { DRAW_OFF_PULSE_CLASS } from '../primitiveMotion';
import type { PrimitiveSize } from './BoilerPrimitive';

export type CylinderVariant = 'vented' | 'unvented';

export interface CylinderPrimitiveProps {
  variant?: CylinderVariant;
  /** 0–1 fraction of cylinder that is at hot temperature. */
  fillLevel?: number;
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
  /** When true, animates the hot draw-off arrow on mount. Defaults to false. */
  animateFlow?: boolean;
}

const VARIANT_LABELS: Record<CylinderVariant, string> = {
  vented: 'Vented cylinder',
  unvented: 'Unvented cylinder',
};

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };
const CYLINDER_FILL_UNVENTED = '#fed7aa';
const CYLINDER_FILL_VENTED = '#fdba74';
const CYLINDER_CHARGE_TEXT_COLOUR = '#7c2d12';

export function CylinderPrimitive({
  variant = 'unvented',
  fillLevel = 0.75,
  showLabel = true,
  printSafe = false,
  size = 'md',
  animateFlow = false,
}: CylinderPrimitiveProps) {
  const scale = SCALE[size];
  const chargePct = Math.round(Math.max(0, Math.min(1, fillLevel)) * 100);
  const coldInY = CYLINDER_BODY_Y + CYLINDER_BODY_H - 12;
  const hotOutY = CYLINDER_BODY_Y + 14;
  const coilInY = CYLINDER_BODY_Y + Math.round(CYLINDER_BODY_H * 0.68);
  const coilOutY = CYLINDER_BODY_Y + Math.round(CYLINDER_BODY_H * 0.84);
  const coilLeftX = CYLINDER_BODY_X + 15;
  const coilRightX = CYLINDER_BODY_X + CYLINDER_BODY_W - 15;

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label={`${VARIANT_LABELS[variant]}, ${chargePct}% charged`}
    >
      <svg
        width={Math.round(CYLINDER_SVG_W * scale)}
        height={Math.round(CYLINDER_SVG_H * scale)}
        viewBox={`0 0 ${CYLINDER_SVG_W} ${CYLINDER_SVG_H}`}
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Body outline */}
        <rect
          x={CYLINDER_BODY_X} y={CYLINDER_BODY_Y}
          width={CYLINDER_BODY_W} height={CYLINDER_BODY_H}
          rx={14}
          fill="#e2e8f0"
          stroke="#334155"
          strokeWidth={2}
        />

        {/* Standard cylinders render as evenly heated storage with no blue-bottom stratification. */}
        <rect
          x={CYLINDER_BODY_X + 1}
          y={CYLINDER_BODY_Y + 1}
          width={CYLINDER_BODY_W - 2}
          height={CYLINDER_BODY_H - 2}
          rx={13}
          fill={printSafe ? '#d1d5db' : (variant === 'unvented' ? CYLINDER_FILL_UNVENTED : CYLINDER_FILL_VENTED)}
        />
        <text
          x={CYLINDER_BODY_X + CYLINDER_BODY_W / 2}
          y={CYLINDER_BODY_Y + CYLINDER_BODY_H / 2 + 4}
          textAnchor="middle"
          fontSize={9}
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
          fill={printSafe ? '#111827' : CYLINDER_CHARGE_TEXT_COLOUR}
        >
          {chargePct}%
        </text>

        {/* PRV symbol — only on unvented variant */}
        {variant === 'unvented' && (
          <>
            <rect
              x={56} y={CYLINDER_BODY_Y - 10}
              width={12} height={8}
              rx={2}
              fill="#374151" stroke="#1f2937" strokeWidth={1}
            />
            <line x1={62} y1={CYLINDER_BODY_Y - 10} x2={62} y2={CYLINDER_BODY_Y - 2} stroke="#374151" strokeWidth={1.5} />
            <text
              x={70} y={CYLINDER_BODY_Y - 3}
              fontSize={5}
              fontFamily="system-ui"
              fill="#6b7280"
            >PRV</text>
          </>
        )}

        {/* Internal heating coil — tight coil in lower third (flow in / flow out). */}
        <path
          d={`M ${coilLeftX} ${coilInY}
              C ${coilLeftX + 8} ${coilInY - 6}, ${coilLeftX + 12} ${coilInY + 8}, ${coilLeftX + 20} ${coilInY + 2}
              C ${coilLeftX + 28} ${coilInY - 4}, ${coilLeftX + 30} ${coilOutY - 4}, ${coilLeftX + 38} ${coilOutY}
              C ${coilLeftX + 46} ${coilOutY + 4}, ${coilRightX - 2} ${coilOutY - 4}, ${coilRightX} ${coilOutY}`}
          stroke={printSafe ? '#111827' : '#b45309'}
          strokeWidth={2}
          fill="none"
          data-testid="cylinder-internal-coil"
        />

        {/* Cold inlet (bottom) */}
        <line
          x1={0} y1={coldInY}
          x2={CYLINDER_BODY_X} y2={coldInY}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="cylinder-cold-in-port"
          data-port-position="left"
          data-port-role="cylinder_cold_in"
        />
        <polygon
          points={`${CYLINDER_BODY_X - 6},${coldInY - 4} ${CYLINDER_BODY_X},${coldInY} ${CYLINDER_BODY_X - 6},${coldInY + 4}`}
          fill={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
        />

        {/* Hot draw-off (top) */}
        <line
          x1={CYLINDER_BODY_X + CYLINDER_BODY_W} y1={hotOutY}
          x2={CYLINDER_SVG_W} y2={hotOutY}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          className={animateFlow && !printSafe ? DRAW_OFF_PULSE_CLASS : undefined}
          data-testid="cylinder-hot-out-port"
          data-port-position="right"
          data-port-role="cylinder_hot_draw_off"
        />
        <polygon
          points={`${CYLINDER_SVG_W - 6},${hotOutY - 4} ${CYLINDER_SVG_W},${hotOutY} ${CYLINDER_SVG_W - 6},${hotOutY + 4}`}
          fill={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          className={animateFlow && !printSafe ? DRAW_OFF_PULSE_CLASS : undefined}
        />

        {/* Coil flow-in / flow-out ports */}
        <line
          x1={0} y1={coilInY}
          x2={coilLeftX} y2={coilInY}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="cylinder-coil-flow-in-port"
          data-port-position="left"
          data-port-role="cylinder_coil_flow_in"
        />
        <line
          x1={coilRightX} y1={coilOutY}
          x2={CYLINDER_SVG_W} y2={coilOutY}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="cylinder-coil-flow-out-port"
          data-port-position="right"
          data-port-role="cylinder_coil_flow_out"
        />

        {/* Control-valve cue before cylinder coil (unvented shown as 2-port valve). */}
        <polygon
          points={`5,${coilInY - 5} 10,${coilInY} 5,${coilInY + 5} 0,${coilInY}`}
          fill={printSafe ? '#111827' : AUX_COLOUR}
          data-testid="cylinder-control-valve"
        />
        {variant === 'unvented' && (
          <text x={12} y={coilInY - 7} fontSize={7} fontFamily="system-ui" fill={printSafe ? '#111827' : '#334155'}>
            2-port
          </text>
        )}
      </svg>

      {showLabel && (
        <span style={{ fontSize: LABEL_FONT_SIZE, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          {VARIANT_LABELS[variant]}
        </span>
      )}
    </div>
  );
}

export default CylinderPrimitive;
