/**
 * systemConfigs.ts
 *
 * Complete data configurations for all 6 heating system types in the
 * Atlas System Explorer, modelling a typical 3-bed UK semi-detached.
 *
 * System types:
 *   1. combi           — Gas Combi (on-demand DHW, no cylinder)
 *   2. stored_vented   — System Boiler + Vented Cylinder (gravity-fed)
 *   3. stored_unvented — System Boiler + Unvented Cylinder (mains-pressure)
 *   4. ashp            — Air Source Heat Pump (45°C fast-fit, stored DHW)
 *   5. regular_vented  — Regular/Open-Vented Boiler + Vented Cylinder
 *   6. system_unvented — System Boiler + Unvented Cylinder (sealed primary)
 *
 * Physics assumptions:
 *   House peak heat loss: 5.92 kW
 *   Design external temp: -3°C (UK default)
 *   Design internal temp: see per-room
 */

import type {
  SystemConfig,
  Emitter,
  PhysicsRoomData,
  BehaviourEvent,
  Room,
  ExplorerAssumptions,
  ConstraintLabel,
} from './explorerTypes';

// ── Shared rooms (property doesn't change between systems) ────────────────────

export const DEMO_ROOMS: Room[] = [
  { id: 'living',   label: 'Living Room', designTemp: 21, emitterId: 'rad-living',  heatLossKw: 1.60, warmUpMinutes: 22, svg: { x: 20,  y: 195, w: 200, h: 130 }, floor: 0 },
  { id: 'kitchen',  label: 'Kitchen',     designTemp: 19, emitterId: 'rad-kitchen', heatLossKw: 0.90, warmUpMinutes: 12, svg: { x: 228, y: 195, w: 155, h: 130 }, floor: 0 },
  { id: 'hallway',  label: 'Hallway',     designTemp: 18, emitterId: 'rad-hallway', heatLossKw: 0.50, warmUpMinutes:  8, svg: { x: 391, y: 195, w:  69, h: 130 }, floor: 0 },
  { id: 'bedroom1', label: 'Bedroom 1',   designTemp: 18, emitterId: 'rad-bed1',    heatLossKw: 1.10, warmUpMinutes: 15, svg: { x: 20,  y:  45, w: 185, h: 130 }, floor: 1 },
  { id: 'bathroom', label: 'Bathroom',    designTemp: 22, emitterId: 'rad-bath',    heatLossKw: 0.87, warmUpMinutes: 10, svg: { x: 213, y:  45, w: 130, h: 130 }, floor: 1 },
  { id: 'bedroom2', label: 'Bedroom 2',   designTemp: 18, emitterId: 'rad-bed2',    heatLossKw: 0.95, warmUpMinutes: 14, svg: { x: 351, y:  45, w: 109, h: 130 }, floor: 1 },
];

// ── Emitter sets ──────────────────────────────────────────────────────────────
// Radiators at 75°C flow — standard sizing for gas boiler systems

const RADIATORS_75C: Emitter[] = [
  { id: 'rad-living',  label: 'Double Panel Radiator', type: 'radiator', outputKw: 2.10, pipeIds: ['pipe-living-flow',   'pipe-living-return']   },
  { id: 'rad-kitchen', label: 'Single Panel Radiator', type: 'radiator', outputKw: 1.20, pipeIds: ['pipe-kitchen-flow',  'pipe-kitchen-return']  },
  { id: 'rad-hallway', label: 'Slimline Radiator',     type: 'radiator', outputKw: 0.70, pipeIds: ['pipe-hallway-flow',  'pipe-hallway-return']  },
  { id: 'rad-bed1',    label: 'Double Panel Radiator', type: 'radiator', outputKw: 1.40, pipeIds: ['pipe-bed1-flow',     'pipe-bed1-return']     },
  { id: 'rad-bath',    label: 'Towel Rail + Panel',    type: 'radiator', outputKw: 1.20, pipeIds: ['pipe-bath-flow',     'pipe-bath-return']     },
  { id: 'rad-bed2',    label: 'Double Panel Radiator', type: 'radiator', outputKw: 1.25, pipeIds: ['pipe-bed2-flow',     'pipe-bed2-return']     },
];

