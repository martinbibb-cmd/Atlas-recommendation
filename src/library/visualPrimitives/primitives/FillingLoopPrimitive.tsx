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
          stroke={printSafe ? '#000' : '#ef4444'}
          strokeWidth={3}
        />
        <line
          x1={8}
          y1={52}
          x2={142}
          y2={52}
          stroke={printSafe ? '#555' : '#3b82f6'}
          strokeWidth={3}
          strokeDasharray={printSafe ? '5 3' : undefined}
        />

        <path
          d="M 48 20 C 58 20, 58 52, 75 52 C 94 52, 94 20, 102 20"
          stroke="#374151"
          strokeWidth={2.5}
          fill="none"
        />

        <circle cx={56} cy={26} r={3.5} fill={printSafe ? '#000' : '#111827'} />
        <circle cx={94} cy={26} r={3.5} fill={printSafe ? '#000' : '#111827'} />
      </svg>

      {showLabel && (
        <span style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          Filling loop
        </span>
      )}
    </div>
  );
}

export default FillingLoopPrimitive;
