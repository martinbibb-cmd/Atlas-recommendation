/**
 * routeActions.ts
 *
 * Pure action helpers for managing `QuotePlanPipeworkRouteV1` entries.
 *
 * Design rules:
 *   - All functions are pure and side-effect-free.
 *   - Point mutations always return a new object — no in-place mutation.
 *   - The calculation is re-run whenever points, penetration counts,
 *     install method, or scale changes.
 *   - When coordinateSpace is 'pixels' and no scale is supplied,
 *     calculation.lengthM is null and lengthConfidence is 'needs_scale'.
 *   - No React dependencies — usable in reducers, tests, and non-React contexts.
 */

import type {
  QuotePlanPipeworkRouteV1,
  PipeworkRouteKind,
  PipeworkRouteStatus,
  PipeworkInstallMethod,
  QuotePipeworkCalculationV1,
} from './QuoteInstallationPlanV1';
import type {
  QuoteRoutePointV1,
  QuotePointCoordinateSpace,
  QuotePointScale,
  QuoteRouteComplexity,
} from '../calculators/quotePlannerTypes';
import {
  calculatePolylineLengthM,
  calculateBendCount,
} from '../calculators/routeGeometry';

// Monotonic counter for stable IDs within the same millisecond.
let _pipeworkRouteIdCounter = 0;

// ─── Complexity thresholds ────────────────────────────────────────────────────

const SHORT_M = 3;
const LONG_M = 10;
const HIGH_BEND = 3;
const MEDIUM_BEND = 1;

// ─── Complexity classification ────────────────────────────────────────────────

/**
 * Derives a complexity band for a pipework route.
 *
 * Rules (applied in priority order):
 *   1. needs_review — zero points on a proposed route (cannot classify).
 *   2. high  — concealed / underfloor / loft install method, OR
 *              length > LONG_M, OR bends > HIGH_BEND, OR penetrations ≥ 2.
 *   3. medium — external install method, OR length > SHORT_M, OR
 *               bends > MEDIUM_BEND, OR penetrations === 1.
 *   4. low   — short, straight, surface-mounted route.
 */
function classifyPipeworkComplexity(
  installMethod: PipeworkInstallMethod,
  lengthM: number | null,
  bendCount: number,
  totalPenetrations: number,
  hasPoints: boolean,
): { complexity: QuoteRouteComplexity; rationale: string } {
  if (!hasPoints) {
    return { complexity: 'needs_review', rationale: 'No points drawn — manual review required.' };
  }

  const effective = lengthM ?? 0;
  const reasons: string[] = [];
  let complexity: QuoteRouteComplexity = 'low';

  if (
    installMethod === 'concealed' ||
    installMethod === 'underfloor' ||
    installMethod === 'loft' ||
    effective > LONG_M ||
    bendCount > HIGH_BEND ||
    totalPenetrations >= 2
  ) {
    complexity = 'high';
    if (installMethod === 'concealed') reasons.push('concealed route');
    if (installMethod === 'underfloor') reasons.push('underfloor route');
    if (installMethod === 'loft') reasons.push('loft route');
    if (effective > LONG_M) reasons.push(`length ${effective.toFixed(1)} m exceeds ${LONG_M} m`);
    if (bendCount > HIGH_BEND) reasons.push(`${bendCount} bends`);
    if (totalPenetrations >= 2) reasons.push(`${totalPenetrations} penetrations`);
  } else if (
    installMethod === 'external' ||
    installMethod === 'boxed' ||
    effective > SHORT_M ||
    bendCount > MEDIUM_BEND ||
    totalPenetrations === 1
  ) {
    complexity = 'medium';
    if (installMethod === 'external') reasons.push('external route');
    if (installMethod === 'boxed') reasons.push('boxed route');
    if (effective > SHORT_M) reasons.push(`length ${effective.toFixed(1)} m`);
    if (bendCount > MEDIUM_BEND) reasons.push(`${bendCount} bends`);
    if (totalPenetrations === 1) reasons.push('1 penetration');
  } else {
    reasons.push('short straight surface route');
  }

  return { complexity, rationale: reasons.join(', ') };
}

