/**
 * installMarkup.types.ts
 *
 * Local install markup model types for the atlas-recommendation engine.
 *
 * These types mirror the canonical schema defined in atlas-contracts
 * (InstallObjectModelV1, InstallRouteModelV1, InstallLayerModelV1) and will be
 * replaced by direct imports from @atlas/contracts once that package publishes
 * the install markup module.
 *
 * The types define the structured, spatially-anchored output produced by the
 * atlas-scans-ios capture layer and consumed here for recommendation reasoning.
 */

// ─── Spatial primitives ───────────────────────────────────────────────────────

/**
 * A 2D point in the install plan coordinate space.
 * Units: metres, relative to a room or building origin.
 */
export interface InstallPoint2D {
  /** Horizontal position (metres). */
  x: number;
  /** Vertical position (metres). */
  y: number;
}

/**
 * A 3D point in the install plan coordinate space.
 * Units: metres.
 */
export interface InstallPoint3D {
  /** Horizontal position (metres). */
  x: number;
  /** Depth/vertical position (metres). */
  y: number;
  /** Height above floor (metres). */
  z: number;
}

// ─── Install objects ──────────────────────────────────────────────────────────

/**
 * The type of plant item placed in the install layout.
 */
export type InstallObjectType =
  | 'boiler'
  | 'cylinder'
  | 'radiator'
  | 'heat_pump'
  | 'buffer_tank'
  | 'valve'
  | 'pump'
  | 'other';

/**
 * How a placed object was located in the install plan.
 *
 *   scan     — position derived from a RoomPlan / LiDAR capture.
 *   manual   — placed by the engineer via gesture-based UI.
 *   inferred — position estimated by the engine from survey inputs.
 */
export type InstallObjectSource = 'scan' | 'manual' | 'inferred';

/**
 * Dimensions of an installed object (metres).
 */
export interface InstallObjectDimensions {
  widthM: number;
  heightM: number;
  depthM: number;
}

/**
 * A single installed or proposed plant item with spatial context.
 *
 * V1 of the canonical InstallObjectModel as defined by atlas-contracts.
 */
export interface InstallObjectModelV1 {
  /** Stable identifier unique within the layer. */
  id: string;
  /** What kind of plant item this is. */
  type: InstallObjectType;
  /** Centre-point of the object in the room / building coordinate space. */
  position: InstallPoint3D;
  /** Physical bounding dimensions. Optional — not always known at capture time. */
  dimensions?: InstallObjectDimensions;
  /** Rotation around the vertical axis, degrees clockwise from north. */
  orientationDeg?: number;
  /** How this object's position was determined. */
  source: InstallObjectSource;
}

// ─── Install routes ───────────────────────────────────────────────────────────

/**
 * The service carried by a pipe route.
 *
 *   flow    — primary circuit flow (heat delivery).
 *   return  — primary circuit return.
 *   gas     — gas supply.
 *   dhw     — domestic hot water distribution.
 *   cold    — cold water supply.
 *   flue    — flue / exhaust.
 */
export type InstallRouteKind =
  | 'flow'
  | 'return'
  | 'gas'
  | 'dhw'
  | 'cold'
  | 'flue';

/**
 * How the pipe is mounted / concealed.
 *
 *   surface — exposed on wall or floor surface.
 *   boxed   — within a surface-mounted boxing / duct.
 *   buried  — within screed, wall render, or structural fabric.
 *   ceiling — run above ceiling (floor void or loft).
 */
export type InstallRouteMounting =
  | 'surface'
  | 'boxed'
  | 'buried'
  | 'ceiling';

/**
 * How accurately the route geometry was captured.
 *
 *   measured — derived from scan / ArUco-scaled photo; sub-10 cm accuracy.
 *   drawn    — engineer-drawn on floor plan; accuracy ~ ±0.5 m.
 *   estimated — inferred by the engine; no direct spatial measurement.
 */
export type InstallRouteConfidence =
  | 'measured'
  | 'drawn'
  | 'estimated';

/**
 * An ordered sequence of 2D waypoints defining a pipe route path.
 * Each consecutive pair of points forms a straight run.
 */
export type PathPoint = InstallPoint2D;

/**
 * A single pipe run (existing or proposed) between two points or objects.
 *
 * V1 of the canonical InstallRouteModel as defined by atlas-contracts.
 */
