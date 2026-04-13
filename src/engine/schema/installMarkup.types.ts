/**
 * installMarkup.types.ts
 *
 * Canonical install markup models consumed by the atlas-recommendation engine.
 *
 * These types mirror the contracts defined in atlas-contracts
 * (InstallObjectModelV1, InstallRouteModelV1, InstallLayerModelV1) and must be
 * kept in sync with that package as it evolves.
 *
 * Separation of concerns:
 *   atlas-scans-ios  — produces InstallObjectModelV1 + InstallRouteModelV1
 *   atlas-contracts  — defines the canonical schema (source of truth)
 *   atlas-recommendation — consumes these models for complexity / disruption
 *                          signals and recommendation reasoning (this layer)
 *
 * Engine rules:
 *   - These types are input-only; never write engine results back into them.
 *   - The engine MUST NOT guess routes — all route data must originate from
 *     a scan or measured markup source.
 *   - confidence fields determine how much weight the engine places on the data.
 */

// ─── Geometry ─────────────────────────────────────────────────────────────────

/**
 * A 3-D point in real-world space (metres).
 * Origin is typically the property reference point (e.g. front-door corner).
 */
export interface PathPoint {
  x: number;
  y: number;
  /** Elevation above floor level (m). Absent = floor level (0). */
  z?: number;
}

// ─── Install objects ──────────────────────────────────────────────────────────

/**
 * Category of a placed install object.
 */
export type InstallObjectType =
  | 'boiler'
  | 'cylinder'
  | 'radiator'
  | 'pump'
  | 'valve'
  | 'header'
  | 'other';

/**
 * How the object placement was determined.
 */
export type InstallObjectSource = 'scan' | 'manual' | 'inferred';

/**
 * A spatially-anchored, placed heating or hot-water install object.
 *
 * Produced by atlas-scans-ios; consumed by the engine for feasibility and
 * recommendation reasoning (e.g. cylinder space checks, boiler flue routing).
 */
export interface InstallObjectModelV1 {
  /** Stable identifier, unique within an InstallLayerModelV1. */
  id: string;
  /** Object category. */
  type: InstallObjectType;
  /** Real-world position (m) relative to the property reference point. */
  position: PathPoint;
  /** Bounding dimensions (m). All axes are optional — absent = unknown. */
  dimensions?: {
    widthM?: number;
    heightM?: number;
    depthM?: number;
  };
  /** Orientation in degrees clockwise from north (0 = front face north). */
  orientationDeg?: number;
  /** How this placement was derived. */
  source: InstallObjectSource;
}

// ─── Install routes ───────────────────────────────────────────────────────────

/**
 * The hydraulic or gas purpose of a pipe or duct run.
 */
export type RouteKind =
  | 'flow'
  | 'return'
  | 'gas'
  | 'condensate'
  | 'cold_water'
  | 'hot_water'
  | 'overflow'
  | 'flue';

/**
 * How the pipework is mounted / concealed.
 *
 * surface  — exposed on wall surface (quick, visible, minimal disruption)
 * boxed    — boxed in with timber / plasterboard (moderate disruption)
 * chased   — chased into masonry (high disruption, invisible result)
 * screed   — buried under screed floor (very high disruption)
 */
export type RouteMounting = 'surface' | 'boxed' | 'chased' | 'screed';

/**
 * How confidently the route path is known.
 *
 * measured  — spatially anchored via LiDAR / ArUco scan (highest trust)
 * drawn     — engineer-drawn on floor plan with reference dimensions
 * estimated — engine-inferred from object positions (lowest trust)
 */
export type RouteConfidence = 'measured' | 'drawn' | 'estimated';

/**
 * A single pipe or duct run between two points, with full spatial and
 * semantic metadata.
 *
 * The engine uses this to derive:
 *   - total run length (Σ segment lengths)
 *   - complexity score (bends, branches, mounting transitions)
 *   - disruption band (mounting type distribution)
 *   - material estimates (length × diameter per kind)
 */
export interface InstallRouteModelV1 {
  /** Stable identifier, unique within an InstallLayerModelV1. */
  id: string;
  /** Hydraulic/gas purpose. */
  kind: RouteKind;
  /** Internal bore diameter (mm). Absent = unknown (engine uses heuristic default). */
  diameterMm?: number;
  /**
   * Ordered list of path vertices (real-world metres).
   * Minimum 2 points (start + end). Additional intermediate points define bends.
   * Straight runs have exactly 2 points; multi-segment runs have 3+.
   */
  path: PathPoint[];
  /** Mounting / concealment method. */
  mounting: RouteMounting;
  /** Confidence in the path geometry. */
  confidence: RouteConfidence;
}

// ─── Install layers ───────────────────────────────────────────────────────────

/**
 * An annotation attached to a layer — plain-text surveyor note with an
 * optional spatial anchor point.
 */
export interface InstallAnnotation {
  /** Stable identifier. */
  id: string;
  /** Annotation text. */
  text: string;
  /** Spatial anchor for the annotation (optional). */
  position?: PathPoint;
}

