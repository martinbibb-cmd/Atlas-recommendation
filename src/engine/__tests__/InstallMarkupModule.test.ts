/**
 * InstallMarkupModule.test.ts
 *
 * Unit tests for all public functions in InstallMarkupModule.
 */

import { describe, it, expect } from 'vitest';
import {
  calcRouteLength,
  calcBendCount,
  routeAlignsWithExisting,
  deriveComplexity,
  deriveMaterials,
  deriveDisruption,
  deriveInsights,
  analyseInstallMarkup,
} from '../modules/InstallMarkupModule';
import type {
  InstallRouteModelV1,
  InstallLayerModelV1,
} from '../../features/installMarkup/installMarkup.types';

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function makeRoute(
  overrides: Partial<InstallRouteModelV1> = {},
): InstallRouteModelV1 {
  return {
    id: 'r1',
    kind: 'flow',
    diameterMm: 22,
    path: [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ],
    mounting: 'surface',
    confidence: 'drawn',
    ...overrides,
  };
}

function makeLayer(
  overrides: Partial<{
    existingRoutes: InstallRouteModelV1[];
    proposedRoutes: InstallRouteModelV1[];
  }> = {},
): InstallLayerModelV1 {
  return {
    existing: {
      objects: [],
      routes: overrides.existingRoutes ?? [],
    },
    proposed: {
      objects: [],
      routes: overrides.proposedRoutes ?? [],
    },
    notes: [],
  };
}

// ─── calcRouteLength ─────────────────────────────────────────────────────────

describe('calcRouteLength', () => {
  it('returns 0 for a single-point path', () => {
    const route = makeRoute({ path: [{ x: 0, y: 0 }] });
    expect(calcRouteLength(route)).toBe(0);
  });

  it('returns correct length for a straight horizontal route', () => {
    const route = makeRoute({ path: [{ x: 0, y: 0 }, { x: 5, y: 0 }] });
    expect(calcRouteLength(route)).toBeCloseTo(5);
  });

  it('sums multiple segments correctly', () => {
    // 3-segment route: (0,0)→(3,0)→(3,4)  lengths: 3 + 4 = 7
    const route = makeRoute({
      path: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }],
    });
    expect(calcRouteLength(route)).toBeCloseTo(7);
  });

  it('handles diagonal segments using Euclidean distance', () => {
    // (0,0)→(3,4) = 5
    const route = makeRoute({ path: [{ x: 0, y: 0 }, { x: 3, y: 4 }] });
    expect(calcRouteLength(route)).toBeCloseTo(5);
  });

  it('returns 0 for an empty path', () => {
    const route = makeRoute({ path: [] });
    expect(calcRouteLength(route)).toBe(0);
  });
});

// ─── calcBendCount ───────────────────────────────────────────────────────────

describe('calcBendCount', () => {
  it('returns 0 for a two-point route (no bends)', () => {
    const route = makeRoute({ path: [{ x: 0, y: 0 }, { x: 5, y: 0 }] });
    expect(calcBendCount(route)).toBe(0);
  });

  it('returns 1 for a three-point route', () => {
    const route = makeRoute({
      path: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }],
    });
    expect(calcBendCount(route)).toBe(1);
  });

  it('returns N-2 bends for N waypoints', () => {
    const route = makeRoute({
      path: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
      ],
    });
    expect(calcBendCount(route)).toBe(3);
  });

  it('returns 0 for a single-point path', () => {
    const route = makeRoute({ path: [{ x: 0, y: 0 }] });
    expect(calcBendCount(route)).toBe(0);
  });
});

// ─── routeAlignsWithExisting ─────────────────────────────────────────────────

describe('routeAlignsWithExisting', () => {
  it('returns true when a proposed point is within tolerance of an existing point', () => {
    const proposed = makeRoute({ path: [{ x: 0, y: 0 }, { x: 3, y: 0 }] });
    const existing = makeRoute({ id: 'e1', path: [{ x: 0.1, y: 0.1 }, { x: 3.1, y: 0 }] });
    expect(routeAlignsWithExisting(proposed, [existing])).toBe(true);
  });

  it('returns false when no existing route is nearby', () => {
    const proposed = makeRoute({ path: [{ x: 0, y: 0 }, { x: 3, y: 0 }] });
    const existing = makeRoute({ id: 'e1', path: [{ x: 10, y: 10 }, { x: 13, y: 10 }] });
    expect(routeAlignsWithExisting(proposed, [existing])).toBe(false);
  });

  it('returns false when existing routes list is empty', () => {
    const proposed = makeRoute();
    expect(routeAlignsWithExisting(proposed, [])).toBe(false);
  });
});

// ─── deriveComplexity ────────────────────────────────────────────────────────

