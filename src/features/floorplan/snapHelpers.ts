/**
 * snapHelpers.ts — PR18 snapping and alignment guide utilities.
 *
 * All functions are pure and side-effect-free.  They operate on raw
 * canvas-space coordinates and produce data structures consumed by the
 * FloorPlanBuilder renderer.
 *
 * Rules (enforced by this module):
 * - Never read or write any provenance / confidence field.
 * - Snap results are visual previews only; committing a position is always
 *   the caller's responsibility.
 * - No new model fields, object types, or route types are introduced here.
 */

import { snapToNearestCorner, snapToNearestWall } from './geometry';
import type {
  FloorObject,
  FloorRoute,
  PlacementNode,
  Point,
  Room,
  Wall,
} from '../../components/floorplan/propertyPlan.types';
import { GRID } from './constants';

// ─── Snap kinds ───────────────────────────────────────────────────────────────

/**
 * Classification of the snap result:
 *
 * corner         — snapped to a wall endpoint
 * wall           — snapped to a wall segment (perpendicular projection)
 * object_centre  — snapped to the centre of a FloorObject or PlacementNode
 * route_endpoint — snapped to the start or end of an existing FloorRoute
 * free           — no snap candidate found; cursor is at the raw position
 */
export type SnapKind =
  | 'corner'
  | 'wall'
  | 'object_centre'
  | 'route_endpoint'
  | 'free';

export interface SnapResult {
  snapped: Point;
  kind: SnapKind;
  /** Present when kind === 'wall'. */
  snapWallId?: string;
}

// ─── Alignment guides ─────────────────────────────────────────────────────────

/**
 * A single axis-aligned dashed guide line rendered while placing an object.
 *
 * axis  — 'x' = vertical line at canvas X coordinate `value`
 *         'y' = horizontal line at canvas Y coordinate `value`
 * value — canvas coordinate of the guide on that axis
 */
export interface AlignGuide {
  axis: 'x' | 'y';
  value: number;
}

// ─── Zoom-scaled threshold ────────────────────────────────────────────────────

/**
 * Minimum zoom level below which snapping is disabled entirely.
 * At very low zoom the canvas is so compressed that snap becomes
 * unreachable within a reasonable touch target.
 */
const MIN_SNAP_ZOOM = 0.4;

/**
 * Maximum multiplier on the base threshold.
 * Prevents the canvas-space threshold from growing without bound when zoomed
 * out, which would produce "magnetic" snapping across large distances.
 */
const MAX_THRESHOLD_MULTIPLIER = 2.0;

/**
 * Scale a base snap threshold (canvas pixels) for the current zoom level.
 *
 * The intent is to keep the screen-space snap tolerance roughly constant:
 * a 14 canvas-px threshold at zoom=1 covers 14 screen-px; at zoom=2 we want
 * the same 14 screen-px of tolerance, which is only 7 canvas-px.
 *
 * Returns 0 when zoom is below MIN_SNAP_ZOOM (snapping disabled).
 */
export function snapThresholdForZoom(baseThreshold: number, zoom: number): number {
  if (zoom < MIN_SNAP_ZOOM) return 0;
  const scaled = baseThreshold / zoom;
  return Math.min(scaled, baseThreshold * MAX_THRESHOLD_MULTIPLIER);
}

// ─── Object-centre snap ───────────────────────────────────────────────────────

const BASE_OBJECT_SNAP_PX = 18;

/**
 * Snap to the nearest FloorObject position or PlacementNode anchor within
 * `threshold` canvas pixels.  Returns the snap point and a display label,
 * or null if no candidate is close enough.
 */
export function snapToObjectCentres(
  point: Point,
  floorObjects: FloorObject[],
  placementNodes: PlacementNode[],
  threshold: number = BASE_OBJECT_SNAP_PX,
): { point: Point; label: string } | null {
  let best: { point: Point; label: string; dist: number } | null = null;

  for (const obj of floorObjects) {
    const dist = Math.hypot(point.x - obj.x, point.y - obj.y);
    if (dist <= threshold && (!best || dist < best.dist)) {
      best = { point: { x: obj.x, y: obj.y }, label: obj.label ?? obj.type, dist };
    }
  }

  for (const node of placementNodes) {
    const dist = Math.hypot(point.x - node.anchor.x, point.y - node.anchor.y);
    if (dist <= threshold && (!best || dist < best.dist)) {
      best = { point: { x: node.anchor.x, y: node.anchor.y }, label: node.type, dist };
    }
  }

  return best ? { point: best.point, label: best.label } : null;
}