// Radiators at 70°C flow — open-vented / regular boiler (slightly cooler circuit)
const RADIATORS_70C: Emitter[] = [
  { id: 'rad-living',  label: 'Double Panel Radiator', type: 'radiator', outputKw: 1.90, pipeIds: ['pipe-living-flow',   'pipe-living-return']   },
  { id: 'rad-kitchen', label: 'Single Panel Radiator', type: 'radiator', outputKw: 1.05, pipeIds: ['pipe-kitchen-flow',  'pipe-kitchen-return']  },
  { id: 'rad-hallway', label: 'Slimline Radiator',     type: 'radiator', outputKw: 0.60, pipeIds: ['pipe-hallway-flow',  'pipe-hallway-return']  },
  { id: 'rad-bed1',    label: 'Double Panel Radiator', type: 'radiator', outputKw: 1.25, pipeIds: ['pipe-bed1-flow',     'pipe-bed1-return']     },
  { id: 'rad-bath',    label: 'Towel Rail + Panel',    type: 'radiator', outputKw: 1.10, pipeIds: ['pipe-bath-flow',     'pipe-bath-return']     },
  { id: 'rad-bed2',    label: 'Double Panel Radiator', type: 'radiator', outputKw: 1.15, pipeIds: ['pipe-bed2-flow',     'pipe-bed2-return']     },
];

// Oversized radiators at 45°C flow (ASHP fast-fit).
// At 45°C flow/40°C return, ΔT to room ≈ 22°C vs 52°C at 75°C.
// Output factor ≈ 22/52 ≈ 0.42 — so need ~2.4× larger panels.
// Rounded to realistic panel sizes.
const RADIATORS_45C: Emitter[] = [
  { id: 'rad-living',  label: 'Triple Panel Radiator (oversized)', type: 'radiator', outputKw: 1.90, pipeIds: ['pipe-living-flow',   'pipe-living-return']   },
  { id: 'rad-kitchen', label: 'Double Panel Radiator (oversized)', type: 'radiator', outputKw: 1.05, pipeIds: ['pipe-kitchen-flow',  'pipe-kitchen-return']  },
  { id: 'rad-hallway', label: 'Double Panel Radiator (new)',       type: 'radiator', outputKw: 0.62, pipeIds: ['pipe-hallway-flow',  'pipe-hallway-return']  },
  { id: 'rad-bed1',    label: 'Triple Panel Radiator (oversized)', type: 'radiator', outputKw: 1.30, pipeIds: ['pipe-bed1-flow',     'pipe-bed1-return']     },
  { id: 'rad-bath',    label: 'Towel Rail + Double Panel (new)',   type: 'radiator', outputKw: 1.00, pipeIds: ['pipe-bath-flow',     'pipe-bath-return']     },
  { id: 'rad-bed2',    label: 'Triple Panel Radiator (oversized)', type: 'radiator', outputKw: 1.10, pipeIds: ['pipe-bed2-flow',     'pipe-bed2-return']     },
];

// ── Physics data sets ─────────────────────────────────────────────────────────

const PHYSICS_75C: PhysicsRoomData[] = [
  { roomId: 'living',   heatLossKw: 1.60, radiatorOutputKw: 2.10, deltaKw: 0.50, marginPct: 31, flowTempC: 75, returnTempC: 65 },
  { roomId: 'kitchen',  heatLossKw: 0.90, radiatorOutputKw: 1.20, deltaKw: 0.30, marginPct: 33, flowTempC: 75, returnTempC: 65 },
  { roomId: 'hallway',  heatLossKw: 0.50, radiatorOutputKw: 0.70, deltaKw: 0.20, marginPct: 40, flowTempC: 75, returnTempC: 65 },
  { roomId: 'bedroom1', heatLossKw: 1.10, radiatorOutputKw: 1.40, deltaKw: 0.30, marginPct: 27, flowTempC: 75, returnTempC: 65 },
  { roomId: 'bathroom', heatLossKw: 0.87, radiatorOutputKw: 1.20, deltaKw: 0.33, marginPct: 38, flowTempC: 75, returnTempC: 65 },
  { roomId: 'bedroom2', heatLossKw: 0.95, radiatorOutputKw: 1.25, deltaKw: 0.30, marginPct: 32, flowTempC: 75, returnTempC: 65 },
];

