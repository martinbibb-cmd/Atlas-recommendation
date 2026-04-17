import type { PartKind } from '../../explainers/lego/builder/types';
import type {
  ConnectionPath,
  DisruptionAnnotation,
  DisruptionKind,
  Opening,
  PlacementNode,
  Point,
  PropertyPlan,
  Room,
  ServiceType,
  Wall,
} from './propertyPlan.types';
import { BOILER_VALID_ROOM_TYPES, CYLINDER_VALID_ROOM_TYPES } from './propertyPlan.types';
import { routePipeAligned } from '../../explainers/lego/builder/router';

const GRID = 24;

// ─── Physics constants for fabric heat-loss estimation ────────────────────────
// Assumes a typical pre-2000 UK dwelling with cavity-uninsulated walls.
// Matches the custom-instruction rule: cavity_uninsulated → high heat-loss band.
const U_EXT_WALL_W_M2K = 1.6;  // cavity-uninsulated external wall (W/m²K)
const U_CEILING_W_M2K  = 0.35; // ceiling to loft / upper floor (W/m²K)
const U_FLOOR_W_M2K    = 0.45; // ground / intermediate floor (W/m²K)
const DESIGN_DELTA_T_K = 21;   // design ΔT: 21 °C inside vs 0 °C outside

export interface ManualRoomInput {
  name: string;
  widthM: number;
  lengthM: number;
  floorId: string;
  roomType?: Room['roomType'];
  defaultHeightM: number;
  x?: number;
  y?: number;
}

export function createManualRoom(input: ManualRoomInput, id: string): Room {
  return {
    id,
    floorId: input.floorId,
    name: input.name.trim() || 'New Room',
    roomType: input.roomType ?? 'other',
    x: input.x ?? GRID,
    y: input.y ?? GRID,
    width: Math.max(GRID * 2, Math.round(input.widthM * GRID)),
    height: Math.max(GRID * 2, Math.round(input.lengthM * GRID)),
    areaM2: Number((input.widthM * input.lengthM).toFixed(2)),
    volumeM3: Number((input.widthM * input.lengthM * input.defaultHeightM).toFixed(2)),
  };
}

const PRIMARY_COMPONENTS: PartKind[] = [
  'heat_source_combi',
  'heat_source_system_boiler',
  'heat_source_regular_boiler',
  'heat_source_heat_pump',
  'dhw_unvented_cylinder',
  'dhw_mixergy',
  'dhw_vented_cylinder',
  'radiator_loop',
  'buffer',
  'low_loss_header',
  'pump',
  'zone_valve',
];

export function canPlaceInProfessionalPlan(kind: PartKind): boolean {
  return PRIMARY_COMPONENTS.includes(kind);
}

// ─── Heating pipe auto-routing ────────────────────────────────────────────────

const HEAT_SOURCE_KINDS: PartKind[] = [
  'heat_source_combi',
  'heat_source_system_boiler',
  'heat_source_regular_boiler',
  'heat_source_heat_pump',
];

const EMITTER_KINDS: PartKind[] = ['radiator_loop', 'ufh_loop'];

/** A single auto-routed pipe segment between two placement nodes. */
export interface AutoRoute {
  id: string;
  type: 'flow' | 'return';
  fromNodeId: string;
  toNodeId: string;
  /** Ordered canvas-coordinate waypoints. */
  route: Point[];
  /** Semantic service type for engineer-view labels. */
  serviceType: ServiceType;
  /** Suggested nominal pipe bore in mm based on connected emitter heat load. */
  pipeSizeMm: 15 | 22 | 28 | 35;
}

/** Parse the "x1,y1 x2,y2 …" string from routePipeAligned into Point[]. */
function parseRoutePoints(pointsStr: string): Point[] {
  return pointsStr.trim().split(/\s+/).map((pt) => {
    const [x, y] = pt.split(',').map(Number);
    return { x, y };
  });
}

/**
 * Compute the pipe offset (in pixels) used to visually separate the flow and
 * return pipes.  Scales with the grid so that small rooms or thick walls don't
 * cause the pipes to overlap: 10% of a grid cell, with a minimum of 4 px.
 *
 * @param gridPx  Grid cell size in pixels (defaults to the module-level GRID constant).
 */
