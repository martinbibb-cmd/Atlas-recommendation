/**
 * propertyPlan.types.ts
 *
 * Canonical data model for the three-layer property plan:
 *   1. Geometry layer   — floors, rooms, walls, openings, zones
 *   2. Placement layer  — heating components anchored to floors/rooms
 *   3. Connection layer — pipe/wiring routes between placed nodes
 */

import type { PartKind } from '../../explainers/lego/builder/types';

// ─── Entity provenance ────────────────────────────────────────────────────────

/**
 * How a floor-plan entity was originally obtained.
 *
 * scanned         — measured by a native scan client (LiDAR / RoomPlan)
 * inferred        — derived algorithmically from other scan or survey data
 * manual          — entered or drawn by a user inside Atlas
 * imported_legacy — migrated from an older data format
 */
export type EntitySource = 'scanned' | 'inferred' | 'manual' | 'imported_legacy';

/**
 * Human review status for an imported entity.
 *
 * unreviewed  — imported but not yet inspected by a user
 * reviewed    — a user has confirmed the entity looks correct
 * corrected   — a user has edited the entity after import
 */
export type EntityReviewStatus = 'unreviewed' | 'reviewed' | 'corrected';

/**
 * Provenance metadata attached to any canonical floor-plan entity that was
 * not created directly by a user in Atlas.
 *
 * source              — how the entity was originally obtained
 * sourceBundleVersion — version of the scan contract that produced it (if scanned)
 * sourceBundleId      — unique ID of the originating scan bundle (if scanned)
 * confidence          — optional numeric confidence 0–1 (1 = fully certain)
 * confidenceBand      — banded confidence 'high' | 'medium' | 'low'
 * reviewStatus        — whether a user has inspected this entity
 *
 * All fields are optional so that provenance can be added incrementally
 * without invalidating existing PropertyPlan documents.
 */
export interface EntityProvenance {
  source: EntitySource;
  sourceBundleVersion?: string;
  sourceBundleId?: string;
  confidence?: number;
  confidenceBand?: 'high' | 'medium' | 'low';
  reviewStatus: EntityReviewStatus;
}

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

/** Emoji icon for each room type — used in inspector headings and quick-picks. */
export const ROOM_TYPE_EMOJI: Record<RoomType, string> = {
  living:        '🛋️',
  dining:        '🍽️',
  kitchen:       '🍳',
  bedroom:       '🛏️',
  bathroom:      '🚿',
  en_suite:      '🛁',
  hallway:       '🚪',
  landing:       '📐',
  utility:       '🔧',
  garage:        '🚗',
  study:         '📚',
  conservatory:  '🌿',
  loft:          '🏠',
  cupboard:      '🗄️',
  plant_room:    '⚙️',
  outside:       '🌳',
  other:         '❓',
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
  /** Provenance metadata — present when this entity was not created manually in Atlas. */
  provenance?: EntityProvenance;
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
  /** Provenance metadata — present when this entity was not created manually in Atlas. */
  provenance?: EntityProvenance;
}

export type OpeningType = 'door' | 'window';

export interface Opening {
  id: string;
  floorId: string;
  type: OpeningType;
  wallId: string;
  offsetM: number;
  widthM: number;
  /** Provenance metadata — present when this entity was not created manually in Atlas. */
  provenance?: EntityProvenance;
}

export interface Zone {
  id: string;
  floorId: string;
  label: string;
  polygon: Polygon;
}

// ─── Floor routes (PR10) ──────────────────────────────────────────────────────

/**
 * The type of pipe or service route drawn on the floor plan.
 *
 * flow        — primary heating flow
 * return      — primary heating return
 * hot         — domestic hot water supply
 * cold        — cold mains supply
 * condensate  — condensate drain
 * discharge   — discharge / expansion / PRV pipe
 */
export type FloorRouteType =
  | 'flow'
  | 'return'
  | 'hot'
  | 'cold'
  | 'condensate'
  | 'discharge';

/**
 * Whether the route is already installed, proposed by the engineer, or only
 * assumed based on heuristics / typical practice.
 */
export type FloorRouteStatus = 'existing' | 'proposed' | 'assumed';

export const FLOOR_ROUTE_TYPE_LABELS: Record<FloorRouteType, string> = {
  flow:       'Flow',
  return:     'Return',
  hot:        'Hot supply',
  cold:       'Cold supply',
  condensate: 'Condensate',
  discharge:  'Discharge',
};