const PHYSICS_70C: PhysicsRoomData[] = [
  { roomId: 'living',   heatLossKw: 1.60, radiatorOutputKw: 1.90, deltaKw: 0.30, marginPct: 19, flowTempC: 70, returnTempC: 60 },
  { roomId: 'kitchen',  heatLossKw: 0.90, radiatorOutputKw: 1.05, deltaKw: 0.15, marginPct: 17, flowTempC: 70, returnTempC: 60 },
  { roomId: 'hallway',  heatLossKw: 0.50, radiatorOutputKw: 0.60, deltaKw: 0.10, marginPct: 20, flowTempC: 70, returnTempC: 60 },
  { roomId: 'bedroom1', heatLossKw: 1.10, radiatorOutputKw: 1.25, deltaKw: 0.15, marginPct: 14, flowTempC: 70, returnTempC: 60 },
  { roomId: 'bathroom', heatLossKw: 0.87, radiatorOutputKw: 1.10, deltaKw: 0.23, marginPct: 26, flowTempC: 70, returnTempC: 60 },
  { roomId: 'bedroom2', heatLossKw: 0.95, radiatorOutputKw: 1.15, deltaKw: 0.20, marginPct: 21, flowTempC: 70, returnTempC: 60 },
];

// ASHP at 45°C — oversized rads, tight margins (fast-fit scenario)
const PHYSICS_45C: PhysicsRoomData[] = [
  { roomId: 'living',   heatLossKw: 1.60, radiatorOutputKw: 1.90, deltaKw:  0.30, marginPct: 19, flowTempC: 45, returnTempC: 40 },
  { roomId: 'kitchen',  heatLossKw: 0.90, radiatorOutputKw: 1.05, deltaKw:  0.15, marginPct: 17, flowTempC: 45, returnTempC: 40 },
  { roomId: 'hallway',  heatLossKw: 0.50, radiatorOutputKw: 0.62, deltaKw:  0.12, marginPct: 24, flowTempC: 45, returnTempC: 40 },
  { roomId: 'bedroom1', heatLossKw: 1.10, radiatorOutputKw: 1.30, deltaKw:  0.20, marginPct: 18, flowTempC: 45, returnTempC: 40 },
  { roomId: 'bathroom', heatLossKw: 0.87, radiatorOutputKw: 1.00, deltaKw:  0.13, marginPct: 15, flowTempC: 45, returnTempC: 40 },
  { roomId: 'bedroom2', heatLossKw: 0.95, radiatorOutputKw: 1.10, deltaKw:  0.15, marginPct: 16, flowTempC: 45, returnTempC: 40 },
];

// ── Behaviour event templates ──────────────────────────────────────────────────

const EVENTS_COMBI: BehaviourEvent[] = [
  { id: 'ev1', timeLabel: '06:30', hourDecimal: 6.5,  type: 'heatingOn',   label: 'Morning warm-up',        boilerLoadFraction: 0.85 },
  { id: 'ev2', timeLabel: '07:00', hourDecimal: 7.0,  type: 'shower',      label: 'Shower — boiler fires',  boilerLoadFraction: 1.0  },
  { id: 'ev3', timeLabel: '07:15', hourDecimal: 7.25, type: 'tap',         label: 'Basin tap',              boilerLoadFraction: 0.80 },
  { id: 'ev4', timeLabel: '07:30', hourDecimal: 7.5,  type: 'heatingRamp', label: 'Heating steady state',   boilerLoadFraction: 0.55 },
  { id: 'ev5', timeLabel: '09:00', hourDecimal: 9.0,  type: 'heatingOff',  label: 'House empty — off',      boilerLoadFraction: 0.0  },
  { id: 'ev6', timeLabel: '17:30', hourDecimal: 17.5, type: 'heatingOn',   label: 'Evening warm-up',        boilerLoadFraction: 0.90 },
  { id: 'ev7', timeLabel: '18:00', hourDecimal: 18.0, type: 'heatingRamp', label: 'Evening steady',         boilerLoadFraction: 0.60 },
  { id: 'ev8', timeLabel: '19:30', hourDecimal: 19.5, type: 'bath',        label: 'Evening bath — on demand', boilerLoadFraction: 0.95 },
  { id: 'ev9', timeLabel: '22:30', hourDecimal: 22.5, type: 'heatingOff',  label: 'Night setback',          boilerLoadFraction: 0.0  },
];

