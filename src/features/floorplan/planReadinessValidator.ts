/**
 * planReadinessValidator.ts — PR20 plan readiness / QA checker.
 *
 * A pure, side-effect-free validator that inspects a PropertyPlan and produces
 * a flat checklist so surveyors can see at a glance whether the floor plan is
 * usable for handoff before relying on it.
 *
 * Design rules
 * ────────────
 * - No rendering, no side-effects, no React imports.
 * - No recommendation logic — receives `needsStoredHotWater` as a parameter.
 * - No hard blocking — every item carries a status, nothing throws.
 * - All checks are independent and composable.
 */

import type { PropertyPlan, FloorObject, FloorRoute } from '../../components/floorplan/propertyPlan.types';
import { usingDefaultDimensions } from './objectTemplates';

// ─── Output types ─────────────────────────────────────────────────────────────

/**
 * Status of a single checklist item.
 *
 *   complete        — the thing is present and looks correct
 *   needs_checking  — the thing is present but carries a signal (default dims,
 *                     assumed route) that warrants on-site verification
 *   missing         — the thing is absent and no explicit "not applicable" was set
 *   assumed         — the thing is absent from recorded truth but an assumed/
 *                     default is being used in its place
 */
export type PlanChecklistStatus = 'complete' | 'needs_checking' | 'missing' | 'assumed';

export interface PlanChecklistItem {
  /** Stable key for programmatic use and test assertions. */
  key: string;
  /** Short human-readable label (surveyor-facing). */
  label: string;
  status: PlanChecklistStatus;
  /** Optional one-line detail — only present when status ≠ 'complete'. */
  detail?: string;
}

/**
 * The result returned by `validatePlanReadiness`.
 *
 * `overallStatus` is the worst status across all items:
 *   all complete              → 'ready'
 *   any needs_checking/assumed → 'needs_checking'
 *   any missing               → 'incomplete'
 */
export type PlanOverallStatus = 'ready' | 'needs_checking' | 'incomplete';

