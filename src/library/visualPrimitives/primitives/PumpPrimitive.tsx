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
  PRINT_RETURN_COLOUR,
  RETURN_COLOUR,
  RETURN_PIPE_DASH,
  PRINT_RETURN_DASH,
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
  // SVG authored at 100×60
  const cx = 50;
  const cy = 30;
  const r = 20;

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label="Circulation pump"
    >
      <svg
        width={Math.round(100 * scale)}
        height={Math.round(60 * scale)}
        viewBox="0 0 100 60"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Inlet pipe */}
        <line
          x1={4} y1={cy}
          x2={cx - r} y2={cy}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
          strokeDasharray={printSafe ? PRINT_RETURN_DASH : RETURN_PIPE_DASH}
          data-testid="pump-inlet-pipe"
          data-port-position="left"
        />
        {/* Outlet pipe */}
        <line
          x1={cx + r} y1={cy}
          x2={96} y2={cy}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
          data-testid="pump-outlet-pipe"
          data-port-position="right"
        />

        {/* Pump body circle */}
        <circle
          cx={cx} cy={cy}
          r={r}
          fill={printSafe ? '#f3f4f6' : '#e0f2fe'}
          stroke="#334155"
          strokeWidth={2}
        />

        {/* Impeller — arrow inside */}
        {/* Blades as crossed lines */}
        <line
          x1={cx - 11} y1={cy}
          x2={cx + 11} y2={cy}
          stroke="#334155"
          strokeWidth={1.5}
        />
        <line
          x1={cx} y1={cy - 11}
          x2={cx} y2={cy + 11}
          stroke="#334155"
          strokeWidth={1.5}
        />
        {/* Rotation direction hint arrow */}
        <path
          d={`M ${cx + 12} ${cy - 8} A 14 14 0 0 0 ${cx - 12} ${cy - 8}`}
          stroke="#334155"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
        <polygon
          points={`${cx + 10},${cy - 14} ${cx + 16},${cy - 7} ${cx + 5},${cy - 11}`}
          fill="#334155"
        />

        {/* Flow direction arrow on outlet */}
        <polygon
          points={`${cx + r + 6},${cy - 4} ${cx + r + 14},${cy} ${cx + r + 6},${cy + 4}`}
          fill={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
        />
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
