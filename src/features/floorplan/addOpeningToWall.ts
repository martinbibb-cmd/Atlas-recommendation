/**
 * addOpeningToWall.ts — pure mutation that inserts a door or window onto a
 * wall, or updates an existing opening's offset and width.
 *
 * All newly-created openings are stamped with source='manual' provenance so
 * the engineer handoff can distinguish confirmed manual edits.
 */

import type {
  Opening,
  OpeningType,
  PropertyPlan,
  EntityProvenance,
} from '../../components/floorplan/propertyPlan.types';

let _seq = 0;
function uid(): string {
  return `opening_${Date.now().toString(16)}_${(++_seq).toString(16)}`;
}

const MANUAL_PROVENANCE: EntityProvenance = {
  source: 'manual',
  reviewStatus: 'corrected',
};

// ─── Add opening ──────────────────────────────────────────────────────────────

export interface AddOpeningParams {
  floorId: string;
  wallId: string;
  type: OpeningType;
  /** Offset from the wall start-point in metres. */
  offsetM: number;
  /** Opening width in metres. */
  widthM: number;
}

/**
 * Return a new PropertyPlan with the opening added to the specified wall.
 * The new opening is marked with manual provenance.
 */
export function addOpeningToWall(
  plan: PropertyPlan,
  params: AddOpeningParams,
): { plan: PropertyPlan; openingId: string } {
  const opening: Opening = {
    id: uid(),
    floorId: params.floorId,
    type: params.type,
    wallId: params.wallId,
    offsetM: Math.max(0, params.offsetM),
    widthM: Math.max(0.1, params.widthM),
    provenance: MANUAL_PROVENANCE,
  };

  const nextPlan: PropertyPlan = {
    ...plan,
    floors: plan.floors.map((floor) => {
      if (floor.id !== params.floorId) return floor;
      return { ...floor, openings: [...floor.openings, opening] };
    }),
  };

  return { plan: nextPlan, openingId: opening.id };
}

// ─── Update existing opening ──────────────────────────────────────────────────

export interface UpdateOpeningParams {
  floorId: string;
  openingId: string;
  patch: Partial<Pick<Opening, 'type' | 'offsetM' | 'widthM' | 'wallId'>>;
}

/**
 * Return a new PropertyPlan with the specified opening updated.
 * The provenance reviewStatus is upgraded to 'corrected' on edit.
 */
export function updateOpening(
  plan: PropertyPlan,
  params: UpdateOpeningParams,
): PropertyPlan {
  return {
    ...plan,
    floors: plan.floors.map((floor) => {
      if (floor.id !== params.floorId) return floor;
      return {
        ...floor,
        openings: floor.openings.map((op) => {
          if (op.id !== params.openingId) return op;
          return {
            ...op,
            ...params.patch,
            provenance: { ...(op.provenance ?? MANUAL_PROVENANCE), reviewStatus: 'corrected' },
          };
        }),
      };
    }),
  };
}

// ─── Remove opening ───────────────────────────────────────────────────────────

/**
 * Return a new PropertyPlan with the specified opening removed.
 */
export function removeOpening(
  plan: PropertyPlan,
  floorId: string,
  openingId: string,
): PropertyPlan {
  return {
    ...plan,
    floors: plan.floors.map((floor) => {
      if (floor.id !== floorId) return floor;
      return { ...floor, openings: floor.openings.filter((op) => op.id !== openingId) };
    }),
  };
}
