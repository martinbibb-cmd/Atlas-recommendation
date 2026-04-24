/**
 * updateWallMeasurement.ts — pure mutation that resizes a wall by scaling its
 * end-point along the existing wall direction.
 *
 * The start-point (x1, y1) is held fixed; the end-point moves so the wall
 * reaches the requested length.  Provenance on the wall is set to
 * source='manual', reviewStatus='corrected' to mark the manual edit.
 */

import type { PropertyPlan, Wall, EntityProvenance } from '../../components/floorplan/propertyPlan.types';
import { GRID, MIN_WALL_LENGTH_PX } from './constants';

const MANUAL_PROVENANCE: EntityProvenance = {
  source: 'manual',
  reviewStatus: 'corrected',
};

/**
 * Return a new PropertyPlan where the specified wall has been resized to
 * `newLengthM` metres while preserving its direction and start-point.
 *
 * @param plan        - Current plan (immutable input).
 * @param floorId     - Floor containing the wall.
 * @param wallId      - ID of the wall to resize.
 * @param newLengthM  - Desired wall length in metres (must be > 0).
 * @returns Updated plan, or the original plan unchanged when the wall is not
 *          found or the length is not positive.
 */
export function updateWallMeasurement(
  plan: PropertyPlan,
  floorId: string,
  wallId: string,
  newLengthM: number,
): PropertyPlan {
  if (newLengthM <= 0) return plan;

  return {
    ...plan,
    floors: plan.floors.map((floor) => {
      if (floor.id !== floorId) return floor;
      return {
        ...floor,
        walls: floor.walls.map((wall) => {
          if (wall.id !== wallId) return wall;
          return resizeWall(wall, newLengthM);
        }),
      };
    }),
  };
}

function resizeWall(wall: Wall, newLengthM: number): Wall {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const currentLen = Math.hypot(dx, dy);
  if (currentLen < MIN_WALL_LENGTH_PX) return wall;

  const ux = dx / currentLen;
  const uy = dy / currentLen;
  const newLenPx = newLengthM * GRID;

  return {
    ...wall,
    x2: Math.round(wall.x1 + ux * newLenPx),
    y2: Math.round(wall.y1 + uy * newLenPx),
    provenance: MANUAL_PROVENANCE,
  };
}