const EVENTS_STORED_VENTED: BehaviourEvent[] = [
  { id: 'ev1', timeLabel: '06:00', hourDecimal: 6.0,  type: 'cylinderReheat', label: 'Cylinder reheat (timer)', boilerLoadFraction: 0.75 },
  { id: 'ev2', timeLabel: '06:30', hourDecimal: 6.5,  type: 'heatingOn',      label: 'Morning warm-up',        boilerLoadFraction: 0.80 },
  { id: 'ev3', timeLabel: '07:00', hourDecimal: 7.0,  type: 'shower',         label: 'Shower from cylinder',   boilerLoadFraction: 0.30 },
  { id: 'ev4', timeLabel: '07:15', hourDecimal: 7.25, type: 'tap',            label: 'Basin — hot from cylinder', boilerLoadFraction: 0.25 },
  { id: 'ev5', timeLabel: '07:45', hourDecimal: 7.75, type: 'heatingRamp',    label: 'Heating steady state',   boilerLoadFraction: 0.55 },
  { id: 'ev6', timeLabel: '09:00', hourDecimal: 9.0,  type: 'heatingOff',     label: 'House empty — off',      boilerLoadFraction: 0.0  },
  { id: 'ev7', timeLabel: '17:00', hourDecimal: 17.0, type: 'cylinderReheat', label: 'Evening cylinder pre-heat', boilerLoadFraction: 0.70 },
  { id: 'ev8', timeLabel: '17:30', hourDecimal: 17.5, type: 'heatingOn',      label: 'Evening warm-up',        boilerLoadFraction: 0.85 },
  { id: 'ev9', timeLabel: '18:00', hourDecimal: 18.0, type: 'heatingRamp',    label: 'Evening steady',         boilerLoadFraction: 0.60 },
  { id: 'ev10', timeLabel: '19:30', hourDecimal: 19.5, type: 'bath',          label: 'Evening bath from cylinder', boilerLoadFraction: 0.20 },
  { id: 'ev11', timeLabel: '22:30', hourDecimal: 22.5, type: 'heatingOff',    label: 'Night setback',          boilerLoadFraction: 0.0  },
];

const EVENTS_STORED_UNVENTED: BehaviourEvent[] = EVENTS_STORED_VENTED.map(ev => ({
  ...ev,
  label: ev.label.replace('gravity', 'mains-pressure'),
}));

const EVENTS_ASHP: BehaviourEvent[] = [
  { id: 'ev1', timeLabel: '05:30', hourDecimal: 5.5,  type: 'heatingOn',      label: 'Continuous low-level heat starts', boilerLoadFraction: 0.35 },
  { id: 'ev2', timeLabel: '06:00', hourDecimal: 6.0,  type: 'cylinderReheat', label: 'DHW preheat — immersion/coil',     boilerLoadFraction: 0.90 },
  { id: 'ev3', timeLabel: '07:00', hourDecimal: 7.0,  type: 'shower',         label: 'Shower from pre-heated cylinder',  boilerLoadFraction: 0.35 },
  { id: 'ev4', timeLabel: '07:15', hourDecimal: 7.25, type: 'tap',            label: 'Basin — stored hot water',         boilerLoadFraction: 0.35 },
  { id: 'ev5', timeLabel: '09:00', hourDecimal: 9.0,  type: 'heatingRamp',    label: 'Modulating down — house empty',    boilerLoadFraction: 0.20 },
  { id: 'ev6', timeLabel: '10:00', hourDecimal: 10.0, type: 'defrost',        label: 'Defrost cycle (cold day)',         boilerLoadFraction: 0.0  },
  { id: 'ev7', timeLabel: '10:10', hourDecimal: 10.17, type: 'heatingRamp',   label: 'Resuming low-level heat',          boilerLoadFraction: 0.25 },
  { id: 'ev8', timeLabel: '17:00', hourDecimal: 17.0, type: 'heatingRamp',    label: 'Ramping for evening occupancy',    boilerLoadFraction: 0.55 },
  { id: 'ev9', timeLabel: '19:30', hourDecimal: 19.5, type: 'bath',           label: 'Bath — top-up from cylinder',      boilerLoadFraction: 0.30 },
  { id: 'ev10', timeLabel: '22:00', hourDecimal: 22.0, type: 'heatingRamp',   label: 'Night setback — lower flow temp',  boilerLoadFraction: 0.15 },
];

