/**
 * MagneticFilterPrimitive.tsx
 *
 * Canonical physical primitive for an in-line magnetic filter.
 *
 * Shows:
 *   - A cylindrical filter body on the heating return pipe
 *   - A vertical magnet core running through the body
 *   - A removable top cap (for service/clean)
 *   - Magnetite particle dots clustered around the magnet core
 *   - Inlet pipe (dirty — dark) on the left
 *   - Outlet pipe (cleaner) on the right
 *
 * Source: src/library/diagrams/MagneticFilterDiagram.tsx
 */

import { AUX_COLOUR, LABEL_FONT_SIZE, PIPE_STROKE_MAIN } from '../primitiveTokens';
import type { PrimitiveSize } from './BoilerPrimitive';

export interface MagneticFilterPrimitiveProps {
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
}

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

export function MagneticFilterPrimitive({
  showLabel = true,
  printSafe = false,
  size = 'md',
}: MagneticFilterPrimitiveProps) {
  const scale = SCALE[size];
  // SVG authored at 160×90

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label="Magnetic filter on heating return pipe"
    >
      <svg
        width={Math.round(160 * scale)}
        height={Math.round(90 * scale)}
        viewBox="0 0 160 90"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Return pipe — left (inlet, dirty flow) */}
        <line
          x1={4} y1={50}
          x2={48} y2={50}
          stroke={printSafe ? '#000' : AUX_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
        />

        {/* Dirty flow — dark particles hint */}
        {!printSafe && (
          <line
            x1={4} y1={50}
            x2={36} y2={50}
            stroke="#78350f"
            strokeWidth={2}
            opacity={0.35}
          />
        )}

        {/* Filter body (rectangle) */}
        <rect
          x={48} y={22}
          width={64} height={56}
          rx={8}
          fill={printSafe ? '#e5e7eb' : '#f1f5f9'}
          stroke="#334155"
          strokeWidth={2}
        />

        {/* Magnet core — vertical line through centre */}
        <line
          x1={80} y1={30}
          x2={80} y2={70}
          stroke={printSafe ? '#000' : '#7c3aed'}
          strokeWidth={3}
        />

        {/* Removable cap at top */}
        <rect
          x={70} y={14}
          width={20} height={9}
          rx={3}
          fill="#374151"
          stroke="#1f2937"
          strokeWidth={1}
        />
        <text
          x={80} y={21}
          textAnchor="middle"
          fontSize={5}
          fontFamily="system-ui"
          fill="#fff"
        >CAP</text>

        {/* Magnetite particle dots */}
        {[
          { cx: 72, cy: 46 },
          { cx: 76, cy: 55 },
          { cx: 84, cy: 42 },
          { cx: 88, cy: 58 },
          { cx: 78, cy: 64 },
        ].map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={3.5}
            fill={printSafe ? '#555' : '#1c1917'}
            opacity={0.75}
          />
        ))}

        {/* Outlet pipe — right (cleaner flow) */}
        <line
          x1={112} y1={50}
          x2={156} y2={50}
          stroke={printSafe ? '#555' : AUX_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
        />

        {/* Pipe labels */}
        <text x={24} y={44} textAnchor="middle" fontSize={7} fontFamily="system-ui" fill="#64748b">
          Return in
        </text>
        <text x={134} y={44} textAnchor="middle" fontSize={7} fontFamily="system-ui" fill="#64748b">
          To boiler
        </text>
        <text
          x={80} y={83}
          textAnchor="middle"
          fontSize={7}
          fontFamily="system-ui"
          fill={printSafe ? '#374151' : '#7c3aed'}
        >
          Magnet core
        </text>
      </svg>

      {showLabel && (
        <span style={{ fontSize: LABEL_FONT_SIZE, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          Magnetic filter
        </span>
      )}
    </div>
  );
}

export default MagneticFilterPrimitive;
