/**
 * _shared.tsx — Shared helpers for topology template files.
 *
 * All topology templates import from here. Do not import directly from
 * the parent visualTopologies.tsx — this file IS the shared utility layer
 * for the split templates directory.
 */

import type { CSSProperties, ReactNode } from 'react';
import {
  AUX_COLOUR,
  FLOW_COLOUR,
  PIPE_STROKE_BRANCH,
  PIPE_STROKE_MAIN,
  PIPE_LABEL_FONT_SIZE,
  PIPE_LABEL_STANDOFF,
  PRINT_FLOW_COLOUR,
  PRINT_RETURN_COLOUR,
  RETURN_COLOUR,
  RETURN_PIPE_DASH,
  PRINT_RETURN_DASH,
} from '../../visualPrimitives/primitiveTokens';
import type { VisualTopologyRenderOptions } from '../topologies/types';

// ─── Re-export for template consumers ────────────────────────────────────────

export {
  AUX_COLOUR,
  FLOW_COLOUR,
  PIPE_STROKE_BRANCH,
  PIPE_STROKE_MAIN,
  PRINT_FLOW_COLOUR,
  PRINT_RETURN_COLOUR,
  RETURN_COLOUR,
  RETURN_PIPE_DASH,
  PRINT_RETURN_DASH,
};
export type { VisualTopologyRenderOptions };

// ─── Shared type ──────────────────────────────────────────────────────────────

export type PortSide = 'top' | 'bottom' | 'left' | 'right' | 'left-top' | 'left-bottom' | 'right-top' | 'right-bottom';
export type PortPoint = { x: number; y: number; side?: PortSide };
export type PipeSegment = { x1: number; y1: number; x2: number; y2: number };

// ─── Style helpers ────────────────────────────────────────────────────────────

export function frameStyle(mobileWidth: boolean): CSSProperties {
  return {
    position: 'relative',
    width: mobileWidth ? 320 : 860,
    height: mobileWidth ? 500 : 430,
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    background: '#fff',
    overflow: 'hidden',
  };
}

export function nodeStyle(left: number, top: number): CSSProperties {
  return { position: 'absolute', left, top };
}

export function noCylinderNoteStyle(): CSSProperties {
  return { position: 'absolute', right: 20, bottom: 18, fontSize: 12, color: '#475569' };
}

export function pressureStateLabelStyle(): CSSProperties {
  return { position: 'absolute', left: 614, top: 22, fontSize: 11, color: '#6b7280', display: 'grid', gap: 98 };
}

// ─── Pipe colour / dash helpers ───────────────────────────────────────────────

export function pipeStroke(printSafe: boolean, flow: boolean): string {
  if (flow) return printSafe ? PRINT_FLOW_COLOUR : FLOW_COLOUR;
  return printSafe ? PRINT_RETURN_COLOUR : RETURN_COLOUR;
}

export function pipeDash(printSafe: boolean, flow: boolean): string | undefined {
  if (flow) return undefined;
  return printSafe ? PRINT_RETURN_DASH : RETURN_PIPE_DASH;
}

// ─── Port scaling helpers ─────────────────────────────────────────────────────

const SM_SCALE = 0.7;

export function scaledPoint(x: number, y: number, side?: PortSide): PortPoint {
  return { x: x * SM_SCALE, y: y * SM_SCALE, side };
}

export function offsetPoint(left: number, top: number, point: PortPoint): PortPoint {
  return { x: left + point.x, y: top + point.y, side: point.side };
}

// ─── Pre-computed SM port sets ────────────────────────────────────────────────

export const CYLINDER_SM_PORTS = {
  hotOut: scaledPoint(42, 0, 'top'),
  coldIn: scaledPoint(42, 132, 'bottom'),
  coilFlowIn: scaledPoint(0, 87, 'left'),
  coilFlowOut: scaledPoint(84, 100, 'right'),
  safetyDischarge: scaledPoint(70, 90, 'right'),
};

export const THERMAL_STORE_SM_PORTS = {
  primaryIn: scaledPoint(4, 36, 'left-top'),
  primaryOut: scaledPoint(4, 108, 'left-bottom'),
  potableHotOut: scaledPoint(88, 36, 'right-top'),
  potableColdIn: scaledPoint(88, 108, 'right-bottom'),
};

export const MAGNETIC_FILTER_SM_PORTS = {
  inlet: scaledPoint(4, 52, 'left'),
  outlet: scaledPoint(156, 52, 'right'),
};

export const PUMP_SM_PORTS = {
  flowIn: scaledPoint(4, 34, 'left'),
  flowOut: scaledPoint(126, 34, 'right'),
};

export const POWERFLUSH_SM_PORTS = {
  systemInlet: scaledPoint(4, 56, 'left'),
  systemOutlet: scaledPoint(120, 56, 'right'),
};

export const MIXERGY_SM_PORTS = {
  hotDrawOff: scaledPoint(42, 0, 'top'),
  coldInlet: scaledPoint(42, 132, 'bottom'),
  primaryFlowIn: scaledPoint(0, 87, 'left'),
  primaryReturnOut: scaledPoint(84, 100, 'right'),
};

export const BOILER_COMBI_SM_PORTS = {
  primaryReturn: scaledPoint(28, 136, 'bottom'),
  coldMainsIn: scaledPoint(42, 136, 'bottom'),
  gasSupply: scaledPoint(56, 136, 'bottom'),
  dhwOut: scaledPoint(70, 136, 'bottom'),
  primaryFlow: scaledPoint(84, 136, 'bottom'),
};

