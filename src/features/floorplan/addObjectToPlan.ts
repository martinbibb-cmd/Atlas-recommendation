/**
 * addObjectToPlan.ts — pure mutations for FloorObject (non-HVAC fixtures).
 *
 * FloorObjects (sinks, baths, showers, flues, etc.) are stamped with
 * source='manual', reviewStatus='corrected' provenance so the engineer
 * handoff can display them as confirmed survey data.
 */

import type {
  FloorObject,
  FloorObjectType,
  PropertyPlan,
  EntityProvenance,
} from '../../components/floorplan/propertyPlan.types';

let _seq = 0;
function uid(): string {
  return `fobj_${Date.now().toString(16)}_${(++_seq).toString(16)}`;
}

const MANUAL_PROVENANCE: EntityProvenance = {
  source: 'manual',
  reviewStatus: 'corrected',
};

// ─── Add floor object ─────────────────────────────────────────────────────────

export interface AddFloorObjectParams {
  floorId: string;
  type: FloorObjectType;
  x: number;
  y: number;
  label?: string;
  widthM?: number;
  heightM?: number;
  depthM?: number;
  roomId?: string;
  wallId?: string;
}

/**
 * Return a new PropertyPlan with the floor object added to the specified floor.
 */
export function addObjectToPlan(
  plan: PropertyPlan,
  params: AddFloorObjectParams,
): { plan: PropertyPlan; objectId: string } {
  const obj: FloorObject = {
    id: uid(),
    floorId: params.floorId,
    type: params.type,
    x: params.x,
    y: params.y,
    label: params.label,
    widthM: params.widthM,
    heightM: params.heightM,
    depthM: params.depthM,
    roomId: params.roomId,
    wallId: params.wallId,
    provenance: MANUAL_PROVENANCE,
  };

  const nextPlan: PropertyPlan = {
    ...plan,
    floors: plan.floors.map((floor) => {
      if (floor.id !== params.floorId) return floor;
      return {
        ...floor,
        floorObjects: [...(floor.floorObjects ?? []), obj],
      };
    }),
  };

  return { plan: nextPlan, objectId: obj.id };
}

// ─── Update floor object ──────────────────────────────────────────────────────

export interface UpdateFloorObjectParams {
  floorId: string;
  objectId: string;
  patch: Partial<Omit<FloorObject, 'id' | 'floorId' | 'provenance'>>;
}

/**
 * Return a new PropertyPlan with the floor object patched.
 */
export function updateFloorObject(
  plan: PropertyPlan,
  params: UpdateFloorObjectParams,
): PropertyPlan {
  return {
    ...plan,
    floors: plan.floors.map((floor) => {
      if (floor.id !== params.floorId) return floor;
      return {
        ...floor,
        floorObjects: (floor.floorObjects ?? []).map((obj) => {
          if (obj.id !== params.objectId) return obj;
          return {
            ...obj,
            ...params.patch,
            provenance: { ...(obj.provenance ?? MANUAL_PROVENANCE), reviewStatus: 'corrected' },
          };
        }),
      };
    }),
  };
}

// ─── Remove floor object ──────────────────────────────────────────────────────

/**
 * Return a new PropertyPlan with the floor object removed.
 */
export function removeFloorObject(
  plan: PropertyPlan,
  floorId: string,
  objectId: string,
): PropertyPlan {
  return {
    ...plan,
    floors: plan.floors.map((floor) => {
      if (floor.id !== floorId) return floor;
      return {
        ...floor,
        floorObjects: (floor.floorObjects ?? []).filter((obj) => obj.id !== objectId),
      };
    }),
  };
}