const EVENTS_REGULAR_VENTED: BehaviourEvent[] = [
  { id: 'ev1', timeLabel: '06:00', hourDecimal: 6.0,  type: 'cylinderReheat', label: 'Cylinder reheat (timer)',           boilerLoadFraction: 0.70 },
  { id: 'ev2', timeLabel: '06:30', hourDecimal: 6.5,  type: 'heatingOn',      label: 'Morning warm-up',                  boilerLoadFraction: 0.75 },
  { id: 'ev3', timeLabel: '07:00', hourDecimal: 7.0,  type: 'shower',         label: 'Shower — tank-fed supply (low head)', boilerLoadFraction: 0.25 },
  { id: 'ev4', timeLabel: '07:30', hourDecimal: 7.5,  type: 'heatingRamp',    label: 'Heating steady state',             boilerLoadFraction: 0.50 },
  { id: 'ev5', timeLabel: '09:00', hourDecimal: 9.0,  type: 'heatingOff',     label: 'House empty — off',                boilerLoadFraction: 0.0  },
  { id: 'ev6', timeLabel: '17:00', hourDecimal: 17.0, type: 'cylinderReheat', label: 'Evening cylinder pre-heat',        boilerLoadFraction: 0.65 },
  { id: 'ev7', timeLabel: '17:30', hourDecimal: 17.5, type: 'heatingOn',      label: 'Evening warm-up',                  boilerLoadFraction: 0.80 },
  { id: 'ev8', timeLabel: '18:00', hourDecimal: 18.0, type: 'heatingRamp',    label: 'Evening steady',                   boilerLoadFraction: 0.55 },
  { id: 'ev9', timeLabel: '19:30', hourDecimal: 19.5, type: 'bath',           label: 'Bath — tank-fed supply',            boilerLoadFraction: 0.20 },
  { id: 'ev10', timeLabel: '22:30', hourDecimal: 22.5, type: 'heatingOff',    label: 'Night setback',                    boilerLoadFraction: 0.0  },
];

// ── All 6 system configurations ───────────────────────────────────────────────

