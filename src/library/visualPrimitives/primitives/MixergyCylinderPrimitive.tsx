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

import type { PrimitiveSize } from './BoilerPrimitive';

export interface MixergyCylinderPrimitiveProps {
  /** State of Charge 0–100 %. */
  stateOfChargePct?: number;
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

// SVG authored at 84×132
const BODY_X = 10;
const BODY_Y = 14;
const BODY_W = 60;
const BODY_H = 96;

export function MixergyCylinderPrimitive({
  stateOfChargePct = 80,
  showLabel = true,
  printSafe = false,
  size = 'md',
}: MixergyCylinderPrimitiveProps) {
  const scale = SCALE[size];
  const soc = Math.max(0, Math.min(100, stateOfChargePct));
  const hotH = (soc / 100) * BODY_H;
  const coldH = BODY_H - hotH;
  const thermoclineY = BODY_Y + hotH;

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label={`Mixergy cylinder — hot zone ${soc}% from top`}
    >
      <svg
        width={Math.round(84 * scale)}
        height={Math.round(132 * scale)}
        viewBox="0 0 84 132"
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
          stroke="#276749"
          strokeWidth={2}
        />

        {/* Hot zone — top-down */}
        {hotH > 0 && (
          <rect
            x={BODY_X + 1}
            y={BODY_Y + 1}
            width={BODY_W - 2}
            height={hotH - 1}
            rx={2}
            fill={printSafe ? '#888' : '#fca5a5'}
          />
        )}

        {/* Cold zone — lower */}
        {coldH > 0 && (
          <rect
            x={BODY_X + 1}
            y={thermoclineY}
            width={BODY_W - 2}
            height={coldH - 1}
            rx={2}
            fill={printSafe ? '#ddd' : '#bfdbfe'}
          />
        )}

        {/* Sharp thermocline boundary */}
        {hotH > 0 && hotH < BODY_H && (
          <line
            x1={BODY_X + 1}
            y1={thermoclineY}
            x2={BODY_X + BODY_W - 1}
            y2={thermoclineY}
            stroke={printSafe ? '#000' : '#dc2626'}
            strokeWidth={2}
          />
        )}

        {/* Subtle charging cue near upper shell */}
        <circle
          cx={BODY_X + 8}
          cy={BODY_Y + 10}
          r={2}
          fill={printSafe ? '#6b7280' : '#f97316'}
          opacity={0.8}
        />

        {/* Hot draw-off — top right */}
        <line
          x1={BODY_X + BODY_W} y1={BODY_Y + 20}
          x2={82} y2={BODY_Y + 20}
          stroke={printSafe ? '#000' : '#ef4444'}
          strokeWidth={2.5}
          data-testid="mixergy-hot-draw-off"
        />
        <polygon
          points={`76,${BODY_Y + 16} 82,${BODY_Y + 20} 76,${BODY_Y + 24}`}
          fill={printSafe ? '#000' : '#ef4444'}
        />

        {/* Cold mains inlet — low entry */}
        <line
          x1={0} y1={BODY_Y + BODY_H - 10}
          x2={BODY_X} y2={BODY_Y + BODY_H - 14}
          stroke={printSafe ? '#555' : '#3b82f6'}
          strokeWidth={2.5}
          data-testid="mixergy-cold-entry"
        />
        <polygon
          points={`${BODY_X - 6},${BODY_Y + BODY_H - 18} ${BODY_X},${BODY_Y + BODY_H - 14} ${BODY_X - 6},${BODY_Y + BODY_H - 10}`}
          fill={printSafe ? '#555' : '#3b82f6'}
        />
      </svg>

      {showLabel && (
        <span style={{ fontSize: 11, fontWeight: 600, color: '#276749', textAlign: 'center' }}>
          Mixergy cylinder
        </span>
      )}
    </div>
  );
}

export default MixergyCylinderPrimitive;
