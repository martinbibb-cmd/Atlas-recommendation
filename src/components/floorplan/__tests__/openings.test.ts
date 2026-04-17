/**
 * Tests for opening geometry helpers and validation.
 *
 * Covers:
 *   - getOpeningGeometry: coordinate resolution for doors and windows
 *   - wallSegmentsWithGaps: wall segment splitting with gap punching
 *   - findWallHit: nearest-wall detection from a pointer position
 *   - propertyValidation: orphaned opening warning
 */

import { describe, expect, it } from 'vitest';
import {
  findWallHit,
  getOpeningGeometry,
  WALL_HIT_THRESHOLD_PX,
  wallSegmentsWithGaps,
} from '../floorplanDerivations';
import type { Opening, Wall } from '../propertyPlan.types';
import { validatePropertyPlan } from '../propertyValidation';
import type { PropertyPlan } from '../propertyPlan.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const GRID = 24; // must match the internal constant

/** A horizontal wall of length 10 m (240 px) starting at origin. */
const HORIZONTAL_WALL: Wall = {
  id: 'w1',
  floorId: 'f1',
  kind: 'internal',
  x1: 0,
  y1: 0,
  x2: GRID * 10, // 240 px = 10 m
  y2: 0,
};

/** A vertical wall of length 8 m (192 px) starting at origin. */
const VERTICAL_WALL: Wall = {
  id: 'w2',
  floorId: 'f1',
  kind: 'external',
  x1: 0,
  y1: 0,
  x2: 0,
  y2: GRID * 8, // 192 px = 8 m
};

function makeOpening(overrides: Partial<Opening> = {}): Opening {
  return {
    id: 'op1',
    floorId: 'f1',
    type: 'door',
    wallId: 'w1',
    offsetM: 2,
    widthM: 0.9,
    ...overrides,
  };
}

// ─── getOpeningGeometry ────────────────────────────────────────────────────────

describe('getOpeningGeometry', () => {
  it('returns null when the referenced wall is not found', () => {
    const opening = makeOpening({ wallId: 'nonexistent' });
    expect(getOpeningGeometry(opening, [HORIZONTAL_WALL])).toBeNull();
  });

  it('returns null for a zero-length wall', () => {
    const zeroWall: Wall = { ...HORIZONTAL_WALL, x2: 0 };
    const opening = makeOpening({ wallId: zeroWall.id });
    expect(getOpeningGeometry(opening, [zeroWall])).toBeNull();
  });

  it('places opening start at offsetM × GRID along the wall', () => {
    const opening = makeOpening({ offsetM: 2, widthM: 0.9 });
    const geom = getOpeningGeometry(opening, [HORIZONTAL_WALL]);
    expect(geom).not.toBeNull();
    // Horizontal wall → startX should be 2 m × 24 px/m = 48 px
    expect(geom!.startX).toBeCloseTo(2 * GRID);
    expect(geom!.startY).toBeCloseTo(0);
  });

  it('places opening end at (offsetM + widthM) × GRID along the wall', () => {
    const opening = makeOpening({ offsetM: 2, widthM: 0.9 });
    const geom = getOpeningGeometry(opening, [HORIZONTAL_WALL]);
    expect(geom!.endX).toBeCloseTo((2 + 0.9) * GRID);
    expect(geom!.endY).toBeCloseTo(0);
  });

  it('widthPx equals widthM × GRID', () => {
    const opening = makeOpening({ widthM: 1.2 });
    const geom = getOpeningGeometry(opening, [HORIZONTAL_WALL]);
    expect(geom!.widthPx).toBeCloseTo(1.2 * GRID);
  });

  it('unit vector is (1, 0) for a horizontal wall', () => {
    const geom = getOpeningGeometry(makeOpening(), [HORIZONTAL_WALL]);
    expect(geom!.ux).toBeCloseTo(1);
    expect(geom!.uy).toBeCloseTo(0);
  });

  it('perp vector is (0, 1) for a left-to-right horizontal wall', () => {
    // perpX = -uy = 0, perpY = ux = 1
    const geom = getOpeningGeometry(makeOpening(), [HORIZONTAL_WALL]);
    expect(geom!.perpX).toBeCloseTo(0);
    expect(geom!.perpY).toBeCloseTo(1);
  });

  it('works for a vertical wall', () => {
    const opening = makeOpening({ wallId: 'w2', offsetM: 1, widthM: 0.9 });
    const geom = getOpeningGeometry(opening, [VERTICAL_WALL]);
    expect(geom).not.toBeNull();
    expect(geom!.startX).toBeCloseTo(0);
    expect(geom!.startY).toBeCloseTo(1 * GRID);
    expect(geom!.endX).toBeCloseTo(0);
    expect(geom!.endY).toBeCloseTo((1 + 0.9) * GRID);
  });
});

