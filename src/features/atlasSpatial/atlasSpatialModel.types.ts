/**
 * atlasSpatialModel.types.ts
 *
 * AtlasSpatialModelV1 — the canonical editable property model.
 *
 * Pipeline position:
 *   SessionCaptureV1 (iOS capture)
 *   → AtlasSpatialModelV1  ← this layer
 *   → HeatLossModelV1
 *   → recommendation / report / portal outputs
 *
 * Design rules:
 * - SessionCaptureV1 is observational only; Atlas editor fields must not be
 *   written back to capture data.
 * - AtlasSpatialModelV1 is the corrected, enriched model produced by the
 *   Atlas floor plan editor.
 * - HeatLossModelV1 is derived; never store calculation results in this model.
 * - Rooms hold customer-friendly labels; ThermalZones hold calculation-grade
 *   geometry and fabric data.
 *
 * Key concepts:
 * - One Room contains one or more ThermalZones (default: one zone = whole room).
 * - Emitters are assigned at zone level but also carry their parent roomId for
 *   quick lookup.
 * - Boundaries classify wall segments as external / party / internal-heated /
 *   internal-unheated so heat-loss calculations can apply the correct U-value.
 */

// ─── Geometry primitives ──────────────────────────────────────────────────────

/**
 * Canvas-space point.  Canvas units: 24 units per metre (GRID = 24).
 */
export interface SpatialPoint {
  x: number;
  y: number;
}

/**
 * Axis-aligned bounding box for a room or zone, in canvas units.
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Optional geometry descriptor for a room — directly mirrors the canvas
 * bounding-box stored in the PropertyPlan Room entity.
 */
export interface RoomGeometry {
  /** Floor identifier this room lives on. */
  floorId: string;
  /** Canvas bounding box (24 canvas units = 1 metre). */
  boundingBox: BoundingBox;
}

/**
 * Optional geometry descriptor for a thermal zone.
 * A zone is typically a subset of its parent room.
 * polygon takes precedence over boundingBox when both are provided.
 */
export interface ZoneGeometry {
  /** Floor identifier (inherited from parent room when omitted). */
  floorId?: string;
  /** Ordered polygon vertices defining the zone boundary. */
  polygon?: SpatialPoint[];
  /** Axis-aligned fallback when no polygon is available. */
  boundingBox?: BoundingBox;
}

// ─── Room ─────────────────────────────────────────────────────────────────────

/**
 * Completion status of an Atlas room entity.
 *
 * draft    — imported or sketched but not yet reviewed by the engineer.
 * complete — reviewed and confirmed correct (geometry, label, zones).
 */
export type AtlasRoomStatus = 'draft' | 'complete';

/**
 * Customer-visible room in the Atlas spatial model.
 *
 * AtlasRoomV1 is the "human room" — what the householder or engineer refers
 * to by name.  Heat-loss calculations are performed at ThermalZone level and
 * rolled up to the room.
 */
export interface AtlasRoomV1 {
  /** Stable identifier for this room. */
  roomId: string;
  /** Human-readable room name, e.g. "Lounge", "Kitchen Diner". */
  label: string;
  /** Editorial status. */
  status: AtlasRoomStatus;
  /**
   * Semantic room type inherited from the floor plan Room entity.
   * Drives default design temperature and heat-loss assumptions.
   */
  roomType: string;
  /** Canvas geometry sourced from the floor plan editor. */
  geometry?: RoomGeometry;
  /** IDs of ThermalZones that cover this room. */
  zoneIds: string[];
}

// ─── Thermal zone ─────────────────────────────────────────────────────────────

/**
 * Wall construction category for U-value lookup.
 *
 * cavity_uninsulated is treated as a high heat-loss band — identical penalty
 * to solid_masonry per the physics rules in custom-instruction §Wall Types.
 */
export type WallConstructionType =
  | 'solid_masonry'
  | 'cavity_uninsulated'
  | 'cavity_insulated'
  | 'cavity_full_fill'
  | 'timber_frame'
  | 'unknown';

/**
 * Thermal sub-zone within a room.
 *
 * AtlasThermalZoneV1 is the calculation unit.  A single "Lounge" room may
 * contain a north-window zone and an internal rear zone, each with its own
 * exposure profile and emitter assignment.
 *
 * When a room has no explicit sub-zones, a single default zone is created
 * by buildAtlasSpatialModel() that covers the full room footprint.
 */
export interface AtlasThermalZoneV1 {
  /** Stable identifier for this zone. */
  zoneId: string;
  /** Parent room identifier. */
  roomId: string;
  /** Descriptive label, e.g. "Lounge – north window zone". */
  label: string;
  /** Zone geometry (falls back to room geometry when absent). */
  geometry?: ZoneGeometry;

  // ── Design conditions ──────────────────────────────────────────────────