export const BOILER_SYSTEM_SM_PORTS = {
  primaryReturn: scaledPoint(32, 136, 'bottom'),
  gasSupply: scaledPoint(56, 136, 'bottom'),
  primaryFlow: scaledPoint(80, 136, 'bottom'),
};

// ─── Connection geometry helpers ────────────────────────────────────────────────

function normalizePortSide(side?: PortSide): 'top' | 'bottom' | 'left' | 'right' | undefined {
  if (!side) return undefined;
  if (side.startsWith('left')) return 'left';
  if (side.startsWith('right')) return 'right';
  if (side === 'top' || side === 'bottom') return side;
  return undefined;
}

/**
 * Nudges an external route endpoint slightly inside connector geometry.
 * `depth` is the in-port overlap in SVG units to avoid floating pipe terminations.
 */
export function portAttachPoint(port: PortPoint, depth = 2): PortPoint {
  const side = normalizePortSide(port.side);
  switch (side) {
    case 'top':
      return { x: port.x, y: port.y + depth, side };
    case 'bottom':
      return { x: port.x, y: port.y - depth, side };
    case 'left':
      return { x: port.x + depth, y: port.y, side };
    case 'right':
      return { x: port.x - depth, y: port.y, side };
    default:
      return { ...port };
  }
}

/**
 * Builds a two-segment L-shaped route between two points.
 * `mode` controls whether the first leg is horizontal or vertical.
 */
export function elbowSegments(
  from: PortPoint,
  to: PortPoint,
  mode: 'horizontal-first' | 'vertical-first' = 'horizontal-first',
): readonly PipeSegment[] {
  if (mode === 'horizontal-first') {
    return [
      { x1: from.x, y1: from.y, x2: to.x, y2: from.y },
      { x1: to.x, y1: from.y, x2: to.x, y2: to.y },
    ] as const;
  }
  return [
    { x1: from.x, y1: from.y, x2: from.x, y2: to.y },
    { x1: from.x, y1: to.y, x2: to.x, y2: to.y },
  ] as const;
}

export function dropOrRiseSegment(x: number, fromY: number, toY: number): readonly PipeSegment[] {
  return [{ x1: x, y1: fromY, x2: x, y2: toY }] as const;
}

export function teeSegments(
  railStartX: number,
  railEndX: number,
  railY: number,
  branchX: number,
  branchToY: number,
): readonly PipeSegment[] {
  return [
    { x1: railStartX, y1: railY, x2: railEndX, y2: railY },
    { x1: branchX, y1: railY, x2: branchX, y2: branchToY },
  ] as const;
}

/**
 * Splits a horizontal rail into two segments around an inline service body.
 * The gap between `serviceInX` and `serviceOutX` is reserved for the component.
 */
export function inlineServiceSegments(
  lineStartX: number,
  lineEndX: number,
  y: number,
  serviceInX: number,
  serviceOutX: number,
): readonly PipeSegment[] {
  return [
    { x1: lineStartX, y1: y, x2: serviceInX, y2: y },
    { x1: serviceOutX, y1: y, x2: lineEndX, y2: y },
  ] as const;
}

// ─── Pipe label helper ────────────────────────────────────────────────────────

/**
 * Returns SVG text props with a canonical 8px standoff from the pipe line.
 */
export function pipeLabelProps(
  x: number,
  pipeY: number,
  direction: 'above' | 'below',
  fill: string,
): { x: number; y: number; fontSize: number; fontFamily: string; fill: string } {
  const y =
    direction === 'above'
      ? pipeY - PIPE_LABEL_STANDOFF
      : pipeY + PIPE_LABEL_STANDOFF + PIPE_LABEL_FONT_SIZE;
  return { x, y, fontSize: PIPE_LABEL_FONT_SIZE, fontFamily: 'system-ui, sans-serif', fill };
}

// ─── MidPipeArrow ─────────────────────────────────────────────────────────────

/**
 * Renders a directional arrowhead mid-pipe when pipeTrace mode is active.
 */
export function MidPipeArrow({
  midX,
  y,
  direction,
  color,
}: {
  midX: number;
  y: number;
  direction: 'right' | 'left' | 'down' | 'up';
  color: string;
}) {
  const size = 5;
  let points: string;
  switch (direction) {
    case 'right':
      points = `${midX - size},${y - size} ${midX + size},${y} ${midX - size},${y + size}`;
      break;
    case 'left':
      points = `${midX + size},${y - size} ${midX - size},${y} ${midX + size},${y + size}`;
      break;
    case 'down':
      points = `${midX - size},${y - size} ${midX},${y + size} ${midX + size},${y - size}`;
      break;
    case 'up':
    default:
      points = `${midX - size},${y + size} ${midX},${y - size} ${midX + size},${y + size}`;
      break;
  }
  return <polygon points={points} fill={color} />;
}

// ─── Layout components ────────────────────────────────────────────────────────

export function TopologyNode({
  role,
  left,
  top,
  children,
}: {
  role: string;
  left: number;
  top: number;
  children: ReactNode;
}) {
  return (
    <div data-topology-component-role={role} style={nodeStyle(left, top)}>
      {children}
    </div>
  );
}

export function PipeLayer({
  children,
  mobileWidth,
}: {
  children: ReactNode;
  mobileWidth: boolean;
}) {
  return (
    <svg
      width={mobileWidth ? 320 : 860}
      height={mobileWidth ? 500 : 430}
      viewBox={mobileWidth ? '0 0 320 500' : '0 0 860 430'}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function TopologyShell({
  options,
  children,
}: {
  options: VisualTopologyRenderOptions;
  children: ReactNode;
}) {
  return <div style={frameStyle(options.mobileWidth)}>{children}</div>;
}
