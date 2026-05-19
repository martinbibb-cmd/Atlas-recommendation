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

import { LABEL_FONT_SIZE } from '../primitiveTokens';
import type { PrimitiveSize } from './BoilerPrimitive';

export interface ExpansionVesselPrimitiveProps {
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

/** Canonical bounding box of the ExpansionVesselPrimitive SVG at md scale (viewBox units). */
export const EXPANSION_VESSEL_FOOTPRINT = { width: 80, height: 96 } as const;

/**
 * Canonical port coordinates for ExpansionVesselPrimitive (viewBox units, md scale).
 * Single bottom connection stub back to the sealed circuit.
 */
export const EXPANSION_VESSEL_PORTS = {
  circuit_connection: { x: 40, y: 94, side: 'bottom' as const },
} as const;

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
        {/* Wall bracket cue */}
        <rect
          x={8}
          y={18}
          width={8}
          height={34}
          rx={2}
          fill={printSafe ? '#9ca3af' : '#6b7280'}
          data-testid="expansion-vessel-bracket"
        />
        <line x1={16} y1={36} x2={20} y2={36} stroke="#475569" strokeWidth={2} />

        {/* Vessel shell */}
        <ellipse
          cx={40} cy={44}
          rx={34} ry={38}
          fill={printSafe ? '#d1d5db' : '#ef4444'}
          stroke="#374151"
          strokeWidth={2}
          data-testid="expansion-vessel-shell"
        />

        {/* Grey lower shell cue */}
        <path d="M 8 44 C 8 64, 24 80, 40 80 C 56 80, 72 64, 72 44 Z" fill={printSafe ? '#9ca3af' : '#9ca3af'} opacity={0.8} />

        {/* Air charge side */}
        <path
          d="M 40 8 C 22 8, 8 24, 8 44 C 8 64, 22 78, 40 80 Z"
          fill={printSafe ? '#f3f4f6' : '#fee2e2'}
        />

        {/* Water side */}
        <path
          d="M 40 8 C 58 8, 72 24, 72 44 C 72 64, 58 78, 40 80 Z"
          fill={printSafe ? '#d1d5db' : '#fecaca'}
        />

        {/* Diaphragm — S-curve split */}
        <path
          d="M 40 8 C 35 24, 45 44, 35 60 C 30 68, 36 76, 40 80"
          stroke={printSafe ? '#000' : '#1f2937'}
          strokeWidth={2.5}
          fill="none"
          data-testid="expansion-vessel-diaphragm"
        />

        {/* Connection pipe stub at bottom */}
        <line
          x1={40} y1={80}
          x2={40} y2={94}
          stroke="#374151"
          strokeWidth={3}
          data-port-position="bottom"
          data-port-role="expansion_vessel_connection"
        />
        <rect
          x={32} y={90}
          width={16} height={4}
          rx={1}
          fill="#374151"
        />
      </svg>

      {showLabel && (
        <span style={{ fontSize: LABEL_FONT_SIZE, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          Expansion vessel
        </span>
      )}
    </div>
  );
}

export default ExpansionVesselPrimitive;
