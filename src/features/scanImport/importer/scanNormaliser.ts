/**
 * scanNormaliser.ts
 *
 * Coordinate and unit normalisation for incoming scan bundles.
 *
 * The scan contract uses real-world metric coordinates (metres, origin at
 * scanner start).  Atlas canvas uses pixel-like units with a configurable
 * scale factor.
 *
 * Responsibilities:
 *   - Translate scan coordinate space → Atlas canvas units
 *   - Shift origin so the bounding box starts at (CANVAS_MARGIN, CANVAS_MARGIN)
 *   - Return a normalised copy of the bundle (no mutation)
 *
 * Coordinate convention (ScanBundleV1 / metric_m):
 *   - x, y are horizontal plane in metres
 *   - z is vertical elevation in metres
 *   - Atlas canvas only uses x, y (z is preserved in wall height fields)
 *
 * Scale factor:
 *   - SCAN_METRES_TO_CANVAS_PX: metres → canvas units
 *   - Default is 50 px/m so a 4 m wide room occupies 200 canvas units.
 *     This matches the expected density of the FloorPlanBuilder grid.
 */

import type { ScanBundleV1, ScanRoom, ScanWall, ScanPoint2D, ScanPoint3D } from '@atlas/contracts';

// ─── Scale / offset constants ─────────────────────────────────────────────────

/** Canvas units per metre (px equivalent per m). */
export const SCAN_METRES_TO_CANVAS_PX = 50;

/** Margin in canvas units applied around the imported floor plan. */
const CANVAS_MARGIN = 40;
const TARGET_CANVAS_WIDTH = 980;
const TARGET_CANVAS_HEIGHT = 540;

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface BoundingBox2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function getBoundingBox(rooms: ScanRoom[]): BoundingBox2D {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const room of rooms) {
    for (const pt of room.polygon) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
    for (const wall of room.walls) {
      const points = [wall.start, wall.end];
      for (const pt of points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
    }
  }

  // Fall back to zero-area box if no rooms
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

function normPoint2D(p: ScanPoint2D, offsetX: number, offsetY: number, scale: number): ScanPoint2D {
  return {
    x: (p.x - offsetX) * scale + CANVAS_MARGIN,
    y: (p.y - offsetY) * scale + CANVAS_MARGIN,
  };
}

function normPoint3D(p: ScanPoint3D, offsetX: number, offsetY: number, scale: number): ScanPoint3D {
  return {
    x: (p.x - offsetX) * scale + CANVAS_MARGIN,
    y: (p.y - offsetY) * scale + CANVAS_MARGIN,
    z: p.z,
  };
}

function normaliseWall(wall: ScanWall, offsetX: number, offsetY: number, scale: number): ScanWall {
  return {
    ...wall,
    start: normPoint3D(wall.start, offsetX, offsetY, scale),
    end: normPoint3D(wall.end, offsetX, offsetY, scale),
  };
}

function normaliseRoom(room: ScanRoom, offsetX: number, offsetY: number, scale: number): ScanRoom {
  return {
    ...room,
    polygon: room.polygon.map(p => normPoint2D(p, offsetX, offsetY, scale)),
    walls: room.walls.map(w => normaliseWall(w, offsetX, offsetY, scale)),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * normaliseScanCoordinates — translates a scan bundle from metric scan space
 * into Atlas canvas units.
 *
 * Returns a new ScanBundleV1 with all coordinates transformed.
 * The original bundle is not mutated.
 *
 * The coordinate transform is:
 *   canvas_x = (scan_x - origin_x) × SCALE + MARGIN
 *   canvas_y = (scan_y - origin_y) × SCALE + MARGIN
 *
 * where origin is the minimum bounding box corner across all room polygons.
 */
export function normaliseScanCoordinates(bundle: ScanBundleV1): ScanBundleV1 {
  const { minX, minY, maxX, maxY } = getBoundingBox(bundle.rooms);
  const width = Math.max(0.001, maxX - minX);
  const height = Math.max(0.001, maxY - minY);
  const fitScaleX = (TARGET_CANVAS_WIDTH - 2 * CANVAS_MARGIN) / width;
  const fitScaleY = (TARGET_CANVAS_HEIGHT - 2 * CANVAS_MARGIN) / height;
  const scale = Math.min(SCAN_METRES_TO_CANVAS_PX, fitScaleX, fitScaleY);

  return {
    ...bundle,
    rooms: bundle.rooms.map(r => normaliseRoom(r, minX, minY, scale)),
  };
}
