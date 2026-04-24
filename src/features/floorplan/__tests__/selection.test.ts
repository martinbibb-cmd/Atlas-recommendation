/**
 * selection.test.ts — PR31 regression tests for hit-test helpers.
 *
 * Covers:
 *   1. selectFloorRoute — finds the correct route by polyline proximity
 *   2. selectFloorRoute — returns null when no route is nearby
 *   3. selectFloorRoute — ignores routes with fewer than 2 points
 *   4. selectFloorRoute — picks the closest route when multiple overlap
 *   5. selectFloorRoute — works with multi-segment polylines
 */

import { describe, it, expect } from 'vitest';
import { selectFloorRoute } from '../selection';
import type { FloorRoute } from '../../../components/floorplan/propertyPlan.types';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeRoute(
  id: string,
  points: { x: number; y: number }[],
  type: FloorRoute['type'] = 'flow',
): FloorRoute {
  return {
    id,
    floorId: 'f1',
    type,
    status: 'existing',
    points,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('selectFloorRoute', () => {
  // 1. Finds the route when the pointer is directly on the segment
  it('returns the route when pointer is on the segment', () => {
    const route = makeRoute('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    const result = selectFloorRoute({ x: 50, y: 0 }, [route]);
    expect(result?.id).toBe('r1');
  });

  // 2. Finds the route when pointer is slightly off the segment (within threshold)
  it('returns the route when pointer is within hit radius', () => {
    const route = makeRoute('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    // Pointer is 8px away from the segment — within ROUTE_HIT_DIST_PX (10)
    const result = selectFloorRoute({ x: 50, y: 8 }, [route]);
    expect(result?.id).toBe('r1');
  });

  // 3. Returns null when pointer is too far from any route
  it('returns null when pointer is outside hit radius', () => {
    const route = makeRoute('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    // Pointer is 20px away — outside threshold
    const result = selectFloorRoute({ x: 50, y: 20 }, [route]);
    expect(result).toBeNull();
  });

  // 4. Returns null for an empty routes array
  it('returns null when routes array is empty', () => {
    const result = selectFloorRoute({ x: 50, y: 0 }, []);
    expect(result).toBeNull();
  });

  // 5. Picks the closest route when two routes overlap the hit radius
  it('returns the closest route when multiple routes are nearby', () => {
    const closeRoute = makeRoute('close', [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    const farRoute  = makeRoute('far',   [{ x: 0, y: 8 }, { x: 100, y: 8 }]);
    // Pointer at y=1 — closeRoute (at y=0) is 1px away; farRoute (at y=8) is 7px away
    const result = selectFloorRoute({ x: 50, y: 1 }, [closeRoute, farRoute]);
    expect(result?.id).toBe('close');
  });

  // 6. Works with multi-segment polylines — hits middle segment
  it('finds a hit on the second segment of a multi-segment route', () => {
    const route = makeRoute('r1', [
      { x: 0,   y: 0 },
      { x: 50,  y: 0 },
      { x: 50,  y: 100 },
      { x: 100, y: 100 },
    ]);
    // Point near the vertical segment x=50, y=0→100 — at (55, 50)
    const result = selectFloorRoute({ x: 55, y: 50 }, [route]);
    expect(result?.id).toBe('r1');
  });

  // 7. Returns null when route has only one point (no segments)
  it('returns null for a single-point route', () => {
    const route = makeRoute('r1', [{ x: 50, y: 50 }]);
    const result = selectFloorRoute({ x: 50, y: 50 }, [route]);
    expect(result).toBeNull();
  });

  // 8. Returns null for a route with no points
  it('returns null for a zero-point route', () => {
    const route = makeRoute('r1', []);
    const result = selectFloorRoute({ x: 50, y: 50 }, [route]);
    expect(result).toBeNull();
  });

  // 9. Hit test works near the endpoint of a segment
  it('returns the route when pointer is near a segment endpoint', () => {
    const route = makeRoute('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    // Pointer is 5px from the start endpoint
    const result = selectFloorRoute({ x: 0, y: 5 }, [route]);
    expect(result?.id).toBe('r1');
  });

  // 10. Correctly resolves two adjacent routes of different types
  it('returns the correct route type when two routes are adjacent', () => {
    const flowRoute    = makeRoute('flow',    [{ x: 0, y: 0  }, { x: 100, y: 0  }], 'flow');
    const returnRoute  = makeRoute('return',  [{ x: 0, y: 24 }, { x: 100, y: 24 }], 'return');
    // Pointer at y=2 — closest to flowRoute
    const result = selectFloorRoute({ x: 50, y: 2 }, [flowRoute, returnRoute]);
    expect(result?.id).toBe('flow');
    expect(result?.type).toBe('flow');
  });
});
