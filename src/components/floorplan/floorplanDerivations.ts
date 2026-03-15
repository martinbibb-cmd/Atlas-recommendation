import type { PartKind } from '../../explainers/lego/builder/types';
import type { ConnectionPath, PlacementNode, PropertyPlan, Room } from './propertyPlan.types';

const GRID = 24;

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

export interface DerivedFloorplanOutput {
  roomHeatLossKw: Array<{ roomId: string; roomName: string; heatLossKw: number }>;
  emitterSizing: Array<{ roomId: string; roomName: string; suggestedRadiatorKw: number }>;
  routeLengthsM: Array<{ connectionId: string; lengthM: number }>;
  totalPipeLengthM: number;
  feasibilityChecks: { hasOutdoorHeatPump: boolean; hasHeatSource: boolean; hasEmitters: boolean };
}

export function deriveFloorplanOutputs(plan: PropertyPlan, defaultRoomHeightM: number): DerivedFloorplanOutput {
  const rooms = plan.floors.flatMap((f) => f.rooms);

  const roomHeatLossKw = rooms.map((room) => {
    const area = room.areaM2 ?? (room.width / GRID) * (room.height / GRID);
    const roomHeight = room.heightM ?? defaultRoomHeightM;
    const volumeM3 = room.volumeM3 ?? area * roomHeight;
    const heatLossKw = volumeM3 * 0.04;
    return { roomId: room.id, roomName: room.name, heatLossKw: Number(heatLossKw.toFixed(2)) };
  });

  const emitterSizing = roomHeatLossKw.map((item) => ({
    roomId: item.roomId,
    roomName: item.roomName,
    suggestedRadiatorKw: Number((item.heatLossKw * 1.15).toFixed(2)),
  }));

  const routeLengthsM = plan.connections.map((conn) => ({
    connectionId: conn.id,
    lengthM: Number(routeLengthM(conn.route).toFixed(2)),
  }));

  const routeTotal = routeLengthsM.reduce((sum, r) => sum + r.lengthM, 0);
  const totalPipeLengthM = Number((routeTotal * 2 * 1.1).toFixed(2));

  const hasOutdoorHeatPump = plan.placementNodes.some((n: PlacementNode) => {
    if (n.type !== 'heat_source_heat_pump' || !n.roomId) return false;
    return rooms.some((r) => r.id === n.roomId && r.roomType === 'outside');
  });

  const hasHeatSource = plan.placementNodes.some((n) => n.type.startsWith('heat_source_'));
  const hasEmitters = plan.placementNodes.some((n) => n.type === 'radiator_loop' || n.type === 'ufh_loop');

  return {
    roomHeatLossKw,
    emitterSizing,
    routeLengthsM,
    totalPipeLengthM,
    feasibilityChecks: { hasOutdoorHeatPump, hasHeatSource, hasEmitters },
  };
}