// ─── wallSegmentsWithGaps ─────────────────────────────────────────────────────

describe('wallSegmentsWithGaps', () => {
  it('returns empty array for a zero-length wall', () => {
    const zeroWall: Wall = { ...HORIZONTAL_WALL, x2: 0 };
    expect(wallSegmentsWithGaps(zeroWall, [])).toHaveLength(0);
  });

  it('returns one full-length segment when there are no openings', () => {
    const segs = wallSegmentsWithGaps(HORIZONTAL_WALL, []);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ x1: 0, y1: 0, x2: GRID * 10, y2: 0 });
  });

  it('returns one full-length segment when openings are for a different wall', () => {
    const opening = makeOpening({ wallId: 'w2' }); // on vertical wall, not w1
    const segs = wallSegmentsWithGaps(HORIZONTAL_WALL, [opening]);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ x1: 0, y1: 0, x2: GRID * 10, y2: 0 });
  });

  it('splits into two segments for a central opening', () => {
    // Door at 2 m, width 0.9 m on a 10 m wall → [0,2) and (2.9,10]
    const opening = makeOpening({ offsetM: 2, widthM: 0.9 });
    const segs = wallSegmentsWithGaps(HORIZONTAL_WALL, [opening]);
    expect(segs).toHaveLength(2);
    expect(segs[0].x1).toBeCloseTo(0);
    expect(segs[0].x2).toBeCloseTo(2 * GRID);
    expect(segs[1].x1).toBeCloseTo(2.9 * GRID);
    expect(segs[1].x2).toBeCloseTo(GRID * 10);
  });

  it('returns empty array (no segments) when a single opening covers the entire wall', () => {
    // Wall 2 m long, one opening 2 m wide at offset 0
    const shortWall: Wall = { ...HORIZONTAL_WALL, x2: 2 * GRID };
    const opening = makeOpening({ widthM: 2, offsetM: 0 });
    const segs = wallSegmentsWithGaps(shortWall, [opening]);
    expect(segs).toHaveLength(0);
  });

  it('returns one head segment when the opening is at the end of the wall', () => {
    // Wall 10 m, opening at 9 m offset width 1 m → only [0,9) remains
    const opening = makeOpening({ offsetM: 9, widthM: 1 });
    const segs = wallSegmentsWithGaps(HORIZONTAL_WALL, [opening]);
    expect(segs).toHaveLength(1);
    expect(segs[0].x1).toBeCloseTo(0);
    expect(segs[0].x2).toBeCloseTo(9 * GRID);
  });

  it('returns one tail segment when the opening is at the start of the wall', () => {
    const opening = makeOpening({ offsetM: 0, widthM: 1 });
    const segs = wallSegmentsWithGaps(HORIZONTAL_WALL, [opening]);
    expect(segs).toHaveLength(1);
    expect(segs[0].x1).toBeCloseTo(1 * GRID);
    expect(segs[0].x2).toBeCloseTo(10 * GRID);
  });

  it('merges two overlapping openings into a single gap', () => {
    const op1 = makeOpening({ id: 'op1', offsetM: 2, widthM: 1 });
    const op2 = makeOpening({ id: 'op2', offsetM: 2.5, widthM: 1 }); // overlaps with op1
    const segs = wallSegmentsWithGaps(HORIZONTAL_WALL, [op1, op2]);
    // Merged gap covers [2, 3.5] → two outer segments
    expect(segs).toHaveLength(2);
    expect(segs[0].x2).toBeCloseTo(2 * GRID);
    expect(segs[1].x1).toBeCloseTo(3.5 * GRID);
  });

  it('handles three separate openings in a long wall', () => {
    // Wall 10 m, openings at 1 m, 4 m, 7 m (all 0.9 m wide)
    const ops: Opening[] = [
      makeOpening({ id: 'op1', offsetM: 1, widthM: 0.9 }),
      makeOpening({ id: 'op2', offsetM: 4, widthM: 0.9 }),
      makeOpening({ id: 'op3', offsetM: 7, widthM: 0.9 }),
    ];
    const segs = wallSegmentsWithGaps(HORIZONTAL_WALL, ops);
    expect(segs).toHaveLength(4);
  });
});

