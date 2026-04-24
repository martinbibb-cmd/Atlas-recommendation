/**
 * guidedSurveySteps.test.ts — PR24 guided survey step derivation tests.
 *
 * Covers:
 *   1. Progress derived from plan state (rooms, boiler, flue, routes)
 *   2. Cylinder step — optional when needsStoredHotWater=false, missing when true
 *   3. Radiators step — derived directly from plan contents
 *   4. Outlets step — optional when absent (nice-to-have)
 *   5. Correct actions per step (tool, library, preview)
 *   6. Review handoff step status matches overall readiness
 */

import { describe, it, expect } from 'vitest';
import { deriveGuidedSteps } from '../guidedSurveySteps';
import { validatePlanReadiness } from '../planReadinessValidator';
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
  return { id: 'obj_boiler', floorId: 'floor_1', type: 'boiler', x: 100, y: 50, widthM: 0.6, heightM: 0.7 };
}

function makeFlueObject(): FloorObject {
  return { id: 'obj_flue', floorId: 'floor_1', type: 'flue', x: 100, y: 10, widthM: 0.125, heightM: 0.125 };
}

function makeCylinderObject(): FloorObject {
  return { id: 'obj_cylinder', floorId: 'floor_1', type: 'cylinder', x: 200, y: 50, widthM: 0.5, heightM: 0.5 };
}

function makeRadiatorObject(): FloorObject {
  return { id: 'obj_rad', floorId: 'floor_1', type: 'radiator', x: 50, y: 100, widthM: 1.0, heightM: 0.6 };
}

function makeSinkObject(): FloorObject {
  return { id: 'obj_sink', floorId: 'floor_1', type: 'sink', x: 60, y: 120, widthM: 0.6, heightM: 0.5 };
}

