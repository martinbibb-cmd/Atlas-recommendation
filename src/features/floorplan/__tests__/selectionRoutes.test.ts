/**
 * selectionRoutes.test.ts — PR32 supplemental route/room selection coverage.
 *
 * These tests document the priority-gate behaviour of `selectFloorRoute` that
 * underpins the PR31 regression fix:
 *
 *   • When a route lies at the clicked position, `selectFloorRoute` returns it
 *     so the caller (FloorPlanBuilder room.onPointerDown) can select the route
 *     instead of the room underneath.
 *   • When no route is hit, `selectFloorRoute` returns null so room selection
 *     can proceed normally.
 *
 * This complements the comprehensive `selection.test.ts` by framing the tests
 * explicitly around the room-vs-route priority use-case that PR31 fixed.
 */

import { describe, it, expect } from 'vitest';
import { selectFloorRoute } from '../selection';
import type { FloorRoute } from '../../../components/floorplan/propertyPlan.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRoute(overrides: Partial<FloorRoute> & { id: string; points: FloorRoute['points'] }): FloorRoute {
  return {
    floorId: 'f1',
    type:    'flow',
    status:  'existing',
    ...overrides,
  };
}

// ─── Priority-gate tests ──────────────────────────────────────────────────────

describe('selectFloorRoute — route/room priority gate', () => {
  /**
   * Core PR31 scenario: pointer is exactly on a route point (origin of the
   * canvas in jsdom).  The room div is at the same position.  Route must win.
   */
  it('returns the route when the pointer is exactly at a route endpoint', () => {
    const route = makeRoute({ id: 'rt1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
    const result = selectFloorRoute({ x: 0, y: 0 }, [route]);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('rt1');
  });

  /**
   * When there are NO routes on the floor, `selectFloorRoute` must return null
   * so the caller can fall through to room selection.
   */
  it('returns null when the floor has no routes (room selection should proceed)', () => {
    const result = selectFloorRoute({ x: 0, y: 0 }, []);
    expect(result).toBeNull();
  });

  /**
   * When the pointer is far from all routes, null is returned — room wins.
   */
  it('returns null when the pointer is far from all routes', () => {
    const route = makeRoute({ id: 'rt1', points: [{ x: 500, y: 500 }, { x: 600, y: 500 }] });
    // Click near origin — far from the route
    const result = selectFloorRoute({ x: 0, y: 0 }, [route]);
    expect(result).toBeNull();
  });

  /**
   * With two routes, the closer one wins (priority among routes).
   * This prevents the wrong route from being selected when routes are adjacent.
   */
  it('returns the route closest to the pointer when multiple routes are present', () => {
    const near = makeRoute({ id: 'near', points: [{ x: 10, y: 0 }, { x: 50, y: 0 }] });
    const far  = makeRoute({ id: 'far',  points: [{ x: 200, y: 0 }, { x: 300, y: 0 }] });
    const result = selectFloorRoute({ x: 10, y: 0 }, [far, near]);
    expect(result?.id).toBe('near');
  });

  /**
   * Route type and status do not affect whether the route is hit.
   * A 'assumed' discharge route is equally selectable.
   */
  it('selects assumed and non-flow routes without distinction', () => {
    const discharge = makeRoute({
      id: 'dc1', type: 'discharge', status: 'assumed',
      points: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
    });
    const result = selectFloorRoute({ x: 0, y: 0 }, [discharge]);
    expect(result?.id).toBe('dc1');
  });

  /**
   * A route with only one point (degenerate) should NOT prevent normal room
   * selection — returning null keeps room selection intact.
   */
  it('returns null for a degenerate single-point route (no segment to hit)', () => {
    const degenerate = makeRoute({ id: 'degen', points: [{ x: 0, y: 0 }] });
    const result = selectFloorRoute({ x: 0, y: 0 }, [degenerate]);
    expect(result).toBeNull();
  });

  /**
   * Multi-segment polyline: a point on the second segment (not the first)
   * must still return the route.
   */
  it('hits a route on its second segment, not just the first', () => {
    const route = makeRoute({
      id: 'poly',
      points: [
        { x: 0,   y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
    });
    // Point on the second segment (vertical leg)
    const result = selectFloorRoute({ x: 100, y: 50 }, [route]);
    expect(result?.id).toBe('poly');
  });

  /**
   * Route that shares its starting point with a room corner: the route should
   * still be hit when the pointer is on that point.
   */
  it('returns the route when pointer is at a shared room-corner / route-start position', () => {
    // Simulates a route whose first point is at the room's top-left corner (0,0)
    const route = makeRoute({
      id: 'shared',
      points: [{ x: 0, y: 0 }, { x: 80, y: 0 }],
    });
    const result = selectFloorRoute({ x: 0, y: 0 }, [route]);
    expect(result?.id).toBe('shared');
  });
});

// ─── Layer-off guard (no routes visible → always null) ───────────────────────
// NOTE: `selectFloorRoute` itself does not know about layer visibility — the
// caller (FloorPlanBuilder) guards with `if (visibleLayers.routes)`.  These
// tests verify the function is pure and only depends on the provided routes
// array; callers must filter the array before calling when routes are hidden.

describe('selectFloorRoute — pure function contract', () => {
  it('is deterministic: same inputs always produce the same output', () => {
    const route = makeRoute({ id: 'r1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
    const a = selectFloorRoute({ x: 0, y: 0 }, [route]);
    const b = selectFloorRoute({ x: 0, y: 0 }, [route]);
    expect(a?.id).toBe(b?.id);
  });

  it('does not mutate the routes array', () => {
    const routes = [
      makeRoute({ id: 'r1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }),
    ];
    const original = JSON.stringify(routes);
    selectFloorRoute({ x: 0, y: 0 }, routes);
    expect(JSON.stringify(routes)).toBe(original);
  });
});
