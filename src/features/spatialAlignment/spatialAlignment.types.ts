/**
 * spatialAlignment.types.ts
 *
 * Output types for the SpatialAlignmentEngine.
 *
 * These types describe computed insights — not raw model data.  They are
 * derived by spatialAlignment.engine.ts and consumed by the UI layer.
 */

import type { AtlasWorldPosition } from '../atlasSpatial/atlasSpatialModel.types';

// ─── Camera / view ────────────────────────────────────────────────────────────

/**
 * Orientation of the device camera in world space.
 * Used by projectToViewPlane() to map 3-D positions onto the 2-D screen.
 */
export interface CameraPose {
  /** Camera origin in world space. */
  position: AtlasWorldPosition;
  /** Yaw angle in degrees (0 = north, 90 = east). */
  yawDeg: number;
  /** Pitch angle in degrees (0 = level, positive = looking up). */
  pitchDeg: number;
  /** Horizontal field of view in degrees (e.g. 60). */
  fovHorizontalDeg: number;
  /** Vertical field of view in degrees (e.g. 45). */
  fovVerticalDeg: number;
}

/**
 * A 2-D screen coordinate produced by projectToViewPlane().
 * Values are in normalised screen space: 0–1 on both axes (0,0 = top-left).
 * null means the point is behind the camera or outside the frustum.
 */
export interface ScreenPosition {
  /** Normalised horizontal position (0 = left, 1 = right). */
  u: number;
  /** Normalised vertical position (0 = top, 1 = bottom). */
  v: number;
  /**
   * True when the point is within the camera frustum and visible.
   * When false, u/v values are extrapolated and should not be used for
   * on-screen rendering.
   */
  inFrustum: boolean;
}

// ─── Relative positioning ─────────────────────────────────────────────────────

/**
 * The position of a target anchor relative to the user's current location.
 */
export interface RelativePosition {
  /** Straight-line distance in metres (3-D). */
  distanceM: number;
  /**
   * Horizontal bearing in degrees (0 = north, 90 = east, clockwise).
   * Derived from the x/y offset ignoring z.
   */
  bearingDeg: number;
  /**
   * Signed vertical offset in metres (positive = target is above user,
   * negative = target is below user).
   */
  verticalOffsetM: number;
}

// ─── Alignment insight ────────────────────────────────────────────────────────

/**
 * A human-readable insight about one anchor's spatial relationship within the
 * building.  Produced by buildAlignmentInsights().
 */
export interface AlignmentInsight {
  /** Anchor this insight describes. */
  anchorId: string;
  /** Human-readable label (from AtlasAnchor.label). */
  label: string;
  /** Vertical relationship to a reference anchor (typically the boiler). */
  relation: 'above' | 'below' | 'same_level';
  /** Absolute vertical distance in metres from the reference anchor. */
  verticalDistanceM: number;
  /** Horizontal offset in metres from the reference anchor. */
  horizontalOffsetM: number;
  /** Confidence of the position data. */
  confidence: 'confirmed' | 'inferred';
  /**
   * Present when confidence is 'inferred' — explains how this position
   * was derived so engineers can review and correct it.
   */
  derivationReason?: string;
}

// ─── Route-derived pipe length ────────────────────────────────────────────────

/**
 * Pipe-length estimate derived from an AtlasInferredRoute.
 * Consumed by engine integration (hydraulic / heat-loss modules).
 */
export interface InferredPipeLengthM {
  /** Source route ID. */
  routeId: string;
  /** Service type inherited from the route. */
  type: 'pipe' | 'cable' | 'flue';
  /** Total path length in metres (sum of segment distances). */
  totalLengthM: number;
  /**
   * Always 'inferred' — never present a derived pipe length as a
   * confirmed measurement.
   */
  confidence: 'inferred';
  /** Derivation reason inherited from the source route. */
  reason: string;
}
