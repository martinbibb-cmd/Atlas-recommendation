/**
 * spatialAlignment.engine.ts
 *
 * SpatialAlignmentEngine — converts an AtlasSpatialModelV1 with anchor data
 * into relative positions, screen projections, and alignment insights.
 *
 * SAFETY RULES (non-negotiable):
 *  - Inferred data is NEVER rendered as confirmed.
 *  - Every derived result carries a derivationReason string.
 *  - No Math.random() — all outputs are deterministic from model inputs.
 *
 * Pipeline position:
 *   AtlasSpatialModelV1 (with anchors)
 *     → SpatialAlignmentEngine
 *       → AlignmentInsight[]   (UI Alignment View / Structure View)
 *       → InferredPipeLengthM[] (hydraulic / heat-loss engine integration)
 */

import type {
  AtlasSpatialModelV1,
  AtlasWorldPosition,
  AtlasAnchor,
} from '../atlasSpatial/atlasSpatialModel.types';
import type {
  CameraPose,
  ScreenPosition,
  RelativePosition,
  AlignmentInsight,
  InferredPipeLengthM,
} from './spatialAlignment.types';
import { selectReferenceAnchor } from './spatialAlignment.selectors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Euclidean distance between two world positions (3-D).
 */
function euclidean3D(a: AtlasWorldPosition, b: AtlasWorldPosition): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Horizontal (x-y plane) distance between two world positions.
 */
function horizontalDistance(a: AtlasWorldPosition, b: AtlasWorldPosition): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Convert a y-north / x-east offset to a compass bearing in degrees.
 * 0° = north, 90° = east, 180° = south, 270° = west (clockwise).
 */
function offsetToBearing(dx: number, dy: number): number {
  // atan2 standard: 0 = east, positive = counter-clockwise.
  // Compass: 0 = north, positive = clockwise.
  const radians = Math.atan2(dx, dy); // note: args swapped for north-up
  const degrees = radians * (180 / Math.PI);
  return (degrees + 360) % 360;
}

// ─── Core engine functions ────────────────────────────────────────────────────

/**
 * Compute the position of a target anchor relative to the user's current
 * world position.
 *
 * @param userPosition  The observer's current world position.
 * @param target        The anchor whose relative position is needed.
 * @returns             Distance, bearing, and vertical offset.
 */
export function getRelativePosition(
  userPosition: AtlasWorldPosition,
  target: AtlasAnchor,
): RelativePosition {
  const wp = target.worldPosition;
  const distanceM       = euclidean3D(userPosition, wp);
  const bearingDeg      = offsetToBearing(wp.x - userPosition.x, wp.y - userPosition.y);
  const verticalOffsetM = wp.z - userPosition.z;

  return {
    distanceM:       parseFloat(distanceM.toFixed(3)),
    bearingDeg:      parseFloat(bearingDeg.toFixed(1)),
    verticalOffsetM: parseFloat(verticalOffsetM.toFixed(3)),
  };
}

/**
 * Project a world position onto the normalised screen plane given a camera pose.
 *
 * This is a simple rectilinear pinhole projection — suitable for a 2-D
 * "Structure View" fallback or for positioning AR overlay labels.  AR
 * frameworks (ARKit / ARCore) handle the real view matrix; this function is
 * used for the 2-D fallback panel.
 *
 * @param cameraPose     Observer camera orientation in world space.
 * @param worldPosition  The point to project.
 * @returns              Normalised screen coordinate (u,v ∈ [0,1]) and frustum flag.
 *                       Returns null for points exactly at the camera origin.
 */
