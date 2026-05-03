/**
 * quotePlannerTypes.ts — Local type definitions for the Atlas Quote Planner.
 *
 * These types define the data contracts for the pure calculation utilities
 * (route geometry, flue equivalent length, job classification).
 *
 * Design rules:
 *   - All types are versioned with a V1 suffix per Atlas convention.
 *   - Coordinate-space units are always explicit (metres vs pixels).
 *   - Calculation results carry a `calculationMode` to prevent generic
 *     estimates being confused with manufacturer-verified data.
 */

// ─── Coordinate space ─────────────────────────────────────────────────────────

/**
 * A 2D point in the quote-planner coordinate space.
 *
 * coordinateSpace distinguishes metric floor-plan data from raw pixel data
 * captured from images without a known scale factor.
 *
 * metres  — physical coordinates (x/y in metres from a floor-plan origin).
 * pixels  — raw pixel coordinates from an image; requires a scale to be
 *            converted to metres.
 */
export type QuotePointCoordinateSpace = 'metres' | 'pixels';

/**
 * Pixel-to-metre scale factor.
 * When coordinateSpace is 'pixels', this converts pixels to metres.
 * e.g. scale = 0.02 means 1 px = 0.02 m (i.e. 50 px = 1 m).
 */
export interface QuotePointScale {
  /** How many metres one pixel represents. */
  metresPerPixel: number;
}

// ─── Route geometry ───────────────────────────────────────────────────────────

/**
 * The role a waypoint plays in a pipe or flue route.
 *
 * start      — origin of the route.
 * end        — terminus of the route.
 * waypoint   — an intermediate point (no fitting implied).
 * bend       — a direction change at this point (an elbow fitting is present
 *              or planned at this location).
 * penetration — the route passes through a wall, floor, or ceiling at this point.
 */
export type QuoteRoutePointKind = 'start' | 'end' | 'waypoint' | 'bend' | 'penetration';

/**
 * A single waypoint in a quote route polyline.
 */
export interface QuoteRoutePointV1 {
  /** Horizontal position in the coordinate space. */
  x: number;
  /** Vertical position in the coordinate space. */
  y: number;
  /** The role this point plays in the route. */
  kind: QuoteRoutePointKind;
  /**
   * Bend angle in degrees (0–180).
   * Only relevant when kind === 'bend'.
   * 90 = right-angle elbow; 45 = swept elbow.
   * Optional — preserved when present but not inferred.
   */
  bendAngleDeg?: number;
}

/**
 * The install method for a route segment or overall route.
 *
 * surface  — exposed on wall or floor.
 * boxed    — within surface-mounted boxing.
 * buried   — in screed, plaster, or structural fabric.
 * ceiling  — above ceiling or in floor void.
 */
export type QuoteRouteInstallMethod = 'surface' | 'boxed' | 'buried' | 'ceiling' | 'unknown';

/**
 * Overall confidence in the route geometry data.
 *
 * measured  — derived from a scan or scaled photo.
 * drawn     — engineer-drawn on a floor plan (± 0.5 m typical).
 * estimated — inferred from survey inputs; no direct measurement.
 */
export type QuoteRouteConfidence = 'measured' | 'drawn' | 'estimated';

/**
 * A complete pipe or flue route in the quote planner.
 */
export interface QuoteRouteV1 {
  /** Ordered waypoints defining the route. */
  points: QuoteRoutePointV1[];
  /** Coordinate space of the point coordinates. */
  coordinateSpace: QuotePointCoordinateSpace;
  /**
   * Scale factor — required when coordinateSpace is 'pixels'.
   * Omit for metre-space routes.
   */
  scale?: QuotePointScale;
  /** How the route is physically installed or planned. */
  installMethod: QuoteRouteInstallMethod;
  /** Confidence in the route geometry. */
  confidence: QuoteRouteConfidence;
  /**
   * Number of wall/floor/ceiling penetrations along the route.
   * Counted separately from bend points.
   */
  penetrationCount?: number;
}

/**
 * Route complexity band.
 *
 * low          — short, straight, minimal fittings; low-disruption install.
 * medium       — moderate length or a few bends; some disruption.
 * high         — long run, multiple bends, penetrations, or buried sections.
 * needs_review — insufficient data to classify; manual review required.
 */
export type QuoteRouteComplexity = 'low' | 'medium' | 'high' | 'needs_review';

/**
 * Output of calculateRouteComplexity.
 */
export interface QuoteRouteComplexityResultV1 {
  complexity: QuoteRouteComplexity;
  /** Physical length of the route in metres (or null when not calculable). */
  lengthM: number | null;
  /** Number of explicit bend points counted. */
  bendCount: number;
  /** Number of penetrations. */
  penetrationCount: number;
  /** Human-readable rationale for the complexity band. */
  rationale: string;
}

// ─── Flue segments ────────────────────────────────────────────────────────────

/**
 * The kind of flue segment or accessory.
 *
 * straight     — straight pipe section (contributes physical length only).
 * elbow_90     — 90° elbow; default equivalent length 2.0 m.
 * elbow_45     — 45° elbow; default equivalent length 1.0 m.
 * plume_kit    — plume management kit; equivalent length configurable (default 0).
 * terminal     — flue terminal; default equivalent length 0.
 * other        — any other accessory with a specified equivalent length.
 */
export type FlueSegmentKind =
  | 'straight'
  | 'elbow_90'
  | 'elbow_45'
  | 'plume_kit'
  | 'terminal'
  | 'other';

/**
 * A single segment in a flue route.
 */
