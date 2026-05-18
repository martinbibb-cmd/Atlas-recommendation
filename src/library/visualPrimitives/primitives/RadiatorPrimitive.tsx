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

import {
  FLOW_COLOUR,
  LABEL_FONT_SIZE,
  PIPE_STROKE_BRANCH,
  PRINT_FLOW_COLOUR,
  PRINT_RETURN_COLOUR,
  RETURN_COLOUR,
  RETURN_PIPE_DASH,
  PRINT_RETURN_DASH,
  VALVE_H,
  VALVE_W,
} from '../primitiveTokens';
import type { PrimitiveSize } from './BoilerPrimitive';

export type RadiatorTemperatureTone = 'hot' | 'warm' | 'cool';
export type RadiatorConnectionLayout = 'opposite_ends_bottom' | 'same_side_bottom';

export interface RadiatorPrimitiveProps {
  temperatureTone?: RadiatorTemperatureTone;
  /** Number of fin sections to render (2–8). */
  sections?: number;
  /** Common UK bottom-connection style. */
  connectionLayout?: RadiatorConnectionLayout;
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
  connectionLayout = 'opposite_ends_bottom',
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
  const portY = bodyY + bodyH;
  const leftPortX = bodyX + 10;
  const rightPortX = bodyX + bodyW - 10;
  const flowPortX = rightPortX;
  const returnPortX = connectionLayout === 'same_side_bottom' ? rightPortX - 12 : leftPortX;

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

        {/* Bottom flow connection (TRV side) */}
        <line
          x1={flowPortX} y1={portY}
          x2={flowPortX} y2={svgH}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="radiator-flow-connection"
          data-port-position="bottom"
        />
        {/* Bottom return connection (lockshield side) */}
        <line
          x1={returnPortX} y1={portY}
          x2={returnPortX} y2={svgH}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          strokeDasharray={printSafe ? PRINT_RETURN_DASH : RETURN_PIPE_DASH}
          data-testid="radiator-return-connection"
          data-port-position="bottom"
        />

        {/* TRV body (flow side, bottom-mounted) — canonical VALVE_W × VALVE_H */}
        <rect
          x={flowPortX - VALVE_W / 2} y={portY + 1}
          width={VALVE_W} height={VALVE_H}
          rx={2}
          fill={printSafe ? '#9ca3af' : '#dc2626'}
          stroke={printSafe ? '#374151' : '#7f1d1d'}
          strokeWidth={1}
        />
        {/* Lockshield cap (return side, bottom-mounted) — 80% of canonical valve */}
        <rect
          x={returnPortX - Math.round(VALVE_W * 0.4)} y={portY + 1}
          width={Math.round(VALVE_W * 0.8)} height={Math.round(VALVE_H * 0.83)}
          rx={1.5}
          fill={printSafe ? '#d1d5db' : '#94a3b8'}
          stroke="#4b5563"
          strokeWidth={1}
        />
      </svg>

      {showLabel && (
        <span style={{ fontSize: LABEL_FONT_SIZE, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          {TONE_LABEL[temperatureTone]}
        </span>
      )}
    </div>
  );
}

export default RadiatorPrimitive;
