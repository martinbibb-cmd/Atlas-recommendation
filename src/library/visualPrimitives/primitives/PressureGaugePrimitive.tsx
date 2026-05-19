/**
 * PressureGaugePrimitive.tsx
 *
 * Canonical physical primitive for a circular analogue system pressure gauge.
 *
 * Renders: circular face, swept arc scale, a coloured normal-range sector,
 * and a needle pointing to the current pressure.
 *
 * pressureBar: current reading in bar (typically 0–4).
 * The normal operating band (1.0–1.5 bar) is always shown as a green arc.
 *
 * Source: OpenVentedToUnventedDiagram.tsx gauge elements, SystemPressureWindowDiagram.tsx
 */

import {
  GAUGE_NEEDLE_PIVOT_R,
  GAUGE_READING_FONT_SIZE,
  GAUGE_TICK_FONT_SIZE,
  LABEL_FONT_SIZE,
} from '../primitiveTokens';
import type { PrimitiveSize } from './BoilerPrimitive';

export interface PressureGaugePrimitiveProps {
  /** Current pressure reading in bar. Default 1.2 (normal). */
  pressureBar?: number;
  /** Gauge scale maximum in bar. Default 4. */
  maxBar?: number;
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

/** Canonical bounding box of the PressureGaugePrimitive SVG at md scale (viewBox units). */
export const PRESSURE_GAUGE_FOOTPRINT = { width: 80, height: 90 } as const;

/**
 * PressureGaugePrimitive has no pipe ports — it is read-only instrumentation
 * that connects via a spur off the return pipe, not inline.
 */
export const PRESSURE_GAUGE_PORTS = {} as const;

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

// SVG authored at 80×90
// Gauge occupies a circle of radius 34 centred at (40, 42)
const CX = 40;
const CY = 42;
const R = 34;
// Arc sweeps from 210° to 330° (bottom-left to bottom-right, 120° sweep)
const START_DEG = 210;
const SWEEP_DEG = 120;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function arcPoint(deg: number, radius: number): { x: number; y: number } {
  const rad = degToRad(deg);
  return {
    x: CX + radius * Math.cos(rad),
    y: CY + radius * Math.sin(rad),
  };
}

function describeArc(startDeg: number, endDeg: number, radius: number): string {
  const s = arcPoint(startDeg, radius);
  const e = arcPoint(endDeg, radius);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

/** Convert a pressure value to a gauge angle in degrees. */
function pressureToAngle(bar: number, maxBar: number): number {
  const fraction = Math.max(0, Math.min(1, bar / maxBar));
  return START_DEG + fraction * SWEEP_DEG;
}

export function PressureGaugePrimitive({
  pressureBar = 1.2,
  maxBar = 4,
  showLabel = true,
  printSafe = false,
  size = 'md',
}: PressureGaugePrimitiveProps) {
  const scale = SCALE[size];

  // Normal band: 1.0–1.5 bar
  const normalStartAngle = pressureToAngle(1.0, maxBar);
  const normalEndAngle = pressureToAngle(1.5, maxBar);
  const needleAngle = pressureToAngle(Math.min(pressureBar, maxBar), maxBar);
  const needleTip = arcPoint(needleAngle, R - 8);

  const isLow = pressureBar < 0.8;
  const isHigh = pressureBar > 2.5;
  const toneColor = isLow || isHigh
    ? (printSafe ? '#000' : '#ef4444')
    : (printSafe ? '#000' : '#16a34a');

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label={`System pressure gauge: ${pressureBar} bar${isLow ? ' — low' : isHigh ? ' — high' : ' — normal'}`}
    >
      <svg
        width={Math.round(80 * scale)}
        height={Math.round(90 * scale)}
        viewBox="0 0 80 90"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Gauge face */}
        <circle
          cx={CX} cy={CY}
          r={R}
          fill={printSafe ? '#fff' : '#f8fafc'}
          stroke="#334155"
          strokeWidth={2}
        />

        {/* Full scale arc (background) */}
        <path
          d={describeArc(START_DEG, START_DEG + SWEEP_DEG, R - 6)}
          stroke="#e2e8f0"
          strokeWidth={4}
          fill="none"
        />

        {/* Normal band arc — green sector */}
        <path
          d={describeArc(normalStartAngle, normalEndAngle, R - 6)}
          stroke={printSafe ? '#555' : '#16a34a'}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />

        {/* Needle */}
        <line
          x1={CX} y1={CY}
          x2={needleTip.x} y2={needleTip.y}
          stroke={toneColor}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Needle pivot */}
        <circle cx={CX} cy={CY} r={GAUGE_NEEDLE_PIVOT_R} fill="#334155" />

        {/* Pressure reading */}
        <text
          x={CX} y={CY + 14}
          textAnchor="middle"
          fontSize={GAUGE_READING_FONT_SIZE}
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
          fill={toneColor}
        >
          {pressureBar.toFixed(1)} bar
        </text>

        {/* Scale labels */}
        {[0, 1, 2, 3, 4].map(v => {
          if (v > maxBar) return null;
          const angle = pressureToAngle(v, maxBar);
          const pt = arcPoint(angle, R + 6);
          return (
            <text
              key={v}
              x={pt.x}
              y={pt.y + 3}
              textAnchor="middle"
              fontSize={GAUGE_TICK_FONT_SIZE}
              fontFamily="system-ui, sans-serif"
              fill="#64748b"
            >
              {v}
            </text>
          );
        })}
      </svg>

      {showLabel && (
        <span style={{ fontSize: LABEL_FONT_SIZE, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          System pressure
        </span>
      )}
    </div>
  );
}

export default PressureGaugePrimitive;
