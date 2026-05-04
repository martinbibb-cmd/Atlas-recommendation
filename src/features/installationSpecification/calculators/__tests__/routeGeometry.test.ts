/**
 * routeGeometry.test.ts — Unit tests for the route geometry calculators.
 *
 * Covers:
 *   - calculatePolylineLengthM: metre-space routes, pixel routes with/without scale.
 *   - calculateBendCount: explicit bends, waypoint inference flag.
 *   - calculateRouteComplexity: low / medium / high / needs_review classification.
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePolylineLengthM,
  calculateBendCount,
  calculateRouteComplexity,
} from '../routeGeometry';
import type { QuoteRouteV1, QuoteRoutePointV1 } from '../quotePlannerTypes';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMetrePoints(coords: [number, number][]): QuoteRoutePointV1[] {
  return coords.map(([x, y], i) => ({
    x,
    y,
    kind: i === 0 ? 'start' : i === coords.length - 1 ? 'end' : 'waypoint',
  }));
}

function makeBendPoints(coords: [number, number][], bendIndices: number[]): QuoteRoutePointV1[] {
  return coords.map(([x, y], i) => ({
    x,
    y,
    kind: i === 0 ? 'start' : i === coords.length - 1 ? 'end' : bendIndices.includes(i) ? 'bend' : 'waypoint',
  }));
}

// ─── calculatePolylineLengthM ─────────────────────────────────────────────────

describe('calculatePolylineLengthM', () => {
  it('returns 0 for a single-point route', () => {
    const points: QuoteRoutePointV1[] = [{ x: 0, y: 0, kind: 'start' }];
    expect(calculatePolylineLengthM(points, 'metres')).toBe(0);
  });

  it('returns 0 for an empty route', () => {
    expect(calculatePolylineLengthM([], 'metres')).toBe(0);
  });

  it('calculates a 3 m horizontal straight run correctly', () => {
    const points = makeMetrePoints([[0, 0], [3, 0]]);
    expect(calculatePolylineLengthM(points, 'metres')).toBeCloseTo(3, 5);
  });

  it('calculates a right-angle route (3 m + 4 m = 5 m hypotenuse path)', () => {
    // Two segments: 3 m right then 4 m up → total 7 m path length (not hypotenuse).
    const points = makeMetrePoints([[0, 0], [3, 0], [3, 4]]);
    expect(calculatePolylineLengthM(points, 'metres')).toBeCloseTo(7, 5);
  });

  it('returns null for pixel-space route without scale', () => {
    const points: QuoteRoutePointV1[] = [
      { x: 0, y: 0, kind: 'start' },
      { x: 100, y: 0, kind: 'end' },
    ];
    expect(calculatePolylineLengthM(points, 'pixels')).toBeNull();
  });

  it('returns null for pixel-space route with zero metresPerPixel', () => {
    const points: QuoteRoutePointV1[] = [
      { x: 0, y: 0, kind: 'start' },
      { x: 100, y: 0, kind: 'end' },
    ];
    expect(calculatePolylineLengthM(points, 'pixels', { metresPerPixel: 0 })).toBeNull();
  });

  it('converts pixel coordinates to metres when scale is provided', () => {
    // 150 px at 0.02 m/px = 3 m
    const points: QuoteRoutePointV1[] = [
      { x: 0, y: 0, kind: 'start' },
      { x: 150, y: 0, kind: 'end' },
    ];
    const result = calculatePolylineLengthM(points, 'pixels', { metresPerPixel: 0.02 });
    expect(result).toBeCloseTo(3, 5);
  });

  it('pixel route without explicit scale argument is rejected', () => {
    const points: QuoteRoutePointV1[] = [
      { x: 0, y: 0, kind: 'start' },
      { x: 200, y: 0, kind: 'end' },
    ];
    // No scale argument → null (cannot produce fake metres)
    expect(calculatePolylineLengthM(points, 'pixels', undefined)).toBeNull();
  });
});

// ─── calculateBendCount ───────────────────────────────────────────────────────

describe('calculateBendCount', () => {
  it('returns 0 when there are no explicit bend points', () => {
    const points = makeMetrePoints([[0, 0], [1, 0], [2, 0]]);
    const { count, angles } = calculateBendCount(points);
    expect(count).toBe(0);
    expect(angles).toHaveLength(0);
  });

  it('counts only points with kind === bend by default', () => {
    const points = makeBendPoints(
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [1, 2],
    );
    const { count } = calculateBendCount(points);
    expect(count).toBe(2);
  });

  it('preserves bendAngleDeg when present', () => {
    const points: QuoteRoutePointV1[] = [
      { x: 0, y: 0, kind: 'start' },
      { x: 1, y: 0, kind: 'bend', bendAngleDeg: 90 },
      { x: 1, y: 1, kind: 'bend', bendAngleDeg: 45 },
      { x: 2, y: 1, kind: 'end' },
    ];
    const { count, angles } = calculateBendCount(points);
    expect(count).toBe(2);
    expect(angles[0]).toBe(90);
    expect(angles[1]).toBe(45);
  });

  it('does not count waypoints when inferFromWaypoints is false (default)', () => {
    const points = makeMetrePoints([[0, 0], [1, 0], [1, 1], [2, 1]]);
    const { count } = calculateBendCount(points);
    expect(count).toBe(0);
  });

  it('counts waypoints as bends when inferFromWaypoints is true', () => {
    const points = makeMetrePoints([[0, 0], [1, 0], [1, 1], [2, 1]]);
    // makeMetrePoints labels index 1 and 2 as 'waypoint'
    const { count } = calculateBendCount(points, true);
    expect(count).toBe(2);
  });

  it('angles array contains undefined for inferred waypoint bends', () => {
    const points = makeMetrePoints([[0, 0], [1, 0], [2, 0]]);
    const { angles } = calculateBendCount(points, true);
    expect(angles[0]).toBeUndefined();
  });
});

// ─── calculateRouteComplexity ─────────────────────────────────────────────────

describe('calculateRouteComplexity', () => {
  it('classifies a short surface route as low complexity', () => {
    const route: QuoteRouteV1 = {
      points: makeMetrePoints([[0, 0], [2, 0]]),
      coordinateSpace: 'metres',
      installMethod: 'surface',
      confidence: 'measured',
    };
    const result = calculateRouteComplexity(route);
    expect(result.complexity).toBe('low');
    expect(result.lengthM).toBeCloseTo(2, 5);
    expect(result.bendCount).toBe(0);
  });

  it('classifies a medium-length surface route as medium complexity', () => {
    // 5 m is above SHORT threshold (3 m) but below LONG threshold (10 m)
    const route: QuoteRouteV1 = {
      points: makeMetrePoints([[0, 0], [5, 0]]),
      coordinateSpace: 'metres',
      installMethod: 'surface',
      confidence: 'measured',
    };
    const result = calculateRouteComplexity(route);
    expect(result.complexity).toBe('medium');
  });

  it('classifies a long route as high complexity', () => {
    const route: QuoteRouteV1 = {
      points: makeMetrePoints([[0, 0], [12, 0]]),
      coordinateSpace: 'metres',
      installMethod: 'surface',
      confidence: 'measured',
    };
    const result = calculateRouteComplexity(route);
    expect(result.complexity).toBe('high');
  });

  it('classifies a buried route as high complexity', () => {
    const route: QuoteRouteV1 = {
      points: makeMetrePoints([[0, 0], [2, 0]]),
      coordinateSpace: 'metres',
      installMethod: 'buried',
      confidence: 'measured',
    };
    const result = calculateRouteComplexity(route);
    expect(result.complexity).toBe('high');
  });

  it('classifies a route with many bends as high complexity', () => {
    const points: QuoteRoutePointV1[] = [
      { x: 0, y: 0, kind: 'start' },
      { x: 1, y: 0, kind: 'bend' },
      { x: 1, y: 1, kind: 'bend' },
      { x: 2, y: 1, kind: 'bend' },
      { x: 2, y: 2, kind: 'bend' },
      { x: 3, y: 2, kind: 'end' },
    ];
    const route: QuoteRouteV1 = {
      points,
      coordinateSpace: 'metres',
      installMethod: 'surface',
      confidence: 'measured',
    };
    const result = calculateRouteComplexity(route);
    expect(result.bendCount).toBe(4);
    expect(result.complexity).toBe('high');
  });

  it('escalates high-complexity estimated route to needs_review', () => {
    const route: QuoteRouteV1 = {
      points: makeMetrePoints([[0, 0], [15, 0]]),
      coordinateSpace: 'metres',
      installMethod: 'surface',
      confidence: 'estimated',
    };
    const result = calculateRouteComplexity(route);
    expect(result.complexity).toBe('needs_review');
  });

  it('returns needs_review for an empty route', () => {
    const route: QuoteRouteV1 = {
      points: [],
      coordinateSpace: 'metres',
      installMethod: 'surface',
      confidence: 'measured',
    };
    const result = calculateRouteComplexity(route);
    expect(result.complexity).toBe('needs_review');
  });

  it('returns needs_review for pixel route with no scale and estimated confidence', () => {
    const route: QuoteRouteV1 = {
      points: [
        { x: 0, y: 0, kind: 'start' },
        { x: 500, y: 0, kind: 'end' },
      ],
      coordinateSpace: 'pixels',
      installMethod: 'surface',
      confidence: 'estimated',
    };
    const result = calculateRouteComplexity(route);
    expect(result.complexity).toBe('needs_review');
    expect(result.lengthM).toBeNull();
  });

  it('classifies a route with one penetration as medium', () => {
    const route: QuoteRouteV1 = {
      points: makeMetrePoints([[0, 0], [2, 0]]),
      coordinateSpace: 'metres',
      installMethod: 'surface',
      confidence: 'measured',
      penetrationCount: 1,
    };
    const result = calculateRouteComplexity(route);
    expect(result.complexity).toBe('medium');
    expect(result.penetrationCount).toBe(1);
  });
});
