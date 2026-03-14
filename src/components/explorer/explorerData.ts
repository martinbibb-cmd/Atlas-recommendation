/**
 * explorerData.ts
 *
 * Representative sample property data for the Atlas System Explorer demo.
 * A typical 3-bed semi-detached (UK, 1970s construction) with gas combi boiler.
 */

import type { Room, Emitter, Pipe, BoilerData, BehaviourEvent, PhysicsRoomData } from './explorerTypes';

// ── Rooms ─────────────────────────────────────────────────────────────────────
// SVG coords within a 480 × 340 viewBox.
// Ground floor y:190–330, First floor y:40–180.

export const DEMO_ROOMS: Room[] = [
  {
    id: 'living',
    label: 'Living Room',
    designTemp: 21,
    emitterId: 'rad-living',
    heatLossKw: 1.6,
    warmUpMinutes: 22,
    svg: { x: 20, y: 195, w: 200, h: 130 },
    floor: 0,
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    designTemp: 19,
    emitterId: 'rad-kitchen',
    heatLossKw: 0.9,
    warmUpMinutes: 12,
    svg: { x: 228, y: 195, w: 155, h: 130 },
    floor: 0,
  },
  {
    id: 'hallway',
    label: 'Hallway',
    designTemp: 18,
    emitterId: 'rad-hallway',
    heatLossKw: 0.5,
    warmUpMinutes: 8,
    svg: { x: 391, y: 195, w: 69, h: 130 },
    floor: 0,
  },
  {
    id: 'bedroom1',
    label: 'Bedroom 1',
    designTemp: 18,
    emitterId: 'rad-bed1',
    heatLossKw: 1.1,
    warmUpMinutes: 15,
    svg: { x: 20, y: 45, w: 185, h: 130 },
    floor: 1,
  },
  {
    id: 'bathroom',
    label: 'Bathroom',
    designTemp: 22,
    emitterId: 'rad-bath',
    heatLossKw: 0.87,
    warmUpMinutes: 10,
    svg: { x: 213, y: 45, w: 130, h: 130 },
    floor: 1,
  },
  {
    id: 'bedroom2',
    label: 'Bedroom 2',
    designTemp: 18,
    emitterId: 'rad-bed2',
    heatLossKw: 0.95,
    warmUpMinutes: 14,
    svg: { x: 351, y: 45, w: 109, h: 130 },
    floor: 1,
  },
];

// ── Emitters ──────────────────────────────────────────────────────────────────

export const DEMO_EMITTERS: Emitter[] = [
  { id: 'rad-living',  label: 'Double Panel Radiator', type: 'radiator', outputKw: 2.1,  pipeIds: ['pipe-living-flow', 'pipe-living-return'] },
  { id: 'rad-kitchen', label: 'Single Panel Radiator', type: 'radiator', outputKw: 1.2,  pipeIds: ['pipe-kitchen-flow', 'pipe-kitchen-return'] },
  { id: 'rad-hallway', label: 'Slimline Radiator',     type: 'radiator', outputKw: 0.7,  pipeIds: ['pipe-hallway-flow', 'pipe-hallway-return'] },
  { id: 'rad-bed1',    label: 'Double Panel Radiator', type: 'radiator', outputKw: 1.4,  pipeIds: ['pipe-bed1-flow', 'pipe-bed1-return'] },
  { id: 'rad-bath',    label: 'Towel Rail + Panel',    type: 'radiator', outputKw: 1.2,  pipeIds: ['pipe-bath-flow', 'pipe-bath-return'] },
  { id: 'rad-bed2',    label: 'Double Panel Radiator', type: 'radiator', outputKw: 1.25, pipeIds: ['pipe-bed2-flow', 'pipe-bed2-return'] },
];

// ── Pipes ─────────────────────────────────────────────────────────────────────

export const DEMO_PIPES: Pipe[] = [
  { id: 'pipe-living-flow',   label: 'Living flow',   from: 'boiler',      to: 'rad-living',  diameterMm: 22, flowLpm: 4.2 },
  { id: 'pipe-living-return', label: 'Living return', from: 'rad-living',  to: 'boiler',       diameterMm: 22, flowLpm: 4.2 },
  { id: 'pipe-kitchen-flow',  label: 'Kitchen flow',  from: 'boiler',      to: 'rad-kitchen', diameterMm: 15, flowLpm: 2.8 },
  { id: 'pipe-kitchen-return',label: 'Kitchen return',from: 'rad-kitchen', to: 'boiler',       diameterMm: 15, flowLpm: 2.8 },
  { id: 'pipe-hallway-flow',  label: 'Hallway flow',  from: 'boiler',      to: 'rad-hallway', diameterMm: 15, flowLpm: 1.8 },
  { id: 'pipe-hallway-return',label: 'Hallway return',from: 'rad-hallway', to: 'boiler',       diameterMm: 15, flowLpm: 1.8 },
  { id: 'pipe-bed1-flow',     label: 'Bed 1 flow',    from: 'boiler',      to: 'rad-bed1',    diameterMm: 15, flowLpm: 3.1 },
  { id: 'pipe-bed1-return',   label: 'Bed 1 return',  from: 'rad-bed1',    to: 'boiler',       diameterMm: 15, flowLpm: 3.1 },
  { id: 'pipe-bath-flow',     label: 'Bath flow',     from: 'boiler',      to: 'rad-bath',    diameterMm: 15, flowLpm: 2.6 },
  { id: 'pipe-bath-return',   label: 'Bath return',   from: 'rad-bath',    to: 'boiler',       diameterMm: 15, flowLpm: 2.6 },
  { id: 'pipe-bed2-flow',     label: 'Bed 2 flow',    from: 'boiler',      to: 'rad-bed2',    diameterMm: 15, flowLpm: 2.9 },
  { id: 'pipe-bed2-return',   label: 'Bed 2 return',  from: 'rad-bed2',    to: 'boiler',       diameterMm: 15, flowLpm: 2.9 },
];

