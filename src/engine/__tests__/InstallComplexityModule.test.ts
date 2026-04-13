/**
 * InstallComplexityModule.test.ts
 *
 * Unit tests for runInstallComplexityModule.
 *
 * Covers:
 *   - Absent markup → empty defaults
 *   - Single straight surface-mounted route
 *   - Multi-bend chased route → high disruption, complexity score
 *   - Mixed mounting types → moderate disruption
 *   - Alignment signal detection (existing vs proposed proximity)
 *   - Material estimates aggregation
 *   - disruptionObjectiveDelta clamping
 *   - Confidence weight effect on disruption score
 */

import { describe, it, expect } from 'vitest';
import { runInstallComplexityModule } from '../modules/InstallComplexityModule';
import type {
  InstallMarkupV1,
  InstallRouteModelV1,
  InstallLayerModelV1,
} from '../schema/installMarkup.types';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeRoute(
  overrides: Partial<InstallRouteModelV1> & Pick<InstallRouteModelV1, 'path'>,
): InstallRouteModelV1 {
  return {
    id: overrides.id ?? 'r1',
    kind: overrides.kind ?? 'flow',
    diameterMm: overrides.diameterMm ?? 22,
    mounting: overrides.mounting ?? 'surface',
    confidence: overrides.confidence ?? 'measured',
    ...overrides,
  };
}

function makeLayer(
  proposed: InstallRouteModelV1[] = [],
  existing: InstallRouteModelV1[] = [],
): InstallLayerModelV1 {
  return {
    id: 'layer1',
    proposed: { objects: [], routes: proposed },
    existing:  { objects: [], routes: existing },
    annotations: [],
  };
}

function makeMarkup(layers: InstallLayerModelV1[]): InstallMarkupV1 {
  return { version: '1.0', layers };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runInstallComplexityModule – absent markup', () => {
  it('returns hasMarkup=false with zero/unknown defaults when markup is undefined', () => {
    const result = runInstallComplexityModule(undefined);
    expect(result.hasMarkup).toBe(false);
    expect(result.totalProposedLengthM).toBe(0);
    expect(result.totalBendCount).toBe(0);
    expect(result.disruptionBand).toBe('unknown');
    expect(result.alignmentSignal).toBe('unknown');
    expect(result.complexityScore).toBe(0);
    expect(result.disruptionObjectiveDelta).toBe(0);
    expect(result.narrativeSignals).toHaveLength(0);
  });

  it('returns hasMarkup=false for markup with no layers', () => {
    const result = runInstallComplexityModule({ version: '1.0', layers: [] });
    expect(result.hasMarkup).toBe(false);
  });

  it('returns hasMarkup=true but zero totals when proposed routes are empty', () => {
    const markup = makeMarkup([makeLayer([], [])]);
    const result = runInstallComplexityModule(markup);
    expect(result.hasMarkup).toBe(true);
    expect(result.totalProposedLengthM).toBe(0);
  });
});

describe('runInstallComplexityModule – single straight surface route', () => {
  const route = makeRoute({
    path: [{ x: 0, y: 0 }, { x: 0, y: 5 }],
    mounting: 'surface',
    confidence: 'measured',
  });
  const markup = makeMarkup([makeLayer([route])]);
  const result = runInstallComplexityModule(markup);

  it('reports hasMarkup=true', () => {
    expect(result.hasMarkup).toBe(true);
  });

  it('calculates 5 m total length', () => {
    expect(result.totalProposedLengthM).toBeCloseTo(5, 1);
  });

  it('reports 0 bends for straight route', () => {
    expect(result.totalBendCount).toBe(0);
  });

  it('disruption band is low for all-surface routing', () => {
    expect(result.disruptionBand).toBe('low');
  });

  it('surface mount fraction is 1.0', () => {
    expect(result.surfaceMountFraction).toBeCloseTo(1.0, 2);
  });

  it('produces a material estimate for flow route', () => {
    expect(result.materialEstimates).toHaveLength(1);
    expect(result.materialEstimates[0].kind).toBe('flow');
    expect(result.materialEstimates[0].totalLengthM).toBeCloseTo(5, 1);
    expect(result.materialEstimates[0].avgDiameterMm).toBe(22);
  });
});

describe('runInstallComplexityModule – high disruption (chased routes)', () => {
  // 8 m chased route with 3 significant 90° bends
  const route = makeRoute({
    path: [
      { x: 0, y: 0 },
      { x: 3, y: 0 },   // bend 1: turn north
      { x: 3, y: 3 },   // bend 2: turn east
      { x: 6, y: 3 },   // bend 3: turn north again
      { x: 6, y: 5 },
    ],
    mounting: 'chased',
    confidence: 'measured',
    kind: 'flow',
  });
  const markup = makeMarkup([makeLayer([route])]);
  const result = runInstallComplexityModule(markup);

  it('disruption band is high', () => {
    expect(result.disruptionBand).toBe('high');
  });

  it('detects 3 bends', () => {
    expect(result.totalBendCount).toBe(3);
  });

  it('complexity score is above 20', () => {
    expect(result.complexityScore).toBeGreaterThan(20);
  });

  it('disruption objective delta is positive (worse than baseline)', () => {
    expect(result.disruptionObjectiveDelta).toBeGreaterThan(0);
  });

  it('includes routing complexity narrative', () => {
    expect(result.narrativeSignals.some(s => s.includes('bends'))).toBe(true);
  });

  it('includes chased masonry narrative', () => {
    expect(result.narrativeSignals.some(s => s.includes('chased masonry'))).toBe(true);
  });
});

