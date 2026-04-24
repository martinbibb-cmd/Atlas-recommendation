/**
 * Tests for src/features/floorplan/snapHelpers.ts (PR18)
 */

import { describe, expect, it } from 'vitest';
import {
  snapThresholdForZoom,
  snapToObjectCentres,
  snapToRouteEndpoints,
  computeObjectSnap,
  computeAlignmentGuides,
  validateWallLength,
  routeLabelPosition,
  MIN_PRACTICAL_WALL_LENGTH_M,
} from '../snapHelpers';
import type { FloorObject, FloorRoute, PlacementNode, Wall, Room } from '../../../components/floorplan/propertyPlan.types';

const GRID = 24;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const H_WALL: Wall = {
  id: 'w1', floorId: 'f1', kind: 'internal',
  x1: 0, y1: 0, x2: GRID * 10, y2: 0,
};

const V_WALL: Wall = {
  id: 'w2', floorId: 'f1', kind: 'external',
  x1: GRID * 10, y1: 0, x2: GRID * 10, y2: GRID * 8,
};

const FLOOR_OBJ: FloorObject = {
  id: 'fo1', floorId: 'f1', type: 'radiator',
  x: 100, y: 50,
  provenance: { source: 'manual', reviewStatus: 'corrected' },
};

const PLACEMENT_NODE: PlacementNode = {
  id: 'pn1', floorId: 'f1', type: 'heat_source_combi',
  anchor: { x: 200, y: 80 },
  orientationDeg: 0, metadata: {},
};

const FLOOR_ROUTE: FloorRoute = {
  id: 'fr1', floorId: 'f1', type: 'flow', status: 'proposed',
  points: [{ x: 50, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 100 }],
  provenance: { source: 'manual', reviewStatus: 'corrected' },
};

const SAMPLE_ROOM: Room = {
  id: 'r1', floorId: 'f1', name: 'Living', roomType: 'living',
  x: 0, y: 0, width: GRID * 8, height: GRID * 6,
};

// ─── snapThresholdForZoom ─────────────────────────────────────────────────────

describe('snapThresholdForZoom', () => {
  it('returns 0 when zoom is below minimum', () => {
    expect(snapThresholdForZoom(14, 0.3)).toBe(0);
    expect(snapThresholdForZoom(14, 0.39)).toBe(0);
  });

  it('scales threshold inversely with zoom at normal levels', () => {
    const at1 = snapThresholdForZoom(14, 1);
    const at2 = snapThresholdForZoom(14, 2);
    expect(at1).toBeCloseTo(14);
    expect(at2).toBeCloseTo(7);
  });

  it('caps threshold at MAX_THRESHOLD_MULTIPLIER × base', () => {
    // At zoom=0.4 (minimum): 14/0.4 = 35 but cap is 2×14 = 28
    const result = snapThresholdForZoom(14, 0.4);
    expect(result).toBeLessThanOrEqual(14 * 2);
    expect(result).toBeGreaterThan(0);
  });

  it('returns base threshold at zoom=1', () => {
    expect(snapThresholdForZoom(18, 1)).toBeCloseTo(18);
  });
});

// ─── snapToObjectCentres ──────────────────────────────────────────────────────

describe('snapToObjectCentres', () => {
  it('snaps to a FloorObject within threshold', () => {
    const result = snapToObjectCentres(
      { x: 104, y: 53 },
      [FLOOR_OBJ],
      [],
      10,
    );
    expect(result).not.toBeNull();
    expect(result!.point).toEqual({ x: 100, y: 50 });
    expect(result!.label).toBe('radiator');
  });

  it('snaps to a PlacementNode within threshold', () => {
    const result = snapToObjectCentres(
      { x: 196, y: 78 },
      [],
      [PLACEMENT_NODE],
      10,
    );
    expect(result).not.toBeNull();
    expect(result!.point).toEqual({ x: 200, y: 80 });
  });

  it('returns null when outside threshold', () => {
    expect(snapToObjectCentres({ x: 500, y: 500 }, [FLOOR_OBJ], [], 10)).toBeNull();
  });

  it('prefers closer object when two are nearby', () => {
    const close: FloorObject = { ...FLOOR_OBJ, id: 'fo2', x: 102, y: 50 };
    const result = snapToObjectCentres(
      { x: 103, y: 50 },
      [FLOOR_OBJ, close],
      [],
      20,
    );
    // close is at distance ~1; FLOOR_OBJ is at distance ~3 — close wins
    expect(result!.point).toEqual({ x: 102, y: 50 });
  });
});