export const SYSTEM_CONFIGS: Record<string, SystemConfig> = {

  // ─────────────────────────────────────────────────────────────────────────
  combi: {
    id: 'combi',
    label: 'Gas Combi',
    shortLabel: 'Combi',
    description: 'On-demand DHW from a single gas appliance. No cylinder, no stored water. Simplest install.',
    category: 'gas_boiler',
    dhwMethod: 'instantaneous',
    hasCylinder: false,
    hasLoftTank: false,
    hasOutdoorUnit: false,
    hasBufferVessel: false,
    primaryDiameterMm: 22,
    designFlowTempC: 75,
    designReturnTempC: 65,
    accentColor: '#ff7a00',
    heatSource: {
      brand: 'Worcester Bosch',
      model: 'Greenstar 24i',
      isHeatPump: false,
      outputKw: 24,
      currentLoadKw: 14,
      returnTempC: 63,
      condensing: false,
      efficiencyPct: 89,
    },
    emitters: RADIATORS_75C,
    physics: PHYSICS_75C,
    behaviourEvents: EVENTS_COMBI,
  },

  // ─────────────────────────────────────────────────────────────────────────
  stored_vented: {
    id: 'stored_vented',
    label: 'System Boiler + Vented Cylinder',
    shortLabel: 'Stored Vented',
    description: 'Indirect vented cylinder fed from a cold water storage tank in the loft. Gravity-fed taps. No G3 required.',
    category: 'gas_boiler',
    dhwMethod: 'cylinder_gravity',
    hasCylinder: true,
    hasLoftTank: true,
    hasOutdoorUnit: false,
    hasBufferVessel: false,
    primaryDiameterMm: 22,
    designFlowTempC: 75,
    designReturnTempC: 65,
    accentColor: '#3fa7ff',
    heatSource: {
      brand: 'Ideal Logic',
      model: 'System 24',
      isHeatPump: false,
      outputKw: 24,
      currentLoadKw: 12,
      returnTempC: 56,
      condensing: true,
      efficiencyPct: 93,
    },
    cylinder: {
      volumeLitres: 180,
      type: 'indirect_vented',
      recoveryTimeMinutes: 35,
      standingLossKwhPerDay: 1.2,
      hasImmersionBackup: true,
      maxFlowLpm: 12,
      g3Required: false,
    },
    emitters: RADIATORS_75C,
    physics: PHYSICS_75C,
    behaviourEvents: EVENTS_STORED_VENTED,
  },

  // ─────────────────────────────────────────────────────────────────────────
  stored_unvented: {
    id: 'stored_unvented',
    label: 'System Boiler + Unvented Cylinder',
    shortLabel: 'Stored Unvented',
    description: 'Mains-pressure hot water from an unvented cylinder. Sealed primary. G3-qualified installer required.',
    category: 'gas_boiler',
    dhwMethod: 'cylinder_mains',
    hasCylinder: true,
    hasLoftTank: false,
    hasOutdoorUnit: false,
    hasBufferVessel: false,
    primaryDiameterMm: 22,
    designFlowTempC: 75,
    designReturnTempC: 65,
    accentColor: '#2f6bff',
    heatSource: {
      brand: 'Vaillant',
      model: 'ecoTEC Plus 24',
      isHeatPump: false,
      outputKw: 24,
      currentLoadKw: 12,
      returnTempC: 52,
      condensing: true,
      efficiencyPct: 94,
    },
    cylinder: {
      volumeLitres: 150,
      type: 'indirect_unvented',
      recoveryTimeMinutes: 28,
      standingLossKwhPerDay: 0.9,
      hasImmersionBackup: true,
      maxFlowLpm: 20,
      g3Required: true,
    },
    emitters: RADIATORS_75C,
    physics: PHYSICS_75C,
    behaviourEvents: EVENTS_STORED_UNVENTED,
  },

  // ─────────────────────────────────────────────────────────────────────────
  ashp: {
    id: 'ashp',
    label: 'Air Source Heat Pump',
    shortLabel: 'ASHP',
    description: '45°C fast-fit ASHP with oversized radiators. Stored DHW cylinder with immersion backup. 28mm primary required.',
    category: 'heat_pump',
    dhwMethod: 'cylinder_mains',
    hasCylinder: true,
    hasLoftTank: false,
    hasOutdoorUnit: true,
    hasBufferVessel: false,
    primaryDiameterMm: 28,
    designFlowTempC: 45,
    designReturnTempC: 40,
    accentColor: '#28c76f',
    heatSource: {
      brand: 'Vaillant',
      model: 'arotherm plus 7kW',
      isHeatPump: true,
      ratedOutputKw: 7,
      currentLoadKw: 4.5,
      cop: 2.8,
      spf: 2.5,
      outdoorTempC: 7,
      flowTempC: 45,
      flowTempRegime: '45C',
      primaryDiameterMm: 28,
    },
    cylinder: {
      volumeLitres: 200,
      type: 'indirect_unvented',
      recoveryTimeMinutes: 90,
      standingLossKwhPerDay: 1.1,
      hasImmersionBackup: true,
      maxFlowLpm: 18,
      g3Required: true,
    },
    emitters: RADIATORS_45C,
    physics: PHYSICS_45C,
    behaviourEvents: EVENTS_ASHP,
  },

  // ─────────────────────────────────────────────────────────────────────────
  regular_vented: {
    id: 'regular_vented',
    label: 'Regular Boiler (Open Vented)',
    shortLabel: 'Regular',
    description: 'Traditional open-vented system with feed-and-expansion tank and cold water storage in the loft. Low-pressure taps.',
    category: 'gas_boiler',
    dhwMethod: 'cylinder_gravity',
    hasCylinder: true,
    hasLoftTank: true,
    hasOutdoorUnit: false,
    hasBufferVessel: false,
    primaryDiameterMm: 22,
    designFlowTempC: 70,
    designReturnTempC: 60,
    accentColor: '#9b59b6',
    heatSource: {
      brand: 'Baxi',
      model: '105e Regular',
      isHeatPump: false,
      outputKw: 20,
      currentLoadKw: 13,
      returnTempC: 62,
      condensing: false,
      efficiencyPct: 81,
    },
    cylinder: {
      volumeLitres: 120,
      type: 'indirect_vented',
      recoveryTimeMinutes: 50,
      standingLossKwhPerDay: 1.8,
      hasImmersionBackup: true,
      maxFlowLpm: 9,
      g3Required: false,
    },
    emitters: RADIATORS_70C,
    physics: PHYSICS_70C,
    behaviourEvents: EVENTS_REGULAR_VENTED,
  },

  // ─────────────────────────────────────────────────────────────────────────
  system_unvented: {
    id: 'system_unvented',
    label: 'System Boiler (Sealed Unvented)',
    shortLabel: 'System',
    description: 'Sealed primary circuit, mains-pressure unvented cylinder. No loft tanks needed. G3 compliance required.',
    category: 'gas_boiler',
    dhwMethod: 'cylinder_mains',
    hasCylinder: true,
    hasLoftTank: false,
    hasOutdoorUnit: false,
    hasBufferVessel: false,
    primaryDiameterMm: 22,
    designFlowTempC: 75,
    designReturnTempC: 65,
    accentColor: '#e67e22',
    heatSource: {
      brand: 'Worcester Bosch',
      model: 'Greenstar Si 30',
      isHeatPump: false,
      outputKw: 30,
      currentLoadKw: 13,
      returnTempC: 54,
      condensing: true,
      efficiencyPct: 93,
    },
    cylinder: {
      volumeLitres: 150,
      type: 'indirect_unvented',
      recoveryTimeMinutes: 25,
      standingLossKwhPerDay: 0.9,
      hasImmersionBackup: true,
      maxFlowLpm: 22,
      g3Required: true,
    },
    emitters: RADIATORS_75C,
    physics: PHYSICS_75C,
    behaviourEvents: EVENTS_STORED_UNVENTED,
  },
};