export function computePipeOffset(gridPx: number = GRID): number {
  return Math.max(4, gridPx * 0.1);
}

/**
 * Suggest a nominal pipe bore (mm) for a heating circuit based on the
 * connected emitter heat load at design conditions.
 *
 * Rules (UK standard practice, 20 °C ΔT in the circuit):
 *   ≤ 3 kW   → 15 mm microbore / standard small rad
 *   ≤ 8 kW   → 22 mm — most residential circuits
 *   ≤ 20 kW  → 28 mm — larger system / multiple rads on one sub-circuit
 *   > 20 kW  → 35 mm — high-load / commercial sizing
 */
export function computePipeSizeMm(heatLossKw: number): 15 | 22 | 28 | 35 {
  if (heatLossKw <= 3)  return 15;
  if (heatLossKw <= 8)  return 22;
  if (heatLossKw <= 20) return 28;
  return 35;
}

/**
 * Auto-route flow and return heating pipes between the heat source and every
 * emitter on the same floor.  Returns an AutoRoute[] ready to render.
 *
 * Flow pipes run from heat source → emitter (offset +pipeOffset px right).
 * Return pipes run from emitter → heat source (offset -pipeOffset px left).
 * Both are snapped to room-wall edges via routePipeAligned().
 *
 * @param nodes      Placement nodes on the floor plan.
 * @param rooms      Room definitions used for wall-snap routing.
 * @param pipeOffset Optional pixel offset between flow and return pipes.
 *                   Defaults to computePipeOffset(GRID).
 */
export function autoRouteHeatingPipes(
  nodes: PlacementNode[],
  rooms: Room[],
  pipeOffset?: number,
): AutoRoute[] {
  const heatSource = nodes.find((n) => HEAT_SOURCE_KINDS.includes(n.type));
  if (!heatSource) return [];

  const emitters = nodes.filter((n) => EMITTER_KINDS.includes(n.type));
  if (emitters.length === 0) return [];

  const routerRooms = rooms.map((r) => ({
    x: r.x, y: r.y, w: r.width, h: r.height, label: r.name,
  }));

  const PIPE_OFFSET = pipeOffset ?? computePipeOffset(GRID); // px — separates flow/return visually
  const routes: AutoRoute[] = [];

  for (const emitter of emitters) {
    // Use the emitter's rated output (if known) to suggest pipe bore.
    // 2 kW is the minimum practical single-radiator output and safely selects
    // 22 mm microbore — the most common UK residential pipe size.
    const emitterKw = typeof emitter.emitterOutputKw === 'number' ? emitter.emitterOutputKw : 2;
    const pipeSizeMm = computePipeSizeMm(emitterKw);

    // Flow: heat source → emitter
    const flowFrom = { x: heatSource.anchor.x + PIPE_OFFSET, y: heatSource.anchor.y };
    const flowTo   = { x: emitter.anchor.x + PIPE_OFFSET,    y: emitter.anchor.y };
    routes.push({
      id: `auto_flow_${heatSource.id}_${emitter.id}`,
      type: 'flow',
      serviceType: 'primary_flow',
      pipeSizeMm,
      fromNodeId: heatSource.id,
      toNodeId: emitter.id,
      route: parseRoutePoints(routePipeAligned(flowFrom, flowTo, routerRooms)),
    });

    // Return: emitter → heat source
    const retFrom = { x: emitter.anchor.x - PIPE_OFFSET,    y: emitter.anchor.y };
    const retTo   = { x: heatSource.anchor.x - PIPE_OFFSET, y: heatSource.anchor.y };
    routes.push({
      id: `auto_return_${emitter.id}_${heatSource.id}`,
      type: 'return',
      serviceType: 'primary_return',
      pipeSizeMm,
      fromNodeId: emitter.id,
      toNodeId: heatSource.id,
      route: parseRoutePoints(routePipeAligned(retFrom, retTo, routerRooms)),
    });
  }

  return routes;
}

function routeLengthM(route: ConnectionPath['route']) {
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const dx = route[i].x - route[i - 1].x;
    const dy = route[i].y - route[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy) / GRID;
  }
  return total;
}

