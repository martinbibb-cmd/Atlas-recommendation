/**
 * PumpPrimitive.tsx
 *
 * Canonical physical primitive for a heating circuit circulation pump.
 *
 * Renders the standard P&ID / schematic convention:
 *   - A circle (pump casing)
 *   - An impeller cross or arrow inside
 *   - Inlet pipe stub on the left
 *   - Outlet pipe stub on the right
 *
 * Source: OpenVentedToUnventedDiagram.tsx (pump circle element)
 *
 * Recognisability note:
 *   The circle-with-impeller is recognisable to installers and engineers.
 *   For homeowner audiences, always show this inside a pipe loop with
 *   directional arrows so context is clear.
 */

import {
  FLOW_COLOUR,
  LABEL_FONT_SIZE,
  PIPE_STROKE_MAIN,
  PRINT_FLOW_COLOUR,
} from '../primitiveTokens';
import type { PrimitiveSize } from './BoilerPrimitive';

export interface PumpPrimitiveProps {
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

export function PumpPrimitive({
  showLabel = true,
  printSafe = false,
  size = 'md',
}: PumpPrimitiveProps) {
  const scale = SCALE[size];
  const cy = 34;

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label="Circulation pump"
    >
      <svg
        width={Math.round(130 * scale)}
        height={Math.round(72 * scale)}
        viewBox="0 0 130 72"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Inlet pipe */}
        <line
          x1={4}
          y1={cy}
          x2={34}
          y2={cy}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
          data-testid="pump-inlet-pipe"
          data-port-position="left"
          data-port-role="pump_primary_flow_in"
        />
        {/* Outlet pipe */}
        <line
          x1={96}
          y1={cy}
          x2={126}
          y2={cy}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
          data-testid="pump-outlet-pipe"
          data-port-position="right"
          data-port-role="pump_primary_flow_out"
        />

        {/* Inline unions/flanges */}
        <rect x={34} y={28} width={10} height={12} rx={2} fill={printSafe ? '#9ca3af' : '#94a3b8'} data-testid="pump-inline-flange-left" />
        <rect x={86} y={28} width={10} height={12} rx={2} fill={printSafe ? '#9ca3af' : '#94a3b8'} data-testid="pump-inline-flange-right" />

        {/* Circulator housing */}
        <circle
          cx={65}
          cy={34}
          r={24}
          fill={printSafe ? '#f3f4f6' : '#e0f2fe'}
          stroke="#334155"
          strokeWidth={2}
          data-testid="pump-circulator-body"
        />
        <circle cx={65} cy={34} r={12} fill={printSafe ? '#e5e7eb' : '#bfdbfe'} stroke="#475569" strokeWidth={1.5} />
        <rect x={61} y={20} width={8} height={7} rx={2} fill={printSafe ? '#6b7280' : '#334155'} />
        <path
          d="M 74 31 A 9 9 0 0 0 56 31"
          stroke="#334155"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
        <polygon points="73,26 78,31 70,30" fill="#334155" />
      </svg>

      {showLabel && (
        <span style={{ fontSize: LABEL_FONT_SIZE, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          Circulation pump
        </span>
      )}
    </div>
  );
}

export default PumpPrimitive;
