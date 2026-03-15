import type { PartKind } from '../../explainers/lego/builder/types';
import type { ConnectionPath, PlacementNode, PropertyPlan, Room } from './propertyPlan.types';
import { BOILER_VALID_ROOM_TYPES, CYLINDER_VALID_ROOM_TYPES } from './propertyPlan.types';

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
  emitterSizing: Array<{ roomId: string; roomName: string; suggestedRadiatorKw: number }>;
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

  const emitterSizing = roomHeatLossKw.map((item) => ({
    roomId: item.roomId,
    roomName: item.roomName,
    suggestedRadiatorKw: Number((item.heatLossKw * 1.15).toFixed(2)),
  }));

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