export interface QuoteFlueSegmentV1 {
  /** What kind of segment this is. */
  kind: FlueSegmentKind;
  /**
   * Physical straight-line length in metres.
   * Required for 'straight' segments; optional for fittings.
   */
  physicalLengthM?: number;
  /**
   * Equivalent length in metres (for resistance purposes).
   * When omitted, the generic rule set value for this kind is used.
   */
  equivalentLengthM?: number;
}

/**
 * A complete flue route, composed of ordered segments.
 */
export interface QuoteFlueRouteV1 {
  /** Ordered segments making up the flue run. */
  segments: QuoteFlueSegmentV1[];
  /**
   * Maximum equivalent length permitted by the manufacturer (metres).
   * When omitted, the result will be `needs_model_specific_check`.
   */
  maxEquivalentLengthM?: number;
}

// ─── Flue calculation result ──────────────────────────────────────────────────

/**
 * Whether the flue run is within the manufacturer's permitted equivalent length.
 *
 * within_allowance          — total equivalent length ≤ max allowance.
 * exceeds_allowance         — total equivalent length > max allowance.
 * needs_model_specific_check — max allowance not supplied; cannot pass/fail.
 * not_calculated            — insufficient data to perform any calculation.
 */
export type QuoteFlueCalculationResult =
  | 'within_allowance'
  | 'exceeds_allowance'
  | 'needs_model_specific_check'
  | 'not_calculated';

/**
 * How the flue equivalent-length calculation was performed.
 *
 * generic_estimate       — uses generic rule defaults; NOT manufacturer truth.
 * manufacturer_specific  — uses confirmed manufacturer data.
 * manual_override        — engineer has manually entered the values.
 */
export type QuoteFlueCalculationMode =
  | 'generic_estimate'
  | 'manufacturer_specific'
  | 'manual_override';

/**
 * Full output of calculateFlueEquivalentLength.
 */
export interface QuoteFlueCalculationV1 {
  /** Total physical straight length of all segments (metres). */
  physicalLengthM: number;
  /** Total equivalent length including fittings (metres). */
  equivalentLengthM: number;
  /**
   * Maximum permitted equivalent length (metres).
   * Null when not provided — triggers `needs_model_specific_check`.
   */
  maxEquivalentLengthM: number | null;
  /**
   * Remaining allowance (max − equivalent).
   * Null when maxEquivalentLengthM is null.
   */
  remainingAllowanceM: number | null;
  /** Whether the flue run is within allowance. */
  result: QuoteFlueCalculationResult;
  /** How this calculation was performed. */
  calculationMode: QuoteFlueCalculationMode;
  /**
   * Human-readable assumptions made during the calculation.
   * Used to communicate generic-estimate caveats to the engineer.
   */
  assumptions: string[];
}

// ─── Flue rule set ────────────────────────────────────────────────────────────

/**
 * A rule set that defines equivalent lengths for each flue segment kind.
 * Used by calculateFlueEquivalentLength to look up missing segment values.
 */
export interface FlueRuleSetV1 {
  /** Equivalent length (m) for a 90° elbow. */
  elbow90EquivalentLengthM: number;
  /** Equivalent length (m) for a 45° elbow. */
  elbow45EquivalentLengthM: number;
  /** Equivalent length (m) for a plume management kit. */
  plumeKitEquivalentLengthM: number;
  /** Equivalent length (m) for the flue terminal. */
  terminalEquivalentLengthM: number;
  /**
   * Calculation mode to declare when this rule set is used.
   * Generic rules must declare `generic_estimate`.
   */
  calculationMode: QuoteFlueCalculationMode;
}

// ─── Job classification ───────────────────────────────────────────────────────

/**
 * The broad family of a heating/hot-water system.
 *
 * combi          — combination boiler (no hot-water cylinder).
 * system_stored  — system boiler with a hot-water cylinder.
 * regular_stored — regular (heat-only) boiler with cylinder and feed/expansion tank.
 * heat_pump      — air-source or ground-source heat pump (with cylinder).
 * unknown        — system type cannot be determined.
 */
export type QuoteSystemFamily =
  | 'combi'
  | 'system_stored'
  | 'regular_stored'
  | 'heat_pump'
  | 'unknown';

/**
 * Simplified location descriptor for a heat source or cylinder.
 */
export interface QuoteSystemLocationV1 {
  /**
   * Room or zone label (e.g. "Airing cupboard", "Kitchen", "Loft").
   * Used for like-for-like vs relocation detection.
   */
  room?: string;
  /**
   * Whether this is the same physical location as another reference location.
   * Pre-computed by the caller when available.
   */
  isSameLocation?: boolean;
}

/**
 * Snapshot describing the current or proposed heating system for classification.
 */
export interface QuoteSystemDescriptorV1 {
  /** Broad system family. */
  family: QuoteSystemFamily;
  /** Where the heat source is located. */
  heatSourceLocation?: QuoteSystemLocationV1;
  /** Whether the system includes a stored hot-water cylinder. */
  hasStoredHotWater?: boolean;
}

/**
 * The classified job type for a proposed installation.
 *
 * like_for_like         — same system family in the same location.
 * relocation            — same system family, heat source moved.
 * conversion            — change from one system family to another.
 * stored_hot_water_upgrade — combi replaced with a system that includes stored DHW.
 * low_carbon_conversion — any system replaced with a heat pump.
 * needs_review          — cannot be determined from available data.
 */
export type QuoteJobType =
  | 'like_for_like'
  | 'relocation'
  | 'conversion'
  | 'stored_hot_water_upgrade'
  | 'low_carbon_conversion'
  | 'needs_review';

/**
 * Output of classifyQuoteJob.
 */
export interface QuoteJobClassificationV1 {
  /** The classified job type. */
  jobType: QuoteJobType;
  /** Human-readable rationale for the classification. */
  rationale: string;
}
