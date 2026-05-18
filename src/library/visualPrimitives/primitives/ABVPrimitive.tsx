/**
 * ABVPrimitive.tsx
 *
 * Canonical physical primitive for an Automatic Bypass Valve (ABV).
 *
 * The ABV is installed as a bypass between the flow and return pipes of
 * a sealed heating circuit. When all thermostatic radiator valves (TRVs)
 * close simultaneously, the ABV opens to maintain a minimum flow through
 * the boiler, preventing damage from heat build-up and pump cavitation.
 *
 * Visual convention:
 *   - Flow pipe horizontal at top (red / solid)
 *   - Return pipe horizontal at bottom (blue / dashed in printSafe)
 *   - Bypass spur connecting flow to return on the right side
 *   - Valve body: small diamond/rectangle on the bypass spur
 *   - Arrow on the bypass spur showing relief direction (flow → return)
 *
 * No existing rendering was found in the codebase; this is a net-new
 * canonical primitive.
 */

import type { PrimitiveSize } from './BoilerPrimitive';

export interface ABVPrimitiveProps {
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

export function ABVPrimitive({
  showLabel = true,
  printSafe = false,
  size = 'md',
}: ABVPrimitiveProps) {
  const scale = SCALE[size];
  // SVG authored at 160×80

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label="Automatic bypass valve"
    >
      <svg
        width={Math.round(160 * scale)}
        height={Math.round(80 * scale)}
        viewBox="0 0 160 80"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Flow pipe — top (hot) */}
        <line
          x1={4} y1={20}
          x2={156} y2={20}
          stroke={printSafe ? '#000' : '#ef4444'}
          strokeWidth={3}
        />

        {/* Return pipe — bottom (cool) */}
        <line
          x1={4} y1={60}
          x2={156} y2={60}
          stroke={printSafe ? '#555' : '#3b82f6'}
          strokeWidth={3}
          strokeDasharray={printSafe ? '6 3' : undefined}
        />

        {/* Bypass spur — vertical, right side */}
        <line
          x1={120} y1={20}
          x2={120} y2={60}
          stroke="#374151"
          strokeWidth={2.5}
        />

        {/* Bypass flow arrow */}
        <polygon
          points="116,44 120,52 124,44"
          fill="#374151"
        />

        {/* Valve body — diamond on spur */}
        <rect
          x={112} y={34}
          width={16} height={12}
          rx={2}
          fill={printSafe ? '#d1d5db' : '#fef9c3'}
          stroke="#374151"
          strokeWidth={1.5}
          transform="rotate(45 120 40)"
        />

        {/* ABV label on valve body */}
        <text
          x={120} y={43}
          textAnchor="middle"
          fontSize={6}
          fontFamily="system-ui"
          fontWeight="bold"
          fill="#374151"
        >
          ABV
        </text>

        {/* Pipe labels */}
        <text x={72} y={14} textAnchor="middle" fontSize={7} fontFamily="system-ui" fill={printSafe ? '#000' : '#ef4444'}>
          Flow
        </text>
        <text x={72} y={72} textAnchor="middle" fontSize={7} fontFamily="system-ui" fill={printSafe ? '#555' : '#3b82f6'}>
          Return
        </text>
        <text x={138} y={42} fontSize={7} fontFamily="system-ui" fill="#374151">
          Bypass
        </text>
      </svg>

      {showLabel && (
        <span style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          Automatic bypass valve
        </span>
      )}
    </div>
  );
}

export default ABVPrimitive;