export interface PlanReadinessResult {
  overallStatus: PlanOverallStatus;
  items: PlanChecklistItem[];
  completeCount: number;
  needsCheckingCount: number;
  missingCount: number;
  assumedCount: number;
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface PlanReadinessOptions {
  /**
   * Pass `true` when the selected or recommended scenario requires a hot-water
   * storage cylinder (system/regular boiler, heat pump with buffer tank, etc.).
   * When `false` the "cylinder recorded" check is skipped.
   * Defaults to `false`.
   */
  needsStoredHotWater?: boolean;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function allFloorObjects(plan: PropertyPlan): FloorObject[] {
  return plan.floors.flatMap((f) => f.floorObjects ?? []);
}

function allFloorRoutes(plan: PropertyPlan): FloorRoute[] {
  return plan.floors.flatMap((f) => f.floorRoutes ?? []);
}

function hasObjectOfType(objects: FloorObject[], type: FloorObject['type']): boolean {
  return objects.some((o) => o.type === type);
}

function hasRouteOfType(routes: FloorRoute[], type: FloorRoute['type']): boolean {
  return routes.some((r) => r.type === type);
}

function hasAssumedRouteOfType(routes: FloorRoute[], type: FloorRoute['type']): boolean {
  return routes.some((r) => r.type === type && r.status === 'assumed');
}

/** Heat-source placement-node kinds that indicate a boiler-type heat source. */
const BOILER_NODE_KINDS = new Set([
  'heat_source_combi',
  'heat_source_system_boiler',
  'heat_source_regular_boiler',
]);

function hasBoilerOrHeatSource(plan: PropertyPlan): boolean {
  // FloorObject survey markers
  const objects = allFloorObjects(plan);
  if (hasObjectOfType(objects, 'boiler')) return true;
  // Placement-node heating graph
  return plan.placementNodes.some((n) => BOILER_NODE_KINDS.has(n.type));
}

function hasHeatPump(plan: PropertyPlan): boolean {
  return plan.placementNodes.some((n) => n.type === 'heat_source_heat_pump');
}

/** Minimum wall length in canvas pixels to be considered "usable". */
const MIN_USABLE_WALL_PX = 4;

function roomsHaveUsableWallLengths(plan: PropertyPlan): boolean {
  for (const floor of plan.floors) {
    const wallIds = new Set(floor.walls.map((w) => w.id));
    if (floor.rooms.length > 0 && wallIds.size === 0) return false;
    for (const wall of floor.walls) {
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < MIN_USABLE_WALL_PX) return false;
    }
  }
  return true;
}

// ─── Individual checks ────────────────────────────────────────────────────────

function checkAtLeastOneRoom(plan: PropertyPlan): PlanChecklistItem {
  const totalRooms = plan.floors.reduce((s, f) => s + f.rooms.length, 0);
  if (totalRooms > 0) {
    return { key: 'rooms_present', label: 'Rooms recorded', status: 'complete' };
  }
  return {
    key: 'rooms_present',
    label: 'Rooms recorded',
    status: 'missing',
    detail: 'No rooms have been drawn. Add at least one room to make the plan usable.',
  };
}

function checkBoilerOrHeatSource(plan: PropertyPlan): PlanChecklistItem {
  if (hasBoilerOrHeatSource(plan) || hasHeatPump(plan)) {
    return { key: 'heat_source_recorded', label: 'Boiler location recorded', status: 'complete' };
  }
  return {
    key: 'heat_source_recorded',
    label: 'Boiler location recorded',
    status: 'missing',
    detail: 'No boiler or heat source has been placed.',
  };
}

function checkFlueRecorded(plan: PropertyPlan): PlanChecklistItem {
  const hasBoiler =
    hasBoilerOrHeatSource(plan) &&
    !plan.placementNodes.some((n) => n.type === 'heat_source_heat_pump');

  if (!hasBoiler) {
    // No boiler present — flue check is not applicable.
    return { key: 'flue_recorded', label: 'Flue route recorded', status: 'complete' };
  }

  const objects = allFloorObjects(plan);
  if (hasObjectOfType(objects, 'flue')) {
    return { key: 'flue_recorded', label: 'Flue route recorded', status: 'complete' };
  }

  const routes = allFloorRoutes(plan);
  if (hasAssumedRouteOfType(routes, 'discharge')) {
    return {
      key: 'flue_recorded',
      label: 'Flue route recorded',
      status: 'assumed',
      detail: 'Assumed discharge route — verify flue position on site.',
    };
  }

  return {
    key: 'flue_recorded',
    label: 'Flue route recorded',
    status: 'missing',
    detail: 'A boiler is present but no flue marker has been placed.',
  };
}

function checkCylinderRecorded(
  plan: PropertyPlan,
  needsStoredHotWater: boolean,
): PlanChecklistItem {
  if (!needsStoredHotWater) {
    return { key: 'cylinder_recorded', label: 'Cylinder recorded', status: 'complete' };
  }

  const objects = allFloorObjects(plan);
  if (hasObjectOfType(objects, 'cylinder')) {
    return { key: 'cylinder_recorded', label: 'Cylinder recorded', status: 'complete' };
  }

  // Check placement nodes too (cylinder types)
  const cylinderNodeKinds = new Set([
    'dhw_unvented_cylinder',
    'dhw_mixergy',
    'dhw_vented_cylinder',
  ]);
  if (plan.placementNodes.some((n) => cylinderNodeKinds.has(n.type))) {
    return { key: 'cylinder_recorded', label: 'Cylinder recorded', status: 'complete' };
  }

  return {
    key: 'cylinder_recorded',
    label: 'Cylinder recorded',
    status: 'missing',
    detail: 'The selected scenario uses stored hot water but no cylinder has been placed.',
  };
}

function checkKeyRoutes(plan: PropertyPlan): PlanChecklistItem {
  const routes = allFloorRoutes(plan);

  if (routes.length === 0) {
    return {
      key: 'key_routes',
      label: 'Key routes recorded',
      status: 'missing',
      detail: 'No pipe or service routes have been drawn.',
    };
  }

  const hasAssumed = routes.some((r) => r.status === 'assumed');
  if (hasAssumed) {
    return {
      key: 'key_routes',
      label: 'Key routes recorded',
      status: 'assumed',
      detail: 'Some routes are marked as assumed — verify on site.',
    };
  }

  return { key: 'key_routes', label: 'Key routes recorded', status: 'complete' };
}

function checkDischargeRoute(plan: PropertyPlan): PlanChecklistItem {
  const routes = allFloorRoutes(plan);
  const hasDischarge = hasRouteOfType(routes, 'discharge');
  const hasAssumedDischarge = hasAssumedRouteOfType(routes, 'discharge');

  if (hasAssumedDischarge) {
    return {
      key: 'discharge_route',
      label: 'Assumed discharge route',
      status: 'assumed',
      detail: 'Discharge route is assumed — route to check on site.',
    };
  }

  if (hasDischarge) {
    return { key: 'discharge_route', label: 'Discharge route recorded', status: 'complete' };
  }

  // Discharge is advisory — missing is acceptable without a boiler
  const hasBoiler = hasBoilerOrHeatSource(plan);
  if (hasBoiler) {
    return {
      key: 'discharge_route',
      label: 'Discharge route recorded',
      status: 'missing',
      detail: 'A boiler is present but no condensate/discharge route has been recorded.',
    };
  }

  return { key: 'discharge_route', label: 'Discharge route', status: 'complete' };
}

function checkUsableWallLengths(plan: PropertyPlan): PlanChecklistItem {
  if (roomsHaveUsableWallLengths(plan)) {
    return { key: 'wall_lengths', label: 'Room wall lengths usable', status: 'complete' };
  }
  return {
    key: 'wall_lengths',
    label: 'Room wall lengths usable',
    status: 'needs_checking',
    detail: 'One or more walls are very short or missing. Check room geometry.',
  };
}

function checkDefaultDimensions(plan: PropertyPlan): PlanChecklistItem {
  const objectsWithDefaults = allFloorObjects(plan).filter(usingDefaultDimensions);
  if (objectsWithDefaults.length === 0) {
    return { key: 'default_dimensions', label: 'Object dimensions verified', status: 'complete' };
  }
  const labels = objectsWithDefaults.map((o) => o.label ?? o.type).join(', ');
  return {
    key: 'default_dimensions',
    label: 'Default dimensions — verify on site',
    status: 'needs_checking',
    detail: `Some objects use default dimensions — verify: ${labels}.`,
  };
}

// ─── Overall status derivation ────────────────────────────────────────────────

function deriveOverallStatus(items: PlanChecklistItem[]): PlanOverallStatus {
  if (items.some((i) => i.status === 'missing')) return 'incomplete';
  if (items.some((i) => i.status === 'needs_checking' || i.status === 'assumed')) {
    return 'needs_checking';
  }
  return 'ready';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate a PropertyPlan for handoff readiness and return a flat checklist.
 *
 * This is a pure function — it never mutates `plan` and has no side-effects.
 * It does not block rendering and never throws.
 *
 * @param plan                 The PropertyPlan to inspect.
 * @param options              Optional flags (e.g. needsStoredHotWater).
 */
export function validatePlanReadiness(
  plan: PropertyPlan,
  options: PlanReadinessOptions = {},
): PlanReadinessResult {
  const { needsStoredHotWater = false } = options;

  const items: PlanChecklistItem[] = [
    checkAtLeastOneRoom(plan),
    checkBoilerOrHeatSource(plan),
    checkFlueRecorded(plan),
    checkCylinderRecorded(plan, needsStoredHotWater),
    checkKeyRoutes(plan),
    checkDischargeRoute(plan),
    checkUsableWallLengths(plan),
    checkDefaultDimensions(plan),
  ];

  const overallStatus = deriveOverallStatus(items);

  return {
    overallStatus,
    items,
    completeCount:      items.filter((i) => i.status === 'complete').length,
    needsCheckingCount: items.filter((i) => i.status === 'needs_checking').length,
    missingCount:       items.filter((i) => i.status === 'missing').length,
    assumedCount:       items.filter((i) => i.status === 'assumed').length,
  };
}

/**
 * Derive a short engineer-handoff summary label from a PlanOverallStatus.
 *
 * Used in the handoff panel and engineer layout header.
 */
export function planHandoffSummaryLabel(status: PlanOverallStatus): string {
  switch (status) {
    case 'ready':          return 'Ready for install review';
    case 'needs_checking': return 'Needs verification before install';
    case 'incomplete':     return 'Spatial data incomplete';
  }
}

/**
 * Return true when the plan's overall status warrants softened customer copy
 * ("planned location", "to be confirmed", "route to check") rather than
 * confident spatial claims.
 */
export function spatialConfidenceIsWeak(result: PlanReadinessResult): boolean {
  return result.overallStatus !== 'ready';
}