/** Canvas stroke colours matching RoutesSection.tsx / EngineerLayout spec. */
export const FLOOR_ROUTE_TYPE_COLORS: Record<FloorRouteType, string> = {
  flow:       '#e53e3e',  // red
  return:     '#3182ce',  // blue
  hot:        '#ed8936',  // orange
  cold:       '#63b3ed',  // light blue / cyan
  condensate: '#718096',  // grey
  discharge:  '#d69e2e',  // amber
};

export const FLOOR_ROUTE_STATUS_LABELS: Record<FloorRouteStatus, string> = {
  existing: 'Existing',
  proposed: 'Proposed',
  assumed:  'Assumed',
};

/**
 * A pipe or service route drawn manually on the floor plan by the surveyor.
 *
 * Routes are first-class plan truth — they persist into PropertyPlan and are
 * fed directly into the engineer handoff (EngineerLayout.routes).
 *
 * No automatic pathfinding: all routes are manually authored.
 */
export interface FloorRoute {
  id: string;
  floorId: string;
  type: FloorRouteType;
  status: FloorRouteStatus;
  /** Ordered polyline points in canvas coordinates. */
  points: Point[];
  /** Optional reference to a FloorObject or PlacementNode at the route origin. */
  fromObjectId?: string;
  /** Optional reference to a FloorObject or PlacementNode at the route end. */
  toObjectId?: string;
  notes?: string;
  /** Provenance — always manual/corrected for user-drawn routes. */
  provenance?: EntityProvenance;
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
  /** Non-HVAC fixtures placed by survey (sinks, baths, showers, flues, etc.). */
  floorObjects?: FloorObject[];
  /**
   * Pipe and service routes drawn by the surveyor.
   * Layer 5 of the canonical model (PR10).
   */
  floorRoutes?: FloorRoute[];
  /**
   * True-north bearing for this floor plan in degrees clockwise from north
   * (0 = north, 90 = east, 180 = south, 270 = west).
   * Captured via the compass overlay on the floor plan editor.
   * Stored per-floor so multi-storey extensions can have independent orientations
   * if the building geometry requires it (usually all floors share the same value).
   */
  compassBearingDeg?: number;
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
  /** Rated heat output of this emitter at design conditions (kW). Only applicable to radiator_loop / ufh_loop nodes. */
  emitterOutputKw?: number;
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

/**
 * Semantic service type used for engineer-view labeling and PDF/print outputs.
 * More granular than ConnectionType — distinguishes primary from secondary
 * and labels DHW / cold-main runs explicitly.
 */
export type ServiceType =
  | 'primary_flow'
  | 'primary_return'
  | 'dhw_hot'
  | 'cold_main'
  | 'gas'
  | 'condensate'
  | 'prv'
  | 'control';

export type PipeSizeMm = 15 | 22 | 28 | 35;

export type InstallMethod = 'underfloor' | 'boxed' | 'surface' | 'void' | 'external';

export type RouteStatus = 'ok' | 'borderline' | 'upgrade_required';

export interface ConnectionPath {
  id: string;
  type: ConnectionType;
  fromNodeId: string;
  toNodeId: string;
  /** Ordered waypoints including start and end */
  route: Point[];
  routeMode: 'manual' | 'auto';
  /** Semantic service classification for engineer-view labels. */
  serviceType?: ServiceType;
  /** Nominal pipe bore in mm (15 / 22 / 28 / 35). */
  pipeSizeMm?: PipeSizeMm;
  /** How the run is physically installed. */
  installMethod?: InstallMethod;
  /** Calculated run length in metres (populated by deriveFloorplanOutputs). */
  lengthM?: number;
  /** Route health — ok, borderline velocity/pressure, or upgrade required. */
  status?: RouteStatus;
  /** Free-text engineer annotation for this segment (e.g. "floorboards lifted"). */
  annotation?: string;
}

// ─── Disruption / consequence annotations ─────────────────────────────────────

/**
 * Kind of physical disruption or access implication associated with a
 * pipe route or component placement.
 */
export type DisruptionKind =
  | 'floorLift'
  | 'boxing'
  | 'wallChase'
  | 'coreDrill'
  | 'externalRun';

export const DISRUPTION_KIND_LABELS: Record<DisruptionKind, string> = {
  floorLift:   'Floor lift',
  boxing:      'Boxing',
  wallChase:   'Wall chase',
  coreDrill:   'Core drill',
  externalRun: 'External run',
};

export const DISRUPTION_KIND_EMOJI: Record<DisruptionKind, string> = {
  floorLift:   '🪵',
  boxing:      '📦',
  wallChase:   '🔨',
  coreDrill:   '🔩',
  externalRun: '🌿',
};

/**
 * A consequence / disruption marker anchored to a specific canvas position.
 * Used to communicate installation implications to customers and engineers.
 */
export interface DisruptionAnnotation {
  id: string;
  kind: DisruptionKind;
  floorId: string;
  x: number;
  y: number;
  /** Optional free-text note (e.g. "floorboards lifted in hallway"). */
  note?: string;
}

// ─── View mode ────────────────────────────────────────────────────────────────

/**
 * Presentation mode for the floor plan.
 *
 * customer  — simplified labels, main routes and disruption emphasis.
 *             Language: "new cylinder here", "pipes likely under this floor".
 * engineer  — full dimensions, route labels, pipe sizes, run lengths,
 *             engineering notes and warnings.
 *             Language: "22mm primary F/R", "route via first-floor void".
 */
export type ViewMode = 'customer' | 'engineer';

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
  /**
   * Consequence / disruption annotations placed on the plan.
   * Layer 4 of the canonical model.
   */
  disruptions?: DisruptionAnnotation[];
  /**
   * Active presentation mode.  Drives which labels and layers are shown in
   * FloorPlanBuilder without changing the underlying data.
   */
  viewMode?: ViewMode;
  metadata: PropertyMetadata;
}