/**
 * A layered view of install intent, separating existing pipework from the
 * proposed installation.
 *
 * The engine uses both layers to detect:
 *   - alignment opportunities (proposed route follows existing → lower disruption)
 *   - conflict zones (proposed route crosses existing → complexity risk)
 *   - net new pipework (proposed not shadowed by existing → full disruption cost)
 */
export interface InstallLayerModelV1 {
  /** Stable identifier for this layer set. */
  id: string;
  /**
   * Existing pipework and objects currently installed in the property.
   * Absence of a route here means the engine cannot detect alignment savings.
   */
  existing: {
    objects: InstallObjectModelV1[];
    routes: InstallRouteModelV1[];
  };
  /**
   * Proposed new pipework and objects as designed by the engineer.
   * The complexity module operates primarily on this layer.
   */
  proposed: {
    objects: InstallObjectModelV1[];
    routes: InstallRouteModelV1[];
  };
  /** Surveyor notes spatially anchored to the plan. */
  annotations: InstallAnnotation[];
}

// ─── Top-level input container ────────────────────────────────────────────────

/**
 * InstallMarkupV1 — the install markup input to the recommendation engine.
 *
 * Populated from atlas-scans-ios via atlas-contracts.
 * Optional in EngineInputV2_3: when absent, the engine makes no install-geometry
 * assumptions and all install-complexity signals default to 'unknown'.
 */
export interface InstallMarkupV1 {
  version: '1.0';
  /** Identifier of the originating scan session (SessionCaptureV1.id). */
  sourceSessionId?: string;
  /**
   * One layer set per storey or logical area of the property.
   * Most residential installations will have a single layer set.
   */
  layers: InstallLayerModelV1[];
}

// ─── Complexity result types ──────────────────────────────────────────────────

/**
 * Per-route-kind material estimate derived by InstallComplexityModule.
 */
export interface RouteMaterialEstimate {
  kind: RouteKind;
  /** Total run length (m) across all routes of this kind. */
  totalLengthM: number;
  /** Weighted average bore diameter (mm). */
  avgDiameterMm: number;
}

/**
 * Disruption band for the proposed installation.
 *
 * low      — majority of routes are surface-mounted; minimal enabling works
 * moderate — mixed surface and boxed; some carpentry/decoration required
 * high     — significant chased or screed sections; masonry / floor works likely
 * unknown  — no markup available; engine cannot assess disruption from geometry
 */
export type InstallDisruptionBand = 'low' | 'moderate' | 'high' | 'unknown';

/**
 * Alignment signal: whether proposed routes follow existing pipework.
 *
 * aligned     — majority of proposed length runs alongside existing routes
 * partial     — some alignment with existing pipework
 * new_routing — proposed routes diverge from existing (full disruption cost)
 * unknown     — no existing layer to compare against
 */
export type InstallAlignmentSignal = 'aligned' | 'partial' | 'new_routing' | 'unknown';

/**
 * Complete install complexity result emitted by runInstallComplexityModule.
 * Attached to EngineOutputV1.installComplexity when installMarkup is present.
 */
export interface InstallComplexityResultV1 {
  /**
   * Whether install markup was present in the engine input.
   * When false, all computed fields are defaults/unknowns.
   */
  hasMarkup: boolean;

  // ── Route geometry ──────────────────────────────────────────────────────────

  /** Total proposed pipe run length (m) across all route kinds. */
  totalProposedLengthM: number;
  /** Total number of significant bends across all proposed routes. */
  totalBendCount: number;
  /** Per-route-kind material estimates for the proposed installation. */
  materialEstimates: RouteMaterialEstimate[];

  // ── Disruption ──────────────────────────────────────────────────────────────

  /**
   * Weighted disruption score (0–100, higher = more disruptive).
   * Derived from mounting type distribution weighted by route length and confidence.
   */
  disruptionScore: number;
  /** Human-readable disruption band. */
  disruptionBand: InstallDisruptionBand;
  /**
   * Disruption score delta (−20 to +20) applied to the recommendation engine's
   * disruption objective.
   *
   * Negative = better alignment, lower disruption than the physics baseline.
   * Positive = worse disruption than the baseline.
   * 0 when markup is absent.
   */
  disruptionObjectiveDelta: number;

  // ── Routing signals ─────────────────────────────────────────────────────────

  /** How well the proposed routes align with existing pipework. */
  alignmentSignal: InstallAlignmentSignal;
  /**
   * Proportion of proposed routes that are surface-mounted (0–1).
   * Higher fractions reduce the disruption score.
   */
  surfaceMountFraction: number;

  // ── Complexity ──────────────────────────────────────────────────────────────

  /**
   * Overall install complexity score (0–100, higher = more complex).
   * Derived from: run length, bend count, mounting transitions, and route count.
   */
  complexityScore: number;

  // ── Narrative signals ───────────────────────────────────────────────────────

  /**
   * Human-readable install complexity signals for recommendation copy.
   * Examples:
   *   "This option requires complex routing — 6 significant bends detected."
   *   "This option aligns with existing flow and return routes."
   *   "Proposed routing introduces 4.2 m of chased masonry."
   */
  narrativeSignals: string[];
}
