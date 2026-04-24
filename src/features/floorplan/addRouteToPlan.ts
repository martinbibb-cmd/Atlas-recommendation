/**
 * addRouteToPlan.ts — pure mutations for FloorRoute (pipe/service routes).
 *
 * FloorRoutes are user-drawn pipe and service paths stamped with
 * source='manual', reviewStatus='corrected' provenance so the engineer
 * handoff can display them as confirmed survey data.
 *
 * Assumed routes retain their status — they must never be silently upgraded
 * to 'confirmed'.  The assumed flag is the engineer's explicit signal that
 * the route needs on-site verification.
 */

import type {
  FloorRoute,
  FloorRouteType,
  FloorRouteStatus,
  Point,
  PropertyPlan,
  EntityProvenance,
} from '../../components/floorplan/propertyPlan.types';

let _seq = 0;
function uid(): string {
  return `froute_${Date.now().toString(16)}_${(++_seq).toString(16)}`;
}

const MANUAL_PROVENANCE: EntityProvenance = {
  source: 'manual',
  reviewStatus: 'corrected',
};

// ─── Add floor route ──────────────────────────────────────────────────────────

export interface AddFloorRouteParams {
  floorId: string;
  type: FloorRouteType;
  status: FloorRouteStatus;
  points: Point[];
  fromObjectId?: string;
  toObjectId?: string;
  notes?: string;
}

/**
 * Return a new PropertyPlan with the floor route added to the specified floor.
 * Requires at least 2 points; returns the unchanged plan otherwise.
 */
export function addRouteToPlan(
  plan: PropertyPlan,
  params: AddFloorRouteParams,
): { plan: PropertyPlan; routeId: string } {
  if (params.points.length < 2) return { plan, routeId: '' };

  const route: FloorRoute = {
    id: uid(),
    floorId: params.floorId,
    type: params.type,
    status: params.status,
    points: [...params.points],
    fromObjectId: params.fromObjectId,
    toObjectId: params.toObjectId,
    notes: params.notes,
    provenance: MANUAL_PROVENANCE,
  };

  const nextPlan: PropertyPlan = {
    ...plan,
    floors: plan.floors.map((floor) => {
      if (floor.id !== params.floorId) return floor;
      return {
        ...floor,
        floorRoutes: [...(floor.floorRoutes ?? []), route],
      };
    }),
  };

  return { plan: nextPlan, routeId: route.id };
}

// ─── Update floor route ───────────────────────────────────────────────────────

export interface UpdateRouteParams {
  floorId: string;
  routeId: string;
  patch: Partial<Omit<FloorRoute, 'id' | 'floorId' | 'provenance'>>;
}

/**
 * Return a new PropertyPlan with the route patched.
 * Provenance is re-stamped as manual/corrected on every update.
 */
export function updateRoute(
  plan: PropertyPlan,
  params: UpdateRouteParams,
): PropertyPlan {
  return {
    ...plan,
    floors: plan.floors.map((floor) => {
      if (floor.id !== params.floorId) return floor;
      return {
        ...floor,
        floorRoutes: (floor.floorRoutes ?? []).map((r) => {
          if (r.id !== params.routeId) return r;
          return {
            ...r,
            ...params.patch,
            provenance: { ...(r.provenance ?? MANUAL_PROVENANCE), reviewStatus: 'corrected' },
          };
        }),
      };
    }),
  };
}

// ─── Remove floor route ───────────────────────────────────────────────────────

/**
 * Return a new PropertyPlan with the floor route removed.
 */
export function removeRoute(
  plan: PropertyPlan,
  floorId: string,
  routeId: string,
): PropertyPlan {
  return {
    ...plan,
    floors: plan.floors.map((floor) => {
      if (floor.id !== floorId) return floor;
      return {
        ...floor,
        floorRoutes: (floor.floorRoutes ?? []).filter((r) => r.id !== routeId),
      };
    }),
  };
}
