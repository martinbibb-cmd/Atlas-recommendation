/**
 * InstallMarkupModule.ts
 *
 * Derives install complexity, material estimates, and disruption signals from
 * an InstallLayerModelV1 captured by atlas-scans-ios.
 *
 * Design rules:
 *   - All derivations are deterministic; no Math.random().
 *   - This module is pure interpretation — it does not modify engine inputs
 *     and does not invent route geometry.
 *   - When no install markup is present, returns a zero-state analysis with
 *     hasMarkup: false so callers can render appropriate fallback copy.
 *
 * Geometry reasoning:
 *   - Route length: sum of Euclidean distances between consecutive path points.
 *   - Bend count: each interior waypoint (index > 0 and < last) counts as one bend.
 *   - Concealed segments: routes with mounting === 'buried' or 'boxed'.
 *   - Alignment with existing: checks whether proposed route start/end points are
 *     within ALIGN_TOLERANCE_M of any existing route point.
 *   - Disruption score: 0–10 weighted combination of route length, concealed
 *     proportion, and bend density.
 */

import type {
  InstallLayerModelV1,
  InstallRouteModelV1,
  InstallComplexityV1,
  InstallComplexityBand,
  InstallMaterialEstimateV1,
  InstallDisruptionSignalV1,
  InstallMarkupAnalysisV1,
  PathPoint,
} from '../../features/installMarkup/installMarkup.types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Route length thresholds (m) for complexity band classification. */
const COMPLEXITY_LOW_MAX_M = 10;
const COMPLEXITY_MED_MAX_M = 25;

/** Maximum bend density (bends/m) before complexity is bumped up a band. */
const BEND_DENSITY_HIGH_THRESHOLD = 0.4; // bends per metre

/**
 * Spatial tolerance (metres) used when comparing proposed and existing route
 * points to decide whether the proposed route "aligns" with the existing one.
 */
const ALIGN_TOLERANCE_M = 0.5;

/**
 * Weight factors for the disruption score (0–10).
 *   length    — each metre of proposed pipe contributes this many score points
 *               before normalisation.
 *   concealed — buried / boxed segments contribute an extra flat score per route.
 *   bends     — each bend contributes this many score points.
 */