  /**
   * Indoor design temperature for this zone (°C).
   * Defaults to the BS EN 12831 reference value for the room type when absent.
   * Living: 21 °C · Bedroom: 18 °C · Bathroom: 22 °C · Other: 21 °C.
   */
  designTempC?: number;

  // ── Fabric inputs (override physics from captured geometry) ────────────

  /** Floor area in m² (derived from geometry when absent). */
  floorAreaM2?: number;
  /** Clear ceiling height in m. */
  heightM?: number;
  /**
   * Length of perimeter exposed to outdoor conditions (m).
   * Derived from geometry and adjacency when absent.
   */
  exposedPerimeterM?: number;
  /** Wall construction type for U-value look-up. */
  wallConstruction?: WallConstructionType;
  /** Override for external wall U-value (W/m²K). */
  wallUValueOverride?: number;
  /** Total glazing area (all windows) in m². */
  windowAreaM2?: number;
  /** Window U-value (W/m²K); defaults to standard double-glazed value. */
  windowUValue?: number;

  // ── Emitter assignments ────────────────────────────────────────────────

  /** IDs of emitters serving this zone. */
  emitterIds: string[];
}

// ─── Emitter ──────────────────────────────────────────────────────────────────

/**
 * Physical emitter type classification.
 *
 * radiator — panel or cast-iron radiator.
 * ufh      — underfloor heating (wet or electric).
 * other    — fan convector, heated towel rail, or unclassified.
 */
export type AtlasEmitterType = 'radiator' | 'ufh' | 'other';

/**
 * A heat-emitting device assigned to a room and optionally to a zone.
 *
 * Emitters are linked back to their PlacementNode in the PropertyPlan via
 * objectId so that the floor plan editor and heat-loss model stay in sync.
 */
export interface AtlasEmitterV1 {
  /** Stable identifier for this emitter. */
  emitterId: string;
  /**
   * Linked PlacementNode id in the originating PropertyPlan.
   * Present when the emitter was derived from a floor-plan node.
   */
  objectId?: string;
  /** Parent room identifier. */
  roomId: string;
  /** Zone assignment — null means the emitter covers the whole room. */
  zoneId?: string;
  /** Emitter category. */
  type: AtlasEmitterType;
  /**
   * Rated heat output at ΔT50 (W) — standard UK radiator test condition.
   * Used to derive output at design flow temperatures via correction curves.
   */
  outputWattsAtDt50?: number;
  /**
   * Calculated heat output at the system design flow temperature (W).
   * Populated by the heat-loss calculation layer when design conditions are known.
   */
  outputWattsAtDesign?: number;
}

// ─── Opening ──────────────────────────────────────────────────────────────────

/**
 * A door or window in the spatial model.
 *
 * Openings reduce the opaque wall area used in heat-loss calculations and
 * contribute their own glazing/door U-value area.
 */
export interface AtlasOpeningV1 {
  /** Stable identifier for this opening. */
  openingId: string;
  /** Room that contains this opening (on the internal face). */
  roomId?: string;
  /** Source wall identifier from the PropertyPlan. */
  wallId?: string;
  /** Opening type. */
  type: 'door' | 'window';
  /** Clear opening width (m). */
  widthM: number;
  /** Clear opening height (m) — estimated when absent. */
  heightM?: number;
}

// ─── Boundary ─────────────────────────────────────────────────────────────────

/**
 * Thermal character of a wall segment.
 *
 * external          — separates the heated space from the outdoors.
 * internal_heated   — separates two heated spaces (no heat loss across it).
 * internal_unheated — separates a heated space from an unheated space
 *                     (garage, loft); reduced heat loss applies.
 * party             — shared wall with an adjacent property (negligible loss).
 */
export type BoundaryKind =
  | 'external'
  | 'internal_heated'
  | 'internal_unheated'
  | 'party';

/**
 * A classified boundary segment (one or more wall IDs sharing the same
 * thermal character) between two spaces.
 */
export interface AtlasBoundaryV1 {
  /** Stable identifier for this boundary segment. */
  boundaryId: string;
  /** Thermal character of this boundary. */
  kind: BoundaryKind;
  /** Wall IDs from the PropertyPlan that make up this boundary. */
  wallIds: string[];
}

// ─── Spatial alignment — world positioning ────────────────────────────────────

/**
 * Absolute world-space position on the site local grid.
 *
 * Axes: x = east (metres), y = north (metres), z = height above ground (metres).
 * confidence distinguishes surveyed data from geometry-inferred estimates.
 * source records where the position came from so it can be displayed correctly
 * in the UI (solid = confirmed, dashed = inferred).
 */
