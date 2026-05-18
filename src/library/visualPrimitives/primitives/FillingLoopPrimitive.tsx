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

const SCALE: Record<PrimitiveSize, number> = { sm: 0.7, md: 1, lg: 1.4 };
const FLOW_PIPE_Y = 20;
const RETURN_PIPE_Y = 52;
const LEFT_GHOST_LINK_GEOMETRY = { startX: 48, joinX: 72, controlX: 58 } as const;
const RIGHT_GHOST_LINK_GEOMETRY = { joinX: 78, endX: 102, controlX: 92 } as const;
const GHOST_LINK_CURVE_Y = 47;
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

        <path
          d={`M ${LEFT_GHOST_LINK_GEOMETRY.startX} ${FLOW_PIPE_Y} C ${LEFT_GHOST_LINK_GEOMETRY.controlX} ${FLOW_PIPE_Y}, ${LEFT_GHOST_LINK_GEOMETRY.controlX} ${GHOST_LINK_CURVE_Y}, ${LEFT_GHOST_LINK_GEOMETRY.joinX} ${GHOST_LINK_CURVE_Y}`}
          stroke="#374151"
          strokeWidth={2.5}
          strokeDasharray="3 2"
          opacity={0.7}
          data-testid="filling-loop-ghost-link-left"
          fill="none"
        />
        <path
          d={`M ${RIGHT_GHOST_LINK_GEOMETRY.joinX} ${GHOST_LINK_CURVE_Y} C ${RIGHT_GHOST_LINK_GEOMETRY.controlX} ${GHOST_LINK_CURVE_Y}, ${RIGHT_GHOST_LINK_GEOMETRY.controlX} ${FLOW_PIPE_Y}, ${RIGHT_GHOST_LINK_GEOMETRY.endX} ${FLOW_PIPE_Y}`}
          stroke="#374151"
          strokeWidth={2.5}
          strokeDasharray="3 2"
          opacity={0.7}
          data-testid="filling-loop-ghost-link-right"
          fill="none"
        />

        <circle cx={56} cy={26} r={3.5} fill={printSafe ? '#000' : '#111827'} />
        <circle cx={94} cy={26} r={3.5} fill={printSafe ? '#000' : '#111827'} />
        <line
          x1={DISCONNECT_GAP_START_X}
          y1={GHOST_LINK_CURVE_Y}
          x2={DISCONNECT_GAP_END_X}
          y2={GHOST_LINK_CURVE_Y}
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
