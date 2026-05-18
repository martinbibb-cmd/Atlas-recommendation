/**
 * PipeLoopPrimitive.tsx
 *
 * Canonical physical primitive for a sealed central heating circuit loop.
 *
 * Shows a simplified rectangular loop representing the sealed circuit:
 * boiler (flow) → radiators → return → pump → boiler.
 *
 * Colour convention (or pattern in printSafe mode):
 *   Top horizontal pipe  — red   (flow, hot)
 *   Bottom horizontal pipe — blue (return, cooler)
 *   Left vertical pipe   — transition
 *   Right vertical pipe  — transition
 *
 * Used to communicate:
 *   - Sealed system topology
 *   - Flow direction around the circuit
 *   - Position of pump, expansion vessel, filling loop relative to the circuit
 */

import type { PrimitiveSize } from './BoilerPrimitive';

export interface PipeLoopPrimitiveProps {
  /** Show flow direction arrows. Default true. */
  showArrows?: boolean;
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

// SVG authored at 160×90
// Loop: 20,20 → 140,20 → 140,70 → 20,70 → back
const L = 20;   // left x
const R_X = 140; // right x
const T = 20;   // top y
const B = 70;   // bottom y
const MID_X = (L + R_X) / 2;  // 80
const MID_Y = (T + B) / 2;    // 45

export function PipeLoopPrimitive({
  showArrows = true,
  showLabel = true,
  printSafe = false,
  size = 'md',
}: PipeLoopPrimitiveProps) {
  const scale = SCALE[size];
  const flowColor = printSafe ? '#000' : '#ef4444';
  const returnColor = printSafe ? '#555' : '#3b82f6';
  const pipeW = 3;

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label="Sealed central heating circuit loop"
    >
      <svg
        width={Math.round(160 * scale)}
        height={Math.round(90 * scale)}
        viewBox="0 0 160 90"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Top flow pipe — hot */}
        <line
          x1={L} y1={T}
          x2={R_X} y2={T}
          stroke={flowColor}
          strokeWidth={pipeW}
        />
        {/* Bottom return pipe — cool */}
        <line
          x1={L} y1={B}
          x2={R_X} y2={B}
          stroke={returnColor}
          strokeWidth={pipeW}
          strokeDasharray={printSafe ? '6 3' : undefined}
        />
        {/* Left vertical */}
        <line
          x1={L} y1={T}
          x2={L} y2={B}
          stroke="#64748b"
          strokeWidth={pipeW}
        />
        {/* Right vertical */}
        <line
          x1={R_X} y1={T}
          x2={R_X} y2={B}
          stroke="#64748b"
          strokeWidth={pipeW}
        />

        {/* Boiler — left */}
        <rect
          x={L - 12} y={MID_Y - 14}
          width={24} height={28}
          rx={3}
          fill={printSafe ? '#e5e7eb' : '#dbeafe'}
          stroke={printSafe ? '#374151' : '#1e40af'}
          strokeWidth={1.5}
        />
        <text
          x={L}
          y={MID_Y + 4}
          textAnchor="middle"
          fontSize={6}
          fontFamily="system-ui"
          fontWeight="bold"
          fill={printSafe ? '#000' : '#1e40af'}
        >
          BOILER
        </text>

        {/* Pump — bottom centre */}
        <circle
          cx={MID_X} cy={B}
          r={8}
          fill={printSafe ? '#f3f4f6' : '#e0f2fe'}
          stroke="#334155"
          strokeWidth={1.5}
        />
        {/* Pump impeller cross */}
        <line x1={MID_X - 4} y1={B} x2={MID_X + 4} y2={B} stroke="#334155" strokeWidth={1} />
        <line x1={MID_X} y1={B - 4} x2={MID_X} y2={B + 4} stroke="#334155" strokeWidth={1} />

        {/* Radiator stubs — top */}
        {[60, 90, 120].map(x => (
          <rect
            key={x}
            x={x - 8} y={T - 12}
            width={16} height={12}
            rx={2}
            fill={printSafe ? '#d1d5db' : '#fca5a5'}
            stroke={printSafe ? '#374151' : '#ef4444'}
            strokeWidth={1}
          />
        ))}

        {/* Flow direction arrows */}
        {showArrows && (
          <>
            {/* Top pipe → right */}
            <polygon
              points={`${MID_X - 2},${T - 4} ${MID_X + 6},${T} ${MID_X - 2},${T + 4}`}
              fill={flowColor}
            />
            {/* Bottom pipe → left */}
            <polygon
              points={`${MID_X + 2},${B - 4} ${MID_X - 6},${B} ${MID_X + 2},${B + 4}`}
              fill={returnColor}
            />
          </>
        )}

        {/* Flow / Return labels */}
        <text x={MID_X + 18} y={T - 3} fontSize={7} fontFamily="system-ui" fill={flowColor}>Flow</text>
        <text x={MID_X - 30} y={B - 5} fontSize={7} fontFamily="system-ui" fill={returnColor}>Return</text>
      </svg>

      {showLabel && (
        <span style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          Sealed circuit loop
        </span>
      )}
    </div>
  );
}

export default PipeLoopPrimitive;
