import { LABEL_FONT_SIZE } from '../primitiveTokens';
import type { PrimitiveSize } from './BoilerPrimitive';

export interface PowerflushMachinePrimitiveProps {
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

export function PowerflushMachinePrimitive({
  showLabel = true,
  printSafe = false,
  size = 'md',
}: PowerflushMachinePrimitiveProps) {
  const scale = SCALE[size];

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label="Powerflush machine"
    >
      <svg
        width={Math.round(124 * scale)}
        height={Math.round(96 * scale)}
        viewBox="0 0 124 96"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        <rect
          x={14}
          y={14}
          width={96}
          height={56}
          rx={8}
          fill={printSafe ? '#f3f4f6' : '#dcfce7'}
          stroke="#334155"
          strokeWidth={2}
        />

        <circle cx={34} cy={78} r={7} fill="#1f2937" />
        <circle cx={90} cy={78} r={7} fill="#1f2937" />

        <rect x={22} y={24} width={30} height={14} rx={3} fill={printSafe ? '#d1d5db' : '#fef3c7'} stroke="#374151" strokeWidth={1.5} />
        <rect x={60} y={24} width={40} height={14} rx={3} fill={printSafe ? '#d1d5db' : '#dbeafe'} stroke="#374151" strokeWidth={1.5} />

        <line x1={110} y1={34} x2={122} y2={24} stroke={printSafe ? '#555' : '#92400e'} strokeWidth={3} />
        <line x1={110} y1={50} x2={122} y2={60} stroke={printSafe ? '#000' : '#16a34a'} strokeWidth={3} />
      </svg>

      {showLabel && (
        <span style={{ fontSize: LABEL_FONT_SIZE, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          Powerflush machine
        </span>
      )}
    </div>
  );
}

export default PowerflushMachinePrimitive;
