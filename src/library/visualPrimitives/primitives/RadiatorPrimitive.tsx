/**
 * RadiatorPrimitive.tsx
 *
 * Canonical physical primitive for a panel radiator.
 *
 * Renders a rectangular panel body with vertical fin lines indicating
 * individual sections, and optional temperature tone fill.
 *
 * temperatureTone:
 *   'hot'   — boiler-fed, 60–80 °C surface
 *   'warm'  — heat-pump-fed or low-temperature, 35–50 °C surface
 *   'cool'  — off or radiating negligible heat
 */

import type { PrimitiveSize } from './BoilerPrimitive';

export type RadiatorTemperatureTone = 'hot' | 'warm' | 'cool';

export interface RadiatorPrimitiveProps {
  temperatureTone?: RadiatorTemperatureTone;
  /** Number of fin sections to render (2–8). */
  sections?: number;
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

const TONE_FILL: Record<RadiatorTemperatureTone, string> = {
  hot: '#fca5a5',
  warm: '#fed7aa',
  cool: '#e2e8f0',
};

const TONE_STROKE: Record<RadiatorTemperatureTone, string> = {
  hot: '#ef4444',
  warm: '#f97316',
  cool: '#94a3b8',
};

const TONE_LABEL: Record<RadiatorTemperatureTone, string> = {
  hot: 'Hot radiator (60–80 °C)',
  warm: 'Warm radiator (35–50 °C)',
  cool: 'Radiator off',
};

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

export function RadiatorPrimitive({
  temperatureTone = 'warm',
  sections = 5,
  showLabel = true,
  printSafe = false,
  size = 'md',
}: RadiatorPrimitiveProps) {
  const scale = SCALE[size];
  const clampedSections = Math.max(2, Math.min(8, sections));

  // SVG authored at 120×60
  const svgW = 120;
  const svgH = 60;
  const bodyX = 4;
  const bodyY = 4;
  const bodyW = 112;
  const bodyH = 44;
  const finStep = bodyW / clampedSections;

  const fill = printSafe
    ? temperatureTone === 'hot'
      ? '#ccc'
      : temperatureTone === 'warm'
        ? '#eee'
        : '#f9f9f9'
    : TONE_FILL[temperatureTone];

  const stroke = TONE_STROKE[temperatureTone];

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label={TONE_LABEL[temperatureTone]}
    >
      <svg
        width={Math.round(svgW * scale)}
        height={Math.round(svgH * scale)}
        viewBox={`0 0 ${svgW} ${svgH}`}
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Panel body */}
        <rect
          x={bodyX} y={bodyY}
          width={bodyW} height={bodyH}
          rx={4}
          fill={fill}
          stroke={stroke}
          strokeWidth={2}
        />

        {/* Fin dividers */}
        {Array.from({ length: clampedSections - 1 }).map((_, i) => {
          const x = bodyX + finStep * (i + 1);
          return (
            <line
              key={i}
              x1={x} y1={bodyY + 4}
              x2={x} y2={bodyY + bodyH - 4}
              stroke={printSafe ? '#999' : stroke}
              strokeWidth={1}
              opacity={0.4}
            />
          );
        })}

        {/* Flow pipe (top) */}
        <line
          x1={30} y1={bodyY}
          x2={30} y2={0}
          stroke={printSafe ? '#000' : '#ef4444'}
          strokeWidth={2.5}
        />
        {/* Return pipe (bottom) */}
        <line
          x1={30} y1={bodyY + bodyH}
          x2={30} y2={svgH}
          stroke={printSafe ? '#555' : '#3b82f6'}
          strokeWidth={2.5}
          strokeDasharray={printSafe ? '4 2' : undefined}
        />

        {/* TRV knob stub (top-right) */}
        <rect
          x={bodyX + bodyW - 20} y={bodyY - 8}
          width={16} height={8}
          rx={2}
          fill="#6b7280"
          stroke="#4b5563"
          strokeWidth={1}
        />
      </svg>

      {showLabel && (
        <span style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          {TONE_LABEL[temperatureTone]}
        </span>
      )}
    </div>
  );
}

export default RadiatorPrimitive;
