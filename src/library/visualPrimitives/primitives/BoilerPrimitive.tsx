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

export function BoilerPrimitive({
  variant = 'combi',
  showLabel = true,
  printSafe = false,
  size = 'md',
  animateFlow = false,
}: BoilerPrimitiveProps) {
  const scale = SCALE[size];
  const w = Math.round(100 * scale);
  const h = Math.round(110 * scale);
  // SVG is authored at 100×110; we scale via viewBox + explicit dimensions.

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label={VARIANT_LABELS[variant]}
    >
      <svg
        width={w}
        height={h}
        viewBox="0 0 100 110"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Boiler body */}
        <rect
          x={10} y={4}
          width={80} height={76}
          rx={5}
          fill={printSafe ? '#f3f4f6' : '#1e40af'}
          stroke={printSafe ? '#1e3a8a' : '#1e3a8a'}
          strokeWidth={2}
          strokeDasharray={printSafe ? '4 2' : undefined}
        />

        {/* Viewing panel */}
        <rect
          x={22} y={14}
          width={56} height={42}
          rx={3}
          fill={printSafe ? '#fff' : '#eff6ff'}
          stroke="#93c5fd"
          strokeWidth={1}
        />

        {/* Flame — left lobe */}
        <path
          d="M50 50 C46 42 54 36 50 28 C47 34 43 32 45 40 C42 36 40 32 42 26 C36 34 38 46 44 50 Z"
          fill={printSafe ? '#000' : '#f97316'}
        />
        {/* Flame — right lobe */}
        <path
          d="M50 50 C54 42 46 36 50 28 C53 34 57 32 55 40 C58 36 60 32 58 26 C64 34 62 46 56 50 Z"
          fill={printSafe ? '#666' : '#fbbf24'}
        />

        {/* Variant badge */}
        <text
          x={50} y={68}
          textAnchor="middle"
          fontSize={7}
          fontFamily="system-ui, sans-serif"
          fontWeight="bold"
          fill={printSafe ? '#000' : '#1e3a8a'}
        >
          {variant === 'combi' ? 'COMBI' : variant === 'system' ? 'SYSTEM' : 'REGULAR'}
        </text>

        {/* Flow pipe (hot — red/dark) */}
        <line
          x1={30} y1={80}
          x2={30} y2={104}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
          className={animateFlow && !printSafe ? FLOW_PULSE_CLASS.flow : undefined}
        />
        {/* Return pipe (cool — blue/dashed for colour-blind safety) */}
        <line
          x1={70} y1={80}
          x2={70} y2={104}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
          strokeDasharray={animateFlow && !printSafe ? undefined : (printSafe ? PRINT_RETURN_DASH : RETURN_PIPE_DASH)}
          className={animateFlow && !printSafe ? FLOW_PULSE_CLASS.return : undefined}
        />
        {/* Gas supply stub (grey dashed) */}
        <line
          x1={50} y1={80}
          x2={50} y2={104}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_GAS}
          strokeDasharray="4 2"
        />

        {/* Pipe foot labels */}
        <text x={30} y={109} textAnchor="middle" fontSize={6} fontFamily="system-ui" fill={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}>Flow</text>
        <text x={70} y={109} textAnchor="middle" fontSize={6} fontFamily="system-ui" fill={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}>Return</text>
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
