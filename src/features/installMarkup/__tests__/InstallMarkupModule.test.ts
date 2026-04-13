import { describe, it, expect } from 'vitest';
import { runInstallMarkupModule } from '../InstallMarkupModule';
import type { InstallLayerModelV1, InstallRouteModelV1, InstallObjectModelV1 } from '../installMarkup.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRoute(overrides: Partial<InstallRouteModelV1> & Pick<InstallRouteModelV1, 'id'>): InstallRouteModelV1 {
  return {
    kind: 'flow',
    diameterMm: 22,
    mounting: 'surface',
    confidence: 'measured',
    path: [
      { position: { x: 0, y: 0, z: 0 } },
      { position: { x: 5, y: 0, z: 0 } }, // 5 m
    ],
    ...overrides,
  };
}

function makeObject(overrides: Partial<InstallObjectModelV1> & Pick<InstallObjectModelV1, 'id'>): InstallObjectModelV1 {
  return {
    type: 'boiler',
    position: { x: 2, y: 3, z: 1 },
    dimensions: { widthM: 0.6, heightM: 0.8, depthM: 0.3 },
    orientationDeg: 0,
    source: 'manual',
    ...overrides,
  };
}

function emptyLayer(): InstallLayerModelV1 {
  return {
    existing: { objects: [], routes: [] },
    proposed: { objects: [], routes: [] },
    notes: [],
  };
}

// ─── Tests: absent markup ─────────────────────────────────────────────────────

describe('runInstallMarkupModule — absent markup', () => {
  it('returns zero totals when markup is undefined', () => {
    const result = runInstallMarkupModule(undefined);
    expect(result.totalProposedRouteLengthM).toBe(0);
    expect(result.totalExistingRouteLengthM).toBe(0);
    expect(result.complexityScore).toBe(0);
    expect(result.disruptionBand).toBe('minimal');
    expect(result.disruptionWeightedMetres).toBe(0);
    expect(result.existingRouteReuseRatio).toBeNull();
    expect(result.feasibilitySignals).toHaveLength(0);
    expect(result.routingNotes).toHaveLength(0);
  });
});

// ─── Tests: route length ──────────────────────────────────────────────────────

describe('runInstallMarkupModule — route length', () => {
  it('computes correct proposed length for a single horizontal route', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(makeRoute({ id: 'r1' })); // 5 m
    const result = runInstallMarkupModule(layer);
    expect(result.totalProposedRouteLengthM).toBeCloseTo(5, 5);
  });

  it('computes correct length for a 3D diagonal segment', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(
      makeRoute({
        id: 'r1',
        path: [
          { position: { x: 0, y: 0, z: 0 } },
          { position: { x: 3, y: 4, z: 0 } }, // 5 m (3-4-5 triangle)
        ],
      }),
    );
    const result = runInstallMarkupModule(layer);
    expect(result.totalProposedRouteLengthM).toBeCloseTo(5, 5);
  });

  it('sums multiple proposed routes', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(makeRoute({ id: 'r1' })); // 5 m
    layer.proposed.routes.push(makeRoute({ id: 'r2', kind: 'return' })); // 5 m
    const result = runInstallMarkupModule(layer);
    expect(result.totalProposedRouteLengthM).toBeCloseTo(10, 5);
  });

  it('computes existing route lengths independently', () => {
    const layer = emptyLayer();
    layer.existing.routes.push(makeRoute({ id: 'e1' })); // 5 m
    const result = runInstallMarkupModule(layer);
    expect(result.totalExistingRouteLengthM).toBeCloseTo(5, 5);
    expect(result.totalProposedRouteLengthM).toBe(0);
  });

  it('ignores routes with only one path point', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(
      makeRoute({ id: 'r1', path: [{ position: { x: 0, y: 0, z: 0 } }] }),
    );
    const result = runInstallMarkupModule(layer);
    expect(result.totalProposedRouteLengthM).toBe(0);
  });
});

// ─── Tests: lengths by kind ───────────────────────────────────────────────────

describe('runInstallMarkupModule — lengths by kind', () => {
  it('groups lengths correctly by route kind', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(makeRoute({ id: 'r1', kind: 'flow' }));    // 5 m
    layer.proposed.routes.push(makeRoute({ id: 'r2', kind: 'flow' }));    // 5 m
    layer.proposed.routes.push(makeRoute({ id: 'r3', kind: 'return' }));  // 5 m
    layer.proposed.routes.push(makeRoute({ id: 'r4', kind: 'gas' }));     // 5 m
    const result = runInstallMarkupModule(layer);
    expect(result.proposedLengthsByKind['flow']).toBeCloseTo(10, 5);
    expect(result.proposedLengthsByKind['return']).toBeCloseTo(5, 5);
    expect(result.proposedLengthsByKind['gas']).toBeCloseTo(5, 5);
  });
});

// ─── Tests: material estimates ────────────────────────────────────────────────

