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