const DISRUPTION_WEIGHT_PER_M = 0.2;
const DISRUPTION_WEIGHT_PER_CONCEALED_ROUTE = 1.5;
const DISRUPTION_WEIGHT_PER_BEND = 0.3;

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/** Euclidean distance between two 2D points (metres). */
function dist2D(a: PathPoint, b: PathPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate the total length of a route (sum of segment lengths in metres).
 * Returns 0 when the route has fewer than 2 waypoints.
 */
export function calcRouteLength(route: InstallRouteModelV1): number {
  const { path } = route;
  if (path.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += dist2D(path[i - 1], path[i]);
  }
  return total;
}

/**
 * Count the number of bends (interior waypoints) in a route.
 * A route with N points has N−2 bends (start and end are not bends).
 * Returns 0 for routes with fewer than 3 waypoints.
 */
export function calcBendCount(route: InstallRouteModelV1): number {
  return Math.max(0, route.path.length - 2);
}

/**
 * Check whether a proposed route aligns with any existing routes.
 * "Aligns" means at least one proposed path point is within ALIGN_TOLERANCE_M
 * of at least one existing path point — indicating the pipe runs follow the
 * same corridors.
 */
export function routeAlignsWithExisting(
  proposed: InstallRouteModelV1,
  existing: InstallRouteModelV1[],
): boolean {
  for (const ep of existing) {
    for (const pp of proposed.path) {
      for (const ep2 of ep.path) {
        if (dist2D(pp, ep2) <= ALIGN_TOLERANCE_M) return true;
      }
    }
  }
  return false;
}

// ─── Derivation functions ──────────────────────────────────────────────────────

/**
 * Derive install complexity from the proposed routes.
 */
export function deriveComplexity(
  proposedRoutes: InstallRouteModelV1[],
): InstallComplexityV1 {
  let totalLength = 0;
  let totalBends = 0;
  let concealedCount = 0;

  for (const route of proposedRoutes) {
    totalLength += calcRouteLength(route);
    totalBends += calcBendCount(route);
    if (route.mounting === 'buried' || route.mounting === 'boxed') {
      concealedCount++;
    }
  }

  // Bend density (bends per metre of pipe); guard against zero-length.
  const bendDensity = totalLength > 0 ? totalBends / totalLength : 0;
  const hasBuried = proposedRoutes.some(r => r.mounting === 'buried');

  // Classify complexity band
  let band: InstallComplexityBand;
  if (totalLength === 0) {
    band = 'low';
  } else if (
    totalLength > COMPLEXITY_MED_MAX_M ||
    hasBuried ||
    bendDensity > BEND_DENSITY_HIGH_THRESHOLD
  ) {
    band = 'high';
  } else if (totalLength > COMPLEXITY_LOW_MAX_M || concealedCount > 0) {
    band = 'medium';
  } else {
    band = 'low';
  }

  const summaryParts: string[] = [];
  summaryParts.push(`${totalLength.toFixed(1)} m of proposed pipework`);
  if (totalBends > 0) summaryParts.push(`${totalBends} bend${totalBends !== 1 ? 's' : ''}`);
  if (concealedCount > 0) {
    summaryParts.push(
      `${concealedCount} concealed section${concealedCount !== 1 ? 's' : ''}`,
    );
  }

  return {
    band,
    totalRouteLengthM: totalLength,
    totalBendCount: totalBends,
    concealedSegmentCount: concealedCount,
    summary: summaryParts.join(', '),
  };
}

/**
 * Derive material estimates from the proposed routes.
 * Pipe lengths are bucketed by bore diameter.
 */
export function deriveMaterials(
  proposedRoutes: InstallRouteModelV1[],
): InstallMaterialEstimateV1 {
  let pipe15 = 0;
  let pipe22 = 0;
  let pipe28 = 0;
  let pipeUnknown = 0;

  for (const route of proposedRoutes) {
    const len = calcRouteLength(route);
    if (route.diameterMm === 15) pipe15 += len;
    else if (route.diameterMm === 22) pipe22 += len;
    else if (route.diameterMm === 28) pipe28 += len;
    else pipeUnknown += len;
  }

  return {
    pipe15mmM: pipe15,
    pipe22mmM: pipe22,
    pipe28mmM: pipe28,
    pipeUnknownM: pipeUnknown,
  };
}

/**
 * Derive disruption signals from the proposed and existing routes.
 */
export function deriveDisruption(
  proposedRoutes: InstallRouteModelV1[],
  existingRoutes: InstallRouteModelV1[],
): InstallDisruptionSignalV1 {
  const hasBuried = proposedRoutes.some(r => r.mounting === 'buried');
  const hasBoxed = proposedRoutes.some(r => r.mounting === 'boxed');

  const alignsWithExisting =
    proposedRoutes.length > 0 &&
    proposedRoutes.every(r => routeAlignsWithExisting(r, existingRoutes));

  // Raw disruption score before clamping
  let score = 0;
  for (const route of proposedRoutes) {
    const len = calcRouteLength(route);
    score += len * DISRUPTION_WEIGHT_PER_M;
    score += calcBendCount(route) * DISRUPTION_WEIGHT_PER_BEND;
    if (route.mounting === 'buried' || route.mounting === 'boxed') {
      score += DISRUPTION_WEIGHT_PER_CONCEALED_ROUTE;
    }
  }

  // Reduce score when new routes closely follow existing ones
  if (alignsWithExisting) score *= 0.7;

  const disruptionScore = Math.min(10, Math.round(score * 10) / 10);

  return {
    hasBuriedRoutes: hasBuried,
    hasBoxedRoutes: hasBoxed,
    alignsWithExistingRoutes: alignsWithExisting,
    disruptionScore,
  };
}

/**
 * Generate plain-language install insights from the analysis components.
 * These are surfaced in recommendation copy and reports.
 */
export function deriveInsights(
  complexity: InstallComplexityV1,
  disruption: InstallDisruptionSignalV1,
): string[] {
  const insights: string[] = [];

  if (complexity.band === 'high') {
    if (disruption.hasBuriedRoutes) {
      insights.push(
        'This option requires complex routing with buried pipe sections — significant disruption to fabric expected.',
      );
    } else {
      insights.push(
        'This option requires complex routing — longer runs and multiple bends increase installation time.',
      );
    }
  } else if (complexity.band === 'medium') {
    insights.push(
      'This option involves a moderate installation — some pipework routing through the property.',
    );
  } else {
    insights.push(
      'This option involves straightforward pipework routing — minimal disruption expected.',
    );
  }

  if (disruption.alignsWithExistingRoutes) {
    insights.push(
      'New pipework closely follows existing routes — lower visible disruption and reduced decorating.',
    );
  }

  if (disruption.hasBoxedRoutes && !disruption.hasBuriedRoutes) {
    insights.push(
      'Some pipework will be surface-mounted in boxing — visible to occupants but avoids structural work.',
    );
  }

  return insights;
}

// ─── Zero-state (no markup present) ──────────────────────────────────────────

const ZERO_COMPLEXITY: InstallComplexityV1 = {
  band: 'low',
  totalRouteLengthM: 0,
  totalBendCount: 0,
  concealedSegmentCount: 0,
  summary: 'No install markup captured',
};

const ZERO_MATERIALS: InstallMaterialEstimateV1 = {
  pipe15mmM: 0,
  pipe22mmM: 0,
  pipe28mmM: 0,
  pipeUnknownM: 0,
};

const ZERO_DISRUPTION: InstallDisruptionSignalV1 = {
  hasBuriedRoutes: false,
  hasBoxedRoutes: false,
  alignsWithExistingRoutes: false,
  disruptionScore: 0,
};

// ─── Public entry point ────────────────────────────────────────────────────────

/**
 * Analyse an InstallLayerModelV1 and produce an InstallMarkupAnalysisV1.
 *
 * Pass `undefined` when no install markup is available — returns a zero-state
 * analysis with `hasMarkup: false`.
 */
export function analyseInstallMarkup(
  markup: InstallLayerModelV1 | undefined,
): InstallMarkupAnalysisV1 {
  if (markup == null) {
    return {
      hasMarkup: false,
      complexity: ZERO_COMPLEXITY,
      materials: ZERO_MATERIALS,
      disruption: ZERO_DISRUPTION,
      insights: [],
    };
  }

  const proposedRoutes = markup.proposed.routes;
  const existingRoutes = markup.existing.routes;

  const complexity = deriveComplexity(proposedRoutes);
  const materials = deriveMaterials(proposedRoutes);
  const disruption = deriveDisruption(proposedRoutes, existingRoutes);
  const insights = deriveInsights(complexity, disruption);

  return {
    hasMarkup: true,
    complexity,
    materials,
    disruption,
    insights,
  };
}