// ─── Route-endpoint snap ──────────────────────────────────────────────────────

const BASE_ROUTE_ENDPOINT_SNAP_PX = 16;

/**
 * Snap to the start or end point of any existing FloorRoute within `threshold`
 * canvas pixels.
 *
 * Only considers the first and last points of each route (the endpoints that
 * a surveyor would naturally want to connect to).  Never reads or alters
 * route provenance.
 */
export function snapToRouteEndpoints(
  point: Point,
  routes: FloorRoute[],
  threshold: number = BASE_ROUTE_ENDPOINT_SNAP_PX,
): Point | null {
  let best: { point: Point; dist: number } | null = null;

  for (const route of routes) {
    const first = route.points[0];
    const last  = route.points[route.points.length - 1];
    for (const ep of [first, last]) {
      if (!ep) continue;
      const dist = Math.hypot(point.x - ep.x, point.y - ep.y);
      if (dist <= threshold && (!best || dist < best.dist)) {
        best = { point: ep, dist };
      }
    }
  }

  return best ? best.point : null;
}

// ─── Unified snap (PR18) ──────────────────────────────────────────────────────

/** Base thresholds (canvas pixels at zoom = 1). */
const BASE_CORNER_PX  = 18;
const BASE_WALL_PX    = 14;

/**
 * Apply full snap priority for floor-route waypoints and floor-object
 * placement.  Snap candidates are tested in priority order:
 *
 *   1. Wall corner (endpoint)   — highest accuracy; typical "start of wall" intent
 *   2. Object centre            — snap to existing survey fixture / HVAC node
 *   3. Route endpoint           — chain routes together cleanly
 *   4. Wall segment projection  — snap along a wall face
 *   5. Free placement           — no nearby target; raw pointer position used
 *
 * All thresholds are scaled for the current zoom so snap feels consistent
 * regardless of zoom level, and so it does not become "magnetic" when zoomed
 * out.
 *
 * Snapping never silently modifies confidence or provenance.
 */
export function computeObjectSnap(
  point: Point,
  walls: Wall[],
  floorObjects: FloorObject[],
  placementNodes: PlacementNode[],
  routes: FloorRoute[],
  zoom: number,
): SnapResult {
  const cornerThreshold = snapThresholdForZoom(BASE_CORNER_PX, zoom);
  const wallThreshold   = snapThresholdForZoom(BASE_WALL_PX, zoom);
  const objectThreshold = snapThresholdForZoom(BASE_OBJECT_SNAP_PX, zoom);
  const routeThreshold  = snapThresholdForZoom(BASE_ROUTE_ENDPOINT_SNAP_PX, zoom);

  // 1. Corner snap
  const corner = snapToNearestCorner(point, walls, cornerThreshold);
  if (corner) return { snapped: corner, kind: 'corner' };

  // 2. Object-centre snap
  const obj = snapToObjectCentres(point, floorObjects, placementNodes, objectThreshold);
  if (obj) return { snapped: obj.point, kind: 'object_centre' };

  // 3. Route-endpoint snap
  const endpoint = snapToRouteEndpoints(point, routes, routeThreshold);
  if (endpoint) return { snapped: endpoint, kind: 'route_endpoint' };

  // 4. Wall-segment snap
  const wall = snapToNearestWall(point, walls, wallThreshold);
  if (wall) return { snapped: wall.point, kind: 'wall', snapWallId: wall.wallId };

  // 5. Free
  return { snapped: point, kind: 'free' };
}

// ─── Alignment guides ─────────────────────────────────────────────────────────

/** How close (canvas px) the ghost must be to trigger an alignment guide.
 * 4 px was chosen to be finger-reachable on a tablet at zoom=1 while avoiding
 * false positives when objects are densely packed on a grid.
 */
const ALIGN_TOLERANCE_PX = 4;

/**
 * Compute lightweight alignment guides for the given ghost position.
 *
 * A guide fires when the ghost X or Y is within ALIGN_TOLERANCE_PX of:
 *   - another FloorObject's position
 *   - a PlacementNode anchor
 *   - a Room edge or centreline
 *   - a Wall midpoint
 *
 * Returns an array of guide descriptors (visual only — never stored in model).
 * Deduplicates guides on the same axis/value.
 */
