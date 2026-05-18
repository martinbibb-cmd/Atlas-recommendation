/**
 * ExpansionVesselPrimitive.tsx
 *
 * Canonical physical primitive for a sealed heating system expansion vessel.
 *
 * The distinguishing feature is the internal rubber diaphragm shown as
 * a curved split between the air charge side (left) and the water side (right).
 *
 * In sealed heating systems the expansion vessel absorbs the small volume
 * increase of water as it heats from cold to operating temperature, preventing
 * dangerous pressure spikes.
 *
 * Connection stub at the base shows the pipe connection back to the circuit.
 */

import type { PrimitiveSize } from './BoilerPrimitive';

export interface ExpansionVesselPrimitiveProps {
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

export function ExpansionVesselPrimitive({
  showLabel = true,
  printSafe = false,
  size = 'md',
}: ExpansionVesselPrimitiveProps) {
  const scale = SCALE[size];
  // SVG authored at 80×96

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label="Expansion vessel"
    >
      <svg
        width={Math.round(80 * scale)}
        height={Math.round(96 * scale)}
        viewBox="0 0 80 96"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Vessel shell — ellipse */}
        <ellipse
          cx={40} cy={44}
          rx={34} ry={38}
          fill={printSafe ? '#e5e7eb' : '#d1d5db'}
          stroke="#374151"
          strokeWidth={2}
        />

        {/* Air charge side (left) — lighter */}
        <path
          d="M 40 8 C 22 8, 8 24, 8 44 C 8 64, 22 78, 40 80 Z"
          fill={printSafe ? '#f9fafb' : '#f0f9ff'}
        />

        {/* Water side (right) — slightly darker */}
        <path
          d="M 40 8 C 58 8, 72 24, 72 44 C 72 64, 58 78, 40 80 Z"
          fill={printSafe ? '#d1d5db' : '#bfdbfe'}
        />

        {/* Diaphragm — S-curve split */}
        <path
          d="M 40 8 C 35 24, 45 44, 35 60 C 30 68, 36 76, 40 80"
          stroke={printSafe ? '#000' : '#1f2937'}
          strokeWidth={2.5}
          fill="none"
        />

        {/* Air label */}
        <text
          x={24} y={46}
          textAnchor="middle"
          fontSize={8}
          fontFamily="system-ui, sans-serif"
          fill={printSafe ? '#374151' : '#1e40af'}
        >Air</text>

        {/* Water label */}
        <text
          x={56} y={46}
          textAnchor="middle"
          fontSize={8}
          fontFamily="system-ui, sans-serif"
          fill={printSafe ? '#374151' : '#1d4ed8'}
        >Water</text>

        {/* Connection pipe stub at bottom */}
        <line
          x1={40} y1={80}
          x2={40} y2={92}
          stroke="#374151"
          strokeWidth={3}
        />
        <rect
          x={32} y={90}
          width={16} height={4}
          rx={1}
          fill="#374151"
        />
      </svg>

      {showLabel && (
        <span style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          Expansion vessel
        </span>
      )}
    </div>
  );
}

export default ExpansionVesselPrimitive;