// ─── snapToRouteEndpoints ─────────────────────────────────────────────────────

describe('snapToRouteEndpoints', () => {
  it('snaps to first point of a route within threshold', () => {
    const result = snapToRouteEndpoints({ x: 52, y: 52 }, [FLOOR_ROUTE], 10);
    expect(result).toEqual({ x: 50, y: 50 });
  });

  it('snaps to last point of a route within threshold', () => {
    const result = snapToRouteEndpoints({ x: 148, y: 102 }, [FLOOR_ROUTE], 10);
    expect(result).toEqual({ x: 150, y: 100 });
  });

  it('does NOT snap to intermediate route points', () => {
    // Middle point is {x:150,y:50}; test that we only match endpoints
    const result = snapToRouteEndpoints({ x: 150, y: 50 }, [FLOOR_ROUTE], 5);
    // This point is the LAST of [50,50]-[150,50]-[150,100]? No, it's the middle.
    // It's close to first-segment end but NOT a route endpoint.
    // snap target check: first = {50,50}, last = {150,100}
    // Distance from {150,50} to {50,50} = 100 > threshold 5
    // Distance from {150,50} to {150,100} = 50 > threshold 5
    expect(result).toBeNull();
  });

  it('returns null when no route endpoint is within threshold', () => {
    expect(snapToRouteEndpoints({ x: 500, y: 500 }, [FLOOR_ROUTE], 10)).toBeNull();
  });
});

// ─── computeObjectSnap ────────────────────────────────────────────────────────

describe('computeObjectSnap', () => {
  const walls = [H_WALL, V_WALL];

  it('prefers corner snap over all others', () => {
    // Near corner (0,0) of H_WALL
    const result = computeObjectSnap(
      { x: 3, y: 3 }, walls, [FLOOR_OBJ], [PLACEMENT_NODE], [], 1,
    );
    expect(result.kind).toBe('corner');
    expect(result.snapped).toEqual({ x: 0, y: 0 });
  });

  it('prefers object_centre snap over wall snap', () => {
    // Near FLOOR_OBJ at (100,50) — also near H_WALL (y=0) if threshold is large,
    // but object snap is checked before wall snap.
    // Distance to obj = 0; distance to wall projection = 50 — well outside wall threshold.
    const result = computeObjectSnap(
      { x: 100, y: 50 }, walls, [FLOOR_OBJ], [], [], 1,
    );
    expect(result.kind).toBe('object_centre');
    expect(result.snapped).toEqual({ x: 100, y: 50 });
  });

  it('falls back to route_endpoint snap', () => {
    // Near route endpoint {50, 50} but not near any corner or object centre
    const noObjects: FloorObject[] = [];
    const farWalls: Wall[] = []; // no walls nearby
    const result = computeObjectSnap(
      { x: 52, y: 52 }, farWalls, noObjects, [], [FLOOR_ROUTE], 1,
    );
    expect(result.kind).toBe('route_endpoint');
    expect(result.snapped).toEqual({ x: 50, y: 50 });
  });

  it('falls back to wall snap when no corner or object nearby', () => {
    // Point near middle of H_WALL, not near any corner or object
    const result = computeObjectSnap(
      { x: 120, y: 8 }, [H_WALL], [], [], [], 1,
    );
    expect(result.kind).toBe('wall');
    expect(result.snapWallId).toBe('w1');
    expect(result.snapped.y).toBeCloseTo(0);
  });

  it('returns free when nothing nearby', () => {
    const result = computeObjectSnap(
      { x: 500, y: 500 }, [], [], [], [], 1,
    );
    expect(result.kind).toBe('free');
    expect(result.snapped).toEqual({ x: 500, y: 500 });
  });

  it('returns free when zoom is below minimum (snapping disabled)', () => {
    // Even near H_WALL corner, zoom=0.3 → all thresholds = 0 → no snap
    const result = computeObjectSnap(
      { x: 2, y: 2 }, walls, [], [], [], 0.3,
    );
    expect(result.kind).toBe('free');
  });
});

// ─── computeAlignmentGuides ───────────────────────────────────────────────────

