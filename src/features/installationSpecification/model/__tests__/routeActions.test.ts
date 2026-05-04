/**
 * routeActions.test.ts
 *
 * Unit tests for the pipework route action helpers.
 *
 * Covers (as specified in the problem statement):
 *   1. Drawing a metre-based route returns correct length.
 *   2. Pixel-only route does not return fake length.
 *   3. Manual override stores manual length and confidence.
 *   4. Reused existing route can be recorded without full points.
 *   5. Route summary updates after adding/removing points.
 *
 * Additional coverage:
 *   - buildPipeworkRouteDraft creates a valid initial state.
 *   - updateRouteStatus, updateRouteInstallMethod, updateRouteDiameter.
 *   - updateRoutePenetrations recalculates complexity.
 *   - updateRouteCoordinateSpace sets scale correctly.
 *   - Complexity classification rules.
 */

import { describe, it, expect } from 'vitest';
import {
  buildPipeworkRouteDraft,
  addRoutePoint,
  removeRoutePoint,
  updateRouteStatus,
  updateRouteInstallMethod,
  updateRouteDiameter,
  updateRouteCoordinateSpace,
  updateRoutePenetrations,
  applyManualLengthOverride,
} from '../routeActions';
import type { QuotePlanPipeworkRouteV1 } from '../QuoteInstallationPlanV1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a route with a metre-space scale and the given waypoints. */
function makeMetreRoute(
  coords: [number, number][],
): QuotePlanPipeworkRouteV1 {
  let route = buildPipeworkRouteDraft('gas');
  // Switch to metre coordinate space.
  route = updateRouteCoordinateSpace(route, 'metres');
  for (const [x, y] of coords) {
    route = addRoutePoint(route, { x, y });
  }
  return route;
}

/** Creates a pixel-only route (no scale) with the given waypoints. */
function makePixelRoute(
  coords: [number, number][],
): QuotePlanPipeworkRouteV1 {
  let route = buildPipeworkRouteDraft('gas');
  // Stays in pixel space with no scale (default from buildPipeworkRouteDraft).
  for (const [x, y] of coords) {
    route = addRoutePoint(route, { x, y });
  }
  return route;
}

// ─── 1. Metre-based route returns correct length ───────────────────────────────

describe('routeActions — metre-space length calculation', () => {
  it('returns 3 m for a 3-metre horizontal run', () => {
    const route = makeMetreRoute([[0, 0], [3, 0]]);
    expect(route.calculation.lengthM).toBeCloseTo(3, 5);
    expect(route.calculation.lengthConfidence).toBe('measured_on_plan');
  });

  it('sums multiple segments correctly (3 m + 4 m = 7 m)', () => {
    const route = makeMetreRoute([[0, 0], [3, 0], [3, 4]]);
    expect(route.calculation.lengthM).toBeCloseTo(7, 5);
  });

  it('sets confidence to measured_on_plan for metre-space routes', () => {
    const route = makeMetreRoute([[0, 0], [5, 0]]);
    expect(route.calculation.lengthConfidence).toBe('measured_on_plan');
  });

  it('returns 0 for a single-point metre route', () => {
    const route = makeMetreRoute([[0, 0]]);
    // Single point → lengthM is 0 (no segments).
    expect(route.calculation.lengthM).toBe(0);
  });
});

// ─── 2. Pixel-only route does not return fake length ───────────────────────────

describe('routeActions — pixel-only route without scale', () => {
  it('returns lengthM: null when no scale is set', () => {
    const route = makePixelRoute([[0, 0], [100, 0]]);
    expect(route.calculation.lengthM).toBeNull();
  });

  it('sets lengthConfidence to needs_scale when no scale is set', () => {
    const route = makePixelRoute([[0, 0], [200, 0]]);
    expect(route.calculation.lengthConfidence).toBe('needs_scale');
  });

  it('does NOT invent a length even when points are far apart', () => {
    const route = makePixelRoute([[0, 0], [9999, 0]]);
    expect(route.calculation.lengthM).toBeNull();
  });

  it('returns a length once a scale is applied', () => {
    // 100 px at 0.05 m/px = 5 m
    let route = makePixelRoute([[0, 0], [100, 0]]);
    route = updateRouteCoordinateSpace(route, 'pixels', { metresPerPixel: 0.05 });
    expect(route.calculation.lengthM).toBeCloseTo(5, 5);
    expect(route.calculation.lengthConfidence).toBe('measured_on_plan');
  });
});