export const SYSTEM_TYPE_ORDER: string[] = [
  'combi',
  'stored_vented',
  'stored_unvented',
  'system_unvented',
  'regular_vented',
  'ashp',
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getSystemConfig(id: string): SystemConfig {
  return SYSTEM_CONFIGS[id] ?? SYSTEM_CONFIGS['combi'];
}

export function getRoomById(id: string): Room | undefined {
  return DEMO_ROOMS.find(r => r.id === id);
}

export function getEmitterById(systemId: string, emitterId: string) {
  const cfg = getSystemConfig(systemId);
  return cfg.emitters.find(e => e.id === emitterId);
}

export function getPhysicsForRoom(systemId: string, roomId: string) {
  const cfg = getSystemConfig(systemId);
  return cfg.physics.find(p => p.roomId === roomId);
}

// ── Assumption derivation ─────────────────────────────────────────────────────

/**
 * Derive explicit assumptions from a system config.
 * Nothing is silently assumed — all values come from the system data.
 * Gas boilers use their design flow temp; heat pumps use flowTempC from heatSource.
 */
export function deriveAssumptions(config: SystemConfig): ExplorerAssumptions {
  const isHP = config.heatSource.isHeatPump;
  const assumedFlowTempC = isHP
    ? (config.heatSource.flowTempC ?? config.designFlowTempC)
    : config.designFlowTempC;

  let emitterState: ExplorerAssumptions['emitterState'];
  if (isHP) {
    if (assumedFlowTempC <= 35) emitterState = 'upgraded';
    else if (assumedFlowTempC <= 45) emitterState = 'oversized';
    else emitterState = 'existing';
  } else {
    emitterState = 'existing';
  }

  return {
    assumedFlowTempC,
    emitterState,
    primaryPipeMm: config.primaryDiameterMm,
    // Heat pumps always use weather/load compensation; boilers typically do not
    compensationEnabled: isHP,
    operatingMode: 'current',
  };
}

/**
 * Derive active constraint labels from a system config and its current assumptions.
 * Only labels that are factually justified by the data are returned.
 * No punitive defaults — a label only appears when the condition is met.
 */
export function deriveConstraintLabels(
  config: SystemConfig,
  assumptions: ExplorerAssumptions,
): ConstraintLabel[] {
  const labels: ConstraintLabel[] = [];
  const isHP = config.heatSource.isHeatPump;

  if (isHP) {
    if (assumptions.assumedFlowTempC > 35) labels.push('flow-temperature-limited');
    if (assumptions.emitterState === 'existing') labels.push('emitter-limited');
    if (assumptions.primaryPipeMm < 28) labels.push('primary-flow-limited');
    if (!assumptions.compensationEnabled) labels.push('no-compensation');
    if (assumptions.assumedFlowTempC >= 55) labels.push('reduced-efficiency-hot-water-mode');
  } else {
    // Gas boiler — flag non-condensing return temperature
    const returnTempC = config.heatSource.returnTempC ?? 0;
    if (returnTempC >= 55) labels.push('flow-temperature-limited');
    // Flag cycling risk when boiler is heavily oversized at current load
    const outputKw = config.heatSource.outputKw ?? 0;
    const currentLoadKw = config.heatSource.currentLoadKw ?? 0;
    if (outputKw > 0 && currentLoadKw > 0 && currentLoadKw / outputKw < 0.3) {
      labels.push('cycling-risk');
    }
  }

  return labels;
}
