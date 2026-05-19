/**
 * routingEngine.ts
 *
 * Rail-aware routing engine for topology pipe segments.
 *
 * Generates PipeSegments from:
 *   - source / target component positions (via LayoutState)
 *   - routing rail identity (CH_FLOW / CH_RETURN / etc.)
 *   - constrained horizontals and verticals only (no decorative curves)
 *
 * Emitter spur positions are DERIVED from the RadiatorPrimitive FOOTPRINT
 * (rule 3 from problem statement: "primitive placement rules / NOT arbitrary x/y").
 *
 * Public helpers:
 *   routeEmitterSpurs()   — both flow and return spurs for one radiator
 *   routeFlowRail()       — horizontal flow rail segment
 *   routeReturnRail()     — horizontal return rail segment
 *   routeVertical()       — constrained vertical segment (elbow connector)
 */

import { RADIATOR_FOOTPRINT } from '../../visualPrimitives/primitives';
import { ROUTING_RAILS } from '../../visualPrimitives/primitiveTokens';
import type { PipeSegment, RailLayout } from './topologyLayoutTypes';

// ─── Derived radiator spur offsets from FOOTPRINT ────────────────────────────
//
// These are the ONLY geometry constants in this file that come from primitive
// dimensions rather than being declared in topologyDeclarations.ts.
// When RadiatorPrimitive.FOOTPRINT changes, the spur offsets update automatically.

const SM_SCALE = 0.7;

/** Rendered width of the RadiatorPrimitive SVG at 'sm' scale. */
const RADIATOR_SM_W = Math.round(RADIATOR_FOOTPRINT.width * SM_SCALE); // 84

/**
 * x offset from radiator left edge to the FLOW spur.
 * Flow spur connects near the right-bottom of the radiator body.
 * 10 px clearance from the right edge.
 */
export const RADIATOR_FLOW_SPUR_OFFSET = RADIATOR_SM_W - 10; // 74

/**
 * x offset from radiator left edge to the RETURN spur.
 * Return spur connects near the left-bottom of the radiator body.
 * 10 px clearance from the left edge.
 */
export const RADIATOR_RETURN_SPUR_OFFSET = 10;

// ─── Emitter spur routing ─────────────────────────────────────────────────────

/**
 * Generate both pipe spurs for one radiator at `emitterLeft`.
 *
 * The spur x positions are derived from RADIATOR_FOOTPRINT (not literals).
 * The spur y positions are from the topology's RailLayout (not literals).
 *
 * Flow spur:   flowRailY → emitterSpurY   (vertical up to radiator bottom)
 * Return spur: emitterSpurY → returnRailY (vertical down to return rail)
 */
export function routeEmitterSpurs(
  emitterLeft: number,
  rails: RailLayout,
): readonly PipeSegment[] {
  const flowSpurX   = emitterLeft + RADIATOR_FLOW_SPUR_OFFSET;
  const returnSpurX = emitterLeft + RADIATOR_RETURN_SPUR_OFFSET;

  return [
    {
      x1: flowSpurX,   y1: rails.flowY,
      x2: flowSpurX,   y2: rails.emitterSpurY,
      rail: ROUTING_RAILS.CH_FLOW,
      strokeKind: 'branch',
    },
    {
      x1: returnSpurX, y1: rails.emitterSpurY,
      x2: returnSpurX, y2: rails.returnY,
      rail: ROUTING_RAILS.CH_RETURN,
      strokeKind: 'branch',
    },
  ] as const;
}

// ─── Horizontal rail helpers ──────────────────────────────────────────────────

/**
 * Horizontal flow rail segment — constrained to `rails.flowY`.
 */
export function routeFlowRail(
  fromX: number,
  toX: number,
  rails: RailLayout,
  testId?: string,
): PipeSegment {
  return {
    x1: fromX, y1: rails.flowY,
    x2: toX,   y2: rails.flowY,
    rail: ROUTING_RAILS.CH_FLOW,
    strokeKind: 'main',
    testId,
  };
}

/**
 * Horizontal return rail segment — constrained to `rails.returnY`.
 */
export function routeReturnRail(
  fromX: number,
  toX: number,
  rails: RailLayout,
  testId?: string,
): PipeSegment {
  return {
    x1: fromX, y1: rails.returnY,
    x2: toX,   y2: rails.returnY,
    rail: ROUTING_RAILS.CH_RETURN,
    strokeKind: 'main',
    testId,
  };
}

// ─── Vertical elbow helper ────────────────────────────────────────────────────

/**
 * Constrained vertical segment (no decorative curves).
 * Used for return leg at heat source, cylinder flow drop, etc.
 */
export function routeVertical(
  x: number,
  fromY: number,
  toY: number,
  rail: (typeof ROUTING_RAILS)[keyof typeof ROUTING_RAILS],
  strokeKind: 'main' | 'branch',
  testId?: string,
): PipeSegment {
  return { x1: x, y1: fromY, x2: x, y2: toY, rail, strokeKind, testId };
}