// ─── 3. Manual override ───────────────────────────────────────────────────────

describe('routeActions — manual length override', () => {
  it('stores the manual length on the calculation', () => {
    let route = buildPipeworkRouteDraft('condensate');
    route = applyManualLengthOverride(route, 6.5);
    expect(route.calculation.lengthM).toBeCloseTo(6.5, 5);
  });

  it('sets lengthConfidence to manual', () => {
    let route = buildPipeworkRouteDraft('condensate');
    route = applyManualLengthOverride(route, 4.0);
    expect(route.calculation.lengthConfidence).toBe('manual');
  });

  it('preserves existing points after a manual override', () => {
    let route = makeMetreRoute([[0, 0], [3, 0]]);
    route = applyManualLengthOverride(route, 10.0);
    expect(route.points).toHaveLength(2);
    expect(route.calculation.lengthM).toBeCloseTo(10.0, 5);
    expect(route.calculation.lengthConfidence).toBe('manual');
  });

  it('recalculates complexity using the manual length', () => {
    let route = buildPipeworkRouteDraft('heating_flow');
    // Manual length of 15 m should push complexity to high.
    route = applyManualLengthOverride(route, 15.0);
    expect(route.calculation.complexity).toBe('high');
  });

  it('manual override can set length to 0', () => {
    let route = buildPipeworkRouteDraft('gas');
    route = applyManualLengthOverride(route, 0);
    expect(route.calculation.lengthM).toBe(0);
    expect(route.calculation.lengthConfidence).toBe('manual');
  });
});

// ─── 4. Reused existing route without full points ─────────────────────────────

describe('routeActions — reused existing route', () => {
  it('can be created without any points', () => {
    const route = buildPipeworkRouteDraft('heating_return', 'reused_existing');
    expect(route.status).toBe('reused_existing');
    expect(route.points).toHaveLength(0);
  });

  it('has needs_review complexity when no points are drawn', () => {
    const route = buildPipeworkRouteDraft('heating_return', 'reused_existing');
    expect(route.calculation.complexity).toBe('needs_review');
  });

  it('status can be updated via updateRouteStatus', () => {
    let route = buildPipeworkRouteDraft('gas');
    route = updateRouteStatus(route, 'reused_existing');
    expect(route.status).toBe('reused_existing');
  });

  it('reused existing route with a manual length still has correct confidence', () => {
    let route = buildPipeworkRouteDraft('heating_flow', 'reused_existing');
    route = applyManualLengthOverride(route, 8.5);
    expect(route.status).toBe('reused_existing');
    expect(route.calculation.lengthM).toBeCloseTo(8.5, 5);
    expect(route.calculation.lengthConfidence).toBe('manual');
  });
});

// ─── 5. Route summary updates after adding/removing points ────────────────────

