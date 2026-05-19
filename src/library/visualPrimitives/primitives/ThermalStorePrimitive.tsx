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

/** Canonical bounding box of the ThermalStorePrimitive SVG at md scale (viewBox units). */
export const THERMAL_STORE_FOOTPRINT = { width: 94, height: 144 } as const;

/**
 * Canonical port coordinates for ThermalStorePrimitive (viewBox units, md scale).
 *
 * Left side — PRIMARY / heating circuit water:
 *   primary_in  (top-left)  — hot from boiler
 *   primary_out (btm-left)  — cooled return to boiler
 *
 * Right side — POTABLE / DHW circuit (separate, no mixing):
 *   potable_hot_out  (top-right) — hot DHW to taps
 *   cold_mains_in    (btm-right) — cold mains enters coil
 */
export const THERMAL_STORE_PORTS = {
  primary_in:      { x: 4,  y: 36,  side: 'left'  as const },
  primary_out:     { x: 4,  y: 108, side: 'left'  as const },
  potable_hot_out: { x: 88, y: 36,  side: 'right' as const },
  cold_mains_in:   { x: 88, y: 108, side: 'right' as const },
} as const;

// Coil path anchor Y positions (in viewBox units).
// The coil path traces cold-in (bottom) to hot-out (top) through the vessel.
const COIL_COLD_Y = 104; // bottom entry — cold mains connection
const COIL_MID_Y  = 76;  // mid-bend centre
const COIL_HOT_Y  = 32;  // top exit — hot DHW connection

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

  const vesselBodyFill = printSafe ? '#d1d5db' : '#f59e0b';
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
        {/* Heavier vessel body — intentionally distinct from smart-cylinder styling */}
        <rect
          x={16}
          y={12}
          width={60}
          height={120}
          rx={16}
          fill={printSafe ? '#e5e7eb' : '#dbeafe'}
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
          fill={vesselBodyFill}
          opacity={0.7}
        />

        {/*
          Internal heat-exchanger coil — potable water path.
          Blue serpentine to distinguish clearly from primary water.
          Cold mains enters bottom-right, travels up through coil,
          exits as hot DHW at top-right.
        */}
        <path
          d={`M 62 ${COIL_COLD_Y} C 50 96, 30 88, 30 ${COIL_MID_Y} C 30 64, 50 60, 62 52 C 50 46, 30 40, 30 ${COIL_HOT_Y}`}
          stroke={coilColour}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          data-testid="thermal-store-coil"
        />
        <rect
          x={58}
          y={62}
          width={12}
          height={22}
          rx={2}
          fill={printSafe ? '#e5e7eb' : '#f8fafc'}
          stroke={coilColour}
          strokeWidth={1.5}
          data-testid="thermal-store-plate-hex"
        />

        {/* PRIMARY stubs — left side */}
        <line
          x1={16} y1={36}
          x2={4}  y2={36}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="thermal-store-primary-in"
          data-port-position="left-top"
          data-port-role="thermal_store_primary_in"
        />
        <line
          x1={16} y1={108}
          x2={4}  y2={108}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="thermal-store-primary-out"
          data-port-position="left-bottom"
          data-port-role="thermal_store_primary_out"
        />

        {/* POTABLE stubs — right side */}
        <line
          x1={76} y1={36}
          x2={88} y2={36}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="thermal-store-potable-hot-out"
          data-port-position="right-top"
          data-port-role="thermal_store_potable_hot_out"
        />
        <line
          x1={76} y1={108}
          x2={88} y2={108}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="thermal-store-potable-cold-in"
          data-port-position="right-bottom"
          data-port-role="thermal_store_potable_cold_in"
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
