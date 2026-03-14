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

export interface ExplorerState {
  layer: ExplorerLayer;
  selectedRoom?: string;
  selectedEmitter?: string;
  selectedPipe?: string;
}

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
  /** Origin node (emitter id or 'boiler') */
  from: string;
  /** Destination node (emitter id or 'boiler') */
  to: string;
  diameterMm: number;
  flowLpm: number;
  /** SVG path for the system diagram */
  svgPath?: string;
}

export interface BoilerData {
  outputKw: number;
  currentLoadKw: number;
  returnTempC: number;
  condensing: boolean;
  efficiencyPct: number;
  brand: string;
  model: string;
}

// ── Behaviour timeline ────────────────────────────────────────────────────────

export type BehaviourEventType =
  | 'heatingOn'
  | 'heatingOff'
  | 'heatingRamp'
  | 'shower'
  | 'bath'
  | 'tap';

export interface BehaviourEvent {
  id: string;
  /** Display label e.g. "06:30" */
  timeLabel: string;
  /** Decimal hour (6.5 = 06:30) */
  hourDecimal: number;
  type: BehaviourEventType;
  label: string;
  /** Boiler load fraction 0–1 during/after this event */
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