export interface AtlasWorldPosition {
  /** East offset in metres on the local site grid. */
  x: number;
  /** North offset in metres on the local site grid. */
  y: number;
  /** Height above ground floor datum in metres. */
  z: number;
  /**
   * Confidence band.
   * confirmed — measured or directly placed by the engineer.
   * inferred  — derived from geometry, adjacency, or heuristic logic.
   */
  confidence: 'confirmed' | 'inferred';
  /**
   * Data source.
   * lidar   — captured by the LiDAR scan pipeline.
   * manual  — placed by the engineer in the Atlas editor.
   * derived — computed from other anchors or routing logic.
   */
  source: 'lidar' | 'manual' | 'derived';
}

/**
 * A named, positioned object of interest within the building.
 *
 * Anchors are the unit of reference for the Spatial Alignment View: engineers
 * can stand anywhere in (or outside) the building and see the relative
 * position of each anchor.
 *
 * Built-in labels: "boiler" | "cylinder" | "consumer_unit" | "pump" | "header"
 * Custom labels are also permitted.
 */
export interface AtlasAnchor {
  /** Stable identifier for this anchor. */
  id: string;
  /** Human-readable label shown in the Alignment View, e.g. "boiler". */
  label: string;
  /** Absolute world position of this anchor. */
  worldPosition: AtlasWorldPosition;
  /** Optional parent room identifier for context. */
  roomId?: string;
}

/**
 * A computed vertical relationship between two anchors.
 *
 * Populated by SpatialAlignmentEngine.buildAlignmentInsights() and used by the
 * Alignment View to draw vertical stack lines between objects.
 */
export interface AtlasVerticalRelation {
  /** Source anchor ID. */
  fromAnchorId: string;
  /** Target anchor ID. */
  toAnchorId: string;
  /** Absolute vertical separation in metres (always positive). */
  verticalDistanceM: number;
  /** Whether the target is above, below, or at the same level as the source. */
  relation: 'above' | 'below' | 'same_level';
}

/**
 * An inferred pipe, cable, or flue route derived from anchor positions.
 *
 * IMPORTANT: inferred routes must NEVER be presented as surveyed fact.
 * Each route must carry a human-readable `reason` string explaining how the
 * path was derived so that engineers can review and correct it.
 *
 * confidence is always 'inferred' — confirmed routes are stored as explicit
 * measurements in the capture layer, not here.
 */
export interface AtlasInferredRoute {
  /** Stable identifier for this route. */
  id: string;
  /** Service type. */
  type: 'pipe' | 'cable' | 'flue';
  /** Ordered waypoints describing the route path. */
  path: AtlasWorldPosition[];
  /** Always 'inferred' — see type doc above. */
  confidence: 'inferred';
  /**
   * Human-readable derivation reason, e.g.
   * "Aligned kitchen tap + boiler position + standard routing"
   */
  reason: string;
}

// ─── Top-level model ──────────────────────────────────────────────────────────

/**
 * AtlasSpatialModelV1
 *
 * The corrected, enriched property model produced and edited by the Atlas
 * floor plan editor.  Sits between observational capture data and derived
 * heat-loss results.
 *
 * Separation of concerns:
 *  - SessionCaptureV1 — observational capture (iOS scan / voice notes)
 *  - AtlasSpatialModelV1 — corrected geometry, zone structure, emitter
 *    assignments, fabric data (this type)
 *  - HeatLossModelV1 — calculated results derived from this model
 */
export interface AtlasSpatialModelV1 {
  version: '1.0';
  /** Property identifier shared across all layers in the pipeline. */
  propertyId: string;
  /** Source session ID from the capture app (SessionCaptureV1.id). */
  sourceSessionId?: string;
  /** Customer-visible rooms (human room labels). */
  rooms: AtlasRoomV1[];
  /** Thermal sub-zones within rooms (calculation units). */
  zones: AtlasThermalZoneV1[];
  /** Heat emitters assigned to rooms and zones. */
  emitters: AtlasEmitterV1[];
  /** Doors and windows derived from or added to the floor plan. */
  openings: AtlasOpeningV1[];
  /** Classified wall-segment boundaries. */
  boundaries: AtlasBoundaryV1[];

  // ── Spatial alignment fields (optional — populated progressively) ──────────

  /**
   * Named positioned objects in the building (boiler, cylinder, etc.).
   * Used by the Spatial Alignment View to show relative positions.
   */
  anchors?: AtlasAnchor[];
  /**
   * Computed vertical relationships between anchors.
   * Populated by SpatialAlignmentEngine after anchors are placed.
   */
  verticalRelations?: AtlasVerticalRelation[];
  /**
   * Geometry-inferred service routes (pipes, cables, flues).
   * Always marked confidence:'inferred' — never rendered as confirmed.
   */
  inferredRoutes?: AtlasInferredRoute[];
  /**
   * Optional geographic origin of the local site grid.
   * Used when correlating with external mapping data.
   */
  buildingOrigin?: {
    lat?: number;
    lng?: number;
  };
}
