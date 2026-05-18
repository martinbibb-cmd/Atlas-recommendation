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
 *   - Bypass bridge connecting flow to return
 *   - Compact inline valve body on the bridge
 *   - Angled adjustment cap/head cue
 *   - Arrow on the bypass spur showing relief direction (flow → return)
 *
 * Canonical primitive for realistic ABV depiction in topology overlays.
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
        width={Math.round(120 * scale)}
        height={Math.round(84 * scale)}
        viewBox="0 0 120 84"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Flow header stub */}
        <line
          x1={8} y1={20}
          x2={112} y2={20}
          stroke={printSafe ? '#000' : '#ef4444'}
          strokeWidth={3}
        />

        {/* Return header stub */}
        <line
          x1={8} y1={64}
          x2={112} y2={64}
          stroke={printSafe ? '#555' : '#3b82f6'}
          strokeWidth={3}
          strokeDasharray={printSafe ? '6 3' : undefined}
        />

        {/* Bypass bridge between flow and return */}
        <line
          x1={78} y1={20}
          x2={78} y2={40}
          stroke="#374151"
          strokeWidth={2.5}
        />
        <line
          x1={94} y1={44}
          x2={94} y2={64}
          stroke="#374151"
          strokeWidth={2.5}
        />
        <line x1={78} y1={40} x2={94} y2={44} stroke="#374151" strokeWidth={2.5} />

        {/* Inline valve body */}
        <rect
          x={78}
          y={37}
          width={16}
          height={10}
          rx={3}
          fill={printSafe ? '#d1d5db' : '#fde68a'}
          stroke="#374151"
          strokeWidth={1.5}
        />

        {/* Angled adjustment cap/head cue */}
        <rect
          x={87}
          y={29}
          width={9}
          height={7}
          rx={1.5}
          transform="rotate(-45 91.5 32.5)"
          fill={printSafe ? '#6b7280' : '#dc2626'}
          stroke={printSafe ? '#111827' : '#7f1d1d'}
          strokeWidth={1}
          data-testid="abv-angled-cap"
        />

        {/* Bypass relief direction */}
        <polygon
          points="84,52 90,56 84,60"
          fill="#374151"
        />

        {/* Pipe labels */}
        <text x={36} y={14} textAnchor="middle" fontSize={7} fontFamily="system-ui" fill={printSafe ? '#000' : '#ef4444'}>
          Flow
        </text>
        <text x={42} y={78} textAnchor="middle" fontSize={7} fontFamily="system-ui" fill={printSafe ? '#555' : '#3b82f6'}>
          Return
        </text>
        <text x={100} y={42} fontSize={7} fontFamily="system-ui" fill="#374151">
          ABV
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
