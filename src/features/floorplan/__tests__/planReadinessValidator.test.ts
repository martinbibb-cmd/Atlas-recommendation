/**
 * planReadinessValidator.test.ts — PR20 validator rules.
 *
 * Tests cover:
 *   1. No rooms
 *   2. Boiler without flue
 *   3. Stored-hot-water scenario without cylinder
 *   4. Default dimensions flagged
 *   5. Assumed routes
 *   6. Fully usable plan (all complete)
 */

import { describe, it, expect } from 'vitest';
import {
  validatePlanReadiness,
  planHandoffSummaryLabel,
  spatialConfidenceIsWeak,
} from '../planReadinessValidator';
import type { PropertyPlan, FloorPlan, FloorObject, FloorRoute } from '../../../components/floorplan/propertyPlan.types';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeFloor(overrides: Partial<FloorPlan> = {}): FloorPlan {
  return {
    id: 'floor_1',
    name: 'Ground',
    levelIndex: 0,
    rooms: [],
    walls: [],
    openings: [],
    zones: [],
    floorObjects: [],
    floorRoutes: [],
    ...overrides,
  };
}

function makePlan(overrides: Partial<PropertyPlan> = {}): PropertyPlan {
  return {
    version: '1.0',
    propertyId: 'prop_test',
    floors: [makeFloor()],
    placementNodes: [],
    connections: [],
    metadata: {},
    ...overrides,
  };
}

function makeRoom() {
  return {
    id: 'room_1',
    name: 'Kitchen',
    roomType: 'kitchen' as const,
    floorId: 'floor_1',
    x: 0, y: 0, width: 192, height: 144,
  };
}

function makeWall() {
  return {
    id: 'wall_1',
    floorId: 'floor_1',
    kind: 'external' as const,
    x1: 0, y1: 0, x2: 192, y2: 0,
  };
}

function makeBoilerObject(): FloorObject {
  return {
    id: 'obj_boiler',
    floorId: 'floor_1',
    type: 'boiler',
    x: 100, y: 50,
    label: 'Boiler',
    widthM: 0.6,
    heightM: 0.7,
  };
}

function makeFlueObject(): FloorObject {
  return {
    id: 'obj_flue',
    floorId: 'floor_1',
    type: 'flue',
    x: 100, y: 10,
    label: 'Flue',
    widthM: 0.125,
    heightM: 0.125,
  };
}

function makeCylinderObject(): FloorObject {
  return {
    id: 'obj_cylinder',
    floorId: 'floor_1',
    type: 'cylinder',
    x: 200, y: 50,
    label: 'Cylinder',
    widthM: 0.5,
    heightM: 0.5,
  };
}

function makeFlowRoute(): FloorRoute {
  return {
    id: 'route_1',
    floorId: 'floor_1',
    type: 'flow',
    status: 'existing',
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
  };
}

function makeReturnRoute(): FloorRoute {
  return {
    id: 'route_2',
    floorId: 'floor_1',
    type: 'return',
    status: 'existing',
    points: [{ x: 0, y: 10 }, { x: 100, y: 10 }],
  };
}

function makeDischargeRoute(status: FloorRoute['status'] = 'existing'): FloorRoute {
  return {
    id: 'route_discharge',
    floorId: 'floor_1',
    type: 'discharge',
    status,
    points: [{ x: 0, y: 20 }, { x: 50, y: 20 }],
  };
}

// ─── A fully usable plan ───────────────────────────────────────────────────────

