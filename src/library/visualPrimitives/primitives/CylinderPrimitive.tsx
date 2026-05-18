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

import type { PrimitiveSize } from './BoilerPrimitive';

export type CylinderVariant = 'vented' | 'unvented';

export interface CylinderPrimitiveProps {
  variant?: CylinderVariant;
  /** 0–1 fraction of cylinder that is at hot temperature. */
  fillLevel?: number;
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

const VARIANT_LABELS: Record<CylinderVariant, string> = {
  vented: 'Vented cylinder',
  unvented: 'Unvented cylinder',
};

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

// SVG authored at 80×130
const SVG_W = 80;
const SVG_H = 130;
const BODY_X = 10;
const BODY_Y = 12;
const BODY_W = 60;
const BODY_H = 96;

export function CylinderPrimitive({
  variant = 'unvented',
  fillLevel = 0.75,
  showLabel = true,
  printSafe = false,
  size = 'md',
}: CylinderPrimitiveProps) {
  const scale = SCALE[size];
  const clampedFill = Math.max(0, Math.min(1, fillLevel));
  const hotH = clampedFill * BODY_H;
  const coldH = BODY_H - hotH;

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label={`${VARIANT_LABELS[variant]}, ${Math.round(clampedFill * 100)}% charged`}
    >
      <svg
        width={Math.round(SVG_W * scale)}
        height={Math.round(SVG_H * scale)}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Body outline */}
        <rect
          x={BODY_X} y={BODY_Y}
          width={BODY_W} height={BODY_H}
          rx={14}
          fill="#e2e8f0"
          stroke="#334155"
          strokeWidth={2}
        />

        {/* Cold zone (lower portion) */}
        {coldH > 0 && (
          <rect
            x={BODY_X + 1}
            y={BODY_Y + hotH + 1}
            width={BODY_W - 2}
            height={coldH - 2}
            rx={2}
            fill={printSafe ? '#ddd' : '#bfdbfe'}
          />
        )}

        {/* Hot zone (upper portion) */}
        {hotH > 0 && (
          <rect
            x={BODY_X + 1}
            y={BODY_Y + 1}
            width={BODY_W - 2}
            height={hotH - 2}
            rx={2}
            fill={printSafe ? '#888' : '#fca5a5'}
          />
        )}

        {/* Fill level percentage */}
        <text
          x={BODY_X + BODY_W / 2}
          y={BODY_Y + BODY_H / 2 + 4}
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
              x1={40} y1={BODY_Y}
              x2={40} y2={4}
              stroke="#334155" strokeWidth={2}
            />
            <circle cx={40} cy={3} r={2} fill="#334155" />
          </>
        )}

        {/* PRV symbol — only on unvented variant */}
        {variant === 'unvented' && (
          <>
            <rect
              x={54} y={BODY_Y - 10}
              width={12} height={8}
              rx={2}
              fill="#374151" stroke="#1f2937" strokeWidth={1}
            />
            <line x1={60} y1={BODY_Y - 10} x2={60} y2={BODY_Y - 2} stroke="#374151" strokeWidth={1.5} />
            <text
              x={68} y={BODY_Y - 3}
              fontSize={5}
              fontFamily="system-ui"
              fill="#6b7280"
            >PRV</text>
          </>
        )}

        {/* Mains/cold inlet arrow (bottom-left) */}
        <line
          x1={0} y1={BODY_Y + BODY_H - 16}
          x2={BODY_X} y2={BODY_Y + BODY_H - 16}
          stroke={printSafe ? '#555' : '#3b82f6'}
          strokeWidth={2.5}
        />
        <polygon
          points={`${BODY_X - 6},${BODY_Y + BODY_H - 20} ${BODY_X},${BODY_Y + BODY_H - 16} ${BODY_X - 6},${BODY_Y + BODY_H - 12}`}
          fill={printSafe ? '#555' : '#3b82f6'}
        />

        {/* Hot draw-off arrow (top-right) */}
        <line
          x1={BODY_X + BODY_W} y1={BODY_Y + 18}
          x2={SVG_W} y2={BODY_Y + 18}
          stroke={printSafe ? '#000' : '#ef4444'}
          strokeWidth={2.5}
        />
        <polygon
          points={`${SVG_W - 6},${BODY_Y + 14} ${SVG_W},${BODY_Y + 18} ${SVG_W - 6},${BODY_Y + 22}`}
          fill={printSafe ? '#000' : '#ef4444'}
        />
      </svg>

      {showLabel && (
        <span style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          {VARIANT_LABELS[variant]}
        </span>
      )}
    </div>
  );
}

export default CylinderPrimitive;
