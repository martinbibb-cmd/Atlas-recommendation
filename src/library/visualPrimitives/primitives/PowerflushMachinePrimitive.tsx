/**
 * PowerflushMachinePrimitive.tsx
 *
 * Canonical physical primitive for a powerflush machine.
 *
 * A powerflush machine is a portable pump-and-chemical unit used to
 * clean sludge, magnetite, and debris from a central heating circuit.
 * A technician connects it temporarily to the system via the radiator
 * valve ports or drain-cock, then pumps chemical solution around the
 * circuit at high velocity.
 *
 * Recognisable features rendered:
 *   - Upright portable unit body with carry-handle at top
 *   - Control panel fascia (pressure gauge + on/off indicator)
 *   - Chemical tank indicator (left, translucent)
 *   - Heavy-duty wheels at the base (mobility cue)
 *   - Inlet hose stub on the left (connects to system drain-cock)
 *   - Outlet hose stub on the right (returns to system)
 *
 * Canonical port positions (see POWERFLUSH_MACHINE_PORTS):
 *   system_inlet  — left side, mid-height (connects to drain-cock return)
 *   system_outlet — right side, mid-height (pumps to flow side)
 */

import { AUX_COLOUR, LABEL_FONT_SIZE, PIPE_STROKE_MAIN } from '../primitiveTokens';
import type { PrimitiveSize } from './BoilerPrimitive';

export interface PowerflushMachinePrimitiveProps {
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

/** Canonical bounding box of the PowerflushMachinePrimitive SVG at md scale (viewBox units). */
export const POWERFLUSH_MACHINE_FOOTPRINT = { width: 124, height: 110 } as const;

/**
 * Canonical port coordinates for PowerflushMachinePrimitive (viewBox units, md scale).
 * Both hose stubs exit horizontally at mid-height.
 */
export const POWERFLUSH_MACHINE_PORTS = {
  system_inlet:  { x: 4,   y: 56, side: 'left'  as const },
  system_outlet: { x: 120, y: 56, side: 'right' as const },
} as const;

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

// SVG authored at 124×110
// Machine body: x=18, y=10, width=88, height=70
const BODY_X = 18;
const BODY_Y = 10;
const BODY_W = 88;
const BODY_H = 70;
const PORT_Y = 56;  // horizontal port exit height

export function PowerflushMachinePrimitive({
  showLabel = true,
  printSafe = false,
  size = 'md',
}: PowerflushMachinePrimitiveProps) {
  const scale = SCALE[size];
  const bodyFill = printSafe ? '#f3f4f6' : '#f0fdf4';

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label="Powerflush machine"
    >
      <svg
        width={Math.round(124 * scale)}
        height={Math.round(110 * scale)}
        viewBox="0 0 124 110"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Main unit body */}
        <rect
          x={BODY_X}
          y={BODY_Y}
          width={BODY_W}
          height={BODY_H}
          rx={6}
          fill={bodyFill}
          stroke="#334155"
          strokeWidth={2}
          data-testid="powerflush-machine-body"
        />

        {/* Chemical tank indicator (left section, translucent) */}
        <rect
          x={BODY_X + 4}
          y={BODY_Y + 6}
          width={24}
          height={BODY_H - 12}
          rx={4}
          fill={printSafe ? '#e5e7eb' : '#bbf7d0'}
          stroke={printSafe ? '#9ca3af' : '#16a34a'}
          strokeWidth={1.5}
          data-testid="powerflush-chemical-tank"
        />
        {/* Chemical level indicator */}
        <rect
          x={BODY_X + 6}
          y={BODY_Y + BODY_H - 28}
          width={20}
          height={14}
          rx={2}
          fill={printSafe ? '#d1d5db' : '#86efac'}
          opacity={0.8}
        />

        {/* Control panel fascia (right section) */}
        <rect
          x={BODY_X + 36}
          y={BODY_Y + 8}
          width={46}
          height={BODY_H - 16}
          rx={4}
          fill={printSafe ? '#f9fafb' : '#f1f5f9'}
          stroke="#94a3b8"
          strokeWidth={1}
          data-testid="powerflush-control-panel"
        />

        {/* Pressure gauge on control panel */}
        <circle cx={BODY_X + 52} cy={BODY_Y + 26} r={9} fill={printSafe ? '#e5e7eb' : '#fff'} stroke="#475569" strokeWidth={1.5} data-testid="powerflush-pressure-gauge" />
        <line x1={BODY_X + 52} y1={BODY_Y + 26} x2={BODY_X + 56} y2={BODY_Y + 21} stroke="#374151" strokeWidth={1.5} />

        {/* Power indicator light */}
        <circle cx={BODY_X + 68} cy={BODY_Y + 26} r={4} fill={printSafe ? '#d1d5db' : '#22c55e'} stroke="#374151" strokeWidth={1} data-testid="powerflush-power-indicator" />

        {/* Flow direction indicator */}
        <polygon points={`${BODY_X + 56},${BODY_Y + 46} ${BODY_X + 64},${BODY_Y + 42} ${BODY_X + 64},${BODY_Y + 50}`} fill={printSafe ? '#9ca3af' : '#2563eb'} />

        {/* Carry handle at top */}
        <path
          d={`M ${BODY_X + 34} ${BODY_Y} Q ${BODY_X + 44} ${BODY_Y - 10} ${BODY_X + 54} ${BODY_Y}`}
          stroke="#334155"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          data-testid="powerflush-carry-handle"
        />

        {/* Wheels at base */}
        <circle cx={BODY_X + 18} cy={BODY_Y + BODY_H + 10} r={8} fill="#1f2937" stroke="#334155" strokeWidth={1.5} data-testid="powerflush-wheel-left" />
        <circle cx={BODY_X + BODY_W - 18} cy={BODY_Y + BODY_H + 10} r={8} fill="#1f2937" stroke="#334155" strokeWidth={1.5} data-testid="powerflush-wheel-right" />
        {/* Axle line */}
        <line x1={BODY_X + 18} y1={BODY_Y + BODY_H + 10} x2={BODY_X + BODY_W - 18} y2={BODY_Y + BODY_H + 10} stroke="#475569" strokeWidth={2} />

        {/* System inlet hose stub — exits left horizontally */}
        <line
          x1={4}
          y1={PORT_Y}
          x2={BODY_X}
          y2={PORT_Y}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
          strokeDasharray="4 2"
          data-testid="powerflush-inlet-hose"
          data-port-position="left"
          data-port-role="powerflush_system_inlet"
        />
        {/* Inlet hose fitting */}
        <rect x={4} y={PORT_Y - 4} width={8} height={8} rx={2} fill={printSafe ? '#9ca3af' : '#64748b'} />

        {/* System outlet hose stub — exits right horizontally */}
        <line
          x1={BODY_X + BODY_W}
          y1={PORT_Y}
          x2={120}
          y2={PORT_Y}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
          strokeDasharray="4 2"
          data-testid="powerflush-outlet-hose"
          data-port-position="right"
          data-port-role="powerflush_system_outlet"
        />
        {/* Outlet hose fitting */}
        <rect x={112} y={PORT_Y - 4} width={8} height={8} rx={2} fill={printSafe ? '#9ca3af' : '#64748b'} />
      </svg>

      {showLabel && (
        <span style={{ fontSize: LABEL_FONT_SIZE, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          Powerflush machine
        </span>
      )}
    </div>
  );
}

export default PowerflushMachinePrimitive;
