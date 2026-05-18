import { LABEL_FONT_SIZE } from '../primitiveTokens';
import type { PrimitiveSize } from './BoilerPrimitive';

export interface HeaderTankPrimitiveProps {
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

export function HeaderTankPrimitive({
  showLabel = true,
  printSafe = false,
  size = 'md',
}: HeaderTankPrimitiveProps) {
  const scale = SCALE[size];

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label="Feed-and-expansion header tank"
    >
      <svg
        width={Math.round(120 * scale)}
        height={Math.round(84 * scale)}
        viewBox="0 0 120 84"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        <rect
          x={14}
          y={18}
          width={94}
          height={46}
          rx={4}
          fill={printSafe ? '#f3f4f6' : '#dbeafe'}
          stroke="#334155"
          strokeWidth={2}
        />

        <line
          x1={18}
          y1={34}
          x2={102}
          y2={34}
          stroke={printSafe ? '#9ca3af' : '#93c5fd'}
          strokeWidth={2}
          strokeDasharray={printSafe ? '4 3' : undefined}
        />

        <line x1={30} y1={64} x2={30} y2={80} stroke="#334155" strokeWidth={3} />
        <line x1={90} y1={64} x2={90} y2={80} stroke="#334155" strokeWidth={3} />

        <line x1={60} y1={18} x2={60} y2={6} stroke="#334155" strokeWidth={2.5} />
        <circle cx={60} cy={5} r={2} fill="#334155" />
      </svg>

      {showLabel && (
        <span style={{ fontSize: LABEL_FONT_SIZE, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          Header tank
        </span>
      )}
    </div>
  );
}

export default HeaderTankPrimitive;
