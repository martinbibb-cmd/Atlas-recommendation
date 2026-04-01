/**
 * Orthogonal pipe routing utilities.
 */

export interface RouterRoom {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

const WALL_SNAP_PX = 16;

export function routePipe(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dx >= dy) {
    const midX = (from.x + to.x) / 2;
    return `${from.x},${from.y} ${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`;
  }
  const midY = (from.y + to.y) / 2;
  return `${from.x},${from.y} ${from.x},${midY} ${to.x},${midY} ${to.x},${to.y}`;
}

function isHallRoom(label?: string): boolean {
  if (!label) return false;
  const v = label.toLowerCase();
  return v.includes('hall') || v.includes('landing');
}

function collectSnapCoords(rooms: RouterRoom[], axis: 'x' | 'y'): number[] {
  const coords: number[] = [];
  rooms.forEach((room) => {
    if (axis === 'x') {
      coords.push(room.x, room.x + room.w);
      if (isHallRoom(room.label)) coords.push(room.x + room.w / 2);
    } else {
      coords.push(room.y, room.y + room.h);
      if (isHallRoom(room.label)) coords.push(room.y + room.h / 2);
    }
  });
  return coords;
}

function snapToNearest(value: number, candidates: number[]): number {
  let best = value;
  let bestDist = WALL_SNAP_PX;
  candidates.forEach((candidate) => {
    const dist = Math.abs(candidate - value);
    if (dist <= bestDist) {
      bestDist = dist;
      best = candidate;
    }
  });
  return best;
}

export function routePipeAligned(
  from: { x: number; y: number },
  to: { x: number; y: number },
  rooms: RouterRoom[],
): string {
  if (rooms.length === 0) return routePipe(from, to);

  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);

  const xCandidates = collectSnapCoords(rooms, 'x');
  const yCandidates = collectSnapCoords(rooms, 'y');

  if (dx >= dy) {
    const rawMidX = (from.x + to.x) / 2;
    const midX = snapToNearest(rawMidX, xCandidates);
    return `${from.x},${from.y} ${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`;
  }

  const rawMidY = (from.y + to.y) / 2;
  const midY = snapToNearest(rawMidY, yCandidates);
  return `${from.x},${from.y} ${from.x},${midY} ${to.x},${midY} ${to.x},${to.y}`;
}

// ── Pipe-crossing and parallel-offset utilities ───────────────────────────────

/** Radius (px) of the arc used to draw a crossing bridge bump. */
export const BUMP_RADIUS = 7;

/** Perpendicular offset (px) applied to a pipe that runs parallel to an
 *  already-routed pipe through the same corridor. */
export const LANE_PITCH = 14;

/** Parse a polyline `points` string (e.g. "10,20 30,40 50,60") into an array
 *  of {x, y} coordinate objects.
 *  Invalid / non-finite coordinate tokens are clamped to 0 so that a single
 *  malformed entry never throws during rendering. */
export function parsePoints(points: string): Array<{ x: number; y: number }> {
  return points
    .trim()
    .split(/\s+/)
    .map((p) => {
      const [x, y] = p.split(',').map(Number);
      return { x: isFinite(x) ? x : 0, y: isFinite(y) ? y : 0 };
    });
}

interface Seg { x1: number; y1: number; x2: number; y2: number }

function toSegs(pts: Array<{ x: number; y: number }>): Seg[] {
  const segs: Seg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    segs.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y });
  }
  return segs;
}

function isHSeg(s: Seg): boolean { return Math.abs(s.y2 - s.y1) < 0.5; }
function isVSeg(s: Seg): boolean { return Math.abs(s.x2 - s.x1) < 0.5; }

/**
 * Find all strict interior crossing points between two orthogonal polyline
 * routes.  A crossing occurs where a horizontal segment of one route meets a
 * vertical segment of the other at a point that is not at the endpoints of
 * either segment.
 */
export function findCrossings(
  pointsA: string,
  pointsB: string,
): Array<{ x: number; y: number }> {
  const segsA = toSegs(parsePoints(pointsA));
  const segsB = toSegs(parsePoints(pointsB));
  const results: Array<{ x: number; y: number }> = [];
  // Keep the crossing point at least BUMP_RADIUS + 2 px inside each segment so
  // that the bump arc fits without clipping the endpoint of the segment.
  const margin = BUMP_RADIUS + 2;

  for (const a of segsA) {
    for (const b of segsB) {
      let cx: number, cy: number;
      let minHX: number, maxHX: number, minVY: number, maxVY: number;

      if (isHSeg(a) && isVSeg(b)) {
        cx = (b.x1 + b.x2) / 2;  cy = (a.y1 + a.y2) / 2;
        minHX = Math.min(a.x1, a.x2); maxHX = Math.max(a.x1, a.x2);
        minVY = Math.min(b.y1, b.y2); maxVY = Math.max(b.y1, b.y2);
      } else if (isVSeg(a) && isHSeg(b)) {
        cx = (a.x1 + a.x2) / 2;  cy = (b.y1 + b.y2) / 2;
        minHX = Math.min(b.x1, b.x2); maxHX = Math.max(b.x1, b.x2);
        minVY = Math.min(a.y1, a.y2); maxVY = Math.max(a.y1, a.y2);
      } else {
        continue;
      }

      if (
        cx > minHX + margin && cx < maxHX - margin &&
        cy > minVY + margin && cy < maxVY - margin
      ) {
        results.push({ x: cx, y: cy });
      }
    }
  }

  return results;
}