// ─── findWallHit ──────────────────────────────────────────────────────────────

describe('findWallHit', () => {
  const walls = [HORIZONTAL_WALL, VERTICAL_WALL];

  it('returns null when no wall is within threshold', () => {
    // Pointer far from both walls
    const result = findWallHit({ x: 500, y: 500 }, walls);
    expect(result).toBeNull();
  });

  it('detects a horizontal wall when click is directly on it', () => {
    const result = findWallHit({ x: 100, y: 0 }, walls);
    expect(result).not.toBeNull();
    expect(result!.wall.id).toBe('w1');
  });

  it('detects a wall when click is within threshold px of it', () => {
    // Click 10 px below the horizontal wall (within default threshold of 15 px)
    const result = findWallHit({ x: 100, y: 10 }, walls);
    expect(result).not.toBeNull();
    expect(result!.wall.id).toBe('w1');
  });

  it('returns null when click is just outside the threshold', () => {
    // Click 16 px below horizontal wall (> default threshold of 15 px)
    const result = findWallHit({ x: 100, y: 16 }, walls);
    expect(result).toBeNull();
  });

  it('returns a hit with distance 0 when using a custom zero threshold', () => {
    // Pointer is exactly on the wall (perpendicular distance = 0) — still matches at threshold=0
    const result = findWallHit({ x: 100, y: 0 }, walls, 0);
    expect(result).not.toBeNull();
    expect(result!.wall.id).toBe('w1');
  });

  it('reports offsetM as distance-along-wall ÷ GRID', () => {
    // Click at x=72 (= 3 m × GRID) directly on horizontal wall
    const result = findWallHit({ x: 72, y: 0 }, walls);
    expect(result!.offsetM).toBeCloseTo(3, 1);
  });

  it('selects the closer wall when two walls are equidistant from click', () => {
    // Click equidistant from the horizontal wall (y=0) and vertical wall (x=0)
    // at (5, 5) — 5 px from each → vertical wall slightly favoured because
    // x-projection of (5,5) onto x=0 line has dist=5 exactly.
    // We just check that one is returned, not null.
    const result = findWallHit({ x: 5, y: 5 }, walls);
    expect(result).not.toBeNull();
  });

  it('clamps the offset to the wall endpoints (does not return negative offset)', () => {
    // Click before the start of the horizontal wall (x < 0, y=0)
    const result = findWallHit({ x: -5, y: 0 }, walls);
    expect(result!.offsetM).toBeGreaterThanOrEqual(0);
  });

  it('respects a custom threshold argument', () => {
    // 5 px below horizontal wall — within 10 px but not 4 px threshold
    expect(findWallHit({ x: 100, y: 5 }, walls, 4)).toBeNull();
    expect(findWallHit({ x: 100, y: 5 }, walls, 10)).not.toBeNull();
  });
});

// ─── Opening validation ───────────────────────────────────────────────────────

describe('opening validation', () => {
  function makePlan(): PropertyPlan {
    return {
      version: '1.0',
      propertyId: 'p1',
      floors: [{
        id: 'f1',
        name: 'Ground',
        levelIndex: 0,
        rooms: [],
        walls: [HORIZONTAL_WALL],
        openings: [],
        zones: [],
      }],
      placementNodes: [],
      connections: [],
      metadata: {},
    };
  }

  it('produces no issues for a valid opening referencing an existing wall', () => {
    const plan = makePlan();
    plan.floors[0].openings.push(makeOpening());
    const result = validatePropertyPlan(plan);
    const openingIssues = result.issues.filter((i) => i.objectId === 'op1');
    expect(openingIssues).toHaveLength(0);
  });

  it('warns when an opening references a non-existent wall', () => {
    const plan = makePlan();
    plan.floors[0].openings.push(makeOpening({ wallId: 'gone' }));
    const result = validatePropertyPlan(plan);
    const openingIssues = result.issues.filter((i) => i.objectId === 'op1');
    expect(openingIssues).toHaveLength(1);
    expect(openingIssues[0].severity).toBe('warning');
    expect(openingIssues[0].objectType).toBe('opening');
  });
});