function makeFullyUsablePlan(): PropertyPlan {
  return makePlan({
    floors: [makeFloor({
      rooms: [makeRoom()],
      walls: [makeWall()],
      floorObjects: [makeBoilerObject(), makeFlueObject()],
      floorRoutes: [makeFlowRoute(), makeReturnRoute(), makeDischargeRoute()],
    })],
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('validatePlanReadiness', () => {

  describe('no rooms', () => {
    it('flags rooms_present as missing when plan has no rooms', () => {
      const plan = makePlan({ floors: [makeFloor({ rooms: [] })] });
      const result = validatePlanReadiness(plan);
      const item = result.items.find((i) => i.key === 'rooms_present');
      expect(item?.status).toBe('missing');
    });

    it('sets overallStatus to incomplete when rooms are missing', () => {
      const plan = makePlan({ floors: [makeFloor({ rooms: [] })] });
      const result = validatePlanReadiness(plan);
      expect(result.overallStatus).toBe('incomplete');
    });
  });

  describe('boiler without flue', () => {
    it('flags flue_recorded as missing when boiler is present but no flue', () => {
      const plan = makePlan({
        floors: [makeFloor({
          rooms: [makeRoom()],
          walls: [makeWall()],
          floorObjects: [makeBoilerObject()],
          floorRoutes: [makeFlowRoute()],
        })],
      });
      const result = validatePlanReadiness(plan);
      const item = result.items.find((i) => i.key === 'flue_recorded');
      expect(item?.status).toBe('missing');
    });

    it('marks flue_recorded complete when flue object is present', () => {
      const plan = makePlan({
        floors: [makeFloor({
          rooms: [makeRoom()],
          walls: [makeWall()],
          floorObjects: [makeBoilerObject(), makeFlueObject()],
          floorRoutes: [makeFlowRoute()],
        })],
      });
      const result = validatePlanReadiness(plan);
      const item = result.items.find((i) => i.key === 'flue_recorded');
      expect(item?.status).toBe('complete');
    });
  });

  describe('stored-hot-water scenario without cylinder', () => {
    it('flags cylinder_recorded as missing when needsStoredHotWater=true and no cylinder placed', () => {
      const plan = makePlan({
        floors: [makeFloor({
          rooms: [makeRoom()],
          walls: [makeWall()],
          floorObjects: [makeBoilerObject(), makeFlueObject()],
          floorRoutes: [makeFlowRoute()],
        })],
      });
      const result = validatePlanReadiness(plan, { needsStoredHotWater: true });
      const item = result.items.find((i) => i.key === 'cylinder_recorded');
      expect(item?.status).toBe('missing');
    });

    it('marks cylinder_recorded complete when cylinder placed and needsStoredHotWater=true', () => {
      const plan = makePlan({
        floors: [makeFloor({
          rooms: [makeRoom()],
          walls: [makeWall()],
          floorObjects: [makeBoilerObject(), makeFlueObject(), makeCylinderObject()],
          floorRoutes: [makeFlowRoute()],
        })],
      });
      const result = validatePlanReadiness(plan, { needsStoredHotWater: true });
      const item = result.items.find((i) => i.key === 'cylinder_recorded');
      expect(item?.status).toBe('complete');
    });

    it('skips cylinder check when needsStoredHotWater=false', () => {
      const plan = makePlan({
        floors: [makeFloor({
          rooms: [makeRoom()],
          floorObjects: [],
          floorRoutes: [],
        })],
      });
      const result = validatePlanReadiness(plan, { needsStoredHotWater: false });
      const item = result.items.find((i) => i.key === 'cylinder_recorded');
      expect(item?.status).toBe('complete');
    });
  });

  describe('default dimensions', () => {
    it('flags default_dimensions as needs_checking when an object has no explicit dimensions', () => {
      // A floor object with no widthM/heightM/depthM → uses template defaults
      const noMeasureCylinder: FloorObject = {
        id: 'obj_nosize',
        floorId: 'floor_1',
        type: 'cylinder',
        x: 200, y: 50,
        // widthM/heightM/depthM deliberately absent
      };
      const plan = makePlan({
        floors: [makeFloor({
          rooms: [makeRoom()],
          walls: [makeWall()],
          floorObjects: [makeBoilerObject(), makeFlueObject(), noMeasureCylinder],
          floorRoutes: [makeFlowRoute()],
        })],
      });
      const result = validatePlanReadiness(plan);
      const item = result.items.find((i) => i.key === 'default_dimensions');
      expect(item?.status).toBe('needs_checking');
    });

    it('marks default_dimensions complete when all objects have explicit dimensions', () => {
      const plan = makePlan({
        floors: [makeFloor({
          rooms: [makeRoom()],
          walls: [makeWall()],
          floorObjects: [makeBoilerObject(), makeFlueObject()],
          floorRoutes: [makeFlowRoute()],
        })],
      });
      const result = validatePlanReadiness(plan);
      const item = result.items.find((i) => i.key === 'default_dimensions');
      expect(item?.status).toBe('complete');
    });
  });

  describe('assumed routes', () => {
    it('flags key_routes as assumed when any route has status=assumed', () => {
      const assumedRoute: FloorRoute = {
        id: 'route_assumed',
        floorId: 'floor_1',
        type: 'flow',
        status: 'assumed',
        points: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
      };
      const plan = makePlan({
        floors: [makeFloor({
          rooms: [makeRoom()],
          walls: [makeWall()],
          floorObjects: [makeBoilerObject(), makeFlueObject()],
          floorRoutes: [assumedRoute],
        })],
      });
      const result = validatePlanReadiness(plan);
      const item = result.items.find((i) => i.key === 'key_routes');
      expect(item?.status).toBe('assumed');
    });

    it('flags discharge_route as assumed when discharge route status=assumed', () => {
      const plan = makePlan({
        floors: [makeFloor({
          rooms: [makeRoom()],
          walls: [makeWall()],
          floorObjects: [makeBoilerObject(), makeFlueObject()],
          floorRoutes: [makeFlowRoute(), makeDischargeRoute('assumed')],
        })],
      });
      const result = validatePlanReadiness(plan);
      const item = result.items.find((i) => i.key === 'discharge_route');
      expect(item?.status).toBe('assumed');
      expect(item?.detail).toContain('route to check');
    });
  });

  describe('fully usable plan', () => {
    it('returns overallStatus=ready when all items are complete', () => {
      const plan = makeFullyUsablePlan();
      const result = validatePlanReadiness(plan);
      expect(result.overallStatus).toBe('ready');
    });

    it('returns zero missing and needs_checking counts', () => {
      const plan = makeFullyUsablePlan();
      const result = validatePlanReadiness(plan);
      expect(result.missingCount).toBe(0);
      expect(result.needsCheckingCount).toBe(0);
      expect(result.assumedCount).toBe(0);
    });

    it('all items are complete on a fully usable plan', () => {
      const plan = makeFullyUsablePlan();
      const result = validatePlanReadiness(plan);
      const notComplete = result.items.filter((i) => i.status !== 'complete');
      expect(notComplete).toHaveLength(0);
    });
  });

  describe('planHandoffSummaryLabel', () => {
    it('returns ready label for ready status', () => {
      expect(planHandoffSummaryLabel('ready')).toBe('Ready for install review');
    });
    it('returns needs verification label for needs_checking status', () => {
      expect(planHandoffSummaryLabel('needs_checking')).toBe('Needs verification before install');
    });
    it('returns incomplete label for incomplete status', () => {
      expect(planHandoffSummaryLabel('incomplete')).toBe('Spatial data incomplete');
    });
  });

  describe('spatialConfidenceIsWeak', () => {
    it('returns false when overallStatus is ready', () => {
      const plan = makeFullyUsablePlan();
      const result = validatePlanReadiness(plan);
      expect(spatialConfidenceIsWeak(result)).toBe(false);
    });

    it('returns true when overallStatus is incomplete', () => {
      const plan = makePlan({ floors: [] });
      const result = validatePlanReadiness(plan);
      expect(spatialConfidenceIsWeak(result)).toBe(true);
    });

    it('returns true when overallStatus is needs_checking', () => {
      // Plan with assumed route → needs_checking
      const assumedRoute: FloorRoute = {
        id: 'r1', floorId: 'floor_1', type: 'flow', status: 'assumed',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      };
      const plan = makePlan({
        floors: [makeFloor({
          rooms: [makeRoom()],
          walls: [makeWall()],
          floorObjects: [makeBoilerObject(), makeFlueObject()],
          floorRoutes: [assumedRoute, makeDischargeRoute()],
        })],
      });
      const result = validatePlanReadiness(plan);
      expect(spatialConfidenceIsWeak(result)).toBe(true);
    });
  });
});