// ─── Internal recalculate ─────────────────────────────────────────────────────

/** Recomputes `calculation` from the current route state. Returns a new route. */
function recalculate(route: QuotePlanPipeworkRouteV1): QuotePlanPipeworkRouteV1 {
  const { points, coordinateSpace, scale, installMethod, wallPenetrationCount, floorPenetrationCount } = route;
  const totalPenetrations = wallPenetrationCount + floorPenetrationCount;

  const lengthM = calculatePolylineLengthM(points, coordinateSpace, scale);
  const { count: bendCount } = calculateBendCount(points);

  const needsScale = coordinateSpace === 'pixels' && (!scale || scale.metresPerPixel <= 0);

  const lengthConfidence = needsScale
    ? 'needs_scale'
    : points.length > 0
      ? 'measured_on_plan'
      : 'estimated';

  const { complexity, rationale } = classifyPipeworkComplexity(
    installMethod,
    lengthM,
    bendCount,
    totalPenetrations,
    points.length > 0,
  );

  const calculation: QuotePipeworkCalculationV1 = {
    lengthM,
    lengthConfidence: lengthConfidence as QuotePipeworkCalculationV1['lengthConfidence'],
    bendCount,
    wallPenetrationCount,
    floorPenetrationCount,
    complexity,
    complexityRationale: rationale,
  };

  return { ...route, calculation };
}

// ─── Build helpers ────────────────────────────────────────────────────────────

/**
 * Creates a new empty pipework route draft for the given service kind.
 *
 * Starts with no points, surface install method, and 'pixels' coordinate
 * space (no scale) so the initial length is correctly shown as 'needs_scale'.
 * The engineer sets scale or switches to 'metres' as they draw.
 */
export function buildPipeworkRouteDraft(
  routeKind: PipeworkRouteKind,
  status: PipeworkRouteStatus = 'proposed',
): QuotePlanPipeworkRouteV1 {
  const pipeworkRouteId = `pipework-${Date.now()}-${++_pipeworkRouteIdCounter}`;
  const base: Omit<QuotePlanPipeworkRouteV1, 'calculation'> = {
    pipeworkRouteId,
    routeKind,
    status,
    installMethod: 'surface',
    points: [],
    coordinateSpace: 'pixels',
    wallPenetrationCount: 0,
    floorPenetrationCount: 0,
  };
  return recalculate({ ...base, calculation: undefined as unknown as QuotePipeworkCalculationV1 });
}

// ─── Point mutations ──────────────────────────────────────────────────────────

/**
 * Appends a waypoint to the route polyline and recalculates.
 *
 * The first point is automatically assigned `kind: 'start'`, the previous
 * end-kind point is promoted to `kind: 'waypoint'`, and the new point
 * becomes `kind: 'end'`.
 */
export function addRoutePoint(
  route: QuotePlanPipeworkRouteV1,
  point: Omit<QuoteRoutePointV1, 'kind'>,
): QuotePlanPipeworkRouteV1 {
  const existing = route.points;
  let updated: QuoteRoutePointV1[];

  if (existing.length === 0) {
    // First point → start
    updated = [{ ...point, kind: 'start' }];
  } else {
    // Promote the previous end to waypoint, append new end.
    const prev = existing.map<QuoteRoutePointV1>((p, i) =>
      i === existing.length - 1 && p.kind === 'end'
        ? { ...p, kind: 'waypoint' }
        : p,
    );
    updated = [...prev, { ...point, kind: 'end' }];
  }

  return recalculate({ ...route, points: updated });
}

/**
 * Removes the waypoint at the given index and recalculates.
 *
 * Out-of-range indices are silently ignored.
 * After removal, the new last point is reassigned `kind: 'end'`.
 */
