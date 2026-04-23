/**
 * Tests for src/features/floorplan/geometry.ts
 */

import { describe, expect, it } from 'vitest';
import {
  wallLengthPx,
  wallLengthM,
  wallUnitVector,
  snapToNearestCorner,
  snapToNearestWall,
  applyPlannerSnap,
  roomAreaM2,
  roomCentre,
  hitTestRoom,
} from '../geometry';
import type { Wall, Room } from '../../../components/floorplan/propertyPlan.types';

const GRID = 24;

const H_WALL: Wall = {
  id: 'w1', floorId: 'f1', kind: 'internal',
  x1: 0, y1: 0, x2: GRID * 10, y2: 0,
};

const V_WALL: Wall = {
  id: 'w2', floorId: 'f1', kind: 'external',
  x1: 0, y1: 0, x2: 0, y2: GRID * 8,
};

const SAMPLE_ROOM: Room = {
  id: 'r1', floorId: 'f1', name: 'Living', roomType: 'living',
  x: 24, y: 24, width: 120, height: 96,
};

// ─── wallLengthPx / wallLengthM ───────────────────────────────────────────────

describe('wallLengthPx', () => {
  it('returns correct px length for horizontal wall', () => {
    expect(wallLengthPx(H_WALL)).toBeCloseTo(GRID * 10);
  });
  it('returns correct px length for vertical wall', () => {
    expect(wallLengthPx(V_WALL)).toBeCloseTo(GRID * 8);
  });
  it('returns 0 for a zero-length wall', () => {
    const z: Wall = { ...H_WALL, x2: 0 };
    expect(wallLengthPx(z)).toBe(0);
  });
});

describe('wallLengthM', () => {
  it('converts px to metres via GRID=24', () => {
    expect(wallLengthM(H_WALL)).toBeCloseTo(10);
    expect(wallLengthM(V_WALL)).toBeCloseTo(8);
  });
});

// ─── wallUnitVector ───────────────────────────────────────────────────────────

describe('wallUnitVector', () => {
  it('horizontal wall → ux=1, uy=0', () => {
    const { ux, uy } = wallUnitVector(H_WALL);
    expect(ux).toBeCloseTo(1);
    expect(uy).toBeCloseTo(0);
  });
  it('vertical wall → ux=0, uy=1', () => {
    const { ux, uy } = wallUnitVector(V_WALL);
    expect(ux).toBeCloseTo(0);
    expect(uy).toBeCloseTo(1);
  });
  it('zero-length wall returns (1,0) fallback', () => {
    const z: Wall = { ...H_WALL, x2: 0 };
    const { ux, uy } = wallUnitVector(z);
    expect(ux).toBe(1);
    expect(uy).toBe(0);
  });
});

// ─── snapToNearestCorner ──────────────────────────────────────────────────────

describe('snapToNearestCorner', () => {
  const walls = [H_WALL, V_WALL];

  it('snaps to wall start corner when within threshold', () => {
    const result = snapToNearestCorner({ x: 3, y: 3 }, walls, 10);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it('snaps to wall end corner when within threshold', () => {
    const result = snapToNearestCorner({ x: GRID * 10 - 5, y: 2 }, walls, 10);
    expect(result).toEqual({ x: GRID * 10, y: 0 });
  });

  it('returns null when outside threshold', () => {
    expect(snapToNearestCorner({ x: 500, y: 500 }, walls, 10)).toBeNull();
  });
});

// ─── snapToNearestWall ────────────────────────────────────────────────────────

describe('snapToNearestWall', () => {
  const walls = [H_WALL];

  it('snaps to the projected point on the wall', () => {
    const result = snapToNearestWall({ x: 48, y: 8 }, walls, 15);
    expect(result).not.toBeNull();
    expect(result!.wallId).toBe('w1');
    expect(result!.point.x).toBeCloseTo(48);
    expect(result!.point.y).toBeCloseTo(0);
  });

  it('returns null when click is too far from wall', () => {
    expect(snapToNearestWall({ x: 48, y: 30 }, walls, 15)).toBeNull();
  });
});

// ─── applyPlannerSnap ─────────────────────────────────────────────────────────

describe('applyPlannerSnap', () => {
  it('prefers corner snap over wall snap', () => {
    const walls = [H_WALL];
    // Close to corner (0,0) and also near the wall line
    const { snapped } = applyPlannerSnap({ x: 5, y: 5 }, walls);
    expect(snapped).toEqual({ x: 0, y: 0 });
  });

  it('falls back to wall snap when not near a corner', () => {
    const walls = [H_WALL];
    const { snapped, snappedToWallId } = applyPlannerSnap({ x: 48, y: 10 }, walls);
    expect(snappedToWallId).toBe('w1');
    expect(snapped.y).toBeCloseTo(0);
  });

  it('returns original point when no snap candidate found', () => {
    const { snapped } = applyPlannerSnap({ x: 500, y: 500 }, []);
    expect(snapped).toEqual({ x: 500, y: 500 });
  });
});

// ─── roomAreaM2 ───────────────────────────────────────────────────────────────

describe('roomAreaM2', () => {
  it('computes area from canvas pixels', () => {
    // width=120px=5m, height=96px=4m → 20 m²
    expect(roomAreaM2(SAMPLE_ROOM)).toBeCloseTo(20);
  });
});

// ─── roomCentre ───────────────────────────────────────────────────────────────

describe('roomCentre', () => {
  it('returns the centre of the room rectangle', () => {
    const c = roomCentre(SAMPLE_ROOM);
    expect(c.x).toBe(SAMPLE_ROOM.x + SAMPLE_ROOM.width / 2);
    expect(c.y).toBe(SAMPLE_ROOM.y + SAMPLE_ROOM.height / 2);
  });
});

// ─── hitTestRoom ─────────────────────────────────────────────────────────────

describe('hitTestRoom', () => {
  const rooms = [SAMPLE_ROOM];

  it('returns the room when point is inside', () => {
    expect(hitTestRoom({ x: 60, y: 60 }, rooms)?.id).toBe('r1');
  });

  it('returns null when point is outside all rooms', () => {
    expect(hitTestRoom({ x: 0, y: 0 }, rooms)).toBeNull();
  });

  it('returns the room when point is exactly on the boundary', () => {
    expect(hitTestRoom({ x: SAMPLE_ROOM.x, y: SAMPLE_ROOM.y }, rooms)?.id).toBe('r1');
  });
});