describe('runInstallComplexityModule – moderate disruption (mixed mounting)', () => {
  const surfaceRoute = makeRoute({
    id: 'r1',
    path: [{ x: 0, y: 0 }, { x: 0, y: 4 }],
    mounting: 'surface',
    kind: 'flow',
  });
  const boxedRoute = makeRoute({
    id: 'r2',
    path: [{ x: 0, y: 4 }, { x: 0, y: 8 }],
    mounting: 'boxed',
    kind: 'return',
  });
  const markup = makeMarkup([makeLayer([surfaceRoute, boxedRoute])]);
  const result = runInstallComplexityModule(markup);

  it('disruption band is low or moderate', () => {
    expect(['low', 'moderate']).toContain(result.disruptionBand);
  });

  it('produces material estimates for both flow and return', () => {
    const kinds = result.materialEstimates.map(e => e.kind);
    expect(kinds).toContain('flow');
    expect(kinds).toContain('return');
  });

  it('total length is approximately 8 m', () => {
    expect(result.totalProposedLengthM).toBeCloseTo(8, 1);
  });

  it('surface mount fraction is approximately 0.5', () => {
    expect(result.surfaceMountFraction).toBeCloseTo(0.5, 1);
  });
});

describe('runInstallComplexityModule – alignment signal', () => {
  const proposedRoute = makeRoute({
    path: [{ x: 0, y: 0 }, { x: 0, y: 5 }],
    mounting: 'surface',
  });

  it('returns aligned when proposed matches existing endpoints closely', () => {
    const existingRoute = makeRoute({
      id: 'e1',
      path: [{ x: 0, y: 0 }, { x: 0, y: 5 }],
      mounting: 'surface',
    });
    const markup = makeMarkup([makeLayer([proposedRoute], [existingRoute])]);
    const result = runInstallComplexityModule(markup);
    expect(result.alignmentSignal).toBe('aligned');
  });

  it('returns new_routing when proposed diverges from existing', () => {
    const existingRoute = makeRoute({
      id: 'e1',
      path: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
      mounting: 'surface',
    });
    const markup = makeMarkup([makeLayer([proposedRoute], [existingRoute])]);
    const result = runInstallComplexityModule(markup);
    expect(result.alignmentSignal).toBe('new_routing');
  });

  it('returns unknown when no existing routes', () => {
    const markup = makeMarkup([makeLayer([proposedRoute], [])]);
    const result = runInstallComplexityModule(markup);
    expect(result.alignmentSignal).toBe('unknown');
  });

  it('aligned signal reduces disruptionObjectiveDelta', () => {
    const existingRoute = makeRoute({
      id: 'e1',
      path: [{ x: 0, y: 0 }, { x: 0, y: 5 }],
      mounting: 'surface',
    });
    const markupAligned = makeMarkup([makeLayer([proposedRoute], [existingRoute])]);
    const markupNoExisting = makeMarkup([makeLayer([proposedRoute], [])]);
    const resultAligned = runInstallComplexityModule(markupAligned);
    const resultNoExisting = runInstallComplexityModule(markupNoExisting);
    expect(resultAligned.disruptionObjectiveDelta).toBeLessThanOrEqual(
      resultNoExisting.disruptionObjectiveDelta,
    );
  });
});

describe('runInstallComplexityModule – confidence weighting', () => {
  const chasedMeasured = makeRoute({
    path: [{ x: 0, y: 0 }, { x: 0, y: 5 }],
    mounting: 'chased',
    confidence: 'measured',
  });
  const chasedEstimated = makeRoute({
    path: [{ x: 0, y: 0 }, { x: 0, y: 5 }],
    mounting: 'chased',
    confidence: 'estimated',
  });

  it('estimated confidence results in lower or equal disruption score than measured', () => {
    const r1 = runInstallComplexityModule(makeMarkup([makeLayer([chasedMeasured])]));
    const r2 = runInstallComplexityModule(makeMarkup([makeLayer([chasedEstimated])]));
    expect(r2.disruptionScore).toBeLessThanOrEqual(r1.disruptionScore);
  });
});

describe('runInstallComplexityModule – disruptionObjectiveDelta clamping', () => {
  it('delta is within −20 to +20 range for extreme inputs', () => {
    const maxDisruptive = makeRoute({
      path: [{ x: 0, y: 0 }, { x: 0, y: 100 }],
      mounting: 'screed',
      confidence: 'measured',
    });
    const result = runInstallComplexityModule(makeMarkup([makeLayer([maxDisruptive])]));
    expect(result.disruptionObjectiveDelta).toBeGreaterThanOrEqual(-20);
    expect(result.disruptionObjectiveDelta).toBeLessThanOrEqual(20);
  });
});

describe('runInstallComplexityModule – multi-layer markup', () => {
  it('aggregates routes across multiple layers', () => {
    const layer1 = makeLayer([makeRoute({ path: [{ x: 0, y: 0 }, { x: 0, y: 3 }] })]);
    const layer2 = makeLayer([makeRoute({ id: 'r2', path: [{ x: 0, y: 0 }, { x: 0, y: 4 }] })]);
    const markup = makeMarkup([layer1, layer2]);
    const result = runInstallComplexityModule(markup);
    expect(result.totalProposedLengthM).toBeCloseTo(7, 1);
  });
});

describe('runInstallComplexityModule – default diameter fallback', () => {
  it('uses 22 mm default when diameterMm is absent', () => {
    const routeNoDiam: InstallRouteModelV1 = {
      id: 'r1',
      kind: 'flow',
      path: [{ x: 0, y: 0 }, { x: 0, y: 5 }],
      mounting: 'surface',
      confidence: 'measured',
    };
    const markup = makeMarkup([makeLayer([routeNoDiam])]);
    const result = runInstallComplexityModule(markup);
    expect(result.materialEstimates[0].avgDiameterMm).toBe(22);
  });
});
