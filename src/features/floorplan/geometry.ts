/**
 * geometry.ts — pure spatial helpers for the floor planner editor.
 *
 * All functions are side-effect-free and operate on raw numeric values or
 * canonical plan types.  They must not import React or mutate plan state.
 */

import type { Point, Wall, Room } from '../../components/floorplan/propertyPlan.types';
import { GRID, MIN_WALL_LENGTH_PX } from './constants';

// ─── Wall geometry ────────────────────────────────────────────────────────────

/** Length of a wall in canvas pixels. */
export function wallLengthPx(wall: Wall): number {
  return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
}

/** Length of a wall in metres. */
export function wallLengthM(wall: Wall): number {
  return wallLengthPx(wall) / GRID;
}

/** Unit vector along the wall direction (x1,y1 → x2,y2). */
export function wallUnitVector(wall: Wall): { ux: number; uy: number } {
  const len = wallLengthPx(wall);
  if (len < MIN_WALL_LENGTH_PX) return { ux: 1, uy: 0 };
  return { ux: (wall.x2 - wall.x1) / len, uy: (wall.y2 - wall.y1) / len };
}

// ─── Snap helpers ─────────────────────────────────────────────────────────────

const SNAP_TO_CORNER_THRESHOLD = 18; // px
const SNAP_TO_WALL_THRESHOLD   = 14; // px

/**
 * Snap a point to the nearest wall endpoint (corner) if within threshold.
 * Returns the snapped point, or null if no corner is close enough.
 */
export function snapToNearestCorner(
  point: Point,
  walls: Wall[],
  threshold: number = SNAP_TO_CORNER_THRESHOLD,
): Point | null {
  let best: { point: Point; dist: number } | null = null;

  for (const wall of walls) {
    for (const corner of [
      { x: wall.x1, y: wall.y1 },
      { x: wall.x2, y: wall.y2 },
    ]) {
      const dist = Math.hypot(point.x - corner.x, point.y - corner.y);
      if (dist <= threshold && (!best || dist < best.dist)) {
        best = { point: corner, dist };
      }
    }
  }

  return best ? best.point : null;
}

/**
 * Snap a point to the nearest wall segment (perpendicular projection) if
 * within threshold.  Returns the projected point and wallId, or null.
 */
export function snapToNearestWall(
  point: Point,
  walls: Wall[],
  threshold: number = SNAP_TO_WALL_THRESHOLD,
): { point: Point; wallId: string } | null {
  let best: { point: Point; wallId: string; dist: number } | null = null;

  for (const wall of walls) {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < MIN_WALL_LENGTH_PX * MIN_WALL_LENGTH_PX) continue;

    const t = Math.max(
      0,
      Math.min(1, ((point.x - wall.x1) * dx + (point.y - wall.y1) * dy) / lenSq),
    );
    const projX = wall.x1 + t * dx;
    const projY = wall.y1 + t * dy;
    const dist = Math.hypot(point.x - projX, point.y - projY);

    if (dist <= threshold && (!best || dist < best.dist)) {
      best = { point: { x: projX, y: projY }, wallId: wall.id, dist };
    }
  }

  return best ? { point: best.point, wallId: best.wallId } : null;
}

/**
 * Apply PR9 snapping priority: corner first, then wall, then grid.
 *
 * 1. Snap to wall corner (endpoint) if within SNAP_TO_CORNER_THRESHOLD.
 * 2. Snap to wall segment projection if within SNAP_TO_WALL_THRESHOLD.
 * 3. Fall through to grid snap (caller's responsibility).
 */
export function applyPlannerSnap(
  point: Point,
  walls: Wall[],
): { snapped: Point; snappedToWallId?: string } {
  const corner = snapToNearestCorner(point, walls);
  if (corner) return { snapped: corner };

  const wall = snapToNearestWall(point, walls);
  if (wall) return { snapped: wall.point, snappedToWallId: wall.wallId };

  return { snapped: point };
}

// ─── Room geometry ────────────────────────────────────────────────────────────

/** Area of a room in m² from canvas coordinates. */
export function roomAreaM2(room: Room): number {
  return Number(((room.width / GRID) * (room.height / GRID)).toFixed(2));
}

/** Centre point of a room (canvas pixels). */
export function roomCentre(room: Room): Point {
  return {
    x: room.x + room.width / 2,
    y: room.y + room.height / 2,
  };
}

/**
 * Return true when point is inside the room rectangle (canvas pixels).
 */
export function pointInRoom(point: Point, room: Room): boolean {
  return (
    point.x >= room.x &&
    point.x <= room.x + room.width &&
    point.y >= room.y &&
    point.y <= room.y + room.height
  );
}

/**
 * Find the room (if any) that contains the given canvas-space point.
 * When rooms overlap the first match in array order wins.
 */
export function hitTestRoom(point: Point, rooms: Room[]): Room | null {
  for (const room of rooms) {
    if (pointInRoom(point, room)) return room;
  }
  return null;
}

// ─── Canvas unit conversion ───────────────────────────────────────────────────

/** Format canvas pixels as a metres string (1 decimal place). */
export function pxToMetersLabel(px: number): string {
  return (px / GRID).toFixed(1);
}

export { GRID };
