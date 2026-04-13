/**
 * installMarkup.types.ts
 *
 * Canonical install markup models consumed by the atlas-recommendation engine.
 *
 * These types mirror the definitions from atlas-contracts
 * (InstallObjectModelV1, InstallRouteModelV1, InstallLayerModelV1) and are
 * the authoritative local types for this repo until the @atlas/contracts
 * package publishes them.
 *
 * Pipeline position:
 *   atlas-scans-ios (captures)
 *   → atlas-contracts (canonical schema)
 *   → atlas-recommendation (consumes) ← this layer
 *
 * Design rules:
 * - These types are input-only; the engine must not write back to them.
 * - All spatial coordinates are in metres (not canvas units).
 * - `confidence` always reflects how the geometry was obtained.
 * - `source` on InstallObjectModelV1 describes how the object was placed.
 */

// ─── Primitives ────────────────────────────────────────────────────────────────

/**
 * A 3-D world-space point in metres.
 * X/Y are floor-plan axes; Z is vertical (height above finished floor level).
 */
export interface InstallPoint3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Object dimensions in metres.
 */
export interface InstallDimensions {
  widthM: number;
  heightM: number;
  depthM: number;
}

// ─── Install objects ──────────────────────────────────────────────────────────

/**
 * The type of appliance or fitting placed during markup.
 */
export type InstallObjectType =
  | 'boiler'
  | 'cylinder'
  | 'radiator'
  | 'heat_pump'
  | 'pump'
  | 'valve'
  | 'header_tank'
  | 'expansion_vessel'
  | 'buffer_vessel'
  | 'manifold';

/**
 * How the object position was determined.
 *
 * 'scan'     — position derived from LiDAR / RoomPlan scan data.
 * 'manual'   — engineer placed the object by gesture on the floor plan.
 * 'inferred' — position inferred from surrounding context (e.g. existing flue).
 */
export type InstallObjectSource = 'scan' | 'manual' | 'inferred';

/**
 * A single piece of heating equipment placed on the install plan.
 *
 * V1 canonical shape — mirrors InstallObjectModelV1 in atlas-contracts.
 */
export interface InstallObjectModelV1 {
  /** Stable identifier unique within a layer. */
  id: string;
  /** Appliance / fitting type. */
  type: InstallObjectType;
  /** World-space centre of the object (metres). */
  position: InstallPoint3D;
  /** Physical dimensions (metres). */
  dimensions: InstallDimensions;
  /** Compass bearing in degrees (0 = north / top of plan, clockwise). */
  orientationDeg: number;
  /** How the position was determined. */
  source: InstallObjectSource;
}

// ─── Install routes ───────────────────────────────────────────────────────────

/**
 * The hydraulic or service purpose of a pipe run.
 *
 * 'flow'    — primary heating flow (hot water leaving the heat source).
 * 'return'  — primary heating return.
 * 'gas'     — gas supply pipe.
 * 'dhw'     — domestic hot water distribution.
 * 'cold'    — cold water supply.
 * 'flue'    — flue or exhaust duct.
 * 'condensate' — condensate drain from condensing boiler.
 */
export type InstallRouteKind =
  | 'flow'
  | 'return'
  | 'gas'
  | 'dhw'
  | 'cold'
  | 'flue'
  | 'condensate';

/**
 * How the pipe run is mounted/routed through the building.
 *
 * 'surface'  — exposed on wall or floor surface.
 * 'boxed'    — enclosed in a boxing / duct.
 * 'buried'   — buried in screed or plaster.
 * 'void'     — running through a floor/ceiling void.
 * 'external' — external to the building envelope.
 */
export type InstallMounting =
  | 'surface'
  | 'boxed'
  | 'buried'
  | 'void'
  | 'external';

/**
 * The confidence level of a route's spatial geometry.
 *
 * 'measured' — length derived from scan data or known reference dimensions.
 * 'drawn'    — engineer traced the route by hand on the floor plan.
 * 'estimated'— length inferred from room/building dimensions.
 */
export type InstallRouteConfidence = 'measured' | 'drawn' | 'estimated';

/**
 * A single vertex in a pipe route path.
 */
export interface InstallPathPoint {
  /** World-space position in metres. */
  position: InstallPoint3D;
  /** Optional label for this node (e.g. 'elbow', 'tee', 'radiator_connection'). */
  label?: string;
}

/**
 * A single pipe / duct run on the install plan.
 *
 * V1 canonical shape — mirrors InstallRouteModelV1 in atlas-contracts.
 */
export interface InstallRouteModelV1 {
  /** Stable identifier unique within a layer. */
  id: string;
  /** Hydraulic / service purpose of this run. */
  kind: InstallRouteKind;
  /** Nominal pipe bore in millimetres (e.g. 15, 22, 28). */
  diameterMm: number;
  /** Ordered list of points tracing the route. Minimum 2 points. */
  path: InstallPathPoint[];
  /** How the pipe is routed through the building fabric. */
  mounting: InstallMounting;
  /** Confidence in the spatial accuracy of the path. */
  confidence: InstallRouteConfidence;
}

// ─── Annotations ─────────────────────────────────────────────────────────────

/**
 * A free-text or structured note attached to a position on the plan.
 */
export interface InstallAnnotation {
  /** Unique identifier. */
  id: string;
  /** World-space anchor position. */
  position: InstallPoint3D;
  /** Annotation text. */
  text: string;
}

// ─── Install layer ────────────────────────────────────────────────────────────

/**
 * A layered view of a property's install state.
 *
 * Separates existing and proposed systems so the engine can derive:
 *   - what is already there (existing)
 *   - what the new installation requires (proposed)
 *   - how much they overlap (reuse)
 *
 * V1 canonical shape — mirrors InstallLayerModelV1 in atlas-contracts.
 */
export interface InstallLayerModelV1 {
  /** Existing system routes and objects (captured from scan or survey). */
  existing: {
    objects: InstallObjectModelV1[];
    routes: InstallRouteModelV1[];
  };
  /** Proposed new routes and objects for the recommended system. */
  proposed: {
    objects: InstallObjectModelV1[];
    routes: InstallRouteModelV1[];
  };
  /** Plan-level annotations (e.g. access notes, obstructions). */
  notes: InstallAnnotation[];
}
