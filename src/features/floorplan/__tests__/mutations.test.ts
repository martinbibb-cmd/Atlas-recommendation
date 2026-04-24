/**
 * Tests for floor planner mutation helpers:
 *   - updateWallMeasurement
 *   - addOpeningToWall / updateOpening / removeOpening
 *   - addObjectToPlan / updateFloorObject / removeFloorObject
 */

import { describe, expect, it } from 'vitest';
import { updateWallMeasurement } from '../updateWallMeasurement';
import {
  addOpeningToWall,
  updateOpening,
  removeOpening,
} from '../addOpeningToWall';
import {
  addObjectToPlan,
  updateFloorObject,
  removeFloorObject,
} from '../addObjectToPlan';
import type { PropertyPlan, Wall } from '../../../components/floorplan/propertyPlan.types';

const GRID = 24;

function makePlan(overrides: Partial<PropertyPlan> = {}): PropertyPlan {
  const wall: Wall = {
    id: 'w1', floorId: 'f1', kind: 'internal',
    x1: 0, y1: 0, x2: GRID * 10, y2: 0,
  };
  return {
    version: '1.0',
    propertyId: 'p1',
    floors: [{
      id: 'f1',
      name: 'Ground',
      levelIndex: 0,
      rooms: [],
      walls: [wall],
      openings: [],
      zones: [],
    }],
    placementNodes: [],
    connections: [],
    metadata: {},
    ...overrides,
  };
}

// ─── updateWallMeasurement ────────────────────────────────────────────────────

describe('updateWallMeasurement', () => {
  it('scales wall end-point to new length in metres', () => {
    const plan = makePlan();
    const next = updateWallMeasurement(plan, 'f1', 'w1', 5);
    const wall = next.floors[0].walls[0];
    // 5 m × 24 px/m = 120 px
    expect(wall.x2).toBeCloseTo(GRID * 5);
    expect(wall.y2).toBeCloseTo(0);
  });

  it('stamps manual provenance on the updated wall', () => {
    const plan = makePlan();
    const next = updateWallMeasurement(plan, 'f1', 'w1', 5);
    expect(next.floors[0].walls[0].provenance?.source).toBe('manual');
    expect(next.floors[0].walls[0].provenance?.reviewStatus).toBe('corrected');
  });

  it('returns original plan unchanged for non-positive length', () => {
    const plan = makePlan();
    expect(updateWallMeasurement(plan, 'f1', 'w1', 0)).toBe(plan);
    expect(updateWallMeasurement(plan, 'f1', 'w1', -1)).toBe(plan);
  });

  it('returns original plan unchanged when wall not found', () => {
    const plan = makePlan();
    const next = updateWallMeasurement(plan, 'f1', 'does-not-exist', 5);
    // Structure should be equivalent but wall is unchanged
    expect(next.floors[0].walls[0].x2).toBe(GRID * 10);
  });

  it('preserves wall direction for non-horizontal walls', () => {
    const diagonalWall: Wall = {
      id: 'w_diag', floorId: 'f1', kind: 'internal',
      x1: 0, y1: 0, x2: GRID * 3, y2: GRID * 4, // 3-4-5 triangle
    };
    const plan: PropertyPlan = {
      ...makePlan(),
      floors: [{ ...makePlan().floors[0], walls: [diagonalWall] }],
    };
    const next = updateWallMeasurement(plan, 'f1', 'w_diag', 10);
    const wall = next.floors[0].walls[0];
    // Length should be 10 m = 240 px; direction should be 3/5 x, 4/5 y
    const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
    expect(len).toBeCloseTo(10 * GRID, 0);
  });
});

// ─── addOpeningToWall ─────────────────────────────────────────────────────────