export function computeAlignmentGuides(
  ghostPos: Point,
  rooms: Room[],
  walls: Wall[],
  floorObjects: FloorObject[],
  placementNodes: PlacementNode[],
): AlignGuide[] {
  const guides: AlignGuide[] = [];
  const seenX = new Set<number>();
  const seenY = new Set<number>();

  function tryX(x: number) {
    const rounded = Math.round(x);
    if (Math.abs(ghostPos.x - rounded) <= ALIGN_TOLERANCE_PX && !seenX.has(rounded)) {
      seenX.add(rounded);
      guides.push({ axis: 'x', value: rounded });
    }
  }

  function tryY(y: number) {
    const rounded = Math.round(y);
    if (Math.abs(ghostPos.y - rounded) <= ALIGN_TOLERANCE_PX && !seenY.has(rounded)) {
      seenY.add(rounded);
      guides.push({ axis: 'y', value: rounded });
    }
  }

  for (const obj of floorObjects) {
    tryX(obj.x);
    tryY(obj.y);
  }

  for (const node of placementNodes) {
    tryX(node.anchor.x);
    tryY(node.anchor.y);
  }

  for (const room of rooms) {
    // Room edges
    tryX(room.x);
    tryX(room.x + room.width);
    tryY(room.y);
    tryY(room.y + room.height);
    // Room centrelines
    tryX(room.x + room.width / 2);
    tryY(room.y + room.height / 2);
  }

  for (const wall of walls) {
    tryX((wall.x1 + wall.x2) / 2);
    tryY((wall.y1 + wall.y2) / 2);
  }

  return guides;
}

// ─── Wall length validation ───────────────────────────────────────────────────

/** Minimum practical wall length in metres for a user-authored wall. */
export const MIN_PRACTICAL_WALL_LENGTH_M = 0.5;

/**
 * Validate a proposed wall length entered by the user.
 * Returns a human-readable warning string, or null when valid.
 */
export function validateWallLength(newLengthM: number): string | null {
  if (!isFinite(newLengthM) || newLengthM <= 0) {
    return 'Length must be a positive number.';
  }
  if (newLengthM < MIN_PRACTICAL_WALL_LENGTH_M) {
    return `Too short — minimum is ${MIN_PRACTICAL_WALL_LENGTH_M} m.`;
  }
  return null;
}

// ─── Route label positioning ──────────────────────────────────────────────────

/**
 * Minimum distance (canvas px) from the nearest endpoint before we attempt
 * a perpendicular offset instead of an outward shift.
 */
const LABEL_ENDPOINT_CLEARANCE_PX = 16;

/**
 * Result of routeLabelPosition.  Callers render the label at
 * `(x + perpOffsetX, y + perpOffsetY)`.
 */
export interface RouteLabelPlacement {
  x: number;
  y: number;
  perpOffsetX: number;
  perpOffsetY: number;
}

/**
 * Compute a safe label position for a route polyline.
 *
 * Prefers the segment at the midpoint.  If the midpoint is too close to the
 * start or end dot (< LABEL_ENDPOINT_CLEARANCE_PX), the perpendicular offset
 * is increased so the label does not overlap a terminal marker.
 *
 * Returns null when the route has fewer than 2 points.
 */
export function routeLabelPosition(points: Point[]): RouteLabelPlacement | null {
  if (points.length < 2) return null;

  const midIdx  = Math.floor(points.length / 2);
  const mid     = points[midIdx];
  const start   = points[0];
  const end     = points[points.length - 1];

  // Perpendicular direction derived from the segment around the midpoint.
  const prevIdx = Math.max(0, midIdx - 1);
  const nextIdx = Math.min(points.length - 1, midIdx + 1);
  const dx = points[nextIdx].x - points[prevIdx].x;
  const dy = points[nextIdx].y - points[prevIdx].y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular: rotate 90° counter-clockwise
  const perpX = -dy / len;
  const perpY =  dx / len;

  const distToStart = Math.hypot(mid.x - start.x, mid.y - start.y);
  const distToEnd   = Math.hypot(mid.x - end.x,   mid.y - end.y);
  const tooClose    = distToStart < LABEL_ENDPOINT_CLEARANCE_PX || distToEnd < LABEL_ENDPOINT_CLEARANCE_PX;

  // Larger offset for short routes to avoid the endpoint dots.
  const offsetMag = tooClose ? 14 : 8;

  return {
    x: mid.x,
    y: mid.y,
    perpOffsetX: perpX * offsetMag,
    perpOffsetY: perpY * offsetMag,
  };
}

export { GRID };
