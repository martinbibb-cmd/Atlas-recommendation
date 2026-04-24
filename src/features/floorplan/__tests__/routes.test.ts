/**
 * Tests for floor route mutation helpers:
 *   - addRouteToPlan
 *   - updateRoute
 *   - removeRoute
 */

import { describe, expect, it } from 'vitest';
import {
  addRouteToPlan,
  updateRoute,
  removeRoute,
} from '../addRouteToPlan';
import type { PropertyPlan } from '../../../components/floorplan/propertyPlan.types';

function makePlan(overrides: Partial<PropertyPlan> = {}): PropertyPlan {
  return {
    version: '1.0',
    propertyId: 'p1',
    floors: [{
      id: 'f1',
      name: 'Ground',
      levelIndex: 0,
      rooms: [],
      walls: [],
      openings: [],
      zones: [],
    }],
    placementNodes: [],
    connections: [],
    metadata: {},
    ...overrides,
  };
}

const TWO_POINTS = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
const THREE_POINTS = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];

// ─── addRouteToPlan ────────────────────────────────────────────────────────────

describe('addRouteToPlan', () => {
  it('adds a route to the correct floor', () => {
    const plan = makePlan();
    const { plan: next, routeId } = addRouteToPlan(plan, {
      floorId: 'f1', type: 'flow', status: 'existing', points: TWO_POINTS,
    });
    const routes = next.floors[0].floorRoutes ?? [];
    expect(routes).toHaveLength(1);
    expect(routes[0].id).toBe(routeId);
    expect(routes[0].type).toBe('flow');
    expect(routes[0].status).toBe('existing');
  });

  it('stamps manual provenance', () => {
    const plan = makePlan();
    const { plan: next } = addRouteToPlan(plan, {
      floorId: 'f1', type: 'condensate', status: 'assumed', points: TWO_POINTS,
    });
    const prov = (next.floors[0].floorRoutes ?? [])[0].provenance;
    expect(prov?.source).toBe('manual');
    expect(prov?.reviewStatus).toBe('corrected');
  });

  it('stores notes and optional object refs', () => {
    const plan = makePlan();
    const { plan: next } = addRouteToPlan(plan, {
      floorId: 'f1', type: 'hot', status: 'proposed', points: THREE_POINTS,
      fromObjectId: 'cyl1', toObjectId: 'rad1', notes: 'via void',
    });
    const route = (next.floors[0].floorRoutes ?? [])[0];
    expect(route.fromObjectId).toBe('cyl1');
    expect(route.toObjectId).toBe('rad1');
    expect(route.notes).toBe('via void');
    expect(route.points).toHaveLength(3);
  });

  it('returns original plan unchanged for fewer than 2 points', () => {
    const plan = makePlan();
    const result = addRouteToPlan(plan, {
      floorId: 'f1', type: 'flow', status: 'existing',
      points: [{ x: 0, y: 0 }],
    });
    expect(result.plan).toBe(plan);
    expect(result.routeId).toBe('');
  });

  it('does not mutate floors on other floorIds', () => {
    const plan = makePlan();
    const { plan: next } = addRouteToPlan(plan, {
      floorId: 'f_missing', type: 'return', status: 'proposed', points: TWO_POINTS,
    });
    expect(next.floors[0].floorRoutes ?? []).toHaveLength(0);
  });

  it('preserves assumed status — does not upgrade to confirmed', () => {
    const plan = makePlan();
    const { plan: next } = addRouteToPlan(plan, {
      floorId: 'f1', type: 'discharge', status: 'assumed', points: TWO_POINTS,
    });
    const route = (next.floors[0].floorRoutes ?? [])[0];
    expect(route.status).toBe('assumed');
  });
});

// ─── updateRoute ───────────────────────────────────────────────────────────────

describe('updateRoute', () => {
  it('patches route type and status', () => {
    const plan = makePlan();
    const { plan: withRoute, routeId } = addRouteToPlan(plan, {
      floorId: 'f1', type: 'flow', status: 'existing', points: TWO_POINTS,
    });
    const next = updateRoute(withRoute, {
      floorId: 'f1', routeId, patch: { type: 'return', status: 'proposed' },
    });
    const route = (next.floors[0].floorRoutes ?? [])[0];
    expect(route.type).toBe('return');
    expect(route.status).toBe('proposed');
  });

  it('re-stamps provenance as manual/corrected on update', () => {
    const plan = makePlan();
    const { plan: withRoute, routeId } = addRouteToPlan(plan, {
      floorId: 'f1', type: 'cold', status: 'assumed', points: TWO_POINTS,
    });
    const next = updateRoute(withRoute, {
      floorId: 'f1', routeId, patch: { notes: 'checked on site' },
    });
    const prov = (next.floors[0].floorRoutes ?? [])[0].provenance;
    expect(prov?.source).toBe('manual');
    expect(prov?.reviewStatus).toBe('corrected');
  });

  it('updates points', () => {
    const plan = makePlan();
    const { plan: withRoute, routeId } = addRouteToPlan(plan, {
      floorId: 'f1', type: 'flow', status: 'existing', points: TWO_POINTS,
    });
    const next = updateRoute(withRoute, {
      floorId: 'f1', routeId, patch: { points: THREE_POINTS },
    });
    expect((next.floors[0].floorRoutes ?? [])[0].points).toHaveLength(3);
  });
});

// ─── removeRoute ──────────────────────────────────────────────────────────────

describe('removeRoute', () => {
  it('removes the specified route', () => {
    const plan = makePlan();
    const { plan: withRoute, routeId } = addRouteToPlan(plan, {
      floorId: 'f1', type: 'flow', status: 'existing', points: TWO_POINTS,
    });
    const next = removeRoute(withRoute, 'f1', routeId);
    expect(next.floors[0].floorRoutes ?? []).toHaveLength(0);
  });

  it('does not remove routes on other floors', () => {
    const plan: PropertyPlan = {
      ...makePlan(),
      floors: [
        { id: 'f1', name: 'Ground', levelIndex: 0, rooms: [], walls: [], openings: [], zones: [] },
        { id: 'f2', name: 'First',  levelIndex: 1, rooms: [], walls: [], openings: [], zones: [] },
      ],
    };
    const { plan: p1, routeId } = addRouteToPlan(plan, {
      floorId: 'f1', type: 'hot', status: 'proposed', points: TWO_POINTS,
    });
    const { plan: p2 } = addRouteToPlan(p1, {
      floorId: 'f2', type: 'cold', status: 'existing', points: TWO_POINTS,
    });
    const next = removeRoute(p2, 'f1', routeId);
    expect(next.floors[0].floorRoutes ?? []).toHaveLength(0);
    expect(next.floors[1].floorRoutes ?? []).toHaveLength(1);
  });
});