describe('computeAlignmentGuides', () => {
  it('emits an x guide when ghost aligns with a FloorObject x', () => {
    const guides = computeAlignmentGuides(
      { x: 100, y: 200 },
      [],
      [],
      [FLOOR_OBJ], // FLOOR_OBJ.x = 100
      [],
    );
    expect(guides.some((g) => g.axis === 'x' && g.value === 100)).toBe(true);
  });

  it('emits a y guide when ghost aligns with a PlacementNode y', () => {
    const guides = computeAlignmentGuides(
      { x: 300, y: 80 },
      [],
      [],
      [],
      [PLACEMENT_NODE], // PLACEMENT_NODE.anchor.y = 80
    );
    expect(guides.some((g) => g.axis === 'y' && g.value === 80)).toBe(true);
  });

  it('emits a guide for room centreline', () => {
    // SAMPLE_ROOM: x=0, width=192 → centre x=96
    const guides = computeAlignmentGuides(
      { x: 96, y: 300 },
      [SAMPLE_ROOM],
      [],
      [],
      [],
    );
    expect(guides.some((g) => g.axis === 'x' && g.value === 96)).toBe(true);
  });

  it('deduplicates guides on the same axis and value', () => {
    // Both a FloorObject and a PlacementNode at x=100
    const nodeAtSameX: PlacementNode = {
      ...PLACEMENT_NODE, id: 'pn2', anchor: { x: 100, y: 200 },
    };
    const guides = computeAlignmentGuides(
      { x: 100, y: 500 },
      [],
      [],
      [FLOOR_OBJ],      // x=100
      [nodeAtSameX],    // x=100 also
    );
    const xAt100 = guides.filter((g) => g.axis === 'x' && g.value === 100);
    expect(xAt100).toHaveLength(1);
  });

  it('returns empty array when nothing aligns', () => {
    const guides = computeAlignmentGuides(
      { x: 500, y: 500 }, [], [], [], [],
    );
    expect(guides).toHaveLength(0);
  });
});

// ─── validateWallLength ───────────────────────────────────────────────────────

describe('validateWallLength', () => {
  it('returns null for valid lengths', () => {
    expect(validateWallLength(1.5)).toBeNull();
    expect(validateWallLength(MIN_PRACTICAL_WALL_LENGTH_M)).toBeNull();
    expect(validateWallLength(10)).toBeNull();
  });

  it('returns error for lengths below minimum', () => {
    const msg = validateWallLength(0.3);
    expect(msg).not.toBeNull();
    expect(msg).toContain('short');
  });

  it('returns error for zero length', () => {
    expect(validateWallLength(0)).not.toBeNull();
  });

  it('returns error for negative length', () => {
    expect(validateWallLength(-1)).not.toBeNull();
  });

  it('returns error for NaN or Infinity', () => {
    expect(validateWallLength(NaN)).not.toBeNull();
    expect(validateWallLength(Infinity)).not.toBeNull();
  });
});

// ─── routeLabelPosition ───────────────────────────────────────────────────────

describe('routeLabelPosition', () => {
  it('returns null for fewer than 2 points', () => {
    expect(routeLabelPosition([])).toBeNull();
    expect(routeLabelPosition([{ x: 0, y: 0 }])).toBeNull();
  });

  it('returns a position for a 2-point route', () => {
    // For a 2-point route, midIdx = Math.floor(2/2) = 1, so pos.x = points[1].x
    const pos = routeLabelPosition([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBe(100);
    expect(pos!.y).toBe(0);
  });

  it('returns a position for a multi-point route', () => {
    const pos = routeLabelPosition([
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 0 },
    ]);
    expect(pos).not.toBeNull();
  });

  it('applies larger perpendicular offset for very short routes', () => {
    // Short route: start and end are only 10px apart; mid will be close to them
    const pos = routeLabelPosition([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(pos).not.toBeNull();
    // perpOffsetX should be non-trivial (labelling a horizontal segment → perpY offset)
    const magnitude = Math.hypot(pos!.perpOffsetX, pos!.perpOffsetY);
    expect(magnitude).toBeGreaterThan(0);
  });

  it('perpendicular offset is non-zero for a horizontal segment', () => {
    const pos = routeLabelPosition([
      { x: 0, y: 50 }, { x: 100, y: 50 }, { x: 200, y: 50 },
    ]);
    expect(pos).not.toBeNull();
    // Horizontal segment: dx > 0, dy = 0 → perpX = 0, perpY = 1 or -1
    expect(Math.abs(pos!.perpOffsetY)).toBeGreaterThan(0);
  });
});
