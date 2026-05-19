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

/** Canonical bounding box of the FillingLoopPrimitive SVG at md scale (viewBox units). */
export const FILLING_LOOP_FOOTPRINT = { width: 150, height: 70 } as const;

/**
 * Canonical port coordinates for FillingLoopPrimitive (viewBox units, md scale).
 * The filling loop bridges the cold mains (return) to the sealed circuit (flow).
 */
export const FILLING_LOOP_PORTS = {
  flow_in:    { x: 8,   y: 20, side: 'left'  as const },
  flow_out:   { x: 142, y: 20, side: 'right' as const },
  return_in:  { x: 8,   y: 52, side: 'left'  as const },
  return_out: { x: 142, y: 52, side: 'right' as const },
} as const;

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };
const FLOW_PIPE_Y = 20;
const RETURN_PIPE_Y = 52;
const HOSE_LEFT_X = 54;
const HOSE_RIGHT_X = 96;
const HOSE_TOP_Y = 28;
const HOSE_BOTTOM_Y = 44;
const DISCONNECT_GAP_START_X = 73;
const DISCONNECT_GAP_END_X = 77;

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
          y1={FLOW_PIPE_Y}
          x2={142}
          y2={FLOW_PIPE_Y}
          stroke={printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
        />
        <line
          x1={8}
          y1={RETURN_PIPE_Y}
          x2={142}
          y2={RETURN_PIPE_Y}
          stroke={printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR}
          strokeWidth={PIPE_STROKE_MAIN}
          strokeDasharray={printSafe ? PRINT_RETURN_DASH : RETURN_PIPE_DASH}
        />

        {/* Isolation valves */}
        <rect
          x={HOSE_LEFT_X - 6}
          y={FLOW_PIPE_Y + 1}
          width={12}
          height={8}
          rx={2}
          fill={printSafe ? '#9ca3af' : '#64748b'}
          data-testid="filling-loop-isolation-valve-left"
        />
        <rect
          x={HOSE_RIGHT_X - 6}
          y={FLOW_PIPE_Y + 1}
          width={12}
          height={8}
          rx={2}
          fill={printSafe ? '#9ca3af' : '#64748b'}
          data-testid="filling-loop-isolation-valve-right"
        />

        {/* Braided flexible hose (ghosted/disconnected default) */}
        <path
          d={`M ${HOSE_LEFT_X} ${FLOW_PIPE_Y + 8} C ${HOSE_LEFT_X + 4} ${HOSE_TOP_Y}, ${HOSE_LEFT_X + 8} ${HOSE_BOTTOM_Y}, ${DISCONNECT_GAP_START_X} ${HOSE_BOTTOM_Y}`}
          stroke={printSafe ? '#374151' : '#6b7280'}
          strokeWidth={3}
          strokeDasharray="2 2"
          opacity={0.65}
          fill="none"
          data-testid="filling-loop-ghost-link-left"
        />
        <path
          d={`M ${DISCONNECT_GAP_END_X} ${HOSE_BOTTOM_Y} C ${HOSE_RIGHT_X - 8} ${HOSE_BOTTOM_Y}, ${HOSE_RIGHT_X - 4} ${HOSE_TOP_Y}, ${HOSE_RIGHT_X} ${FLOW_PIPE_Y + 8}`}
          stroke={printSafe ? '#374151' : '#6b7280'}
          strokeWidth={3}
          strokeDasharray="2 2"
          opacity={0.65}
          fill="none"
          data-testid="filling-loop-ghost-link-right"
        />
        <path
          d={`M ${HOSE_LEFT_X} ${FLOW_PIPE_Y + 8} C ${HOSE_LEFT_X + 3} ${HOSE_TOP_Y}, ${HOSE_LEFT_X + 8} ${HOSE_BOTTOM_Y}, ${DISCONNECT_GAP_START_X} ${HOSE_BOTTOM_Y} M ${DISCONNECT_GAP_END_X} ${HOSE_BOTTOM_Y} C ${HOSE_RIGHT_X - 8} ${HOSE_BOTTOM_Y}, ${HOSE_RIGHT_X - 3} ${HOSE_TOP_Y}, ${HOSE_RIGHT_X} ${FLOW_PIPE_Y + 8}`}
          stroke={printSafe ? '#111827' : '#94a3b8'}
          strokeWidth={1}
          strokeDasharray="1 5"
          fill="none"
          data-testid="filling-loop-braided-hose"
        />
        <line
          x1={DISCONNECT_GAP_START_X}
          y1={HOSE_BOTTOM_Y}
          x2={DISCONNECT_GAP_END_X}
          y2={HOSE_BOTTOM_Y}
          stroke={printSafe ? '#000' : '#9ca3af'}
          strokeWidth={2}
          data-testid="filling-loop-disconnect-gap"
        />
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