/**
 * For a given room, compute the length of perimeter (in metres) that is
 * exposed to the outside — i.e. sides NOT fully covered by an adjacent
 * heated room.  'outside'-typed rooms are treated as external and therefore
 * do not reduce the exposed perimeter.
 *
 * The algorithm handles partial coverage: if two smaller rooms each cover
 * half of one side, the entire side is counted as internal.
 */
export function computeExposedPerimeterM(room: Room, floorRooms: Room[]): number {
  // Only heated neighbours reduce the exposed perimeter.
  const heated = floorRooms.filter((r) => r.id !== room.id && r.roomType !== 'outside');

  /**
   * Return the total length (in canvas px) of the segment [perpStart, perpEnd]
   * that is covered by neighbouring rooms aligned on `edge`.
   * getNeighbourEdge   → the matching edge coordinate on each neighbour
   * getNeighbourStart/End → the perpendicular extent of the neighbour
   */
  function coveredLength(
    edge: number,
    perpStart: number,
    perpEnd: number,
    getNeighbourEdge: (r: Room) => number,
    getNeighbourStart: (r: Room) => number,
    getNeighbourEnd: (r: Room) => number,
  ): number {
    const intervals: Array<[number, number]> = [];
    for (const r of heated) {
      if (getNeighbourEdge(r) !== edge) continue;
      const s = Math.max(perpStart, getNeighbourStart(r));
      const e = Math.min(perpEnd,   getNeighbourEnd(r));
      if (e > s) intervals.push([s, e]);
    }
    if (intervals.length === 0) return 0;
    intervals.sort((a, b) => a[0] - b[0]);
    let covered = 0;
    let [cur0, cur1] = intervals[0];
    for (let i = 1; i < intervals.length; i++) {
      const [s, e] = intervals[i];
      if (s <= cur1) { cur1 = Math.max(cur1, e); }
      else { covered += cur1 - cur0; [cur0, cur1] = [s, e]; }
    }
    covered += cur1 - cur0;
    return covered;
  }

  const topCovered = coveredLength(
    room.y, room.x, room.x + room.width,
    (r) => r.y + r.height, (r) => r.x, (r) => r.x + r.width,
  );
  const bottomCovered = coveredLength(
    room.y + room.height, room.x, room.x + room.width,
    (r) => r.y, (r) => r.x, (r) => r.x + r.width,
  );
  const leftCovered = coveredLength(
    room.x, room.y, room.y + room.height,
    (r) => r.x + r.width, (r) => r.y, (r) => r.y + r.height,
  );
  const rightCovered = coveredLength(
    room.x + room.width, room.y, room.y + room.height,
    (r) => r.x, (r) => r.y, (r) => r.y + r.height,
  );

  const exposedPx =
    (room.width  - topCovered) +
    (room.width  - bottomCovered) +
    (room.height - leftCovered) +
    (room.height - rightCovered);

  return Number((exposedPx / GRID).toFixed(2));
}

// ─── Output interfaces ────────────────────────────────────────────────────────

/** Per-room geometry metrics derived from the canvas. */
export interface RoomMetrics {
  roomId: string;
  roomName: string;
  widthM: number;
  lengthM: number;
  areaM2: number;
  exposedPerimeterM: number;
}

export type SitingStatus = 'ok' | 'warn' | 'missing';

/** Placement/siting check for a key heating object. */
export interface SitingFlag {
  objectType: 'boiler' | 'cylinder' | 'heat_pump';
  nodeId: string;
  status: SitingStatus;
  message: string;
}

export interface DerivedFloorplanOutput {
  /** Geometry metrics for every heated room on all floors. */
  roomMetrics: RoomMetrics[];
  roomHeatLossKw: Array<{ roomId: string; roomName: string; heatLossKw: number }>;
  emitterSizing: Array<{
    roomId: string;
    roomName: string;
    suggestedRadiatorKw: number;
    /**
     * Sum of emitterOutputKw for all emitter nodes placed in this room.
     * null when no emitter nodes with a rated output are present in the room.
     */
    roomEmitterOutputKw: number | null;
  }>;
  routeLengthsM: Array<{ connectionId: string; lengthM: number }>;
  totalPipeLengthM: number;
  feasibilityChecks: { hasOutdoorHeatPump: boolean; hasHeatSource: boolean; hasEmitters: boolean };
  /** Siting/placement flags for boiler, cylinder, and heat-pump nodes. */
  sitingFlags: SitingFlag[];
}