describe('addOpeningToWall', () => {
  it('adds an opening to the correct floor', () => {
    const plan = makePlan();
    const { plan: next, openingId } = addOpeningToWall(plan, {
      floorId: 'f1', wallId: 'w1', type: 'door', offsetM: 2, widthM: 0.9,
    });
    const openings = next.floors[0].openings;
    expect(openings).toHaveLength(1);
    expect(openings[0].id).toBe(openingId);
    expect(openings[0].type).toBe('door');
  });

  it('stamps manual provenance', () => {
    const plan = makePlan();
    const { plan: next } = addOpeningToWall(plan, {
      floorId: 'f1', wallId: 'w1', type: 'window', offsetM: 1, widthM: 1.2,
    });
    const prov = next.floors[0].openings[0].provenance;
    expect(prov?.source).toBe('manual');
    expect(prov?.reviewStatus).toBe('corrected');
  });

  it('clamps negative offsetM to 0', () => {
    const plan = makePlan();
    const { plan: next } = addOpeningToWall(plan, {
      floorId: 'f1', wallId: 'w1', type: 'door', offsetM: -1, widthM: 0.9,
    });
    expect(next.floors[0].openings[0].offsetM).toBe(0);
  });

  it('does not mutate floors on other floorIds', () => {
    const plan = makePlan();
    const { plan: next } = addOpeningToWall(plan, {
      floorId: 'f_missing', wallId: 'w1', type: 'door', offsetM: 1, widthM: 0.9,
    });
    expect(next.floors[0].openings).toHaveLength(0);
  });
});

describe('updateOpening', () => {
  it('patches opening widthM and marks corrected', () => {
    const plan = makePlan();
    const { plan: withOpening, openingId } = addOpeningToWall(plan, {
      floorId: 'f1', wallId: 'w1', type: 'door', offsetM: 2, widthM: 0.9,
    });
    const next = updateOpening(withOpening, {
      floorId: 'f1', openingId, patch: { widthM: 1.5 },
    });
    expect(next.floors[0].openings[0].widthM).toBe(1.5);
    expect(next.floors[0].openings[0].provenance?.reviewStatus).toBe('corrected');
  });
});

describe('removeOpening', () => {
  it('removes the specified opening', () => {
    const plan = makePlan();
    const { plan: withOpening, openingId } = addOpeningToWall(plan, {
      floorId: 'f1', wallId: 'w1', type: 'door', offsetM: 2, widthM: 0.9,
    });
    const next = removeOpening(withOpening, 'f1', openingId);
    expect(next.floors[0].openings).toHaveLength(0);
  });
});

// ─── addObjectToPlan ──────────────────────────────────────────────────────────

describe('addObjectToPlan', () => {
  it('adds a floor object to the correct floor', () => {
    const plan = makePlan();
    const { plan: next, objectId } = addObjectToPlan(plan, {
      floorId: 'f1', type: 'sink', x: 100, y: 100,
    });
    const objs = next.floors[0].floorObjects ?? [];
    expect(objs).toHaveLength(1);
    expect(objs[0].id).toBe(objectId);
    expect(objs[0].type).toBe('sink');
  });

  it('stamps manual provenance', () => {
    const plan = makePlan();
    const { plan: next } = addObjectToPlan(plan, {
      floorId: 'f1', type: 'bath', x: 50, y: 50,
    });
    const prov = (next.floors[0].floorObjects ?? [])[0].provenance;
    expect(prov?.source).toBe('manual');
    expect(prov?.reviewStatus).toBe('corrected');
  });

  it('stores optional label and dimensions', () => {
    const plan = makePlan();
    const { plan: next } = addObjectToPlan(plan, {
      floorId: 'f1', type: 'flue', x: 80, y: 80,
      label: 'Main flue', widthM: 0.1, heightM: 0.1, depthM: 0.5,
    });
    const obj = (next.floors[0].floorObjects ?? [])[0];
    expect(obj.label).toBe('Main flue');
    expect(obj.widthM).toBe(0.1);
  });
});

describe('updateFloorObject', () => {
  it('patches the floor object and marks corrected', () => {
    const plan = makePlan();
    const { plan: withObj, objectId } = addObjectToPlan(plan, {
      floorId: 'f1', type: 'sink', x: 100, y: 100,
    });
    const next = updateFloorObject(withObj, {
      floorId: 'f1', objectId, patch: { label: 'Kitchen sink', widthM: 0.6 },
    });
    const obj = (next.floors[0].floorObjects ?? [])[0];
    expect(obj.label).toBe('Kitchen sink');
    expect(obj.widthM).toBe(0.6);
    expect(obj.provenance?.reviewStatus).toBe('corrected');
  });
});

describe('removeFloorObject', () => {
  it('removes the specified floor object', () => {
    const plan = makePlan();
    const { plan: withObj, objectId } = addObjectToPlan(plan, {
      floorId: 'f1', type: 'sink', x: 100, y: 100,
    });
    const next = removeFloorObject(withObj, 'f1', objectId);
    expect(next.floors[0].floorObjects ?? []).toHaveLength(0);
  });
});
