/**
 * MagneticFilterPrimitive.tsx
 *
 * Canonical physical primitive for an in-line magnetic filter.
 *
 * Shows:
 *   - A laminar-flow in-line separator body on the heating return pipe
 *   - A service canister / magnet assembly above the body
 *   - A dirt collection bowl below the body
 *   - Magnetite particle dots trapped in the lower chamber
 *   - Inlet pipe on the left and outlet pipe on the right
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
          y1={52}
          x2={44}
          y2={52}
          stroke={printSafe ? '#000' : AUX_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
          data-testid="magnetic-filter-return-in-port"
          data-port-position="left"
          data-port-role="magnetic_filter_return_in"
        />

        {/* Isolation valve (inlet side) */}
        <rect x={38} y={46} width={10} height={12} rx={2} fill={printSafe ? '#9ca3af' : '#64748b'} data-testid="magnetic-filter-isolation-valve-left" />

        {/* Main separator body */}
        <rect
          x={48}
          y={36}
          width={64}
          height={24}
          rx={10}
          fill={printSafe ? '#e5e7eb' : '#f1f5f9'}
          stroke="#334155"
          strokeWidth={2}
          data-testid="magnetic-filter-service-body"
        />
        <path
          d="M 58 48 H 102"
          stroke={printSafe ? '#9ca3af' : '#94a3b8'}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path
          d="M 70 42 C 76 39, 84 39, 90 42"
          stroke={printSafe ? '#9ca3af' : '#60a5fa'}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />

        {/* Service canister / magnet head */}
        <rect x={69} y={8} width={22} height={24} rx={6} fill={printSafe ? '#d1d5db' : '#e2e8f0'} stroke="#334155" strokeWidth={1.5} />
        <rect x={72} y={4} width={16} height={7} rx={3} fill="#374151" stroke="#1f2937" strokeWidth={1} />

        {/* Magnet core */}
        <line
          x1={80}
          y1={12}
          x2={80}
          y2={76}
          stroke={printSafe ? '#000' : '#7c3aed'}
          strokeWidth={3}
        />

        {/* Dirt bowl / service sump */}
        <path
          d="M 64 60 H 96 L 92 84 H 68 Z"
          fill={printSafe ? '#e5e7eb' : '#dbeafe'}
          stroke="#334155"
          strokeWidth={2}
        />
        <circle cx={80} cy={84} r={3} fill={printSafe ? '#6b7280' : '#475569'} />

        {/* Magnetite particle dots */}
        {[
          { cx: 72, cy: 70 },
          { cx: 76, cy: 76 },
          { cx: 84, cy: 68 },
          { cx: 88, cy: 76 },
          { cx: 80, cy: 72 },
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
        <rect x={112} y={46} width={10} height={12} rx={2} fill={printSafe ? '#9ca3af' : '#64748b'} data-testid="magnetic-filter-isolation-valve-right" />

        {/* Return pipe outlet toward boiler */}
        <line
          x1={116}
          y1={52}
          x2={156}
          y2={52}
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