export function deriveFloorplanOutputs(plan: PropertyPlan, defaultRoomHeightM: number): DerivedFloorplanOutput {
  const allRooms = plan.floors.flatMap((f) => f.rooms);
  // Heat-loss and emitter sizing only apply to heated (non-outside) rooms.
  const heatedRooms = allRooms.filter((r) => r.roomType !== 'outside');

  // ── Room metrics (geometry) ──────────────────────────────────────────────
  const roomMetrics: RoomMetrics[] = heatedRooms.map((room) => {
    const widthM  = Number((room.width  / GRID).toFixed(2));
    const lengthM = Number((room.height / GRID).toFixed(2));
    const areaM2  = room.areaM2 ?? Number((widthM * lengthM).toFixed(2));
    // Find sibling rooms on the same floor for adjacency checks.
    const floorRooms = plan.floors.find((f) => f.id === room.floorId)?.rooms ?? allRooms;
    const exposedPerimeterM = computeExposedPerimeterM(room, floorRooms);
    return { roomId: room.id, roomName: room.name, widthM, lengthM, areaM2, exposedPerimeterM };
  });

  // ── Physics-based heat-loss ───────────────────────────────────────────────
  // heatLoss (kW) = (U_wall × exposedWallArea + U_ceiling × area + U_floor × area) × ΔT / 1000
  const roomHeatLossKw = heatedRooms.map((room) => {
    const metrics    = roomMetrics.find((m) => m.roomId === room.id)!;
    const roomHeight = room.heightM ?? defaultRoomHeightM;
    const areaM2     = metrics.areaM2;
    const extWallAreaM2 = metrics.exposedPerimeterM * roomHeight;
    const heatLossW  =
      U_EXT_WALL_W_M2K * extWallAreaM2 * DESIGN_DELTA_T_K +
      U_CEILING_W_M2K  * areaM2        * DESIGN_DELTA_T_K +
      U_FLOOR_W_M2K    * areaM2        * DESIGN_DELTA_T_K;
    return { roomId: room.id, roomName: room.name, heatLossKw: Number((heatLossW / 1000).toFixed(2)) };
  });

  const emitterSizing = roomHeatLossKw.map((item) => {
    const emitterNodes = plan.placementNodes.filter(
      (n) =>
        n.roomId === item.roomId &&
        (n.type === 'radiator_loop' || n.type === 'ufh_loop') &&
        typeof n.emitterOutputKw === 'number',
    );
    const roomEmitterOutputKw =
      emitterNodes.length > 0
        ? Number(
            emitterNodes
              .reduce((sum, n) => sum + (n.emitterOutputKw as number), 0)
              .toFixed(2),
          )
        : null;
    return {
      roomId: item.roomId,
      roomName: item.roomName,
      suggestedRadiatorKw: Number((item.heatLossKw * 1.15).toFixed(2)),
      roomEmitterOutputKw,
    };
  });

  // ── Route lengths ────────────────────────────────────────────────────────
  const routeLengthsM = plan.connections.map((conn) => ({
    connectionId: conn.id,
    lengthM: Number(routeLengthM(conn.route).toFixed(2)),
  }));

  const routeTotal = routeLengthsM.reduce((sum, r) => sum + r.lengthM, 0);
  const totalPipeLengthM = Number((routeTotal * 2 * 1.1).toFixed(2));

  // ── Feasibility checks ───────────────────────────────────────────────────
  const hasOutdoorHeatPump = plan.placementNodes.some((n: PlacementNode) => {
    if (n.type !== 'heat_source_heat_pump' || !n.roomId) return false;
    return allRooms.some((r) => r.id === n.roomId && r.roomType === 'outside');
  });

  const hasHeatSource = plan.placementNodes.some((n) => n.type.startsWith('heat_source_'));
  const hasEmitters = plan.placementNodes.some((n) => n.type === 'radiator_loop' || n.type === 'ufh_loop');

  // ── Siting flags ─────────────────────────────────────────────────────────
  const sitingFlags: SitingFlag[] = [];

  for (const node of plan.placementNodes) {
    const room = node.roomId ? allRooms.find((r) => r.id === node.roomId) : undefined;

    if (
      node.type === 'heat_source_combi' ||
      node.type === 'heat_source_system_boiler' ||
      node.type === 'heat_source_regular_boiler'
    ) {
      if (!room) {
        sitingFlags.push({ objectType: 'boiler', nodeId: node.id, status: 'warn', message: 'Boiler must be assigned to a room' });
      } else if (!BOILER_VALID_ROOM_TYPES.includes(room.roomType)) {
        sitingFlags.push({ objectType: 'boiler', nodeId: node.id, status: 'warn', message: `Boiler in "${room.name}" — preferred rooms: kitchen, utility, garage, cupboard` });
      } else {
        sitingFlags.push({ objectType: 'boiler', nodeId: node.id, status: 'ok', message: `Boiler in "${room.name}" — suitable room type` });
      }
    }

    if (
      node.type === 'dhw_unvented_cylinder' ||
      node.type === 'dhw_mixergy' ||
      node.type === 'dhw_vented_cylinder'
    ) {
      if (!room) {
        sitingFlags.push({ objectType: 'cylinder', nodeId: node.id, status: 'warn', message: 'Cylinder must be assigned to a room' });
      } else if (!CYLINDER_VALID_ROOM_TYPES.includes(room.roomType)) {
        sitingFlags.push({ objectType: 'cylinder', nodeId: node.id, status: 'warn', message: `Cylinder in "${room.name}" — preferred rooms: cupboard, utility, airing cupboard, garage` });
      } else {
        sitingFlags.push({ objectType: 'cylinder', nodeId: node.id, status: 'ok', message: `Cylinder in "${room.name}" — suitable room type` });
      }
    }

    if (node.type === 'heat_source_heat_pump') {
      if (!room) {
        sitingFlags.push({ objectType: 'heat_pump', nodeId: node.id, status: 'warn', message: 'Heat pump must be assigned to a room' });
      } else if (room.roomType !== 'outside') {
        sitingFlags.push({ objectType: 'heat_pump', nodeId: node.id, status: 'warn', message: `Heat pump in "${room.name}" — must be placed in an outdoor area` });
      } else {
        sitingFlags.push({ objectType: 'heat_pump', nodeId: node.id, status: 'ok', message: 'Heat pump placed outdoors — correct' });
      }
    }
  }

  return {
    roomMetrics,
    roomHeatLossKw,
    emitterSizing,
    routeLengthsM,
    totalPipeLengthM,
    feasibilityChecks: { hasOutdoorHeatPump, hasHeatSource, hasEmitters },
    sitingFlags,
  };
}

