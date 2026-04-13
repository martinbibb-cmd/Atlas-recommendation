/**
 * InstallComplexityModule.ts
 *
 * Derives install complexity, material estimates, and disruption signals from
 * the InstallMarkupV1 payload in EngineInputV2_3.
 *
 * Design rules:
 *   - Pure function: deterministic, no side-effects, no Math.random().
 *   - Input-only: never writes back to markup or engine input.
 *   - When installMarkup is absent, all signals return 'unknown' defaults.
 *   - Route confidence ('estimated') reduces the weight of derived signals.
 *
 * Output is attached to EngineOutputV1.installComplexity via the
 * ENGINE_MODULE_REGISTRY 'engine:output-ready' subscription.
 *
 * Consumed by:
 *   - Recommendation disruption scoring (adjusts disruption objective baseline)
 *   - Report install overlay (shows "before / after" routing)
 *   - Red-flag surface (warns when complex routing detected)
 */

import type {
  InstallMarkupV1,
  InstallRouteModelV1,
  RouteMounting,
  RouteKind,
  RouteConfidence,
  PathPoint,
  RouteMaterialEstimate,
  InstallDisruptionBand,
  InstallAlignmentSignal,
  InstallComplexityResultV1,
} from '../schema/installMarkup.types';

export type {
  RouteMaterialEstimate,
  InstallDisruptionBand,
  InstallAlignmentSignal,
  InstallComplexityResultV1,
};

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Default pipe bore (mm) used for material estimates when diameterMm is absent.
 * 22 mm is the standard UK primary circuit bore for domestic systems.
 */
const DEFAULT_PIPE_DIAMETER_MM = 22;

/**
 * Disruption weight per mounting type.
 * Higher = more disruptive.
 *   surface  → 1   (minimal: visible but non-invasive)
 *   boxed    → 2   (moderate: carpentry, decoration)
 *   chased   → 4   (high: masonry cutting, re-plastering)
 *   screed   → 6   (very high: floor removal / re-screeding)
 */
const MOUNTING_DISRUPTION_WEIGHT: Record<RouteMounting, number> = {
  surface: 1,
  boxed:   2,
  chased:  4,
  screed:  6,
};

/**
 * Confidence weight multiplier applied to the disruption and complexity scores.
 * A route marked 'estimated' contributes less signal than a 'measured' one.
 */
const CONFIDENCE_WEIGHT: Record<RouteConfidence, number> = {
  measured:  1.0,
  drawn:     0.8,
  estimated: 0.5,
};

/**
 * Minimum angle (degrees) between consecutive path segments to count as a
 * significant bend for complexity scoring purposes.
 * Angles below this threshold are treated as nearly-straight runs.
 */
const BEND_ANGLE_THRESHOLD_DEG = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Euclidean distance between two PathPoints (metres).
 * Elevation (z) is included when present.
 */
