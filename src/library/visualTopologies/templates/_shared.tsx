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

export type PortPoint = { x: number; y: number };

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

export function scaledPoint(x: number, y: number): PortPoint {
  return { x: x * SM_SCALE, y: y * SM_SCALE };
}

export function offsetPoint(left: number, top: number, point: PortPoint): PortPoint {
  return { x: left + point.x, y: top + point.y };
}

// ─── Pre-computed SM port sets ────────────────────────────────────────────────

export const CYLINDER_SM_PORTS = {
  hotOut: scaledPoint(42, 0),
  coldIn: scaledPoint(42, 132),
  coilFlowIn: scaledPoint(0, 87),
  coilFlowOut: scaledPoint(84, 100),
  safetyDischarge: scaledPoint(70, 90),
};

export const THERMAL_STORE_SM_PORTS = {
  primaryIn: scaledPoint(4, 36),
  primaryOut: scaledPoint(4, 108),
  potableHotOut: scaledPoint(88, 36),
  potableColdIn: scaledPoint(88, 108),
};

export const MAGNETIC_FILTER_SM_PORTS = {
  inlet: scaledPoint(4, 52),
  outlet: scaledPoint(156, 52),
};

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
