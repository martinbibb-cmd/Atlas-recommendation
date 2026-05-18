import {
  FLOW_COLOUR,
  LABEL_FONT_SIZE,
  PIPE_STROKE_BRANCH,
  PRINT_FLOW_COLOUR,
  PRINT_RETURN_COLOUR,
  RETURN_COLOUR,
} from '../primitiveTokens';
import type { PrimitiveSize } from './BoilerPrimitive';

export interface ThermalStorePrimitiveProps {
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

export function ThermalStorePrimitive({
  showLabel = true,
  printSafe = false,
  size = 'md',
}: ThermalStorePrimitiveProps) {
  const scale = SCALE[size];

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label="Thermal store with internal heat-exchanger coil"
    >
      <svg
        width={Math.round(94 * scale)}
        height={Math.round(144 * scale)}
        viewBox="0 0 94 144"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        <rect
          x={16}
          y={16}
          width={60}
          height={112}
          rx={16}
          fill={printSafe ? '#e5e7eb' : '#e2e8f0'}
          stroke="#334155"
          strokeWidth={2}
        />

        <rect
          x={18}
          y={18}
          width={56}
          height={108}
          rx={14}
          fill={printSafe ? '#d1d5db' : '#fecaca'}
          opacity={0.6}
        />

        <path
          d="M 30 44 C 42 34, 50 54, 62 44 C 50 56, 42 68, 62 76 C 50 82, 42 96, 62 104"
          stroke={printSafe ? '#000' : '#2563eb'}
          strokeWidth={2.5}
          fill="none"
        />

        <line x1={16} y1={46} x2={4} y2={46} stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={16} y1={100} x2={4} y2={100} stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={76} y1={34} x2={88} y2={34} stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={76} y1={116} x2={88} y2={116} stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR} strokeWidth={PIPE_STROKE_BRANCH} />
      </svg>

      {showLabel && (
        <span style={{ fontSize: LABEL_FONT_SIZE, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          Thermal store
        </span>
      )}
    </div>
  );
}

export default ThermalStorePrimitive;
