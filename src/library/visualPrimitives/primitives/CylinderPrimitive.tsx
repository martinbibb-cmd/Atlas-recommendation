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

export function CylinderPrimitive({
  variant = 'unvented',
  fillLevel = 0.75,
  showLabel = true,
  printSafe = false,
  size = 'md',
  animateFlow = false,
}: CylinderPrimitiveProps) {
  const scale = SCALE[size];
  const clampedFill = Math.max(0, Math.min(1, fillLevel));
  const hotH = clampedFill * CYLINDER_BODY_H;
  const coldH = CYLINDER_BODY_H - hotH;

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label={`${VARIANT_LABELS[variant]}, ${Math.round(clampedFill * 100)}% charged`}
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

        {/* Cold zone (lower portion) */}
        {coldH > 0 && (
          <rect
            x={CYLINDER_BODY_X + 1}
            y={CYLINDER_BODY_Y + hotH + 1}
            width={CYLINDER_BODY_W - 2}
            height={coldH - 2}
            rx={2}
            fill={printSafe ? '#ddd' : '#bfdbfe'}
          />
        )}

        {/* Hot zone (upper portion) */}
        {hotH > 0 && (
          <rect
            x={CYLINDER_BODY_X + 1}
            y={CYLINDER_BODY_Y + 1}
            width={CYLINDER_BODY_W - 2}
            height={hotH - 2}
            rx={2}
            fill={printSafe ? '#888' : '#fca5a5'}
          />
        )}

        {/* Fill level percentage */}
        <text
          x={CYLINDER_BODY_X + CYLINDER_BODY_W / 2}
          y={CYLINDER_BODY_Y + CYLINDER_BODY_H / 2 + 4}
          textAnchor="middle"
          fontSize={10}
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
          fill={printSafe ? '#000' : '#7f1d1d'}
        >
          {Math.round(clampedFill * 100)}%
        </text>

        {/* Vent pipe — only on vented variant */}
        {variant === 'vented' && (
          <>
            <line
              x1={42} y1={CYLINDER_BODY_Y}
              x2={42} y2={4}
              stroke="#334155" strokeWidth={2}
            />
            <circle cx={42} cy={3} r={2} fill="#334155" />
          </>
        )}

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

        {/* Mains/cold inlet arrow (bottom-left) */}
        <line
          x1={0} y1={CYLINDER_BODY_Y + CYLINDER_BODY_H - 16}
          x2={CYLINDER_BODY_X} y2={CYLINDER_BODY_Y + CYLINDER_BODY_H - 16}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
        />
        <polygon
          points={`${CYLINDER_BODY_X - 6},${CYLINDER_BODY_Y + CYLINDER_BODY_H - 20} ${CYLINDER_BODY_X},${CYLINDER_BODY_Y + CYLINDER_BODY_H - 16} ${CYLINDER_BODY_X - 6},${CYLINDER_BODY_Y + CYLINDER_BODY_H - 12}`}
          fill={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
        />

        {/* Hot draw-off arrow (top-right) */}
        <line
          x1={CYLINDER_BODY_X + CYLINDER_BODY_W} y1={CYLINDER_BODY_Y + 18}
          x2={CYLINDER_SVG_W} y2={CYLINDER_BODY_Y + 18}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          className={animateFlow && !printSafe ? DRAW_OFF_PULSE_CLASS : undefined}
        />
        <polygon
          points={`${CYLINDER_SVG_W - 6},${CYLINDER_BODY_Y + 14} ${CYLINDER_SVG_W},${CYLINDER_BODY_Y + 18} ${CYLINDER_SVG_W - 6},${CYLINDER_BODY_Y + 22}`}
          fill={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          className={animateFlow && !printSafe ? DRAW_OFF_PULSE_CLASS : undefined}
        />
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
