/**
 * propertyPlan.types.ts
 *
 * Canonical data model for the three-layer property plan:
 *   1. Geometry layer   — floors, rooms, walls, openings, zones
 *   2. Placement layer  — heating components anchored to floors/rooms
 *   3. Connection layer — pipe/wiring routes between placed nodes
 */

import type { PartKind } from '../../explainers/lego/builder/types';

// ─── Primitives ───────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export type Polygon = Point[];

// ─── Room types ───────────────────────────────────────────────────────────────

export type RoomType =
  | 'living'
  | 'dining'
  | 'kitchen'
  | 'bedroom'
  | 'bathroom'
  | 'en_suite'
  | 'hallway'
  | 'landing'
  | 'utility'
  | 'garage'
  | 'study'
  | 'conservatory'
  | 'loft'
  | 'cupboard'
  | 'plant_room'
  | 'outside'
  | 'other';

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  living:        'Living Room',
  dining:        'Dining Room',
  kitchen:       'Kitchen',
  bedroom:       'Bedroom',
  bathroom:      'Bathroom',
  en_suite:      'En Suite',
  hallway:       'Hallway',
  landing:       'Landing',
  utility:       'Utility',
  garage:        'Garage',
  study:         'Study',
  conservatory:  'Conservatory',
  loft:          'Loft',
  cupboard:      'Cupboard',
  plant_room:    'Plant Room',
  outside:       'Outside',
  other:         'Other',
};

/** Room types that accept boiler/heat-source placement */
export const BOILER_VALID_ROOM_TYPES: RoomType[] = [
  'kitchen', 'utility', 'garage', 'cupboard', 'plant_room',
];

/** Room types that accept cylinder placement */
export const CYLINDER_VALID_ROOM_TYPES: RoomType[] = [
  'cupboard', 'plant_room', 'utility', 'garage', 'airing_cupboard' as RoomType,
];

/** Room types that accept heat pump outdoor unit (or "outside") */
export const HEAT_PUMP_VALID_ROOM_TYPES: RoomType[] = ['outside'];

// ─── Geometry layer ───────────────────────────────────────────────────────────

export interface Room {
  id: string;
  name: string;
  roomType: RoomType;
  floorId: string;
  /** Top-left x in canvas units */
  x: number;
  /** Top-left y in canvas units */
  y: number;
  width: number;
  height: number;
  areaM2?: number;
  volumeM3?: number;
  heightM?: number;
  notes?: string;
}

export type WallKind = 'internal' | 'external';

export interface Wall {
  id: string;
  floorId: string;
  kind: WallKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thicknessMm?: number;
  roomIds?: string[];
}

export type OpeningType = 'door' | 'window';

export interface Opening {
  id: string;
  floorId: string;
  type: OpeningType;
  wallId: string;
  offsetM: number;
  widthM: number;
}

export interface Zone {
  id: string;
  floorId: string;
  label: string;
  polygon: Polygon;
}

export interface FloorPlan {
  id: string;
  name: string;
  levelIndex: number;
  elevationM?: number;
  rooms: Room[];
  walls: Wall[];
  openings: Opening[];
  zones: Zone[];
}

// ─── Placement layer ──────────────────────────────────────────────────────────

export interface NodeAnchor {
  /** Canvas x position */
  x: number;
  /** Canvas y position */
  y: number;
}

export interface PlacementNode {
  id: string;
  /** Heating component type from the lego palette */
  type: PartKind;
  floorId: string;
  roomId?: string;
  anchor: NodeAnchor;
  orientationDeg?: number;
  metadata: Record<string, unknown>;
}

// ─── Connection layer ─────────────────────────────────────────────────────────

export type ConnectionType =
  | 'flow'
  | 'return'
  | 'dhw_hot'
  | 'cold'
  | 'gas'
  | 'condensate'
  | 'prv'
  | 'control';

export interface ConnectionPath {
  id: string;
  type: ConnectionType;
  fromNodeId: string;
  toNodeId: string;
  /** Ordered waypoints including start and end */
  route: Point[];
  routeMode: 'manual' | 'auto';
}

// ─── Property metadata ────────────────────────────────────────────────────────

export interface PropertyMetadata {
  propertyType?: 'detached' | 'semi_detached' | 'terraced' | 'flat' | 'bungalow' | 'other';
  postcode?: string;
  systemType?: 'combi' | 'system' | 'regular' | 'heat_pump';
  notes?: string;
  /** Starter template that was used to seed this plan (if any). */
  templateId?: string;
  defaultRoomHeightM?: number;
}

// ─── Top-level document model ─────────────────────────────────────────────────

export interface PropertyPlan {
  version: '1.0';
  propertyId: string;
  floors: FloorPlan[];
  placementNodes: PlacementNode[];
  connections: ConnectionPath[];
  metadata: PropertyMetadata;
}

// ─── Validation types ─────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  layer: 'geometry' | 'placement' | 'connection';
  objectId?: string;
  objectType?: 'room' | 'wall' | 'node' | 'connection' | 'floor' | 'property';
  message: string;
}

// ─── Editor tool modes ────────────────────────────────────────────────────────

export type EditorTool =
  | 'select'
  | 'addRoom'
  | 'drawWall'
  | 'addOpening'
  | 'placeNode'
  | 'connectRoute'
  | 'pan';

// ─── Selection model ──────────────────────────────────────────────────────────

export type SelectionTarget =
  | { kind: 'room';       id: string }
  | { kind: 'wall';       id: string }
  | { kind: 'node';       id: string }
  | { kind: 'connection'; id: string };