describe('deriveComplexity', () => {
  it('returns low complexity for a short surface route', () => {
    const routes = [makeRoute({ path: [{ x: 0, y: 0 }, { x: 3, y: 0 }] })];
    const result = deriveComplexity(routes);
    expect(result.band).toBe('low');
    expect(result.totalRouteLengthM).toBeCloseTo(3);
    expect(result.totalBendCount).toBe(0);
    expect(result.concealedSegmentCount).toBe(0);
  });

  it('returns medium complexity for a moderate-length surface route', () => {
    // 15 m > COMPLEXITY_LOW_MAX_M (10)
    const routes = [makeRoute({ path: [{ x: 0, y: 0 }, { x: 15, y: 0 }] })];
    const result = deriveComplexity(routes);
    expect(result.band).toBe('medium');
  });

  it('returns high complexity for a long route', () => {
    // 30 m > COMPLEXITY_MED_MAX_M (25)
    const routes = [makeRoute({ path: [{ x: 0, y: 0 }, { x: 30, y: 0 }] })];
    const result = deriveComplexity(routes);
    expect(result.band).toBe('high');
  });

  it('returns high complexity when a route is buried', () => {
    const routes = [makeRoute({ mounting: 'buried', path: [{ x: 0, y: 0 }, { x: 5, y: 0 }] })];
    const result = deriveComplexity(routes);
    expect(result.band).toBe('high');
    expect(result.concealedSegmentCount).toBe(1);
  });

  it('counts boxed routes as concealed', () => {
    const routes = [makeRoute({ mounting: 'boxed', path: [{ x: 0, y: 0 }, { x: 5, y: 0 }] })];
    const result = deriveComplexity(routes);
    expect(result.concealedSegmentCount).toBe(1);
  });

  it('returns low complexity with zero routes', () => {
    const result = deriveComplexity([]);
    expect(result.band).toBe('low');
    expect(result.totalRouteLengthM).toBe(0);
  });

  it('accumulates bends across multiple routes', () => {
    const r1 = makeRoute({
      id: 'r1',
      path: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }],
    });
    const r2 = makeRoute({
      id: 'r2',
      path: [{ x: 5, y: 0 }, { x: 7, y: 0 }, { x: 7, y: 3 }],
    });
    const result = deriveComplexity([r1, r2]);
    expect(result.totalBendCount).toBe(2);
  });
});

// ─── deriveMaterials ─────────────────────────────────────────────────────────

describe('deriveMaterials', () => {
  it('buckets pipe by diameter correctly', () => {
    const routes = [
      makeRoute({ id: 'r1', diameterMm: 15, path: [{ x: 0, y: 0 }, { x: 5, y: 0 }] }),
      makeRoute({ id: 'r2', diameterMm: 22, path: [{ x: 0, y: 0 }, { x: 8, y: 0 }] }),
      makeRoute({ id: 'r3', diameterMm: 28, path: [{ x: 0, y: 0 }, { x: 3, y: 0 }] }),
    ];
    const result = deriveMaterials(routes);
    expect(result.pipe15mmM).toBeCloseTo(5);
    expect(result.pipe22mmM).toBeCloseTo(8);
    expect(result.pipe28mmM).toBeCloseTo(3);
    expect(result.pipeUnknownM).toBe(0);
  });

  it('places null-diameter routes in pipeUnknownM', () => {
    const route = makeRoute({ diameterMm: null, path: [{ x: 0, y: 0 }, { x: 4, y: 0 }] });
    const result = deriveMaterials([route]);
    expect(result.pipeUnknownM).toBeCloseTo(4);
  });

  it('returns all zeros for empty routes', () => {
    const result = deriveMaterials([]);
    expect(result).toEqual({
      pipe15mmM: 0,
      pipe22mmM: 0,
      pipe28mmM: 0,
      pipeUnknownM: 0,
    });
  });
});

// ─── deriveDisruption ───────────────────────────────────────────────────────

describe('deriveDisruption', () => {
  it('flags buried routes', () => {
    const routes = [makeRoute({ mounting: 'buried' })];
    const result = deriveDisruption(routes, []);
    expect(result.hasBuriedRoutes).toBe(true);
    expect(result.hasBoxedRoutes).toBe(false);
  });

  it('flags boxed routes', () => {
    const routes = [makeRoute({ mounting: 'boxed' })];
    const result = deriveDisruption(routes, []);
    expect(result.hasBoxedRoutes).toBe(true);
    expect(result.hasBuriedRoutes).toBe(false);
  });

  it('detects alignment with existing routes', () => {
    const proposed = makeRoute({ path: [{ x: 0, y: 0 }, { x: 3, y: 0 }] });
    const existing = makeRoute({ id: 'e1', path: [{ x: 0.1, y: 0 }, { x: 3, y: 0 }] });
    const result = deriveDisruption([proposed], [existing]);
    expect(result.alignsWithExistingRoutes).toBe(true);
  });

  it('disruption score is higher for buried routes', () => {
    const surface = makeRoute({ mounting: 'surface', path: [{ x: 0, y: 0 }, { x: 5, y: 0 }] });
    const buried = makeRoute({ mounting: 'buried', path: [{ x: 0, y: 0 }, { x: 5, y: 0 }] });
    const scoreSurface = deriveDisruption([surface], []).disruptionScore;
    const scoreBuried = deriveDisruption([buried], []).disruptionScore;
    expect(scoreBuried).toBeGreaterThan(scoreSurface);
  });

  it('disruption score is clamped at 10', () => {
    // Very long buried route
    const route = makeRoute({
      mounting: 'buried',
      path: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
    });
    const result = deriveDisruption([route], []);
    expect(result.disruptionScore).toBeLessThanOrEqual(10);
  });

  it('returns zero-state for empty proposed routes', () => {
    const result = deriveDisruption([], []);
    expect(result.hasBuriedRoutes).toBe(false);
    expect(result.hasBoxedRoutes).toBe(false);
    expect(result.alignsWithExistingRoutes).toBe(false);
    expect(result.disruptionScore).toBe(0);
  });
});

