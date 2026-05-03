/**
 * routeGeometry.ts — Pure geometry utilities for the Atlas Quote Planner.
 *
 * All functions are deterministic and side-effect-free.
 *
 * Design rules:
 *   - Physical lengths are always in metres.
 *   - Pixel-space coordinates are rejected unless a scale is supplied.
 *   - Bends are counted only from explicit kind === 'bend' points; elbows are
 *     never inferred from every waypoint unless inferFromWaypoints is true.
 *   - Complexity classification uses length, bend count, penetrations,
 *     install method, and confidence — not random heuristics.
 */

import type {
  QuoteRoutePointV1,
  QuoteRouteV1,
  QuoteRouteComplexity,
  QuoteRouteComplexityResultV1,
} from './quotePlannerTypes';

// ─── Constants ────────────────────────────────────────────────────────────────

/** A route below this length is considered short for complexity purposes. */
const SHORT_ROUTE_THRESHOLD_M = 3;

/** A route above this length is considered long for complexity purposes. */
const LONG_ROUTE_THRESHOLD_M = 10;

/** Bend counts above this value push complexity to at least 'high'. */
const HIGH_BEND_THRESHOLD = 3;

/** Bend counts above this value push complexity to at least 'medium'. */
const MEDIUM_BEND_THRESHOLD = 1;

// ─── calculatePolylineLengthM ─────────────────────────────────────────────────

/**
 * Calculate the total physical length of a polyline in metres.
 *
 * @param points - Ordered route waypoints.
 * @param coordinateSpace - Whether points are in 'metres' or 'pixels'.
 * @param scale - Required when coordinateSpace is 'pixels'. Provides
 *                metresPerPixel to convert pixel distances to metres.
 *
 * @returns Physical length in metres, or `null` when the coordinate space is
 *          'pixels' but no scale is supplied (pixel lengths are meaningless
 *          without a known scale factor).
 */
export function calculatePolylineLengthM(
  points: QuoteRoutePointV1[],
  coordinateSpace: 'metres' | 'pixels',
  scale?: { metresPerPixel: number },
): number | null {
  if (points.length < 2) {
    return 0;
  }

  // Pixel-space routes require a scale factor; refuse to fabricate metres.
  if (coordinateSpace === 'pixels') {
    if (!scale || scale.metresPerPixel <= 0) {
      return null;
    }
  }

  let totalPixelOrMetres = 0;

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    totalPixelOrMetres += Math.sqrt(dx * dx + dy * dy);
  }

  if (coordinateSpace === 'pixels' && scale) {
    return totalPixelOrMetres * scale.metresPerPixel;
  }

  return totalPixelOrMetres;
}

// ─── calculateBendCount ───────────────────────────────────────────────────────

/**
 * Count the number of bends in a route.
 *
 * By default, only explicit points with `kind === 'bend'` are counted.
 * When `inferFromWaypoints` is true, every intermediate point (kind ===
 * 'waypoint') is also treated as a bend — useful when the capture tool does
 * not mark bend kinds explicitly.
 *
 * `bendAngleDeg` values on bend points are preserved in the returned array so
 * callers can distinguish 90° elbows from 45° sweeps.
 *
 * @returns Object with `count` and `angles` (degrees for each bend, in order).
 */
export function calculateBendCount(
  points: QuoteRoutePointV1[],
  inferFromWaypoints = false,
): { count: number; angles: Array<number | undefined> } {
  const angles: Array<number | undefined> = [];

  for (const point of points) {
    if (point.kind === 'bend') {
      angles.push(point.bendAngleDeg);
    } else if (inferFromWaypoints && point.kind === 'waypoint') {
      angles.push(undefined);
    }
  }

  return { count: angles.length, angles };
}

// ─── calculateRouteComplexity ─────────────────────────────────────────────────

/**
 * Classify the complexity of a quote route.
 *
 * Uses physical length, bend count, penetration count, install method, and
 * route confidence to assign a complexity band.
 *
 * Complexity rules (applied in priority order):
 *   1. needs_review — route confidence is 'estimated' with no length data,
 *      or the route has zero points.
 *   2. high  — buried/ceiling install method, OR length > LONG_ROUTE_THRESHOLD_M,
 *              OR bend count > HIGH_BEND_THRESHOLD, OR penetrations ≥ 2.
 *   3. medium — length between SHORT and LONG thresholds, OR bend count between
 *               MEDIUM and HIGH thresholds, OR penetrations === 1.
 *   4. low   — short, straight, surface-mounted route.
 */
export function calculateRouteComplexity(
  route: QuoteRouteV1,
): QuoteRouteComplexityResultV1 {
  const { points, coordinateSpace, scale, installMethod, confidence, penetrationCount = 0 } = route;

  if (points.length === 0) {
    return {
      complexity: 'needs_review',
      lengthM: null,
      bendCount: 0,
      penetrationCount: 0,
      rationale: 'Route has no points — manual review required.',
    };
  }

  const lengthM = calculatePolylineLengthM(points, coordinateSpace, scale);
  const { count: bendCount } = calculateBendCount(points);

  // Cannot classify confidently when there is no physical length data.
  if (lengthM === null && confidence === 'estimated') {
    return {
      complexity: 'needs_review',
      lengthM: null,
      bendCount,
      penetrationCount,
      rationale:
        'Route uses pixel coordinates without a scale factor and confidence is estimated — manual review required.',
    };
  }

  const effectiveLengthM = lengthM ?? 0;
  const reasons: string[] = [];
  let complexity: QuoteRouteComplexity = 'low';

  // Check for high-complexity signals.
  if (
    installMethod === 'buried' ||
    installMethod === 'ceiling' ||
    effectiveLengthM > LONG_ROUTE_THRESHOLD_M ||
    bendCount > HIGH_BEND_THRESHOLD ||
    penetrationCount >= 2
  ) {
    complexity = 'high';
    if (installMethod === 'buried') reasons.push('buried route');
    if (installMethod === 'ceiling') reasons.push('ceiling route');
    if (effectiveLengthM > LONG_ROUTE_THRESHOLD_M) reasons.push(`length ${effectiveLengthM.toFixed(1)} m exceeds ${LONG_ROUTE_THRESHOLD_M} m`);
    if (bendCount > HIGH_BEND_THRESHOLD) reasons.push(`${bendCount} bends`);
    if (penetrationCount >= 2) reasons.push(`${penetrationCount} penetrations`);
  } else if (
    installMethod === 'boxed' ||
    effectiveLengthM > SHORT_ROUTE_THRESHOLD_M ||
    bendCount > MEDIUM_BEND_THRESHOLD ||
    penetrationCount === 1
  ) {
    complexity = 'medium';
    if (installMethod === 'boxed') reasons.push('boxed route');
    if (effectiveLengthM > SHORT_ROUTE_THRESHOLD_M) reasons.push(`length ${effectiveLengthM.toFixed(1)} m`);
    if (bendCount > MEDIUM_BEND_THRESHOLD) reasons.push(`${bendCount} bends`);
    if (penetrationCount === 1) reasons.push('1 penetration');
  } else {
    reasons.push('short straight surface route');
  }

  // Escalate to needs_review if confidence is estimated and complexity is high.
  if (complexity === 'high' && confidence === 'estimated') {
    return {
      complexity: 'needs_review',
      lengthM,
      bendCount,
      penetrationCount,
      rationale: `High complexity signals detected (${reasons.join(', ')}) with estimated confidence — manual review recommended.`,
    };
  }

  return {
    complexity,
    lengthM,
    bendCount,
    penetrationCount,
    rationale: reasons.join(', '),
  };
}