function makeFlowRoute(): FloorRoute {
  return { id: 'route_1', floorId: 'floor_1', type: 'flow', status: 'existing', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
}

function makeReturnRoute(): FloorRoute {
  return { id: 'route_2', floorId: 'floor_1', type: 'return', status: 'existing', points: [{ x: 0, y: 10 }, { x: 100, y: 10 }] };
}

function makeDischargeRoute(): FloorRoute {
  return { id: 'route_d', floorId: 'floor_1', type: 'discharge', status: 'existing', points: [{ x: 0, y: 20 }, { x: 50, y: 20 }] };
}

/** Fully populated plan where all standard steps should be 'done'. */
function makeFullPlan(): PropertyPlan {
  return makePlan({
    floors: [makeFloor({
      rooms: [makeRoom()],
      walls: [makeWall()],
      floorObjects: [
        makeBoilerObject(),
        makeFlueObject(),
        makeRadiatorObject(),
        makeSinkObject(),
      ],
      floorRoutes: [makeFlowRoute(), makeReturnRoute(), makeDischargeRoute()],
    })],
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('deriveGuidedSteps', () => {

  // ── 1. Empty plan — all required steps are missing ──────────────────────────

  describe('empty plan', () => {
    it('returns 8 steps', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      expect(steps).toHaveLength(8);
    });

    it('confirm_rooms step is missing on empty plan', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'confirm_rooms')!;
      expect(step.status).toBe('missing');
    });

    it('mark_boiler step is missing on empty plan', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_boiler')!;
      expect(step.status).toBe('missing');
    });

    it('mark_radiators step is missing when no radiators placed', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_radiators')!;
      expect(step.status).toBe('missing');
    });

    it('mark_outlets step is optional when no outlets placed', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_outlets')!;
      expect(step.status).toBe('optional');
    });
  });

  // ── 2. Cylinder step — conditional on needsStoredHotWater ──────────────────

  describe('cylinder step visibility', () => {
    it('cylinder step is optional when needsStoredHotWater=false', () => {
      const plan = makePlan({
        floors: [makeFloor({ rooms: [makeRoom()], walls: [makeWall()], floorObjects: [makeBoilerObject(), makeFlueObject()] })],
      });
      const readiness = validatePlanReadiness(plan, { needsStoredHotWater: false });
      const steps = deriveGuidedSteps(plan, readiness, { needsStoredHotWater: false });
      const step = steps.find((s) => s.key === 'mark_cylinder')!;
      expect(step.status).toBe('optional');
    });

    it('cylinder step is missing when needsStoredHotWater=true and no cylinder placed', () => {
      const plan = makePlan({
        floors: [makeFloor({ rooms: [makeRoom()], walls: [makeWall()], floorObjects: [makeBoilerObject(), makeFlueObject()] })],
      });
      const readiness = validatePlanReadiness(plan, { needsStoredHotWater: true });
      const steps = deriveGuidedSteps(plan, readiness, { needsStoredHotWater: true });
      const step = steps.find((s) => s.key === 'mark_cylinder')!;
      expect(step.status).toBe('missing');
    });

    it('cylinder step is done when cylinder placed and needsStoredHotWater=true', () => {
      const plan = makePlan({
        floors: [makeFloor({
          rooms: [makeRoom()],
          walls: [makeWall()],
          floorObjects: [makeBoilerObject(), makeFlueObject(), makeCylinderObject()],
          floorRoutes: [makeFlowRoute()],
        })],
      });
      const readiness = validatePlanReadiness(plan, { needsStoredHotWater: true });
      const steps = deriveGuidedSteps(plan, readiness, { needsStoredHotWater: true });
      const step = steps.find((s) => s.key === 'mark_cylinder')!;
      expect(step.status).toBe('done');
    });
  });

  // ── 3. Radiator step — derived from plan contents ──────────────────────────

  describe('radiator step', () => {
    it('mark_radiators is done when a radiator floor object is placed', () => {
      const plan = makePlan({ floors: [makeFloor({ floorObjects: [makeRadiatorObject()] })] });
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_radiators')!;
      expect(step.status).toBe('done');
    });

    it('mark_radiators is done when a radiator_loop placement node exists', () => {
      const plan = makePlan({
        placementNodes: [{
          id: 'node_rad', type: 'radiator_loop', floorId: 'floor_1',
          anchor: { x: 100, y: 100 }, orientationDeg: 0, metadata: {},
        }],
      });
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_radiators')!;
      expect(step.status).toBe('done');
    });

    it('mark_radiators is missing when no radiators or radiator nodes present', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_radiators')!;
      expect(step.status).toBe('missing');
    });
  });

  // ── 4. Outlets step — optional when absent ────────────────────────────────

  describe('outlets step', () => {
    it('mark_outlets is done when a sink is placed', () => {
      const plan = makePlan({ floors: [makeFloor({ floorObjects: [makeSinkObject()] })] });
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_outlets')!;
      expect(step.status).toBe('done');
    });

    it('mark_outlets is done when a bath is placed', () => {
      const bath: FloorObject = { id: 'obj_bath', floorId: 'floor_1', type: 'bath', x: 80, y: 90 };
      const plan = makePlan({ floors: [makeFloor({ floorObjects: [bath] })] });
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_outlets')!;
      expect(step.status).toBe('done');
    });

    it('mark_outlets is done when a shower is placed', () => {
      const shower: FloorObject = { id: 'obj_shower', floorId: 'floor_1', type: 'shower', x: 80, y: 90 };
      const plan = makePlan({ floors: [makeFloor({ floorObjects: [shower] })] });
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_outlets')!;
      expect(step.status).toBe('done');
    });

    it('mark_outlets is optional when no outlets are placed', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_outlets')!;
      expect(step.status).toBe('optional');
    });
  });

  // ── 5. Action buttons trigger expected tool / library / preview states ───────

  describe('step actions', () => {
    it('confirm_rooms action is switchTool:select', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'confirm_rooms')!;
      expect(step.action).toEqual({ kind: 'switchTool', tool: 'select' });
    });

    it('mark_boiler action is openLibrary:boiler', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_boiler')!;
      expect(step.action).toEqual({ kind: 'openLibrary', highlightType: 'boiler' });
    });

    it('mark_flue action is openLibrary:flue', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_flue')!;
      expect(step.action).toEqual({ kind: 'openLibrary', highlightType: 'flue' });
    });

    it('mark_cylinder action is openLibrary:cylinder', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_cylinder')!;
      expect(step.action).toEqual({ kind: 'openLibrary', highlightType: 'cylinder' });
    });

    it('mark_radiators action is openLibrary:radiator', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_radiators')!;
      expect(step.action).toEqual({ kind: 'openLibrary', highlightType: 'radiator' });
    });

    it('mark_outlets action is openLibrary:sink', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_outlets')!;
      expect(step.action).toEqual({ kind: 'openLibrary', highlightType: 'sink' });
    });

    it('mark_routes action is switchTool:addFloorRoute', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_routes')!;
      expect(step.action).toEqual({ kind: 'switchTool', tool: 'addFloorRoute' });
    });

    it('review_handoff action is enterPreview', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'review_handoff')!;
      expect(step.action).toEqual({ kind: 'enterPreview' });
    });
  });

  // ── 6. Review handoff step matches overall readiness ─────────────────────

  describe('review_handoff step status', () => {
    it('is done when plan overall status is ready', () => {
      const plan = makeFullPlan();
      const readiness = validatePlanReadiness(plan);
      expect(readiness.overallStatus).toBe('ready');
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'review_handoff')!;
      expect(step.status).toBe('done');
    });

    it('is missing when plan has missing items (incomplete)', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      expect(readiness.overallStatus).toBe('incomplete');
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'review_handoff')!;
      expect(step.status).toBe('missing');
    });

    it('is needs_checking when plan has assumed routes', () => {
      const assumedRoute: FloorRoute = {
        id: 'r1', floorId: 'floor_1', type: 'flow', status: 'assumed',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      };
      const dischargeRoute: FloorRoute = {
        id: 'r2', floorId: 'floor_1', type: 'discharge', status: 'existing',
        points: [{ x: 0, y: 20 }, { x: 50, y: 20 }],
      };
      const plan = makePlan({
        floors: [makeFloor({
          rooms: [makeRoom()],
          walls: [makeWall()],
          floorObjects: [makeBoilerObject(), makeFlueObject()],
          floorRoutes: [assumedRoute, dischargeRoute],
        })],
      });
      const readiness = validatePlanReadiness(plan);
      expect(readiness.overallStatus).toBe('needs_checking');
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'review_handoff')!;
      expect(step.status).toBe('needs_checking');
    });
  });

  // ── 7. Step order ─────────────────────────────────────────────────────────

  describe('step order', () => {
    it('returns steps in the correct order', () => {
      const plan = makePlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const keys = steps.map((s) => s.key);
      expect(keys).toEqual([
        'confirm_rooms',
        'mark_boiler',
        'mark_flue',
        'mark_cylinder',
        'mark_radiators',
        'mark_outlets',
        'mark_routes',
        'review_handoff',
      ]);
    });
  });

  // ── 8. Fully complete plan ────────────────────────────────────────────────

  describe('fully complete plan', () => {
    it('all steps except mark_cylinder and mark_outlets are done', () => {
      const plan = makeFullPlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);

      const nonOptionalSteps = steps.filter(
        (s) => s.key !== 'mark_cylinder' && s.key !== 'mark_outlets',
      );
      const notDone = nonOptionalSteps.filter((s) => s.status !== 'done');
      expect(notDone).toHaveLength(0);
    });

    it('mark_outlets is done on full plan (has sink)', () => {
      const plan = makeFullPlan();
      const readiness = validatePlanReadiness(plan);
      const steps = deriveGuidedSteps(plan, readiness);
      const step = steps.find((s) => s.key === 'mark_outlets')!;
      expect(step.status).toBe('done');
    });

    it('mark_cylinder is optional on full plan without stored-hot-water requirement', () => {
      const plan = makeFullPlan();
      const readiness = validatePlanReadiness(plan, { needsStoredHotWater: false });
      const steps = deriveGuidedSteps(plan, readiness, { needsStoredHotWater: false });
      const step = steps.find((s) => s.key === 'mark_cylinder')!;
      expect(step.status).toBe('optional');
    });
  });
});