// ─── Disruption annotation auto-computation ───────────────────────────────────

let _disruptionSeq = 0;
function disruptionId() {
  return `dis_${(++_disruptionSeq).toString(16)}`;
}

/**
 * Derive a suggested set of disruption / consequence annotations from the
 * current property plan.  These are heuristic flags — the installer should
 * review and amend them before sharing with the customer.
 *
 * Rules applied:
 *   • Any auto-routed pipe that crosses a room boundary likely requires a
 *     floor lift (if the room has a timber floor type) or boxing.
 *   • A heat pump outdoor unit always implies an external run back to the
 *     plant room.
 *   • A cylinder that is on a different floor from the boiler implies a
 *     pipe run through a wall or floor — flagged as a core drill.
 *
 * Returns a DisruptionAnnotation[] positioned near the relevant features.
 */
export function computeDisruptionAnnotations(plan: PropertyPlan): DisruptionAnnotation[] {
  const annotations: DisruptionAnnotation[] = [];
  const allRooms = plan.floors.flatMap((f) => f.rooms);

  const heatSourceNodes = plan.placementNodes.filter((n) =>
    n.type === 'heat_source_combi' ||
    n.type === 'heat_source_system_boiler' ||
    n.type === 'heat_source_regular_boiler',
  );

  const cylinderNodes = plan.placementNodes.filter(
    (n) =>
      n.type === 'dhw_unvented_cylinder' ||
      n.type === 'dhw_mixergy' ||
      n.type === 'dhw_vented_cylinder',
  );

  const heatPumpNodes = plan.placementNodes.filter(
    (n) => n.type === 'heat_source_heat_pump',
  );

  // Cylinder on a different floor from the boiler → likely core drill or
  // vertical pipe run through the ceiling/floor void.
  for (const hs of heatSourceNodes) {
    for (const cyl of cylinderNodes) {
      if (hs.floorId !== cyl.floorId) {
        annotations.push({
          id: disruptionId(),
          kind: 'coreDrill' as DisruptionKind,
          floorId: hs.floorId,
          x: hs.anchor.x,
          y: hs.anchor.y,
          note: 'Vertical pipe run between floors — core drill likely required',
        });
      }
    }
  }

  // Heat pump outdoor unit → external run back into the building.
  for (const hp of heatPumpNodes) {
    const room = hp.roomId ? allRooms.find((r) => r.id === hp.roomId) : undefined;
    if (room?.roomType === 'outside') {
      annotations.push({
        id: disruptionId(),
        kind: 'externalRun' as DisruptionKind,
        floorId: hp.floorId,
        x: hp.anchor.x,
        y: hp.anchor.y,
        note: 'External pipe run from outdoor unit through building envelope',
      });
    }
  }

  // Any manual connection route that spans more than two rooms is likely to
  // require boxing or a floor chase.
  for (const conn of plan.connections) {
    if (conn.route.length < 2) continue;
    // Count distinct rooms the route passes through using midpoints of segments.
    const roomsTraversed = new Set<string>();
    for (let i = 0; i + 1 < conn.route.length; i++) {
      const mx = (conn.route[i].x + conn.route[i + 1].x) / 2;
      const my = (conn.route[i].y + conn.route[i + 1].y) / 2;
      for (const room of allRooms) {
        if (mx >= room.x && mx <= room.x + room.width && my >= room.y && my <= room.y + room.height) {
          roomsTraversed.add(room.id);
        }
      }
    }
    if (roomsTraversed.size >= 2) {
      // Midpoint of the route as the annotation anchor.
      const mid = conn.route[Math.floor(conn.route.length / 2)];
      const fromNode = plan.placementNodes.find((n) => n.id === conn.fromNodeId);
      annotations.push({
        id: disruptionId(),
        kind: 'boxing' as DisruptionKind,
        floorId: fromNode?.floorId ?? plan.floors[0]?.id ?? '',
        x: mid.x,
        y: mid.y,
        note: `Pipe route crosses ${roomsTraversed.size} rooms — boxing or floor chase likely`,
      });
    }
  }

  return annotations;
}