export function removeRoutePoint(
  route: QuotePlanPipeworkRouteV1,
  index: number,
): QuotePlanPipeworkRouteV1 {
  const { points } = route;
  if (index < 0 || index >= points.length) return route;

  const filtered = points.filter((_, i) => i !== index);
  // Ensure correct start/end labelling after removal.
  const relabelled = filtered.map<QuoteRoutePointV1>((p, i) => {
    if (i === 0) return { ...p, kind: 'start' };
    if (i === filtered.length - 1) return { ...p, kind: 'end' };
    return p.kind === 'start' || p.kind === 'end' ? { ...p, kind: 'waypoint' } : p;
  });

  return recalculate({ ...route, points: relabelled });
}

// ─── Property updates ─────────────────────────────────────────────────────────

/** Updates the route status. Returns a new route — no mutation. */
export function updateRouteStatus(
  route: QuotePlanPipeworkRouteV1,
  status: PipeworkRouteStatus,
): QuotePlanPipeworkRouteV1 {
  return recalculate({ ...route, status });
}

/** Updates the install method and recalculates complexity. */
export function updateRouteInstallMethod(
  route: QuotePlanPipeworkRouteV1,
  installMethod: PipeworkInstallMethod,
): QuotePlanPipeworkRouteV1 {
  return recalculate({ ...route, installMethod });
}

/** Updates the pipe diameter (free-text, e.g. "22mm"). */
export function updateRouteDiameter(
  route: QuotePlanPipeworkRouteV1,
  diameter: string | undefined,
): QuotePlanPipeworkRouteV1 {
  // Diameter does not affect the calculation; no recalculate needed.
  return { ...route, diameter };
}

/**
 * Updates the coordinate space and optional scale, then recalculates.
 *
 * When switching to 'metres', any previously set pixel scale is cleared.
 * When switching to 'pixels' with a scale, the scale is stored so length
 * can be derived.
 */
export function updateRouteCoordinateSpace(
  route: QuotePlanPipeworkRouteV1,
  coordinateSpace: QuotePointCoordinateSpace,
  scale?: QuotePointScale,
): QuotePlanPipeworkRouteV1 {
  return recalculate({
    ...route,
    coordinateSpace,
    scale: coordinateSpace === 'metres' ? undefined : scale,
  });
}

/** Updates the wall and floor penetration counts and recalculates. */
export function updateRoutePenetrations(
  route: QuotePlanPipeworkRouteV1,
  wallPenetrationCount: number,
  floorPenetrationCount: number,
): QuotePlanPipeworkRouteV1 {
  return recalculate({ ...route, wallPenetrationCount, floorPenetrationCount });
}

/** Updates the start or end anchor location IDs. */
export function updateRouteAnchors(
  route: QuotePlanPipeworkRouteV1,
  startAnchorId: string | undefined,
  endAnchorId: string | undefined,
): QuotePlanPipeworkRouteV1 {
  return { ...route, startAnchorId, endAnchorId };
}

// ─── Manual length override ───────────────────────────────────────────────────

/**
 * Applies a manual length override to the route.
 *
 * Use when the engineer measures the route by other means and wants to enter
 * the length directly, bypassing the drawn-polyline calculation.
 * Sets `calculation.lengthConfidence` to `'manual'`.
 *
 * The existing points are preserved for visual reference, but the complexity
 * calculation is re-run using the supplied manual length.
 */
export function applyManualLengthOverride(
  route: QuotePlanPipeworkRouteV1,
  lengthM: number,
): QuotePlanPipeworkRouteV1 {
  const { wallPenetrationCount, floorPenetrationCount, installMethod } = route;
  const totalPenetrations = wallPenetrationCount + floorPenetrationCount;
  const { count: bendCount } = calculateBendCount(route.points);

  const { complexity, rationale } = classifyPipeworkComplexity(
    installMethod,
    lengthM,
    bendCount,
    totalPenetrations,
    true, // manual override assumes the route is drawable
  );

  const calculation: QuotePipeworkCalculationV1 = {
    lengthM,
    lengthConfidence: 'manual',
    bendCount,
    wallPenetrationCount,
    floorPenetrationCount,
    complexity,
    complexityRationale: rationale,
  };

  return { ...route, calculation };
}
