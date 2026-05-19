/**
 * CylinderPrimitive.tsx
 *
 * Canonical physical primitive for a hot-water storage cylinder.
 *
 * Renders a schematic cylinder cross-section: rounded-rectangle body with
 * a hot/cold fill indicator, inlet/outlet pipe stubs, and optional PRV symbol.
 *
 * Variants:
 *   variant="vented"    — tank-fed supply, vent pipe at top
 *   variant="unvented"  — mains-fed supply with cold inlet diffuser, inlet group,
 *                         and safety discharge path via tundish
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

/** Canonical bounding box of the CylinderPrimitive SVG at md scale (viewBox units). */
export const CYLINDER_FOOTPRINT = { width: 84, height: 132 } as const;

/**
 * Canonical port coordinates for CylinderPrimitive (viewBox units, md scale).
 * Port positions are the same for both variants; visual cues differ.
 */
export const CYLINDER_PORTS = {
  hot_draw_off:     { x: 42, y: 0,   side: 'top'    as const },
  cold_inlet:       { x: 42, y: 132, side: 'bottom' as const },
  coil_flow_in:     { x: 0,  y: 87,  side: 'left'   as const },
  coil_return_out:  { x: 84, y: 100, side: 'right'  as const },
  /** Unvented only — safety discharge to tundish. */
  safety_discharge: { x: 84, y: 78,  side: 'right'  as const },
} as const;

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
const CYLINDER_FILL_UNVENTED = '#e5e7eb';
const CYLINDER_FILL_VENTED = '#d6d3d1';
const VENT_PIPE_VIEWPORT_TOP_Y = 0;

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
  const topX = CYLINDER_BODY_X + CYLINDER_BODY_W / 2;
  const topY = CYLINDER_BODY_Y;
  const bodyBottomY = CYLINDER_BODY_Y + CYLINDER_BODY_H;
  const coilFlowY = CYLINDER_BODY_Y + Math.round(CYLINDER_BODY_H * 0.7);
  const coilReturnY = CYLINDER_BODY_Y + Math.round(CYLINDER_BODY_H * 0.82);
  const coilLeftX = CYLINDER_BODY_X + 8;
  const coilRightX = CYLINDER_BODY_X + CYLINDER_BODY_W - 8;
  const hotDrawOffTeeY = topY - 4;
  const coldInletDiffuserY = bodyBottomY - 10;
  const safetySetX = CYLINDER_BODY_X + CYLINDER_BODY_W + 5;
  const safetySetY = CYLINDER_BODY_Y + 58;
  const tundishY = safetySetY + 18;

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
        {/* Vertical cylinder body */}
        <rect
          x={CYLINDER_BODY_X}
          y={CYLINDER_BODY_Y}
          width={CYLINDER_BODY_W}
          height={CYLINDER_BODY_H}
          rx={14}
          fill={printSafe ? '#f9fafb' : '#f1f5f9'}
          stroke="#334155"
          strokeWidth={2}
          data-testid="cylinder-vertical-body"
        />
        <ellipse
          cx={topX}
          cy={topY + 3}
          rx={Math.round(CYLINDER_BODY_W / 2) - 1}
          ry={6}
          fill={printSafe ? '#f3f4f6' : '#e2e8f0'}
          stroke="#94a3b8"
          strokeWidth={1}
          data-testid="cylinder-domed-top"
        />
        <ellipse
          cx={topX}
          cy={bodyBottomY - 2}
          rx={Math.round(CYLINDER_BODY_W / 2) - 1}
          ry={5}
          fill={printSafe ? '#e5e7eb' : '#cbd5e1'}
          opacity={0.55}
        />

        {/* Uniform warm fill; no stratification/thermocline. */}
        <rect
          x={CYLINDER_BODY_X + 1}
          y={CYLINDER_BODY_Y + 1}
          width={CYLINDER_BODY_W - 2}
          height={CYLINDER_BODY_H - 2}
          rx={13}
          fill={printSafe ? '#d1d5db' : variant === 'unvented' ? CYLINDER_FILL_UNVENTED : CYLINDER_FILL_VENTED}
        />
        <line
          x1={CYLINDER_BODY_X + 5}
          y1={CYLINDER_BODY_Y + 18}
          x2={CYLINDER_BODY_X + CYLINDER_BODY_W - 5}
          y2={CYLINDER_BODY_Y + 18}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
        {variant === 'unvented' && (
          <>
            <rect
              x={topX - 8}
              y={CYLINDER_BODY_Y - 6}
              width={16}
              height={6}
              rx={2}
              fill={printSafe ? '#d1d5db' : '#cbd5e1'}
              stroke="#64748b"
              strokeWidth={1}
            />
            <circle
              cx={CYLINDER_BODY_X + CYLINDER_BODY_W - 7}
              cy={CYLINDER_BODY_Y + 6}
              r={2}
              fill={printSafe ? '#374151' : '#64748b'}
            />
          </>
        )}

        {/* Internal lower heating coil — visually explicit heat-exchanger path. */}
        <path
          d={`M ${coilLeftX} ${coilFlowY}
              C ${coilLeftX + 6} ${coilFlowY - 10}, ${coilLeftX + 12} ${coilFlowY - 10}, ${coilLeftX + 16} ${coilFlowY}
              S ${coilLeftX + 27} ${coilFlowY + 10}, ${coilLeftX + 32} ${coilFlowY}
              S ${coilLeftX + 43} ${coilFlowY - 10}, ${coilLeftX + 48} ${coilFlowY}
              S ${coilRightX - 3} ${coilReturnY - 4}, ${coilRightX} ${coilReturnY}`}
          stroke={printSafe ? '#111827' : '#b45309'}
          strokeWidth={2}
          fill="none"
          data-testid="cylinder-internal-coil"
        />
        <line
          x1={topX}
          y1={hotDrawOffTeeY}
          x2={topX + 10}
          y2={hotDrawOffTeeY}
          stroke={printSafe ? '#9ca3af' : '#94a3b8'}
          strokeWidth={1.5}
        />
        <line
          x1={topX}
          y1={bodyBottomY}
          x2={topX - 9}
          y2={bodyBottomY}
          stroke={printSafe ? '#9ca3af' : '#94a3b8'}
          strokeWidth={1.5}
        />
        <path
          d={`M ${topX - 8} ${coldInletDiffuserY} L ${topX} ${bodyBottomY - 2} L ${topX + 8} ${coldInletDiffuserY}`}
          stroke={printSafe ? '#4b5563' : '#64748b'}
          strokeWidth={1.5}
          fill="none"
        />

        {/* Top DHW draw-off */}
        <line
          x1={topX}
          y1={0}
          x2={topX}
          y2={topY}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          className={animateFlow && !printSafe ? DRAW_OFF_PULSE_CLASS : undefined}
          data-testid="cylinder-hot-out-port"
          data-port-position="top"
          data-port-role="cylinder_hot_draw_off"
        />
        <polygon
          points={`${topX - 4},2 ${topX},0 ${topX + 4},2`}
          fill={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          className={animateFlow && !printSafe ? DRAW_OFF_PULSE_CLASS : undefined}
        />

        {/* Bottom mains cold inlet */}
        <line
          x1={topX}
          y1={bodyBottomY}
          x2={topX}
          y2={CYLINDER_SVG_H}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="cylinder-cold-in-port"
          data-port-position="bottom"
          data-port-role="cylinder_cold_in"
        />
        <polygon
          points={`${topX - 4},${CYLINDER_SVG_H - 2} ${topX},${CYLINDER_SVG_H} ${topX + 4},${CYLINDER_SVG_H - 2}`}
          fill={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
        />

        {/* Lower-third coil flow/return side ports */}
        <line
          x1={0}
          y1={coilFlowY}
          x2={coilLeftX}
          y2={coilFlowY}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="cylinder-coil-flow-in-port"
          data-port-position="left"
          data-port-role="cylinder_coil_flow_in"
        />
        <line
          x1={coilRightX}
          y1={coilReturnY}
          x2={CYLINDER_SVG_W}
          y2={coilReturnY}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="cylinder-coil-flow-out-port"
          data-port-position="right"
          data-port-role="cylinder_coil_flow_out"
        />
        {variant === 'vented' && (
          <path
            d={`M ${topX + 8} ${CYLINDER_BODY_Y + 2} C ${topX + 18} ${CYLINDER_BODY_Y - 6}, ${topX + 20} ${CYLINDER_BODY_Y - 16}, ${topX + 20} ${VENT_PIPE_VIEWPORT_TOP_Y}`}
            stroke={printSafe ? '#6b7280' : '#475569'}
            strokeWidth={1.8}
            fill="none"
          />
        )}
        {variant === 'unvented' && (
          <>
            <rect
              x={safetySetX}
              y={safetySetY}
              width={8}
              height={14}
              rx={2}
              fill={printSafe ? '#d1d5db' : '#f8fafc'}
              stroke="#475569"
              strokeWidth={1.2}
            />
            <path
              d={`M ${CYLINDER_BODY_X + CYLINDER_BODY_W} ${safetySetY + 3} H ${safetySetX} V ${tundishY - 4}`}
              stroke={printSafe ? '#6b7280' : '#475569'}
              strokeWidth={1.8}
              fill="none"
              data-testid="cylinder-safety-discharge-port"
              data-port-position="right"
              data-port-role="cylinder_safety_discharge"
            />
            <path
              d={`M ${safetySetX - 2} ${tundishY - 2} L ${safetySetX + 10} ${tundishY - 2} L ${safetySetX + 7} ${tundishY + 5} L ${safetySetX + 1} ${tundishY + 5} Z`}
              fill={printSafe ? '#f3f4f6' : '#e2e8f0'}
              stroke="#475569"
              strokeWidth={1}
              data-testid="cylinder-tundish"
            />
            <line
              x1={safetySetX + 4}
              y1={tundishY + 5}
              x2={CYLINDER_SVG_W - 1}
              y2={CYLINDER_SVG_H - 10}
              stroke={printSafe ? '#6b7280' : '#475569'}
              strokeWidth={1.8}
            />
          </>
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
