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
import { SLUDGE_SETTLE_CLASS } from '../primitiveMotion';
import type { PrimitiveSize } from './BoilerPrimitive';

export interface MagneticFilterPrimitiveProps {
  showLabel?: boolean;
  printSafe?: boolean;
  size?: PrimitiveSize;
  /** When true, animates sludge particle dots settling toward the magnet on mount. Defaults to false. */
  animateFlow?: boolean;
}

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };

export function MagneticFilterPrimitive({
  showLabel = true,
  printSafe = false,
  size = 'md',
  animateFlow = false,
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
        height={Math.round(100 * scale)}
        viewBox="0 0 160 100"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Return pipe — left inlet */}
        <line
          x1={4}
          y1={82}
          x2={48}
          y2={82}
          stroke={printSafe ? '#000' : AUX_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
          data-testid="magnetic-filter-return-in-port"
          data-port-position="left"
          data-port-role="magnetic_filter_return_in"
        />

        {/* Isolation valve (inlet side) */}
        <rect x={46} y={76} width={10} height={12} rx={2} fill={printSafe ? '#9ca3af' : '#64748b'} data-testid="magnetic-filter-isolation-valve-left" />

        {/* Vertical service body */}
        <rect
          x={64}
          y={20}
          width={32}
          height={62}
          rx={8}
          fill={printSafe ? '#e5e7eb' : '#f1f5f9'}
          stroke="#334155"
          strokeWidth={2}
          data-testid="magnetic-filter-service-body"
        />

        {/* Service cap */}
        <rect x={68} y={10} width={24} height={12} rx={4} fill="#374151" stroke="#1f2937" strokeWidth={1} />

        {/* Magnet core */}
        <line
          x1={80}
          y1={24}
          x2={80}
          y2={74}
          stroke={printSafe ? '#000' : '#7c3aed'}
          strokeWidth={3}
        />

        {/* Magnetite particle dots */}
        {[
          { cx: 72, cy: 50 },
          { cx: 74, cy: 58 },
          { cx: 86, cy: 46 },
          { cx: 88, cy: 62 },
          { cx: 76, cy: 68 },
        ].map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={3.5}
            fill={printSafe ? '#555' : '#1c1917'}
            opacity={0.75}
            className={animateFlow && !printSafe ? SLUDGE_SETTLE_CLASS : undefined}
            style={animateFlow && !printSafe ? { animationDelay: `${i * 0.1}s` } : undefined}
          />
        ))}

        {/* Isolation valve (outlet side) */}
        <rect x={104} y={76} width={10} height={12} rx={2} fill={printSafe ? '#9ca3af' : '#64748b'} data-testid="magnetic-filter-isolation-valve-right" />

        {/* Return pipe outlet toward boiler */}
        <line
          x1={112}
          y1={82}
          x2={156}
          y2={82}
          stroke={printSafe ? '#555' : AUX_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
          data-testid="magnetic-filter-return-out-port"
          data-port-position="right"
          data-port-role="magnetic_filter_return_out"
        />
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