describe('runInstallMarkupModule — material estimates', () => {
  it('groups material by diameter', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(makeRoute({ id: 'r1', diameterMm: 22 })); // 5 m
    layer.proposed.routes.push(makeRoute({ id: 'r2', diameterMm: 22 })); // 5 m
    layer.proposed.routes.push(makeRoute({ id: 'r3', diameterMm: 28 })); // 5 m
    const result = runInstallMarkupModule(layer);
    const d22 = result.materialEstimates.find(e => e.diameterMm === 22);
    const d28 = result.materialEstimates.find(e => e.diameterMm === 28);
    expect(d22?.linearMetres).toBeCloseTo(10, 5);
    expect(d28?.linearMetres).toBeCloseTo(5, 5);
  });

  it('sorts estimates by ascending diameter', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(makeRoute({ id: 'r1', diameterMm: 28 }));
    layer.proposed.routes.push(makeRoute({ id: 'r2', diameterMm: 15 }));
    const result = runInstallMarkupModule(layer);
    expect(result.materialEstimates[0].diameterMm).toBe(15);
    expect(result.materialEstimates[1].diameterMm).toBe(28);
  });

  it('returns empty array when there are no proposed routes', () => {
    const result = runInstallMarkupModule(emptyLayer());
    expect(result.materialEstimates).toHaveLength(0);
  });
});

// ─── Tests: disruption band ───────────────────────────────────────────────────

describe('runInstallMarkupModule — disruption band', () => {
  it('returns minimal for short surface runs', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(makeRoute({ id: 'r1', mounting: 'surface' })); // 5 m × 0.2 = 1 weighted
    const result = runInstallMarkupModule(layer);
    expect(result.disruptionBand).toBe('minimal');
  });

  it('returns moderate for voided / boxed runs', () => {
    const layer = emptyLayer();
    // void × 0.5 weight; need > 4 weighted metres → 9 m route
    layer.proposed.routes.push(
      makeRoute({
        id: 'r1',
        mounting: 'void',
        path: [
          { position: { x: 0, y: 0, z: 0 } },
          { position: { x: 9, y: 0, z: 0 } },
        ],
      }),
    );
    const result = runInstallMarkupModule(layer);
    expect(result.disruptionBand).toBe('moderate');
  });

  it('returns high for buried runs', () => {
    const layer = emptyLayer();
    // buried × 1.0 weight; need > 12 weighted metres → 13 m route
    layer.proposed.routes.push(
      makeRoute({
        id: 'r1',
        mounting: 'buried',
        path: [
          { position: { x: 0, y: 0, z: 0 } },
          { position: { x: 13, y: 0, z: 0 } },
        ],
      }),
    );
    const result = runInstallMarkupModule(layer);
    expect(result.disruptionBand).toBe('high');
  });
});

// ─── Tests: complexity score ──────────────────────────────────────────────────

describe('runInstallMarkupModule — complexity score', () => {
  it('returns 0 when no proposed routes', () => {
    const result = runInstallMarkupModule(emptyLayer());
    expect(result.complexityScore).toBe(0);
  });

  it('is higher for estimated confidence than measured', () => {
    const layer1 = emptyLayer();
    layer1.proposed.routes.push(makeRoute({ id: 'r1', confidence: 'measured' }));

    const layer2 = emptyLayer();
    layer2.proposed.routes.push(makeRoute({ id: 'r1', confidence: 'estimated' }));

    const r1 = runInstallMarkupModule(layer1);
    const r2 = runInstallMarkupModule(layer2);
    expect(r2.complexityScore).toBeGreaterThan(r1.complexityScore);
  });

  it('is higher for buried than surface mounting', () => {
    const layer1 = emptyLayer();
    layer1.proposed.routes.push(makeRoute({ id: 'r1', mounting: 'surface' }));

    const layer2 = emptyLayer();
    layer2.proposed.routes.push(makeRoute({ id: 'r1', mounting: 'buried' }));

    const r1 = runInstallMarkupModule(layer1);
    const r2 = runInstallMarkupModule(layer2);
    expect(r2.complexityScore).toBeGreaterThan(r1.complexityScore);
  });

  it('is higher when multiple diameters are used', () => {
    const layer1 = emptyLayer();
    layer1.proposed.routes.push(makeRoute({ id: 'r1', diameterMm: 22 }));

    const layer2 = emptyLayer();
    layer2.proposed.routes.push(makeRoute({ id: 'r1', diameterMm: 22 }));
    layer2.proposed.routes.push(makeRoute({ id: 'r2', diameterMm: 28 }));

    const r1 = runInstallMarkupModule(layer1);
    const r2 = runInstallMarkupModule(layer2);
    expect(r2.complexityScore).toBeGreaterThan(r1.complexityScore);
  });

  it('is clamped to 0–100', () => {
    const layer = emptyLayer();
    // Extreme buried run
    layer.proposed.routes.push(
      makeRoute({
        id: 'r1',
        mounting: 'buried',
        confidence: 'estimated',
        path: [
          { position: { x: 0, y: 0, z: 0 } },
          { position: { x: 1000, y: 0, z: 0 } },
        ],
      }),
    );
    const result = runInstallMarkupModule(layer);
    expect(result.complexityScore).toBeLessThanOrEqual(100);
    expect(result.complexityScore).toBeGreaterThanOrEqual(0);
  });
});

