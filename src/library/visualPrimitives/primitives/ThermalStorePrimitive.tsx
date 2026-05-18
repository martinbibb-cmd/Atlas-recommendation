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

/**
 * ThermalStorePrimitive
 *
 * Physical primitive for an indirect thermal store (buffer vessel).
 *
 * Physical model:
 *   - The vessel body contains PRIMARY / SYSTEM water (not potable).
 *   - A heat-exchanger coil inside the vessel heats a separate POTABLE water
 *     circuit — there is NO mixing between primary and potable water.
 *
 * Connection ports (viewBox 94×144):
 *   LEFT side  — primary / heating circuit:
 *     y=36  — Primary water IN  (hot from boiler / heat source)
 *     y=108 — Primary water OUT (cool return to boiler)
 *   RIGHT side — potable / domestic hot water circuit:
 *     y=36  — Potable hot water OUT (to DHW taps)
 *     y=108 — Cold mains IN       (enters coil at low entry)
 */
export function ThermalStorePrimitive({
  showLabel = true,
  printSafe = false,
  size = 'md',
}: ThermalStorePrimitiveProps) {
  const scale = SCALE[size];

  const primaryBodyFill = printSafe ? '#d1d5db' : '#fde68a';
  const coilColour = printSafe ? '#374151' : '#2563eb';

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label="Thermal store: primary stored water with separate potable heat-exchanger coil"
    >
      <svg
        width={Math.round(94 * scale)}
        height={Math.round(144 * scale)}
        viewBox="0 0 94 144"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Vessel body — contains primary/system water (not potable) */}
        <rect
          x={16}
          y={12}
          width={60}
          height={120}
          rx={16}
          fill={printSafe ? '#e5e7eb' : '#e2e8f0'}
          stroke="#334155"
          strokeWidth={2}
          data-testid="thermal-store-primary-body"
        />

        {/* Primary water fill — amber/warm indicates stored heat */}
        <rect
          x={18}
          y={14}
          width={56}
          height={116}
          rx={14}
          fill={primaryBodyFill}
          opacity={0.7}
        />

        {/* "Primary" label inside body */}
        <text
          x={46}
          y={50}
          textAnchor="middle"
          fontSize={7}
          fontFamily="system-ui, sans-serif"
          fontWeight="bold"
          fill={printSafe ? '#374151' : '#92400e'}
        >
          Primary
        </text>
        <text
          x={46}
          y={60}
          textAnchor="middle"
          fontSize={7}
          fontFamily="system-ui, sans-serif"
          fill={printSafe ? '#374151' : '#92400e'}
        >
          water
        </text>

        {/*
          Internal heat-exchanger coil — potable water path.
          Blue serpentine to distinguish clearly from primary water.
          Cold mains enters bottom-right, travels up through coil,
          exits as hot DHW at top-right.
        */}
        <path
          d="M 62 104 C 50 96, 30 88, 30 76 C 30 64, 50 60, 62 52 C 50 46, 30 40, 30 32"
          stroke={coilColour}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          data-testid="thermal-store-coil"
        />

        {/* "Coil" label */}
        <text
          x={46}
          y={96}
          textAnchor="middle"
          fontSize={6}
          fontFamily="system-ui, sans-serif"
          fill={coilColour}
          opacity={0.85}
        >
          Coil
        </text>

        {/* PRIMARY stubs — left side */}
        <line
          x1={16} y1={36}
          x2={4}  y2={36}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="thermal-store-primary-in"
          data-port-position="left-top"
        />
        <line
          x1={16} y1={108}
          x2={4}  y2={108}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="thermal-store-primary-out"
          data-port-position="left-bottom"
        />

        {/* POTABLE stubs — right side */}
        <line
          x1={76} y1={36}
          x2={88} y2={36}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="thermal-store-potable-hot-out"
          data-port-position="right-top"
        />
        <line
          x1={76} y1={108}
          x2={88} y2={108}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="thermal-store-potable-cold-in"
          data-port-position="right-bottom"
        />
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
