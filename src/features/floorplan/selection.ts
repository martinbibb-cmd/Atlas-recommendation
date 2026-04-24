/**
 * selection.ts — hit-test helpers for the floor planner editor.
 *
 * Pure functions that resolve pointer positions to plan entities.
 * These have no React dependencies and are safe to unit-test in isolation.
 */

import type { Point, Room, Wall, Opening, PlacementNode, FloorObject, FloorRoute } from '../../components/floorplan/propertyPlan.types';
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

// ─── FloorRoute selection ─────────────────────────────────────────────────────

/** Maximum perpendicular distance (px) from a polyline segment for a hit. */
const ROUTE_HIT_DIST_PX = 10;

/**
 * Return the minimum perpendicular distance from `point` to a line segment
 * defined by `a` → `b`.
 */
function pointToSegmentDist(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  // Project point onto segment, clamp to [0, 1]
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/**
 * Find the floor route whose polyline passes nearest to the pointer.
 * Returns the matching route or null when nothing is within the hit radius.
 *
 * Checks each segment of each route's polyline.  The route with the closest
 * segment distance (within ROUTE_HIT_DIST_PX) is returned.
 */
export function selectFloorRoute(
  point: Point,
  routes: FloorRoute[],
): FloorRoute | null {
  let best: { route: FloorRoute; dist: number } | null = null;

  for (const route of routes) {
    const pts = route.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const dist = pointToSegmentDist(point, pts[i], pts[i + 1]);
      if (dist <= ROUTE_HIT_DIST_PX && (!best || dist < best.dist)) {
        best = { route, dist };
      }
    }
  }

  return best ? best.route : null;
}