// ── Boiler ────────────────────────────────────────────────────────────────────

export const DEMO_BOILER: BoilerData = {
  outputKw: 24,
  currentLoadKw: 14,
  returnTempC: 63,
  condensing: false,
  efficiencyPct: 89,
  brand: 'Worcester Bosch',
  model: 'Greenstar 24i',
};

// ── Behaviour timeline ────────────────────────────────────────────────────────

export const DEMO_BEHAVIOUR_EVENTS: BehaviourEvent[] = [
  { id: 'ev1', timeLabel: '06:30', hourDecimal: 6.5,  type: 'heatingOn',   label: 'Morning warm-up starts', boilerLoadFraction: 0.85 },
  { id: 'ev2', timeLabel: '07:00', hourDecimal: 7.0,  type: 'shower',      label: 'Morning shower',         boilerLoadFraction: 1.0  },
  { id: 'ev3', timeLabel: '07:15', hourDecimal: 7.25, type: 'tap',         label: 'Basin & breakfast tap',  boilerLoadFraction: 0.75 },
  { id: 'ev4', timeLabel: '07:30', hourDecimal: 7.5,  type: 'heatingRamp', label: 'Heating steady state',   boilerLoadFraction: 0.55 },
  { id: 'ev5', timeLabel: '09:00', hourDecimal: 9.0,  type: 'heatingOff',  label: 'House empty — off',      boilerLoadFraction: 0.0  },
  { id: 'ev6', timeLabel: '17:30', hourDecimal: 17.5, type: 'heatingOn',   label: 'Evening warm-up',        boilerLoadFraction: 0.9  },
  { id: 'ev7', timeLabel: '18:00', hourDecimal: 18.0, type: 'heatingRamp', label: 'Evening steady',         boilerLoadFraction: 0.6  },
  { id: 'ev8', timeLabel: '19:30', hourDecimal: 19.5, type: 'bath',        label: 'Evening bath',           boilerLoadFraction: 0.95 },
  { id: 'ev9', timeLabel: '22:30', hourDecimal: 22.5, type: 'heatingOff',  label: 'Night setback',          boilerLoadFraction: 0.0  },
];

// ── Physics console data ──────────────────────────────────────────────────────

export const DEMO_PHYSICS: PhysicsRoomData[] = [
  { roomId: 'living',   heatLossKw: 1.60, radiatorOutputKw: 2.10, deltaKw:  0.50, marginPct:  31, flowTempC: 75, returnTempC: 65 },
  { roomId: 'kitchen',  heatLossKw: 0.90, radiatorOutputKw: 1.20, deltaKw:  0.30, marginPct:  33, flowTempC: 75, returnTempC: 65 },
  { roomId: 'hallway',  heatLossKw: 0.50, radiatorOutputKw: 0.70, deltaKw:  0.20, marginPct:  40, flowTempC: 75, returnTempC: 65 },
  { roomId: 'bedroom1', heatLossKw: 1.10, radiatorOutputKw: 1.40, deltaKw:  0.30, marginPct:  27, flowTempC: 75, returnTempC: 65 },
  { roomId: 'bathroom', heatLossKw: 0.87, radiatorOutputKw: 1.20, deltaKw:  0.33, marginPct:  38, flowTempC: 75, returnTempC: 65 },
  { roomId: 'bedroom2', heatLossKw: 0.95, radiatorOutputKw: 1.25, deltaKw:  0.30, marginPct:  32, flowTempC: 75, returnTempC: 65 },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getRoomById(id: string): Room | undefined {
  return DEMO_ROOMS.find(r => r.id === id);
}

export function getEmitterById(id: string): Emitter | undefined {
  return DEMO_EMITTERS.find(e => e.id === id);
}

export function getPhysicsForRoom(roomId: string): PhysicsRoomData | undefined {
  return DEMO_PHYSICS.find(p => p.roomId === roomId);
}

export function getPipesForEmitter(emitterId: string): Pipe[] {
  const emitter = getEmitterById(emitterId);
  if (!emitter) return [];
  return DEMO_PIPES.filter(p => emitter.pipeIds.includes(p.id));
}
