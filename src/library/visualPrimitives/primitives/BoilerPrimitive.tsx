/**
 * BoilerPrimitive.tsx
 *
 * Canonical physical primitive for a gas wall-mounted boiler.
 *
 * Renders a schematic cross-section: rectangular body with a flame symbol
 * inside a viewing panel, flow pipe (red) and return pipe (blue) below,
 * and a gas supply stub (grey dashed).
 *
 * Variants:
 *   variant="combi"   — on-demand hot water + central heating, no cylinder
 *   variant="system"  — central heating only, separate cylinder required
 *   variant="regular" — heat-only, separate pump, cylinder and controls
 *
 * Props:
 *   showLabel     — render the equipment name below the body (default true)
 *   printSafe     — suppress colour-only cues; add pattern fills (default false)
 *   size          — "sm" | "md" | "lg" — scales SVG dimensions
 */

import {
  AUX_COLOUR,
  FLOW_COLOUR,
  LABEL_FONT_SIZE,
  PIPE_STROKE_GAS,
  PIPE_STROKE_MAIN,
  PRINT_FLOW_COLOUR,
  PRINT_RETURN_COLOUR,
  RETURN_COLOUR,
  RETURN_PIPE_DASH,
  PRINT_RETURN_DASH,
} from '../primitiveTokens';
import { FLOW_PULSE_CLASS } from '../primitiveMotion';

export type BoilerVariant = 'combi' | 'system' | 'regular';
export type PrimitiveSize = 'sm' | 'md' | 'lg';

export interface BoilerPrimitiveProps {
  variant?: BoilerVariant;
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
  /** When true, applies a flow-pulse animation to the pipe stubs. Defaults to false. */
  animateFlow?: boolean;
}

const VARIANT_LABELS: Record<BoilerVariant, string> = {
  combi: 'Combination boiler',
  system: 'System boiler',
  regular: 'Regular boiler',
};

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };
const BOILER_BODY_X = 20;
const BOILER_BODY_W = 72;
const BOILER_BODY_BOTTOM_Y = 108;
const BOILER_PORT_END_Y = 136;

interface BoilerPortSpec {
  id: string;
  x: number;
  role: string;
  stroke: string;
  strokeWidth: number;
  returnDash?: boolean;
}

function buildPortSpec(variant: BoilerVariant, printSafe: boolean): BoilerPortSpec[] {
  if (variant === 'combi') {
    return [
      {
        id: 'boiler-primary-return-port',
        x: 28,
        role: 'boiler_primary_return',
        stroke: printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR,
        strokeWidth: PIPE_STROKE_MAIN,
        returnDash: true,
      },
      {
        id: 'boiler-cold-mains-port',
        x: 42,
        role: 'boiler_cold_mains_in',
        stroke: printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR,
        strokeWidth: PIPE_STROKE_MAIN,
        returnDash: true,
      },
      {
        id: 'boiler-gas-port',
        x: 56,
        role: 'boiler_gas_supply',
        stroke: AUX_COLOUR,
        strokeWidth: PIPE_STROKE_GAS,
      },
      {
        id: 'boiler-dhw-out-port',
        x: 70,
        role: 'boiler_dhw_out',
        stroke: printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR,
        strokeWidth: PIPE_STROKE_MAIN,
      },
      {
        id: 'boiler-primary-flow-port',
        x: 84,
        role: 'boiler_primary_flow',
        stroke: printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR,
        strokeWidth: PIPE_STROKE_MAIN,
      },
    ];
  }

  return [
    {
      id: 'boiler-primary-return-port',
      x: 32,
      role: 'boiler_primary_return',
      stroke: printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR,
      strokeWidth: PIPE_STROKE_MAIN,
      returnDash: true,
    },
    {
      id: 'boiler-gas-port',
      x: 56,
      role: 'boiler_gas_supply',
      stroke: AUX_COLOUR,
      strokeWidth: PIPE_STROKE_GAS,
    },
    {
      id: 'boiler-primary-flow-port',
      x: 80,
      role: 'boiler_primary_flow',
      stroke: printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR,
      strokeWidth: PIPE_STROKE_MAIN,
    },
  ];
}

export function BoilerPrimitive({
  variant = 'combi',
  showLabel = true,
  printSafe = false,
  size = 'md',
  animateFlow = false,
}: BoilerPrimitiveProps) {
  const scale = SCALE[size];
  const ports = buildPortSpec(variant, printSafe);
  const w = Math.round(112 * scale);
  const h = Math.round(138 * scale);

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label={VARIANT_LABELS[variant]}
    >
      <svg
        width={w}
        height={h}
        viewBox="0 0 112 138"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Wall-mounted body */}
        <rect
          x={BOILER_BODY_X}
          y={6}
          width={BOILER_BODY_W}
          height={102}
          rx={6}
          fill={printSafe ? '#f9fafb' : '#ffffff'}
          stroke="#334155"
          strokeWidth={2}
          data-testid="boiler-wall-hung-body"
        />

        {/* Subtle casing seam */}
        <line x1={BOILER_BODY_X} y1={24} x2={BOILER_BODY_X + BOILER_BODY_W} y2={24} stroke="#cbd5e1" strokeWidth={1} />

        {/* Subtle control fascia */}
        <rect
          x={24}
          y={84}
          width={64}
          height={20}
          rx={4}
          fill={printSafe ? '#e5e7eb' : '#f1f5f9'}
          stroke="#94a3b8"
          strokeWidth={1}
          data-testid="boiler-fascia-panel"
        />
        <circle cx={77} cy={94} r={2.2} fill={variant === 'combi' ? '#10b981' : '#94a3b8'} />
        <circle cx={31} cy={94} r={1.6} fill={variant === 'regular' ? '#f59e0b' : '#94a3b8'} />

        {/* Bottom-only service connections */}
        {ports.map((port) => (
          <line
            key={port.id}
            x1={port.x}
            y1={BOILER_BODY_BOTTOM_Y}
            x2={port.x}
            y2={BOILER_PORT_END_Y}
            stroke={port.stroke}
            strokeWidth={port.strokeWidth}
            strokeDasharray={
              port.id === 'boiler-gas-port'
                ? '4 2'
                : port.returnDash
                  ? (printSafe ? PRINT_RETURN_DASH : RETURN_PIPE_DASH)
                  : undefined
            }
            className={
              animateFlow && !printSafe && port.role === 'boiler_primary_flow'
                ? FLOW_PULSE_CLASS.flow
                : animateFlow && !printSafe && port.role === 'boiler_primary_return'
                  ? FLOW_PULSE_CLASS.return
                  : undefined
            }
            data-testid={port.id}
            data-port-position="bottom"
            data-port-role={port.role}
          />
        ))}

        {/* Wall bracket cue */}
        <rect x={14} y={12} width={4} height={18} rx={2} fill="#94a3b8" />
      </svg>

      {showLabel && (
        <span style={{ fontSize: LABEL_FONT_SIZE, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          {VARIANT_LABELS[variant]}
        </span>
      )}
    </div>
  );
}

export default BoilerPrimitive;
