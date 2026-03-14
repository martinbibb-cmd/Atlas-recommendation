/**
 * explorerTypes.ts
 *
 * Core types for the Atlas System Explorer — a layered, tappable house model
 * that progressively reveals the heating system from property → physics.
 */

// ── Layer model ───────────────────────────────────────────────────────────────

export type ExplorerLayer =
  | 'house'
  | 'room'
  | 'emitter'
  | 'hydraulic'
  | 'heatSource'
  | 'physics';

/**
 * Discriminated union for explorer selection state.
 * Each layer variant carries exactly the IDs it needs — no optional fields floating around.
 * Room selection is the primary navigation entry point; emitter and hydraulic are derived from it.
 */
export type ExplorerSelection =
  | { layer: 'house' }
  | { layer: 'room'; roomId: string }
  | { layer: 'emitter'; roomId: string; emitterId: string }
  | { layer: 'hydraulic'; roomId: string; emitterId: string; pipeIds: string[] }
  | { layer: 'heatSource'; boilerId: string }
  | { layer: 'physics'; roomId?: string };

/** @deprecated Use ExplorerSelection instead */
export interface ExplorerState {
  layer: ExplorerLayer;
  selectedRoom?: string;
  selectedEmitter?: string;
  selectedPipe?: string;
}

// ── System type IDs ───────────────────────────────────────────────────────────

export type SystemTypeId =
  | 'combi'
  | 'stored_vented'
  | 'stored_unvented'
  | 'ashp'
  | 'regular_vented'
  | 'system_unvented';

// ── Domain types ──────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  label: string;
  /** Target design temperature (°C) */
  designTemp: number;
  /** ID of the emitter serving this room */
  emitterId: string;
  /** Calculated fabric + ventilation heat loss (kW) */
  heatLossKw: number;
  /** Approximate warm-up time from cold (minutes) */
  warmUpMinutes: number;
  /** SVG bounding box within the house diagram (px in 480×340 viewBox) */
  svg: { x: number; y: number; w: number; h: number };
  /** Floor index (0 = ground, 1 = first) */
  floor: 0 | 1;
}

export interface Emitter {
  id: string;
  label: string;
  type: 'radiator' | 'underfloor';
  /** Rated heat output at design ΔT (kW) */
  outputKw: number;
  /** Pipe IDs connected to this emitter (flow, return) */
  pipeIds: string[];
}

export interface Pipe {
  id: string;
  label: string;
  /** Origin node (emitter id or 'boiler' or 'heatpump') */
  from: string;
  /** Destination node (emitter id or 'boiler' or 'heatpump') */
  to: string;
  diameterMm: number;
  flowLpm: number;
  /** SVG path for the system diagram */
  svgPath?: string;
}

// ── Heat source (covers both boilers and heat pumps) ─────────────────────────

export interface HeatSourceData {
  brand: string;
  model: string;
  isHeatPump: boolean;

  // Boiler fields
  outputKw?: number;
  currentLoadKw?: number;
  returnTempC?: number;
  condensing?: boolean;
  efficiencyPct?: number;

  // Heat pump fields
  ratedOutputKw?: number;
  cop?: number;          // point COP at design conditions (outdoor 7°C, design flow temp)
  spf?: number;          // seasonal performance factor
  outdoorTempC?: number; // outdoor temp used for COP calc
  flowTempC?: number;    // design flow temperature
  flowTempRegime?: '35C' | '45C' | '50C';
  primaryDiameterMm?: number;
}

// ── Cylinder (for stored DHW systems) ─────────────────────────────────────────

export interface CylinderData {
  volumeLitres: number;
  type: 'indirect_vented' | 'indirect_unvented' | 'mixergy';
  recoveryTimeMinutes: number;
  standingLossKwhPerDay: number;
  hasImmersionBackup: boolean;
  maxFlowLpm: number;
  g3Required: boolean;
}

// ── Complete system configuration ─────────────────────────────────────────────

export interface SystemConfig {
  id: SystemTypeId;
  label: string;
  shortLabel: string;
  description: string;
  category: 'gas_boiler' | 'heat_pump';
  dhwMethod: 'instantaneous' | 'cylinder_gravity' | 'cylinder_mains';
  hasCylinder: boolean;
  hasLoftTank: boolean;      // open-vented systems (stored_vented, regular_vented)
  hasOutdoorUnit: boolean;   // ASHP
  hasBufferVessel: boolean;  // ASHP with small system water volume
  primaryDiameterMm: number;
  designFlowTempC: number;
  designReturnTempC: number;
  accentColor: string;       // tab / highlight colour
  heatSource: HeatSourceData;
  cylinder?: CylinderData;
  emitters: Emitter[];
  physics: PhysicsRoomData[];
  behaviourEvents: BehaviourEvent[];
}

// ── Behaviour timeline ────────────────────────────────────────────────────────

export type BehaviourEventType =
  | 'heatingOn'
  | 'heatingOff'
  | 'heatingRamp'
  | 'shower'
  | 'bath'
  | 'tap'
  | 'cylinderReheat'
  | 'defrost';

export interface BehaviourEvent {
  id: string;
  timeLabel: string;
  hourDecimal: number;
  type: BehaviourEventType;
  label: string;
  /** Heat source load fraction 0–1 */
  boilerLoadFraction: number;
}

// ── Physics console data ──────────────────────────────────────────────────────

export interface PhysicsRoomData {
  roomId: string;
  heatLossKw: number;
  radiatorOutputKw: number;
  deltaKw: number;
  marginPct: number;
  flowTempC: number;
  returnTempC: number;
}

// ── Legacy alias (kept for compatibility) ─────────────────────────────────────

/** @deprecated Use HeatSourceData instead */
export type BoilerData = HeatSourceData;
