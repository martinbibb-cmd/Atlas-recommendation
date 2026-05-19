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

import {
  AUX_COLOUR,
  FLOW_COLOUR,
  LABEL_FONT_SIZE,
  PIPE_STROKE_MAIN,
  PRINT_FLOW_COLOUR,
  PRINT_RETURN_COLOUR,
  RETURN_COLOUR,
  RETURN_PIPE_DASH,
  PRINT_RETURN_DASH,
  VALVE_H,
  VALVE_W,
} from '../primitiveTokens';
import { BYPASS_ACTIVATION_CLASS } from '../primitiveMotion';
import type { PrimitiveSize } from './BoilerPrimitive';

export interface ABVPrimitiveProps {
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
  /** When true, animates the bypass valve body with a brief flash. Defaults to false. */
  animateFlow?: boolean;
}

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

export function ABVPrimitive({
  showLabel = true,
  printSafe = false,
  size = 'md',
  animateFlow = false,
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
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
        />

        {/* Return header stub */}
        <line
          x1={8} y1={64}
          x2={112} y2={64}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
          strokeDasharray={printSafe ? PRINT_RETURN_DASH : RETURN_PIPE_DASH}
        />

        {/* Flow-return bridge */}
        <line
          x1={76}
          y1={20}
          x2={76}
          y2={40}
          stroke={AUX_COLOUR}
          strokeWidth={2.5}
        />
        <line
          x1={92}
          y1={44}
          x2={92}
          y2={64}
          stroke={AUX_COLOUR}
          strokeWidth={2.5}
        />
        <line x1={76} y1={40} x2={92} y2={44} stroke={AUX_COLOUR} strokeWidth={2.5} />

        {/* Compact brass bypass body */}
        <rect
          x={75}
          y={36}
          width={VALVE_W + 4}
          height={VALVE_H + 3}
          rx={3}
          fill={printSafe ? '#d1d5db' : '#fbbf24'}
          stroke="#374151"
          strokeWidth={1.5}
          className={animateFlow && !printSafe ? BYPASS_ACTIVATION_CLASS : undefined}
          data-testid="abv-brass-body"
          data-port-role="abv_bypass_body"
        />

        {/* Angled adjustment cap/head cue */}
        <rect
          x={84}
          y={29}
          width={VALVE_W - 1}
          height={VALVE_H + 1}
          rx={1.5}
          transform="rotate(-40 88.5 32.5)"
          fill={printSafe ? '#6b7280' : '#dc2626'}
          stroke={printSafe ? '#111827' : '#7f1d1d'}
          strokeWidth={1}
          data-testid="abv-angled-cap"
        />

        {/* Bypass relief direction — colour-coded to flow for accessibility */}
        <polygon
          points="82,52 88,56 82,60"
          fill={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
        />

        {/* Pipe labels */}
        <text x={36} y={14} textAnchor="middle" fontSize={7} fontFamily="system-ui" fill={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}>
          Flow
        </text>
        <text x={42} y={78} textAnchor="middle" fontSize={7} fontFamily="system-ui" fill={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}>
          Return
        </text>
      </svg>

      {showLabel && (
        <span style={{ fontSize: LABEL_FONT_SIZE, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          Automatic bypass valve
        </span>
      )}
    </div>
  );
}

export default ABVPrimitive;