export interface InstallRouteModelV1 {
  /** Stable identifier unique within the layer. */
  id: string;
  /** Service type carried by this pipe. */
  kind: InstallRouteKind;
  /**
   * Internal bore diameter (mm).
   * Standard domestic values: 15, 22, 28. Null when unknown.
   */
  diameterMm: number | null;
  /**
   * Ordered waypoints defining the route path.
   * At least two points (start, end) required.
   */
  path: PathPoint[];
  /** How the pipe is physically mounted or concealed. */
  mounting: InstallRouteMounting;
  /** How this route's geometry was obtained. */
  confidence: InstallRouteConfidence;
  /** Optional free-text note for the engineer (not used in engine reasoning). */
  note?: string;
}

// ─── Annotations ─────────────────────────────────────────────────────────────

/**
 * A text or flag annotation on the install plan.
 */
export interface InstallAnnotation {
  id: string;
  /** Position in plan coordinates. */
  position: InstallPoint2D;
  text: string;
}

// ─── Layered install model ────────────────────────────────────────────────────

/**
 * The full layered install plan for a property.
 *
 * Separates what exists now (existing) from what is proposed (proposed).
 * Both layers share the same coordinate space, making before/after comparisons
 * straightforward.
 *
 * V1 of the canonical InstallLayerModel as defined by atlas-contracts.
 */
export interface InstallLayerModelV1 {
  /** Existing pipe routes and objects — captured from the current installation. */
  existing: {
    objects: InstallObjectModelV1[];
    routes: InstallRouteModelV1[];
  };
  /** Proposed pipe routes and objects — drawn or inferred for the new system. */
  proposed: {
    objects: InstallObjectModelV1[];
    routes: InstallRouteModelV1[];
  };
  /** Engineer annotations (e.g. access notes, flagged constraints). */
  notes: InstallAnnotation[];
}

// ─── Engine-derived analysis ──────────────────────────────────────────────────

/**
 * Install complexity band derived from route geometry.
 *
 *   low    — short runs, straight lines, all surface-mounted; minimal disruption.
 *   medium — moderate length or one buried / boxed section; some disruption.
 *   high   — long runs, multiple direction changes, buried sections; high disruption.
 */
export type InstallComplexityBand = 'low' | 'medium' | 'high';

/**
 * Engine-derived complexity assessment for the proposed install.
 */
export interface InstallComplexityV1 {
  band: InstallComplexityBand;
  /** Total linear metres of proposed pipe routes. */
  totalRouteLengthM: number;
  /** Number of direction changes (bends) in proposed routes. */
  totalBendCount: number;
  /** Number of proposed route segments that are buried or boxed (not surface). */
  concealedSegmentCount: number;
  /** Human-readable summary for use in recommendations and reports. */
  summary: string;
}

/**
 * Material quantity estimates derived from proposed route lengths and objects.
 */
export interface InstallMaterialEstimateV1 {
  /** Total metres of 15 mm copper pipe required. */
  pipe15mmM: number;
  /** Total metres of 22 mm copper pipe required. */
  pipe22mmM: number;
  /** Total metres of 28 mm copper pipe required. */
  pipe28mmM: number;
  /** Total metres of pipe where diameter is unknown or mixed. */
  pipeUnknownM: number;
}

/**
 * Signals describing the disruption a proposed install will cause to the property.
 */
export interface InstallDisruptionSignalV1 {
  /** True when any proposed route passes through a buried / screed section. */
  hasBuriedRoutes: boolean;
  /** True when any proposed route is concealed in boxing (visible but enclosed). */
  hasBoxedRoutes: boolean;
  /** Whether new pipework closely follows the existing routing (lower disruption). */
  alignsWithExistingRoutes: boolean;
  /**
   * Disruption score 0–10 (higher = more disruptive).
   * Derived from route length, buried/boxed proportions, and bend count.
   */
  disruptionScore: number;
}

/**
 * Top-level install markup analysis attached to the engine output.
 *
 * Derived from InstallLayerModelV1 by InstallMarkupModule and attached to
 * EngineOutputV1 as `installMarkupAnalysis`.
 */
export interface InstallMarkupAnalysisV1 {
  /** Whether install markup input was present and used. */
  hasMarkup: boolean;
  /** Install complexity derived from proposed route geometry. */
  complexity: InstallComplexityV1;
  /** Material quantity estimates for the proposed install. */
  materials: InstallMaterialEstimateV1;
  /** Property disruption signals for the proposed install. */
  disruption: InstallDisruptionSignalV1;
  /**
   * One or more install insight strings for use in recommendation copy.
   * Examples:
   *   "This option requires complex routing (buried sections detected)."
   *   "This option closely follows existing pipework — lower disruption expected."
   */
  insights: string[];
}
