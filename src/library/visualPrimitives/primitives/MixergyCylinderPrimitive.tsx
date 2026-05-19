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
const MIXERGY_DIFFUSER_HALF_WIDTH = 7;
const MIXERGY_DIFFUSER_TOP_OFFSET = 5;
const MIXERGY_DIFFUSER_CONTROL_X_OFFSET = 2;
const MIXERGY_DIFFUSER_CONTROL_Y_OFFSET = 1;

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
  const topX = CYLINDER_BODY_X + CYLINDER_BODY_W / 2;
  const bodyBottomY = CYLINDER_BODY_Y + CYLINDER_BODY_H;
  const coldInY = bodyBottomY - 6;
  const hotOutY = CYLINDER_BODY_Y + 8;

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
        {/* Smart-cylinder body */}
        <rect
          x={CYLINDER_BODY_X} y={CYLINDER_BODY_Y}
          width={CYLINDER_BODY_W} height={CYLINDER_BODY_H}
          rx={14}
          fill="#e2e8f0"
          stroke="#276749"
          strokeWidth={2}
          data-testid="mixergy-smart-body"
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

        {/* Top-heating cue */}
        <rect
          x={topX - 8}
          y={CYLINDER_BODY_Y - 4}
          width={16}
          height={8}
          rx={3}
          fill={printSafe ? '#6b7280' : '#f97316'}
          data-testid="mixergy-top-heating-cue"
        />

        {/* Hot draw-off — top right */}
        <line
          x1={topX}
          y1={0}
          x2={topX}
          y2={hotOutY}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="mixergy-hot-draw-off"
          data-port-position="top"
          data-port-role="mixergy_hot_draw_off"
        />
        <polygon
          points={`${topX - 4},2 ${topX},0 ${topX + 4},2`}
          fill={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
        />

        {/* Cold mains inlet with diffuser */}
        <line
          x1={topX}
          y1={coldInY}
          x2={topX}
          y2={CYLINDER_SVG_H}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="mixergy-cold-entry"
          data-port-position="bottom"
          data-port-role="mixergy_cold_in"
        />
        <polygon
          points={`${topX - 4},${CYLINDER_SVG_H - 2} ${topX},${CYLINDER_SVG_H} ${topX + 4},${CYLINDER_SVG_H - 2}`}
          fill={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
        />
        <path
          d={`M ${topX - MIXERGY_DIFFUSER_HALF_WIDTH} ${bodyBottomY - MIXERGY_DIFFUSER_TOP_OFFSET} C ${topX - MIXERGY_DIFFUSER_CONTROL_X_OFFSET} ${bodyBottomY - MIXERGY_DIFFUSER_CONTROL_Y_OFFSET}, ${topX + MIXERGY_DIFFUSER_CONTROL_X_OFFSET} ${bodyBottomY - MIXERGY_DIFFUSER_CONTROL_Y_OFFSET}, ${topX + MIXERGY_DIFFUSER_HALF_WIDTH} ${bodyBottomY - MIXERGY_DIFFUSER_TOP_OFFSET}`}
          stroke={printSafe ? '#111827' : '#0ea5e9'}
          strokeWidth={2}
          fill="none"
          data-testid="mixergy-bottom-diffuser"
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