// ─── Opening geometry helpers ─────────────────────────────────────────────────

/**
 * Resolved geometry for a single floor-plan opening (door or window).
 * All coordinates are in canvas pixels.
 */
export interface OpeningGeometry {
  /** Canvas position of the opening start (near end). */
  startX: number;
  startY: number;
  /** Canvas position of the opening end (far end). */
  endX: number;
  endY: number;
  /** Unit vector along the wall direction (start → end). */
  ux: number;
  uy: number;
  /** Unit vector perpendicular to the wall (90° anti-clockwise of wall direction). */
  perpX: number;
  perpY: number;
  /** Opening width in canvas pixels. */
  widthPx: number;
}

/**
 * Calculate the canvas-space geometry for a floor-plan opening.
 *
 * @param opening  - The opening to resolve.
 * @param walls    - All walls on the same floor.
 * @returns Resolved geometry, or null when the referenced wall is not found / has zero length.
 */
export function getOpeningGeometry(
  opening: Opening,
  walls: Wall[],
): OpeningGeometry | null {
  const wall = walls.find((w) => w.id === opening.wallId);
  if (!wall) return null;
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;

  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular: 90° anti-clockwise rotation of the unit vector.
  const perpX = -uy;
  const perpY = ux;

  const startX = wall.x1 + opening.offsetM * GRID * ux;
  const startY = wall.y1 + opening.offsetM * GRID * uy;
  const widthPx = opening.widthM * GRID;
  const endX = startX + widthPx * ux;
  const endY = startY + widthPx * uy;

  return { startX, startY, endX, endY, ux, uy, perpX, perpY, widthPx };
}