// ─── Validation types ─────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  layer: 'geometry' | 'placement' | 'connection';
  objectId?: string;
  objectType?: 'room' | 'wall' | 'opening' | 'node' | 'connection' | 'floor' | 'property';
  message: string;
}

// ─── Floor objects (non-HVAC fixtures) ───────────────────────────────────────

/**
 * Fixture types that can be placed on a floor plan independent of the
 * PlacementNode / lego heating palette.  Used by the object library panel
 * and ObjectInspectorPanel to capture survey truth for sinks, baths, etc.
 */
export type FloorObjectType =
  | 'boiler'
  | 'cylinder'
  | 'radiator'
  | 'sink'
  | 'bath'
  | 'shower'
  | 'flue'
  | 'other';

export const FLOOR_OBJECT_TYPE_LABELS: Record<FloorObjectType, string> = {
  boiler:   'Boiler',
  cylinder: 'Cylinder',
  radiator: 'Radiator',
  sink:     'Sink',
  bath:     'Bath',
  shower:   'Shower',
  flue:     'Flue',
  other:    'Other',
};

export const FLOOR_OBJECT_TYPE_EMOJI: Record<FloorObjectType, string> = {
  boiler:   '🔥',
  cylinder: '💧',
  radiator: '🌡️',
  sink:     '🚰',
  bath:     '🛁',
  shower:   '🚿',
  flue:     '🏭',
  other:    '📦',
};

/**
 * A physical fixture placed on the floor plan — distinct from a PlacementNode
 * (which models a heating-circuit component in the lego graph).
 *
 * FloorObjects capture the spatial truth of fixtures such as sinks, baths,
 * showers, and flues for engineer survey purposes.  They are not wired into
 * the heating topology graph but ARE part of the canonical PropertyPlan and
 * are consumed by the engineer handoff view.
 */
export interface FloorObject {
  id: string;
  floorId: string;
  type: FloorObjectType;
  /** Optional human-readable label (e.g. "Main bathroom sink"). */
  label?: string;
  /** Canvas x position of the object anchor. */
  x: number;
  /** Canvas y position of the object anchor. */
  y: number;
  /** Physical width in metres (along the wall / x-axis). */
  widthM?: number;
  /** Physical height in metres (depth from wall / y-axis). */
  heightM?: number;
  /** Physical depth in metres (only relevant for 3-D objects like cylinders). */
  depthM?: number;
  /** Room assignment (if known). */
  roomId?: string;
  /** Wall assignment — when the object is wall-mounted. */
  wallId?: string;
  /** Provenance metadata. Newly-created objects always carry source='manual'. */
  provenance?: EntityProvenance;
}

// ─── Editor tool modes ────────────────────────────────────────────────────────

export type EditorTool =
  | 'select'
  | 'addRoom'
  | 'drawWall'
  | 'addOpening'
  | 'placeNode'
  | 'connectRoute'
  | 'addDisruption'
  | 'addFloorRoute'
  | 'pan';

// ─── Selection model ──────────────────────────────────────────────────────────

export type SelectionTarget =
  | { kind: 'room';         id: string }
  | { kind: 'wall';         id: string }
  | { kind: 'opening';      id: string }
  | { kind: 'node';         id: string }
  | { kind: 'connection';   id: string }
  | { kind: 'disruption';   id: string }
  | { kind: 'floor_object'; id: string }
  | { kind: 'floor_route';  id: string };