export function projectToViewPlane(
  cameraPose: CameraPose,
  worldPosition: AtlasWorldPosition,
): ScreenPosition {
  // Vector from camera to target in world space.
  const dx = worldPosition.x - cameraPose.position.x;
  const dy = worldPosition.y - cameraPose.position.y;
  const dz = worldPosition.z - cameraPose.position.z;

  // Rotate into camera-local space using yaw and pitch.
  const yawRad   = cameraPose.yawDeg   * (Math.PI / 180);
  const pitchRad = cameraPose.pitchDeg * (Math.PI / 180);

  // Yaw rotation (around Z / up axis): camera-local forward = (sin(yaw), cos(yaw), 0)
  const cosYaw = Math.cos(yawRad);
  const sinYaw = Math.sin(yawRad);

  // Camera-local x (right), y (forward), z (up) after yaw:
  const localX =  cosYaw * dx - sinYaw * dy;
  const localY =  sinYaw * dx + cosYaw * dy;
  const localZ =  dz;

  // Pitch rotation (around camera-local X axis):
  const cosPitch = Math.cos(pitchRad);
  const sinPitch = Math.sin(pitchRad);

  const camRight   = localX;
  const camForward = cosPitch * localY + sinPitch * localZ;
  const camUp      = -sinPitch * localY + cosPitch * localZ;

  // Point is behind the camera if forward distance ≤ 0.
  const inFrustumForward = camForward > 0;

  // Project using rectilinear perspective.
  const hFovRad = cameraPose.fovHorizontalDeg * (Math.PI / 180);
  const vFovRad = cameraPose.fovVerticalDeg   * (Math.PI / 180);

  const tanHalfH = Math.tan(hFovRad / 2);
  const tanHalfV = Math.tan(vFovRad / 2);

  // Normalised device coordinates: −1..+1
  const ndcX = camForward > 0 ? camRight  / (camForward * tanHalfH) : 0;
  const ndcY = camForward > 0 ? camUp     / (camForward * tanHalfV) : 0;

  // Map to 0..1 screen space (u: left→right, v: top→bottom).
  const u = 0.5 + ndcX * 0.5;
  const v = 0.5 - ndcY * 0.5;

  const inFrustum =
    inFrustumForward &&
    ndcX >= -1 && ndcX <= 1 &&
    ndcY >= -1 && ndcY <= 1;

  return {
    u: parseFloat(u.toFixed(4)),
    v: parseFloat(v.toFixed(4)),
    inFrustum,
  };
}

/**
 * Build a set of alignment insights from the spatial model.
 *
 * The first anchor labelled "boiler" (case-insensitive) is used as the
 * reference for vertical and horizontal offset calculations.  If no boiler
 * anchor exists, the first anchor in the array is used as the reference.
 *
 * @param model  An AtlasSpatialModelV1 with at least one anchor.
 * @returns      One AlignmentInsight per anchor (excluding the reference anchor).
 *               Empty array when no anchors are present.
 */
export function buildAlignmentInsights(model: AtlasSpatialModelV1): AlignmentInsight[] {
  const anchors = model.anchors ?? [];
  if (anchors.length === 0) return [];

  const referenceAnchor = selectReferenceAnchor(model);
  if (!referenceAnchor) return [];

  const insights: AlignmentInsight[] = [];

  for (const anchor of anchors) {
    if (anchor.id === referenceAnchor.id) continue;

    const ref = referenceAnchor.worldPosition;
    const wp  = anchor.worldPosition;

    const verticalDelta   = wp.z - ref.z;
    const verticalDistanceM = parseFloat(Math.abs(verticalDelta).toFixed(3));
    const horizontalOffsetM = parseFloat(horizontalDistance(ref, wp).toFixed(3));

    const relation: AlignmentInsight['relation'] =
      Math.abs(verticalDelta) < 0.05
        ? 'same_level'
        : verticalDelta > 0
          ? 'above'
          : 'below';

    const insight: AlignmentInsight = {
      anchorId: anchor.id,
      label:    anchor.label,
      relation,
      verticalDistanceM,
      horizontalOffsetM,
      confidence: wp.confidence,
    };

    if (wp.confidence === 'inferred' || wp.source === 'derived') {
      insight.derivationReason =
        `Position is ${wp.confidence === 'inferred' ? 'inferred' : 'derived'} from ` +
        `${wp.source} data — confirm with on-site measurement.`;
    }

    insights.push(insight);
  }

  return insights;
}

// ─── Engine integration helper ────────────────────────────────────────────────

/**
 * Derive total pipe-length estimates from all inferred routes in the model.
 *
 * Results feed into the hydraulic module (pump head estimation) and the
 * heat-loss module (distribution heat-loss penalty).
 *
 * SAFETY: confidence is always 'inferred' — callers must not treat these
 * lengths as surveyed measurements.
 *
 * @param model  AtlasSpatialModelV1 with inferredRoutes populated.
 * @returns      One InferredPipeLengthM per pipe-type route.
 */
export function deriveInferredPipeLengths(model: AtlasSpatialModelV1): InferredPipeLengthM[] {
  const routes = model.inferredRoutes ?? [];

  return routes
    .filter((r) => r.type === 'pipe')
    .map((route) => {
      let totalLengthM = 0;
      for (let i = 1; i < route.path.length; i++) {
        totalLengthM += euclidean3D(route.path[i - 1], route.path[i]);
      }

      return {
        routeId:      route.id,
        type:         route.type,
        totalLengthM: parseFloat(totalLengthM.toFixed(3)),
        confidence:   'inferred' as const,
        reason:       route.reason,
      };
    });
}