/**
 * Split a wall into line segments with gaps punched out wherever openings sit.
 *
 * Segments are returned in wall-direction order (closest to (x1,y1) first).
 * Openings that extend beyond the wall ends are clamped to the wall length.
 * Overlapping openings are merged before splitting.
 *
 * @param wall     - The wall to segment.
 * @param openings - All openings for this floor (only those with matching wallId are used).
 * @returns Array of {x1,y1,x2,y2} segment endpoints in canvas pixels.
 */
export function wallSegmentsWithGaps(
  wall: Wall,
  openings: Opening[],
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 1) return [];

  const ux = dx / len;
  const uy = dy / len;

  // Collect gaps for openings on this wall.
  const wallOpenings = openings.filter((o) => o.wallId === wall.id);
  const rawGaps = wallOpenings.map((o) => ({
    start: Math.max(0, o.offsetM * GRID),
    end: Math.min(len, o.offsetM * GRID + o.widthM * GRID),
  })).filter((g) => g.end > g.start);

  if (rawGaps.length === 0) {
    return [{ x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 }];
  }

  // Sort and merge overlapping gaps.
  rawGaps.sort((a, b) => a.start - b.start);
  const gaps: Array<{ start: number; end: number }> = [];
  let cur = rawGaps[0];
  for (let i = 1; i < rawGaps.length; i++) {
    const next = rawGaps[i];
    if (next.start <= cur.end) {
      cur = { start: cur.start, end: Math.max(cur.end, next.end) };
    } else {
      gaps.push(cur);
      cur = next;
    }
  }
  gaps.push(cur);

  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  let cursor = 0;

  for (const gap of gaps) {
    if (cursor < gap.start) {
      segments.push({
        x1: wall.x1 + cursor * ux,
        y1: wall.y1 + cursor * uy,
        x2: wall.x1 + gap.start * ux,
        y2: wall.y1 + gap.start * uy,
      });
    }
    cursor = gap.end;
  }

  if (cursor < len) {
    segments.push({
      x1: wall.x1 + cursor * ux,
      y1: wall.y1 + cursor * uy,
      x2: wall.x2,
      y2: wall.y2,
    });
  }

  return segments;
}

/** Default pixel threshold used by findWallHit. */
export const WALL_HIT_THRESHOLD_PX = 15;

/**
 * Find the wall closest to a canvas-space pointer position and compute the
 * click offset along that wall in metres.
 *
 * The algorithm projects the click point onto each wall line segment and
 * selects the nearest projection within `threshold` pixels.
 *
 * @param pos       - Canvas-space pointer position.
 * @param walls     - Candidate walls on the active floor.
 * @param threshold - Maximum distance (px) from the wall for a hit (default 15 px).
 * @returns { wall, offsetM } or null when no wall is close enough.
 */
export function findWallHit(
  pos: Point,
  walls: Wall[],
  threshold: number = WALL_HIT_THRESHOLD_PX,
): { wall: Wall; offsetM: number } | null {
  let best: { wall: Wall; offsetM: number; dist: number } | null = null;

  for (const wall of walls) {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) continue;
    const len = Math.sqrt(lenSq);

    // Parametric t of the closest point on the segment [0, 1].
    const t = Math.max(
      0,
      Math.min(1, ((pos.x - wall.x1) * dx + (pos.y - wall.y1) * dy) / lenSq),
    );
    const projX = wall.x1 + t * dx;
    const projY = wall.y1 + t * dy;
    const dist = Math.hypot(pos.x - projX, pos.y - projY);

    if (dist <= threshold && (!best || dist < best.dist)) {
      best = {
        wall,
        offsetM: Number(((t * len) / GRID).toFixed(2)),
        dist,
      };
    }
  }

  return best ? { wall: best.wall, offsetM: best.offsetM } : null;
}