// ─── deriveInsights ──────────────────────────────────────────────────────────

describe('deriveInsights', () => {
  it('produces a high-complexity insight mentioning buried sections', () => {
    const complexity = {
      band: 'high' as const,
      totalRouteLengthM: 30,
      totalBendCount: 2,
      concealedSegmentCount: 1,
      summary: '30 m of proposed pipework',
    };
    const disruption = {
      hasBuriedRoutes: true,
      hasBoxedRoutes: false,
      alignsWithExistingRoutes: false,
      disruptionScore: 8,
    };
    const insights = deriveInsights(complexity, disruption);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0]).toMatch(/buried/i);
  });

  it('produces an alignment insight when routes align with existing', () => {
    const complexity = {
      band: 'low' as const,
      totalRouteLengthM: 5,
      totalBendCount: 0,
      concealedSegmentCount: 0,
      summary: '5.0 m of proposed pipework',
    };
    const disruption = {
      hasBuriedRoutes: false,
      hasBoxedRoutes: false,
      alignsWithExistingRoutes: true,
      disruptionScore: 1,
    };
    const insights = deriveInsights(complexity, disruption);
    expect(insights.some(i => /existing route/i.test(i))).toBe(true);
  });

  it('produces a boxed insight when routes are boxed but not buried', () => {
    const complexity = {
      band: 'medium' as const,
      totalRouteLengthM: 12,
      totalBendCount: 0,
      concealedSegmentCount: 1,
      summary: '12 m',
    };
    const disruption = {
      hasBuriedRoutes: false,
      hasBoxedRoutes: true,
      alignsWithExistingRoutes: false,
      disruptionScore: 3,
    };
    const insights = deriveInsights(complexity, disruption);
    expect(insights.some(i => /boxing/i.test(i))).toBe(true);
  });
});

// ─── analyseInstallMarkup ────────────────────────────────────────────────────

describe('analyseInstallMarkup', () => {
  it('returns zero-state when markup is undefined', () => {
    const result = analyseInstallMarkup(undefined);
    expect(result.hasMarkup).toBe(false);
    expect(result.insights).toHaveLength(0);
    expect(result.complexity.totalRouteLengthM).toBe(0);
    expect(result.materials.pipe22mmM).toBe(0);
    expect(result.disruption.disruptionScore).toBe(0);
  });

  it('returns hasMarkup: true when markup is supplied', () => {
    const layer = makeLayer({
      proposedRoutes: [makeRoute({ path: [{ x: 0, y: 0 }, { x: 5, y: 0 }] })],
    });
    const result = analyseInstallMarkup(layer);
    expect(result.hasMarkup).toBe(true);
  });

  it('derives complexity from proposed routes only', () => {
    const layer = makeLayer({
      existingRoutes: [makeRoute({ id: 'e1', path: [{ x: 0, y: 0 }, { x: 20, y: 0 }] })],
      proposedRoutes: [makeRoute({ path: [{ x: 0, y: 0 }, { x: 3, y: 0 }] })],
    });
    const result = analyseInstallMarkup(layer);
    // Only the 3 m proposed route counts
    expect(result.complexity.totalRouteLengthM).toBeCloseTo(3);
    expect(result.complexity.band).toBe('low');
  });

  it('produces material estimates from proposed routes', () => {
    const layer = makeLayer({
      proposedRoutes: [
        makeRoute({ id: 'r1', diameterMm: 22, path: [{ x: 0, y: 0 }, { x: 6, y: 0 }] }),
      ],
    });
    const result = analyseInstallMarkup(layer);
    expect(result.materials.pipe22mmM).toBeCloseTo(6);
  });

  it('populates at least one insight string', () => {
    const layer = makeLayer({
      proposedRoutes: [makeRoute({ path: [{ x: 0, y: 0 }, { x: 5, y: 0 }] })],
    });
    const result = analyseInstallMarkup(layer);
    expect(result.insights.length).toBeGreaterThan(0);
  });

  it('handles a layer with no proposed routes', () => {
    const layer = makeLayer();
    const result = analyseInstallMarkup(layer);
    expect(result.hasMarkup).toBe(true);
    expect(result.complexity.totalRouteLengthM).toBe(0);
    expect(result.complexity.band).toBe('low');
  });
});
