/**
 * Simple orthogonal pipe router.
 *
 * Produces a 2-segment elbow polyline between two canvas points.
 *   • If the horizontal span is larger: horizontal first then vertical.
 *   • If the vertical span is larger: vertical first then horizontal.
 *
 * Returns an SVG `points` string suitable for use in a <polyline>.
 */
export function routePipe(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);

  if (dx >= dy) {
    // Horizontal then vertical: bend at (midX, from.y) → (midX, to.y)
    const midX = (from.x + to.x) / 2;
    return `${from.x},${from.y} ${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`;
  } else {
    // Vertical then horizontal: bend at (from.x, midY) → (to.x, midY)
    const midY = (from.y + to.y) / 2;
    return `${from.x},${from.y} ${from.x},${midY} ${to.x},${midY} ${to.x},${to.y}`;
  }
}

// ─── Room-aware routing ───────────────────────────────────────────────────────

/** Minimal room descriptor used by routePipeAligned. */
export interface RouterRoom {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

/** Snap tolerance in canvas pixels — bend points within this distance of a
 *  wall edge or hall centreline are snapped to that coordinate. */
const WALL_SNAP_PX = 16;

/**
 * Collect candidate snap coordinates for a given axis from the room list.
 *
 * For X-axis snapping (horizontal wall edges): each room contributes its left
 * edge (x) and right edge (x + w), plus the centreline of any room labelled
 * "Hall" or "Landing".
 *
 * For Y-axis snapping (vertical wall edges): each room contributes its top
 * edge (y) and bottom edge (y + h), plus the centreline of any hall room.
 */
function collectSnapCoords(rooms: RouterRoom[], axis: 'x' | 'y'): number[] {
  const coords: number[] = [];
  for (const r of rooms) {
    if (axis === 'x') {
      coords.push(r.x, r.x + r.w);
      if (isHallRoom(r.label)) coords.push(r.x + r.w / 2);
    } else {
      coords.push(r.y, r.y + r.h);
      if (isHallRoom(r.label)) coords.push(r.y + r.h / 2);
    }
  }
  return coords;
}

function isHallRoom(label: string | undefined): boolean {
  if (!label) return false;
  const lower = label.toLowerCase();
  return lower === 'hall' || lower === 'hallway' || lower === 'landing';
}

/**
 * Snap `value` to the nearest candidate coordinate if it is within
 * `WALL_SNAP_PX`.  Returns the original value when no snap is close enough.
 */
function snapToNearest(value: number, candidates: number[]): number {
  let best = value;
  let bestDist = WALL_SNAP_PX;
  for (const c of candidates) {
    const dist = Math.abs(value - c);
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

/**
 * Wall- and hall-aware orthogonal pipe router.
 *
 * Identical logic to `routePipe` for the primary bend direction, but the
 * intermediate bend point is snapped to the nearest room-wall edge or hall
 * centreline within `WALL_SNAP_PX` canvas pixels.
 *
 * This produces "sensible pipe routes" that follow the edges of walls or run
 * along the hallway centreline rather than cutting across open rooms.
 *
 * Hydraulic role validation (flow→flow, return→return) is enforced at the
 * connection level via `isSnapAllowed()` in snapRoles.ts — this function
 * handles only the geometric routing.
 *
 * @param from  - Start point (e.g. component port centre).
 * @param to    - End point (e.g. target port centre).
 * @param rooms - Rooms on the current floor (used for wall-snap candidates).
 * @returns SVG `points` string for a `<polyline>`.
 */
export function routePipeAligned(
  from: { x: number; y: number },
  to:   { x: number; y: number },
  rooms: RouterRoom[],
): string {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);

  const xCandidates = collectSnapCoords(rooms, 'x');
  const yCandidates = collectSnapCoords(rooms, 'y');

  if (dx >= dy) {
    // Horizontal-first: bend at (midX, from.y) — snap midX to a wall edge.
    const rawMidX = (from.x + to.x) / 2;
    const midX    = snapToNearest(rawMidX, xCandidates);
    return `${from.x},${from.y} ${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`;
  } else {
    // Vertical-first: bend at (from.x, midY) — snap midY to a wall edge.
    const rawMidY = (from.y + to.y) / 2;
    const midY    = snapToNearest(rawMidY, yCandidates);
    return `${from.x},${from.y} ${from.x},${midY} ${to.x},${midY} ${to.x},${to.y}`;
  }
}
