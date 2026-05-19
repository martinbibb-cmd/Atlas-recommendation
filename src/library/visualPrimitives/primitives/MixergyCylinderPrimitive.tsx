/**
 * MixergyCylinderPrimitive.tsx
 *
 * Canonical physical primitive for the Mixergy smart stratified cylinder.
 *
 * Key visual differentiators from a standard cylinder:
 *   1. Top-down charging — the hot zone expands downward from the top.
 *   2. Sharp thermocline boundary between the hot and cold zones.
 *   3. Top draw-off arrow leaving at the top-right (hottest water first).
 *   4. Diffuser at the cold inlet (bottom) to protect stratification.
 *
 * stateOfChargePct (0–100) controls the depth of the hot zone.
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
import type { PrimitiveSize } from './BoilerPrimitive';

export interface MixergyCylinderPrimitiveProps {
  /** State of Charge 0–100 %. */
  stateOfChargePct?: number;
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

// Uses CYLINDER_SVG_W / CYLINDER_SVG_H / CYLINDER_BODY_* from primitiveTokens
// so CylinderPrimitive and MixergyCylinderPrimitive are pixel-aligned in topologies.

export function MixergyCylinderPrimitive({
  stateOfChargePct = 80,
  showLabel = true,
  printSafe = false,
  size = 'md',
}: MixergyCylinderPrimitiveProps) {
  const scale = SCALE[size];
  const soc = Math.max(0, Math.min(100, stateOfChargePct));
  const hotH = (soc / 100) * CYLINDER_BODY_H;
  const coldH = CYLINDER_BODY_H - hotH;
  const thermoclineY = CYLINDER_BODY_Y + hotH;
  const coldInY = CYLINDER_BODY_Y + CYLINDER_BODY_H - 14;
  const hotOutY = CYLINDER_BODY_Y + 20;
  const topCoilInY = CYLINDER_BODY_Y + 26;
  const topCoilOutY = CYLINDER_BODY_Y + 38;
  const topCoilLeftX = CYLINDER_BODY_X + 14;
  const topCoilRightX = CYLINDER_BODY_X + CYLINDER_BODY_W - 12;

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label={`Mixergy cylinder — hot zone ${soc}% from top`}
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
          stroke="#276749"
          strokeWidth={2}
        />

        {/* Hot zone — top-down */}
        {hotH > 0 && (
          <rect
            x={CYLINDER_BODY_X + 1}
            y={CYLINDER_BODY_Y + 1}
            width={CYLINDER_BODY_W - 2}
            height={hotH - 1}
            rx={2}
            fill={printSafe ? '#888' : '#fca5a5'}
            data-testid="mixergy-stratification-hot-zone"
          />
        )}

        {/* Cold zone — lower */}
        {coldH > 0 && (
          <rect
            x={CYLINDER_BODY_X + 1}
            y={thermoclineY}
            width={CYLINDER_BODY_W - 2}
            height={coldH - 1}
            rx={2}
            fill={printSafe ? '#ddd' : '#bfdbfe'}
            data-testid="mixergy-stratification-cold-zone"
          />
        )}

        {/* Sharp thermocline boundary */}
        {hotH > 0 && hotH < CYLINDER_BODY_H && (
          <line
            x1={CYLINDER_BODY_X + 1}
            y1={thermoclineY}
            x2={CYLINDER_BODY_X + CYLINDER_BODY_W - 1}
            y2={thermoclineY}
            stroke={printSafe ? '#000' : '#dc2626'}
            strokeWidth={2}
            data-testid="mixergy-thermocline"
          />
        )}

        {/* Subtle upper-side charging point cue for Mixergy top-charge behaviour */}
        <circle
          cx={CYLINDER_BODY_X + 8}
          cy={CYLINDER_BODY_Y + 10}
          r={2}
          fill={printSafe ? '#6b7280' : '#f97316'}
          opacity={0.8}
        />

        {/* Hot draw-off — top right */}
        <line
          x1={CYLINDER_BODY_X + CYLINDER_BODY_W} y1={hotOutY}
          x2={CYLINDER_SVG_W - 2} y2={hotOutY}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="mixergy-hot-draw-off"
          data-port-position="right"
          data-port-role="mixergy_hot_draw_off"
        />
        <polygon
          points={`${CYLINDER_SVG_W - 8},${hotOutY - 4} ${CYLINDER_SVG_W - 2},${hotOutY} ${CYLINDER_SVG_W - 8},${hotOutY + 4}`}
          fill={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
        />

        {/* Cold mains inlet — low entry */}
        <line
          x1={0} y1={coldInY}
          x2={CYLINDER_BODY_X} y2={coldInY}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="mixergy-cold-entry"
          data-port-position="left"
          data-port-role="mixergy_cold_in"
        />
        <polygon
          points={`${CYLINDER_BODY_X - 6},${coldInY - 4} ${CYLINDER_BODY_X},${coldInY} ${CYLINDER_BODY_X - 6},${coldInY + 4}`}
          fill={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
        />

        {/* Top-heating coil in upper section (Mixergy top-charge signature). */}
        <path
          d={`M ${topCoilLeftX} ${topCoilInY}
              C ${topCoilLeftX + 8} ${topCoilInY - 6}, ${topCoilLeftX + 12} ${topCoilInY + 8}, ${topCoilLeftX + 20} ${topCoilInY + 2}
              C ${topCoilLeftX + 28} ${topCoilInY - 4}, ${topCoilLeftX + 30} ${topCoilOutY - 4}, ${topCoilLeftX + 38} ${topCoilOutY}
              C ${topCoilLeftX + 46} ${topCoilOutY + 4}, ${topCoilRightX - 2} ${topCoilOutY - 4}, ${topCoilRightX} ${topCoilOutY}`}
          stroke={printSafe ? '#111827' : '#b45309'}
          strokeWidth={2}
          fill="none"
          data-testid="mixergy-top-coil"
        />
        <line
          x1={0}
          y1={topCoilInY}
          x2={topCoilLeftX}
          y2={topCoilInY}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="mixergy-coil-flow-in-port"
          data-port-position="left"
          data-port-role="mixergy_coil_flow_in"
        />
        <line
          x1={topCoilRightX}
          y1={topCoilOutY}
          x2={CYLINDER_SVG_W}
          y2={topCoilOutY}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="mixergy-coil-flow-out-port"
          data-port-position="right"
          data-port-role="mixergy_coil_flow_out"
        />
        <polygon
          points={`5,${topCoilInY - 5} 10,${topCoilInY} 5,${topCoilInY + 5} 0,${topCoilInY}`}
          fill={printSafe ? '#111827' : AUX_COLOUR}
          data-testid="mixergy-control-valve"
        />
      </svg>

      {showLabel && (
        <span style={{ fontSize: LABEL_FONT_SIZE, fontWeight: 600, color: '#276749', textAlign: 'center' }}>
          Mixergy cylinder
        </span>
      )}
    </div>
  );
}

export default MixergyCylinderPrimitive;