function segmentLength(a: PathPoint, b: PathPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = (b.z ?? 0) - (a.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Total length of a route's path in metres.
 * Returns 0 for degenerate paths (< 2 points).
 */
function routeLengthM(route: InstallRouteModelV1): number {
  if (route.path.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < route.path.length - 1; i++) {
    total += segmentLength(route.path[i], route.path[i + 1]);
  }
  return total;
}

/**
 * Count the number of significant bends in a route path.
 * A bend is a direction change greater than BEND_ANGLE_THRESHOLD_DEG degrees.
 */
function countBends(path: PathPoint[]): number {
  if (path.length < 3) return 0;
  let bends = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const ax = path[i].x - path[i - 1].x;
    const ay = path[i].y - path[i - 1].y;
    const bx = path[i + 1].x - path[i].x;
    const by = path[i + 1].y - path[i].y;
    const magA = Math.sqrt(ax * ax + ay * ay);
    const magB = Math.sqrt(bx * bx + by * by);
    if (magA === 0 || magB === 0) continue;
    const cosTheta = (ax * bx + ay * by) / (magA * magB);
    // clamp to [-1, 1] to guard against floating-point drift
    const clamped = Math.min(1, Math.max(-1, cosTheta));
    const angleDeg = (Math.acos(clamped) * 180) / Math.PI;
    if (angleDeg > BEND_ANGLE_THRESHOLD_DEG) bends++;
  }
  return bends;
}

// ─── Core computation ─────────────────────────────────────────────────────────

/**
 * Compute disruption score (0–100) from a list of proposed routes.
 *
 * Algorithm:
 *   1. For each route: weight = mountingWeight × confidenceWeight × lengthM
 *   2. disruptionScore = Σ(weight) / Σ(lengthWeighted) × normalisation factor
 *   3. Clamp to 0–100.
 *
 * A score of 0 means all routes are surface-mounted.
 * A score of 100 means all routes are screed-buried (maximally disruptive).
 */
function computeDisruptionScore(routes: InstallRouteModelV1[]): number {
  if (routes.length === 0) return 0;
  let weightedDisruption = 0;
  let totalWeight = 0;
  for (const route of routes) {
    const length = routeLengthM(route);
    if (length === 0) continue;
    const confWeight = CONFIDENCE_WEIGHT[route.confidence];
    const mountWeight = MOUNTING_DISRUPTION_WEIGHT[route.mounting];
    weightedDisruption += mountWeight * confWeight * length;
    totalWeight += confWeight * length;
  }
  if (totalWeight === 0) return 0;
  const rawScore = weightedDisruption / totalWeight;
  // Max mounting weight is 6 (screed), so normalise to 0–100
  return Math.min(100, Math.max(0, (rawScore / 6) * 100));
}

/**
 * Determine the disruption band from a numeric score.
 */
function disruptionBandFromScore(score: number): InstallDisruptionBand {
  if (score < 25) return 'low';
  if (score < 55) return 'moderate';
  return 'high';
}

/**
 * Compute alignment signal by comparing proposed routes to existing routes.
 *
 * A proposed route is considered "aligned" when it starts and ends near
 * (within 0.5 m of) any existing route's start or end point.
 *
 * Alignment fraction = (aligned proposed routes) / (total proposed routes).
 *   ≥ 0.7 → 'aligned'
 *   ≥ 0.3 → 'partial'
 *   < 0.3 → 'new_routing'
 */
const ALIGNMENT_PROXIMITY_M = 0.5;

function isNear(a: PathPoint, b: PathPoint): boolean {
  return segmentLength(a, b) <= ALIGNMENT_PROXIMITY_M;
}

function computeAlignmentSignal(
  proposed: InstallRouteModelV1[],
  existing: InstallRouteModelV1[],
): InstallAlignmentSignal {
  if (proposed.length === 0) return 'unknown';
  if (existing.length === 0) return 'unknown';

  let alignedCount = 0;
  for (const pRoute of proposed) {
    if (pRoute.path.length < 2) continue;
    const pStart = pRoute.path[0];
    const pEnd = pRoute.path[pRoute.path.length - 1];
    for (const eRoute of existing) {
      if (eRoute.path.length < 2) continue;
      const eStart = eRoute.path[0];
      const eEnd = eRoute.path[eRoute.path.length - 1];
      if (
        (isNear(pStart, eStart) || isNear(pStart, eEnd)) &&
        (isNear(pEnd, eStart)   || isNear(pEnd, eEnd))
      ) {
        alignedCount++;
        break;
      }
    }
  }

  const fraction = alignedCount / proposed.length;
  if (fraction >= 0.7) return 'aligned';
  if (fraction >= 0.3) return 'partial';
  return 'new_routing';
}

/**
 * Compute per-kind material estimates from a list of routes.
 */
function computeMaterialEstimates(routes: InstallRouteModelV1[]): RouteMaterialEstimate[] {
  const byKind = new Map<RouteKind, { totalLength: number; totalDiameterWeighted: number }>();
  for (const route of routes) {
    const length = routeLengthM(route);
    if (length === 0) continue;
    const diameter = route.diameterMm ?? DEFAULT_PIPE_DIAMETER_MM;
    const entry = byKind.get(route.kind) ?? { totalLength: 0, totalDiameterWeighted: 0 };
    entry.totalLength += length;
    entry.totalDiameterWeighted += diameter * length;
    byKind.set(route.kind, entry);
  }
  const estimates: RouteMaterialEstimate[] = [];
  for (const [kind, data] of byKind) {
    estimates.push({
      kind,
      totalLengthM: Math.round(data.totalLength * 10) / 10,
      avgDiameterMm: Math.round(data.totalDiameterWeighted / data.totalLength),
    });
  }
  return estimates;
}

/**
 * Compute overall complexity score (0–100).
 *
 * Factors:
 *   - Total run length (normalised against a 20 m reference run)
 *   - Total bend count (each bend adds ~3 points, capped at 30 points)
 *   - Route count (each additional route beyond 2 adds ~2 points, capped at 20)
 *   - Mounting-type penalty (presence of chased/screed adds up to 20 points)
 */
function computeComplexityScore(routes: InstallRouteModelV1[]): number {
  if (routes.length === 0) return 0;
  let totalLength = 0;
  let totalBends = 0;
  let chasedOrScreedLength = 0;
  for (const route of routes) {
    const len = routeLengthM(route);
    totalLength += len;
    totalBends += countBends(route.path);
    if (route.mounting === 'chased' || route.mounting === 'screed') {
      chasedOrScreedLength += len;
    }
  }
  const lengthScore = Math.min(30, (totalLength / 20) * 30);
  const bendScore = Math.min(30, totalBends * 3);
  const routeCountScore = Math.min(20, Math.max(0, (routes.length - 2) * 2));
  const mountingScore = totalLength > 0
    ? Math.min(20, (chasedOrScreedLength / totalLength) * 20)
    : 0;
  return Math.min(100, Math.round(lengthScore + bendScore + routeCountScore + mountingScore));
}

/**
 * Map the disruption score and alignment signal to a delta applied to the
 * disruption objective in the recommendation scorer.
 *
 * Range: −20 (well-aligned, low disruption) to +20 (high disruption, no alignment).
 */
function computeDisruptionObjectiveDelta(
  disruptionScore: number,
  alignmentSignal: InstallAlignmentSignal,
): number {
  // Base delta from disruption score: 0 at score=50, ±20 at extremes
  const baseFromScore = ((disruptionScore - 50) / 50) * 20;
  // Alignment adjustment: aligned = −5, partial = 0, new_routing = +5
  const alignmentAdj =
    alignmentSignal === 'aligned'     ? -5 :
    alignmentSignal === 'new_routing' ?  5 :
    0;
  return Math.min(20, Math.max(-20, Math.round(baseFromScore + alignmentAdj)));
}

/**
 * Build human-readable narrative signals for the recommendation copy layer.
 */
function buildNarrativeSignals(
  totalLengthM: number,
  totalBends: number,
  alignmentSignal: InstallAlignmentSignal,
  disruptionBand: InstallDisruptionBand,
  materialEstimates: RouteMaterialEstimate[],
  chasedLengthM: number,
): string[] {
  const signals: string[] = [];

  if (alignmentSignal === 'aligned') {
    signals.push('This option aligns with existing flow and return routes — minimal new disruption expected.');
  } else if (alignmentSignal === 'partial') {
    signals.push('This option partially follows existing pipework — some new routing is required.');
  } else if (alignmentSignal === 'new_routing') {
    signals.push('This option requires entirely new routing — installation disruption will be higher.');
  }

  if (totalBends >= 6) {
    signals.push(`Complex routing detected — ${totalBends} significant bends across the proposed pipework.`);
  } else if (totalBends >= 3) {
    signals.push(`Moderate routing complexity — ${totalBends} bends in the proposed pipework.`);
  }

  if (chasedLengthM > 0) {
    signals.push(
      `Proposed routing includes ${chasedLengthM.toFixed(1)} m of chased masonry — re-plastering will be required.`,
    );
  }

  if (disruptionBand === 'high') {
    signals.push('High installation disruption anticipated — significant enabling works likely.');
  } else if (disruptionBand === 'low') {
    signals.push('Low installation disruption anticipated — surface-mount routing predominates.');
  }

  const primaryEstimate = materialEstimates.find(e => e.kind === 'flow' || e.kind === 'return');
  if (primaryEstimate != null && primaryEstimate.totalLengthM > 0) {
    signals.push(
      `Estimated primary pipework: ${primaryEstimate.totalLengthM.toFixed(1)} m ` +
      `× ${primaryEstimate.avgDiameterMm} mm (${primaryEstimate.kind}).`,
    );
  }

  if (totalLengthM > 0 && signals.length === 0) {
    signals.push(`Total proposed pipework run: ${totalLengthM.toFixed(1)} m.`);
  }

  return signals;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Default result returned when no install markup is present.
 */
const EMPTY_RESULT: InstallComplexityResultV1 = {
  hasMarkup:              false,
  totalProposedLengthM:   0,
  totalBendCount:         0,
  materialEstimates:      [],
  disruptionScore:        0,
  disruptionBand:         'unknown',
  disruptionObjectiveDelta: 0,
  alignmentSignal:        'unknown',
  surfaceMountFraction:   0,
  complexityScore:        0,
  narrativeSignals:       [],
};

/**
 * runInstallComplexityModule
 *
 * Pure function entry point.  Pass the engine's `installMarkup` field directly.
 *
 * @param markup  InstallMarkupV1 from EngineInputV2_3.installMarkup, or undefined.
 * @returns       InstallComplexityResultV1 — all signals derived from markup geometry.
 */
export function runInstallComplexityModule(
  markup: InstallMarkupV1 | undefined,
): InstallComplexityResultV1 {
  if (markup == null || markup.layers.length === 0) {
    return EMPTY_RESULT;
  }

  // Flatten all proposed and existing routes across layers
  const allProposed: InstallRouteModelV1[] = [];
  const allExisting: InstallRouteModelV1[] = [];
  for (const layer of markup.layers) {
    allProposed.push(...layer.proposed.routes);
    allExisting.push(...layer.existing.routes);
  }

  if (allProposed.length === 0) {
    return { ...EMPTY_RESULT, hasMarkup: true };
  }

  // Compute total length and bend counts
  let totalLengthM = 0;
  let totalBends = 0;
  let chasedLengthM = 0;
  let surfaceLengthM = 0;
  for (const route of allProposed) {
    const len = routeLengthM(route);
    totalLengthM += len;
    totalBends += countBends(route.path);
    if (route.mounting === 'chased' || route.mounting === 'screed') chasedLengthM += len;
    if (route.mounting === 'surface') surfaceLengthM += len;
  }

  const disruptionScore = computeDisruptionScore(allProposed);
  const disruptionBand = disruptionBandFromScore(disruptionScore);
  const alignmentSignal = computeAlignmentSignal(allProposed, allExisting);
  const materialEstimates = computeMaterialEstimates(allProposed);
  const complexityScore = computeComplexityScore(allProposed);
  const surfaceMountFraction = totalLengthM > 0
    ? Math.round((surfaceLengthM / totalLengthM) * 100) / 100
    : 0;
  const disruptionObjectiveDelta = computeDisruptionObjectiveDelta(disruptionScore, alignmentSignal);
  const narrativeSignals = buildNarrativeSignals(
    totalLengthM,
    totalBends,
    alignmentSignal,
    disruptionBand,
    materialEstimates,
    chasedLengthM,
  );

  return {
    hasMarkup: true,
    totalProposedLengthM: Math.round(totalLengthM * 10) / 10,
    totalBendCount: totalBends,
    materialEstimates,
    disruptionScore: Math.round(disruptionScore),
    disruptionBand,
    disruptionObjectiveDelta,
    alignmentSignal,
    surfaceMountFraction,
    complexityScore,
    narrativeSignals,
  };
}
