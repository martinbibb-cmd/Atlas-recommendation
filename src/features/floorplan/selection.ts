/**
 * selection.ts — hit-test helpers for the floor planner editor.
 *
 * Pure functions that resolve pointer positions to plan entities.
 * These have no React dependencies and are safe to unit-test in isolation.
 */

import type { Point, Room, Wall, Opening, PlacementNode, FloorObject } from '../../components/floorplan/propertyPlan.types';
import { hitTestRoom } from './geometry';
import { findWallHit } from '../../components/floorplan/floorplanDerivations';
import { GRID } from './constants';

export type { Point };

// ─── Room selection ───────────────────────────────────────────────────────────

/**
 * Select the room under the pointer.
 * Returns the matching room or null when the pointer lands on empty canvas.
 */
export function selectRoom(point: Point, rooms: Room[]): Room | null {
  return hitTestRoom(point, rooms);
}

// ─── Wall selection ───────────────────────────────────────────────────────────

export interface WallHit {
  wall: Wall;
  /** Distance along the wall from the start endpoint in metres. */
  offsetM: number;
}

/**
 * Select the wall nearest to the pointer (within default threshold).
 * Thin wrapper around `findWallHit` so callers import from one place.
 */
export function selectWall(
  point: Point,
  walls: Wall[],
  threshold?: number,
): WallHit | null {
  return findWallHit(point, walls, threshold);
}

// ─── Opening selection ────────────────────────────────────────────────────────

const OPENING_HIT_RADIUS_PX = 12;

/**
 * Find the opening whose centre is nearest to the pointer, within a fixed
 * pixel radius.  Requires wall geometry to compute the opening centre.
 */
export function selectOpening(
  point: Point,
  openings: Opening[],
  walls: Wall[],
): Opening | null {
  let best: { opening: Opening; dist: number } | null = null;

  for (const op of openings) {
    const wall = walls.find((w) => w.id === op.wallId);
    if (!wall) continue;
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const ux = dx / len;
    const uy = dy / len;
    const cx = wall.x1 + (op.offsetM + op.widthM / 2) * GRID * ux;
    const cy = wall.y1 + (op.offsetM + op.widthM / 2) * GRID * uy;
    const dist = Math.hypot(point.x - cx, point.y - cy);
    if (dist <= OPENING_HIT_RADIUS_PX && (!best || dist < best.dist)) {
      best = { opening: op, dist };
    }
  }

  return best ? best.opening : null;
}

// ─── PlacementNode selection ──────────────────────────────────────────────────

const NODE_HIT_RADIUS_PX = 30;

/**
 * Find the placement node whose anchor is nearest to the pointer.
 */
export function selectNode(
  point: Point,
  nodes: PlacementNode[],
): PlacementNode | null {
  let best: { node: PlacementNode; dist: number } | null = null;

  for (const node of nodes) {
    const dist = Math.hypot(point.x - node.anchor.x, point.y - node.anchor.y);
    if (dist <= NODE_HIT_RADIUS_PX && (!best || dist < best.dist)) {
      best = { node, dist };
    }
  }

  return best ? best.node : null;
}

// ─── FloorObject selection ────────────────────────────────────────────────────

const FLOOR_OBJECT_HIT_RADIUS_PX = 20;

/**
 * Find the floor object whose anchor is nearest to the pointer.
 */
export function selectFloorObject(
  point: Point,
  objects: FloorObject[],
): FloorObject | null {
  let best: { obj: FloorObject; dist: number } | null = null;

  for (const obj of objects) {
    const dist = Math.hypot(point.x - obj.x, point.y - obj.y);
    if (dist <= FLOOR_OBJECT_HIT_RADIUS_PX && (!best || dist < best.dist)) {
      best = { obj, dist };
    }
  }

  return best ? best.obj : null;
}