/**
 * Build an SVG path `d` string from a polyline `points` string, inserting
 * semicircular "bridge bump" arcs at each of the given crossing points.
 *
 * Convention:
 *   Horizontal segments → bump arcs upward (decreasing y in SVG).
 *   Vertical segments   → bump arcs rightward (increasing x in SVG).
 */
export function buildPathWithBumps(
  points: string,
  crossings: Array<{ x: number; y: number }>,
): string {
  const pts = parsePoints(points);
  if (pts.length === 0) return '';

  const segs = toSegs(pts);
  const r = BUMP_RADIUS;
  let d = `M ${pts[0].x},${pts[0].y}`;

  for (const seg of segs) {
    // Gather crossings that lie on this segment's interior, in travel order.
    const onSeg = crossings
      .filter((c) => {
        if (isHSeg(seg)) {
          const minX = Math.min(seg.x1, seg.x2), maxX = Math.max(seg.x1, seg.x2);
          return Math.abs(c.y - seg.y1) < 1 && c.x > minX + r && c.x < maxX - r;
        }
        if (isVSeg(seg)) {
          const minY = Math.min(seg.y1, seg.y2), maxY = Math.max(seg.y1, seg.y2);
          return Math.abs(c.x - seg.x1) < 1 && c.y > minY + r && c.y < maxY - r;
        }
        return false;
      })
      .sort(
        (a, b) =>
          Math.hypot(a.x - seg.x1, a.y - seg.y1) -
          Math.hypot(b.x - seg.x1, b.y - seg.y1),
      );

    if (onSeg.length === 0) {
      d += ` L ${seg.x2},${seg.y2}`;
    } else {
      for (const c of onSeg) {
        if (isHSeg(seg)) {
          // Bump goes upward (y-decreasing in SVG)
          if (seg.x2 >= seg.x1) {
            // travelling right → CCW arc (sweep 0) = up
            d += ` L ${c.x - r},${c.y} A ${r} ${r} 0 0 0 ${c.x + r},${c.y}`;
          } else {
            // travelling left → CW arc (sweep 1) = up
            d += ` L ${c.x + r},${c.y} A ${r} ${r} 0 0 1 ${c.x - r},${c.y}`;
          }
        } else if (isVSeg(seg)) {
          // Bump goes rightward (x-increasing in SVG)
          if (seg.y2 >= seg.y1) {
            // travelling down → CW arc (sweep 1) = right
            d += ` L ${c.x},${c.y - r} A ${r} ${r} 0 0 1 ${c.x},${c.y + r}`;
          } else {
            // travelling up → CCW arc (sweep 0) = right
            d += ` L ${c.x},${c.y + r} A ${r} ${r} 0 0 0 ${c.x},${c.y - r}`;
          }
        }
      }
      d += ` L ${seg.x2},${seg.y2}`;
    }
  }

  return d;
}

/**
 * For a list of 4-point orthogonal pipe routes (as `points` strings), detect
 * pairs whose middle segment is collinear and overlapping, then shift the
 * later route's mid-points sideways by `offset` pixels to prevent visual
 * overlap.  Port endpoints are left unchanged so pipes still connect correctly.
 *
 * Routes are processed in order; the first (highest-priority) route in each
 * overlapping group is never moved.
 */
export function offsetParallelPipes(
  routes: string[],
  offset: number = LANE_PITCH,
): string[] {
  const allPts = routes.map(parsePoints);
  const result: string[] = routes.slice();

  for (let i = 1; i < allPts.length; i++) {
    for (let j = 0; j < i; j++) {
      const ptsA = allPts[j];
      const ptsB = allPts[i];
      if (ptsA.length < 4 || ptsB.length < 4) continue;

      const midSegA: Seg = { x1: ptsA[1].x, y1: ptsA[1].y, x2: ptsA[2].x, y2: ptsA[2].y };
      const midSegB: Seg = { x1: ptsB[1].x, y1: ptsB[1].y, x2: ptsB[2].x, y2: ptsB[2].y };

      // Both middle segments vertical at the same X → overlap in Y?
      if (isVSeg(midSegA) && isVSeg(midSegB) && Math.abs(midSegA.x1 - midSegB.x1) < 3) {
        const minYA = Math.min(midSegA.y1, midSegA.y2), maxYA = Math.max(midSegA.y1, midSegA.y2);
        const minYB = Math.min(midSegB.y1, midSegB.y2), maxYB = Math.max(midSegB.y1, midSegB.y2);
        if (minYB < maxYA && maxYB > minYA) {
          const newPts = allPts[i].map((p, idx) =>
            idx === 1 || idx === 2 ? { ...p, x: p.x + offset } : p,
          );
          allPts[i] = newPts;
          result[i] = newPts.map((p) => `${p.x},${p.y}`).join(' ');
          break;
        }
      }

      // Both middle segments horizontal at the same Y → overlap in X?
      if (isHSeg(midSegA) && isHSeg(midSegB) && Math.abs(midSegA.y1 - midSegB.y1) < 3) {
        const minXA = Math.min(midSegA.x1, midSegA.x2), maxXA = Math.max(midSegA.x1, midSegA.x2);
        const minXB = Math.min(midSegB.x1, midSegB.x2), maxXB = Math.max(midSegB.x1, midSegB.x2);
        if (minXB < maxXA && maxXB > minXA) {
          const newPts = allPts[i].map((p, idx) =>
            idx === 1 || idx === 2 ? { ...p, y: p.y + offset } : p,
          );
          allPts[i] = newPts;
          result[i] = newPts.map((p) => `${p.x},${p.y}`).join(' ');
          break;
        }
      }
    }
  }

  return result;
}