describe('routeActions — route summary updates on point changes', () => {
  it('adds a point and updates the point count', () => {
    let route = buildPipeworkRouteDraft('gas');
    route = updateRouteCoordinateSpace(route, 'metres');
    route = addRoutePoint(route, { x: 0, y: 0 });
    expect(route.points).toHaveLength(1);
    expect(route.points[0].kind).toBe('start');
  });

  it('adds two points and assigns start/end kinds', () => {
    const route = makeMetreRoute([[0, 0], [5, 0]]);
    expect(route.points[0].kind).toBe('start');
    expect(route.points[1].kind).toBe('end');
  });

  it('length increases as points are added', () => {
    let route = buildPipeworkRouteDraft('gas');
    route = updateRouteCoordinateSpace(route, 'metres');
    route = addRoutePoint(route, { x: 0, y: 0 });
    route = addRoutePoint(route, { x: 3, y: 0 });
    expect(route.calculation.lengthM).toBeCloseTo(3, 5);
    route = addRoutePoint(route, { x: 3, y: 4 });
    // 3 + 4 = 7 m total
    expect(route.calculation.lengthM).toBeCloseTo(7, 5);
  });

  it('removing the last point reduces the count and recalculates', () => {
    let route = makeMetreRoute([[0, 0], [3, 0], [3, 4]]);
    expect(route.points).toHaveLength(3);
    route = removeRoutePoint(route, 2); // remove last
    expect(route.points).toHaveLength(2);
    expect(route.calculation.lengthM).toBeCloseTo(3, 5);
  });

  it('removing the only point leaves the route empty with needs_review', () => {
    let route = makeMetreRoute([[0, 0]]);
    route = removeRoutePoint(route, 0);
    expect(route.points).toHaveLength(0);
    expect(route.calculation.complexity).toBe('needs_review');
  });

  it('out-of-range remove index is silently ignored', () => {
    const route = makeMetreRoute([[0, 0], [3, 0]]);
    const unchanged = removeRoutePoint(route, 99);
    expect(unchanged).toBe(route);
  });

  it('complexity updates when install method changes to concealed', () => {
    let route = makeMetreRoute([[0, 0], [2, 0]]); // short surface route → low
    expect(route.calculation.complexity).toBe('low');
    route = updateRouteInstallMethod(route, 'concealed');
    expect(route.calculation.complexity).toBe('high');
  });

  it('penetration counts affect complexity', () => {
    let route = makeMetreRoute([[0, 0], [2, 0]]); // short surface → low
    route = updateRoutePenetrations(route, 2, 0); // 2 wall penetrations → high
    expect(route.calculation.complexity).toBe('high');
    expect(route.calculation.wallPenetrationCount).toBe(2);
  });
});

// ─── Additional helpers ───────────────────────────────────────────────────────

describe('routeActions — updateRouteDiameter', () => {
  it('stores the diameter value', () => {
    let route = buildPipeworkRouteDraft('gas');
    route = updateRouteDiameter(route, '22mm');
    expect(route.diameter).toBe('22mm');
  });

  it('clears the diameter when undefined is passed', () => {
    let route = buildPipeworkRouteDraft('gas');
    route = updateRouteDiameter(route, '22mm');
    route = updateRouteDiameter(route, undefined);
    expect(route.diameter).toBeUndefined();
  });
});

describe('routeActions — buildPipeworkRouteDraft', () => {
  it('initialises with zero points', () => {
    const route = buildPipeworkRouteDraft('gas');
    expect(route.points).toHaveLength(0);
  });

  it('initialises with surface install method', () => {
    const route = buildPipeworkRouteDraft('heating_flow');
    expect(route.installMethod).toBe('surface');
  });

  it('initialises in pixel coordinate space', () => {
    const route = buildPipeworkRouteDraft('condensate');
    expect(route.coordinateSpace).toBe('pixels');
    expect(route.scale).toBeUndefined();
  });

  it('assigns a unique pipeworkRouteId per call', () => {
    const a = buildPipeworkRouteDraft('gas');
    const b = buildPipeworkRouteDraft('gas');
    expect(a.pipeworkRouteId).not.toBe(b.pipeworkRouteId);
  });

  it('sets the correct routeKind', () => {
    expect(buildPipeworkRouteDraft('condensate').routeKind).toBe('condensate');
    expect(buildPipeworkRouteDraft('heating_return').routeKind).toBe('heating_return');
  });

  it('default status is proposed', () => {
    const route = buildPipeworkRouteDraft('gas');
    expect(route.status).toBe('proposed');
  });
});
