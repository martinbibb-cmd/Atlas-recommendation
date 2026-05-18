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

export interface FillingLoopPrimitiveProps {
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

export function FillingLoopPrimitive({
  showLabel = true,
  printSafe = false,
  size = 'md',
}: FillingLoopPrimitiveProps) {
  const scale = SCALE[size];

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label="Filling loop with isolation valves"
    >
      <svg
        width={Math.round(150 * scale)}
        height={Math.round(70 * scale)}
        viewBox="0 0 150 70"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        <line
          x1={8}
          y1={20}
          x2={142}
          y2={20}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
        />
        <line
          x1={8}
          y1={52}
          x2={142}
          y2={52}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
          strokeDasharray={printSafe ? PRINT_RETURN_DASH : RETURN_PIPE_DASH}
        />

        <path
          d="M 48 20 C 58 20, 58 47, 72 47"
          stroke="#374151"
          strokeWidth={2.5}
          strokeDasharray="3 2"
          opacity={0.7}
          data-testid="filling-loop-ghost-link-left"
          fill="none"
        />
        <path
          d="M 78 47 C 92 47, 92 20, 102 20"
          stroke="#374151"
          strokeWidth={2.5}
          strokeDasharray="3 2"
          opacity={0.7}
          data-testid="filling-loop-ghost-link-right"
          fill="none"
        />

        <circle cx={56} cy={26} r={3.5} fill={printSafe ? '#000' : '#111827'} />
        <circle cx={94} cy={26} r={3.5} fill={printSafe ? '#000' : '#111827'} />
        <line x1={73} y1={47} x2={77} y2={47} stroke={printSafe ? '#000' : '#9ca3af'} strokeWidth={2} data-testid="filling-loop-disconnect-gap" />
      </svg>

      {showLabel && (
        <span style={{ fontSize: LABEL_FONT_SIZE, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          Filling loop
        </span>
      )}
    </div>
  );
}

export default FillingLoopPrimitive;