// ─── Tests: existing route reuse ratio ───────────────────────────────────────

describe('runInstallMarkupModule — existing route reuse ratio', () => {
  it('is null when no existing routes', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(makeRoute({ id: 'p1' }));
    const result = runInstallMarkupModule(layer);
    expect(result.existingRouteReuseRatio).toBeNull();
  });

  it('is 0 when proposed routes do not match existing routes', () => {
    const layer = emptyLayer();
    layer.existing.routes.push(makeRoute({ id: 'e1' }));
    // Proposed route is entirely different positions
    layer.proposed.routes.push(
      makeRoute({
        id: 'p1',
        path: [
          { position: { x: 100, y: 100, z: 0 } },
          { position: { x: 110, y: 100, z: 0 } },
        ],
      }),
    );
    const result = runInstallMarkupModule(layer);
    expect(result.existingRouteReuseRatio).toBe(0);
  });

  it('is 1 when proposed route matches existing exactly', () => {
    const layer = emptyLayer();
    const route = makeRoute({ id: 'e1' });
    layer.existing.routes.push(route);
    layer.proposed.routes.push({ ...route, id: 'p1' });
    const result = runInstallMarkupModule(layer);
    expect(result.existingRouteReuseRatio).toBe(1);
  });
});

// ─── Tests: feasibility signals ──────────────────────────────────────────────

describe('runInstallMarkupModule — feasibility signals', () => {
  it('emits gas_route_present when a gas route is proposed', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(makeRoute({ id: 'r1', kind: 'gas' }));
    const result = runInstallMarkupModule(layer);
    expect(result.feasibilitySignals.some(s => s.id === 'gas_route_present')).toBe(true);
  });

  it('emits buried_pipework when a buried route is proposed', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(makeRoute({ id: 'r1', mounting: 'buried' }));
    const result = runInstallMarkupModule(layer);
    expect(result.feasibilitySignals.some(s => s.id === 'buried_pipework')).toBe(true);
  });

  it('emits estimated_routes when a route has estimated confidence', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(makeRoute({ id: 'r1', confidence: 'estimated' }));
    const result = runInstallMarkupModule(layer);
    expect(result.feasibilitySignals.some(s => s.id === 'estimated_routes')).toBe(true);
  });

  it('emits no_proposed_routes when proposed routes are empty', () => {
    const layer = emptyLayer();
    layer.existing.routes.push(makeRoute({ id: 'e1' }));
    const result = runInstallMarkupModule(layer);
    expect(result.feasibilitySignals.some(s => s.id === 'no_proposed_routes')).toBe(true);
  });

  it('emits good_existing_reuse when reuse ratio >= 0.7', () => {
    const layer = emptyLayer();
    const route = makeRoute({ id: 'e1' });
    layer.existing.routes.push(route);
    layer.proposed.routes.push({ ...route, id: 'p1' });
    const result = runInstallMarkupModule(layer);
    expect(result.feasibilitySignals.some(s => s.id === 'good_existing_reuse')).toBe(true);
  });

  it('does not emit gas_route_present for non-gas routes', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(makeRoute({ id: 'r1', kind: 'flow' }));
    const result = runInstallMarkupModule(layer);
    expect(result.feasibilitySignals.some(s => s.id === 'gas_route_present')).toBe(false);
  });
});

// ─── Tests: routing notes ─────────────────────────────────────────────────────

describe('runInstallMarkupModule — routing notes', () => {
  it('includes a material estimate note', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(makeRoute({ id: 'r1', diameterMm: 22 }));
    const result = runInstallMarkupModule(layer);
    expect(result.routingNotes.some(n => n.includes('22 mm copper'))).toBe(true);
  });

  it('includes a flow/return note when flow and return routes are present', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(makeRoute({ id: 'r1', kind: 'flow' }));
    layer.proposed.routes.push(makeRoute({ id: 'r2', kind: 'return' }));
    const result = runInstallMarkupModule(layer);
    expect(result.routingNotes.some(n => n.includes('Primary heating circuit'))).toBe(true);
  });

  it('includes a disruption band note', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(makeRoute({ id: 'r1' }));
    const result = runInstallMarkupModule(layer);
    expect(result.routingNotes.some(n => n.toLowerCase().includes('disruption'))).toBe(true);
  });

  it('includes a DHW note when dhw routes are present', () => {
    const layer = emptyLayer();
    layer.proposed.routes.push(makeRoute({ id: 'r1', kind: 'dhw' }));
    const result = runInstallMarkupModule(layer);
    expect(result.routingNotes.some(n => n.includes('hot water'))).toBe(true);
  });
});

// ─── Tests: ignored fields ────────────────────────────────────────────────────

describe('runInstallMarkupModule — objects and notes are not counted in routes', () => {
  it('ignores existing/proposed objects for length/complexity calculations', () => {
    const layer = emptyLayer();
    layer.proposed.objects.push(makeObject({ id: 'obj1', type: 'boiler' }));
    const result = runInstallMarkupModule(layer);
    expect(result.totalProposedRouteLengthM).toBe(0);
    expect(result.complexityScore).toBe(0);
  });
});
