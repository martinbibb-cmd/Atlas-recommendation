/**
 * InstallMarkupModule.ts
 *
 * Consumes InstallLayerModelV1 from the engine input and derives:
 *
 *   - Total route lengths per kind (flow, return, gas, …)
 *   - Overall pipe complexity score (0–100)
 *   - Material estimates (linear metres per diameter)
 *   - Disruption intensity (how much building fabric must be disturbed)
 *   - Install feasibility signals for recommendation reasoning
 *   - Human-readable routing notes for reports / overlays
 *
 * Design rules:
 * - No Math.random() — all outputs are deterministic from input geometry.
 * - This module interprets geometry; it does NOT recommend systems.
 * - When installMarkup is absent the module returns a safe all-absent result.
 * - Complexity score uses only physics-grounded inputs (lengths, mounting,
 *   confidence, buried runs, diameter changes).
 */

import type {
  InstallLayerModelV1,
  InstallRouteModelV1,
  InstallRouteKind,
  InstallMounting,
} from './installMarkup.types';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Disruption weight per mounting type.
 * 'buried' is the most disruptive (screed / plaster break-out required).
 * 'surface' is the least disruptive (cosmetic boxing / painting only).
 */
const DISRUPTION_WEIGHT: Record<InstallMounting, number> = {
  surface:  0.2,
  boxed:    0.4,
  void:     0.5,
  buried:   1.0,
  external: 0.1,
} as const;

/**
 * Complexity contribution of the confidence level of each route.
 * 'estimated' routes carry more uncertainty → higher complexity contribution.
 */
const CONFIDENCE_COMPLEXITY: Record<InstallRouteModelV1['confidence'], number> = {
  measured:  0.0,
  drawn:     0.3,
  estimated: 0.8,
} as const;

/** Penalty added per diameter change within the proposed route set (m equivalent). */
const DIAMETER_CHANGE_PENALTY_M = 2;

/** Maximum raw disruption-metre value mapped to complexity score 100. */
const DISRUPTION_NORMALISER_M = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the Euclidean distance in 3-D metres between two path points.
 */
function segmentLengthM(
  a: { position: { x: number; y: number; z: number } },
  b: { position: { x: number; y: number; z: number } },
): number {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const dz = b.position.z - a.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Sum the total length (metres) of a route by walking its path segments.
 */
function routeLengthM(route: InstallRouteModelV1): number {
  if (route.path.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < route.path.length; i++) {
    total += segmentLengthM(route.path[i - 1], route.path[i]);
  }
  return total;
}

/**
 * Clamp a value to [0, 100].
 */
function clamp100(v: number): number {
  return Math.min(100, Math.max(0, v));
}

// ─── Result types ─────────────────────────────────────────────────────────────

/**
 * Material estimate for a single nominal pipe diameter.
 */
export interface PipeMaterialEstimate {
  /** Nominal bore in mm (e.g. 15, 22, 28). */
  diameterMm: number;
  /** Total linear metres of this diameter required. */
  linearMetres: number;
}

/**
 * Per-kind route length totals (metres).
 */
export type RouteLengthsByKind = Partial<Record<InstallRouteKind, number>>;

/**
 * Disruption intensity band derived from buried / hidden run lengths.
 *
 * 'minimal'  — almost all pipework is surface-run or external.
 * 'moderate' — some voids or boxing; limited plaster / screed break-out.
 * 'high'     — significant buried or voided runs; notable building works.
 */
export type InstallDisruptionBand = 'minimal' | 'moderate' | 'high';

/**
 * Install feasibility signal for a single property of the proposed system.
 */
export interface InstallFeasibilitySignal {
  /** Machine-readable identifier. */
  id: string;
  /** Human-readable title. */
  title: string;
  /** Explanatory text suitable for use in recommendations and reports. */
  detail: string;
  /** Traffic-light status. */
  status: 'pass' | 'warn' | 'info';
}

/**
 * Full result produced by runInstallMarkupModule().
 */
export interface InstallMarkupResult {
  /**
   * Total length of all proposed routes combined (metres).
   * Excludes existing routes.
   */
  totalProposedRouteLengthM: number;
  /**
   * Total length of all existing routes combined (metres).
   * Used to assess reuse potential.
   */
  totalExistingRouteLengthM: number;
  /**
   * Proposed route lengths broken down by kind (flow, return, gas, …).
   */
  proposedLengthsByKind: RouteLengthsByKind;
  /**
   * Material estimates for proposed pipework, grouped by nominal diameter.
   */
  materialEstimates: PipeMaterialEstimate[];
  /**
   * Physics-grounded complexity score for the proposed install (0–100).
   *
   * 0   = trivial (short surface runs, measured confidence, single diameter).
   * 100 = highly complex (long buried runs, multiple diameter changes, estimated geometry).
   */
  complexityScore: number;
  /**
   * Disruption intensity band derived from proposed route mounting types.
   */
  disruptionBand: InstallDisruptionBand;
  /**
   * Weighted disruption metres — the raw value behind disruptionBand.
   * Exposed for engine scoring (penalty contribution to disruption objective).
   */
  disruptionWeightedMetres: number;
  /**
   * The proportion (0–1) of existing route length that is retained in the
   * proposed system.  1.0 = all existing routes reused; 0.0 = full strip-out.
   * Null when there are no existing routes to compare against.
   */
  existingRouteReuseRatio: number | null;
  /**
   * Feasibility signals surfaced to recommendation reasoning.
   */
  feasibilitySignals: InstallFeasibilitySignal[];
  /**
   * Human-readable routing notes for reports and overlays.
   */
  routingNotes: string[];
}

// ─── Core derivation ──────────────────────────────────────────────────────────

/**
 * Aggregate lengths by route kind across a set of routes.
 */
function aggregateLengthsByKind(routes: InstallRouteModelV1[]): RouteLengthsByKind {
  const acc: RouteLengthsByKind = {};
  for (const route of routes) {
    const len = routeLengthM(route);
    acc[route.kind] = (acc[route.kind] ?? 0) + len;
  }
  return acc;
}

/**
 * Compute material estimates (linear metres per diameter) for a route set.
 */
function computeMaterialEstimates(routes: InstallRouteModelV1[]): PipeMaterialEstimate[] {
  const byDiameter = new Map<number, number>();
  for (const route of routes) {
    const len = routeLengthM(route);
    byDiameter.set(route.diameterMm, (byDiameter.get(route.diameterMm) ?? 0) + len);
  }
  return Array.from(byDiameter.entries())
    .sort(([a], [b]) => a - b)
    .map(([diameterMm, linearMetres]) => ({ diameterMm, linearMetres }));
}

/**
 * Compute the weighted disruption metres for a route set.
 * Each segment's length is multiplied by the disruption weight of its mounting type.
 */
function computeDisruptionWeightedMetres(routes: InstallRouteModelV1[]): number {
  let total = 0;
  for (const route of routes) {
    const len = routeLengthM(route);
    total += len * DISRUPTION_WEIGHT[route.mounting];
  }
  return total;
}

/**
 * Derive the disruption band from weighted metres.
 */
function deriveBand(disruptionWeightedM: number): InstallDisruptionBand {
  if (disruptionWeightedM < 4) return 'minimal';
  if (disruptionWeightedM < 12) return 'moderate';
  return 'high';
}

/**
 * Compute the complexity score (0–100) for a set of proposed routes.
 *
 * Components:
 *   1. Disruption-weighted length normalised to 0–60 points.
 *   2. Confidence penalty (estimated routes add up to 20 points).
 *   3. Diameter-change penalty (each change adds 2 m equivalent → up to 20 points).
 */
function computeComplexityScore(routes: InstallRouteModelV1[]): number {
  if (routes.length === 0) return 0;

  // Component 1: disruption contribution
  const disruptionM = computeDisruptionWeightedMetres(routes);
  const disruptionPoints = clamp100((disruptionM / DISRUPTION_NORMALISER_M) * 60);

  // Component 2: confidence uncertainty
  let confidencePoints = 0;
  for (const route of routes) {
    const len = routeLengthM(route);
    confidencePoints += len * CONFIDENCE_COMPLEXITY[route.confidence];
  }
  // Normalise confidence contribution against total length (max 20 points)
  const totalLen = routes.reduce((s, r) => s + routeLengthM(r), 0);
  const normalisedConfidence = totalLen > 0
    ? clamp100((confidencePoints / totalLen) * 20)
    : 0;

  // Component 3: diameter-change penalty
  const uniqueDiameters = new Set(routes.map(r => r.diameterMm)).size;
  const diameterChanges = Math.max(0, uniqueDiameters - 1);
  const diameterPoints = clamp100(
    ((diameterChanges * DIAMETER_CHANGE_PENALTY_M) / DISRUPTION_NORMALISER_M) * 20,
  );

  return clamp100(Math.round(disruptionPoints + normalisedConfidence + diameterPoints));
}

/**
 * Build install feasibility signals from the markup result.
 */
function buildFeasibilitySignals(
  layer: InstallLayerModelV1,
  proposedLengthsByKind: RouteLengthsByKind,
  disruptionBand: InstallDisruptionBand,
  complexityScore: number,
  existingReuseRatio: number | null,
): InstallFeasibilitySignal[] {
  const signals: InstallFeasibilitySignal[] = [];

  // Gas route present?
  const gasM = proposedLengthsByKind['gas'] ?? 0;
  if (gasM > 0) {
    signals.push({
      id: 'gas_route_present',
      title: 'Gas pipe extension required',
      detail: `The proposed install includes a new gas supply run of approximately ${gasM.toFixed(1)} m. A Gas Safe engineer must assess and certify the work.`,
      status: 'warn',
    });
  }

  // Buried pipework?
  const hasBuried = layer.proposed.routes.some(r => r.mounting === 'buried');
  if (hasBuried) {
    signals.push({
      id: 'buried_pipework',
      title: 'Buried pipework required',
      detail: 'Some proposed routes pass through screed or plaster. This increases installation disruption and extends completion time.',
      status: 'warn',
    });
  }

  // Estimated routes?
  const hasEstimated = layer.proposed.routes.some(r => r.confidence === 'estimated');
  if (hasEstimated) {
    signals.push({
      id: 'estimated_routes',
      title: 'Route lengths are estimated',
      detail: 'One or more proposed pipe runs were estimated rather than measured. Material quantities may vary. A site survey will improve accuracy.',
      status: 'info',
    });
  }

  // High disruption
  if (disruptionBand === 'high') {
    signals.push({
      id: 'high_disruption',
      title: 'This option requires complex routing',
      detail: `The proposed pipework involves significant building works. Disruption score: ${complexityScore}/100. Consider discussing disruption tolerance with the customer.`,
      status: 'warn',
    });
  }

  // Good existing reuse
  if (existingReuseRatio !== null && existingReuseRatio >= 0.7) {
    signals.push({
      id: 'good_existing_reuse',
      title: 'This option aligns with existing routes',
      detail: `Approximately ${Math.round(existingReuseRatio * 100)}% of existing pipework can be retained, reducing installation disruption and material cost.`,
      status: 'pass',
    });
  }

  // No proposed routes at all
  if (layer.proposed.routes.length === 0) {
    signals.push({
      id: 'no_proposed_routes',
      title: 'No proposed routes marked up',
      detail: 'Install markup is present but no proposed routes have been drawn. Routing complexity cannot be assessed.',
      status: 'info',
    });
  }

  return signals;
}

/**
 * Build human-readable routing notes for the report overlay.
 */
function buildRoutingNotes(
  proposedLengthsByKind: RouteLengthsByKind,
  materialEstimates: PipeMaterialEstimate[],
  disruptionBand: InstallDisruptionBand,
): string[] {
  const notes: string[] = [];

  const totalFlow = (proposedLengthsByKind['flow'] ?? 0) + (proposedLengthsByKind['return'] ?? 0);
  if (totalFlow > 0) {
    notes.push(`Primary heating circuit: ${totalFlow.toFixed(1)} m of flow/return pipework.`);
  }

  const dhwM = proposedLengthsByKind['dhw'] ?? 0;
  if (dhwM > 0) {
    notes.push(`On-demand hot water distribution: ${dhwM.toFixed(1)} m.`);
  }

  for (const est of materialEstimates) {
    notes.push(`${est.diameterMm} mm copper: ${est.linearMetres.toFixed(1)} m required.`);
  }

  const bandLabel: Record<InstallDisruptionBand, string> = {
    minimal:  'minimal disruption expected',
    moderate: 'moderate building works required',
    high:     'significant disruption — detailed site assessment advised',
  };
  notes.push(`Installation disruption: ${bandLabel[disruptionBand]}.`);

  return notes;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Derive install complexity, material estimates, and disruption signals from
 * an InstallLayerModelV1.
 *
 * When `installMarkup` is undefined (survey has no markup), returns a sentinel
 * result with zero values and an empty signals/notes array so downstream
 * callers do not need to null-guard.
 */
export function runInstallMarkupModule(
  installMarkup: InstallLayerModelV1 | undefined,
): InstallMarkupResult {
  if (installMarkup == null) {
    return {
      totalProposedRouteLengthM: 0,
      totalExistingRouteLengthM: 0,
      proposedLengthsByKind: {},
      materialEstimates: [],
      complexityScore: 0,
      disruptionBand: 'minimal',
      disruptionWeightedMetres: 0,
      existingRouteReuseRatio: null,
      feasibilitySignals: [],
      routingNotes: [],
    };
  }

  const { existing, proposed } = installMarkup;

  // Route lengths
  const totalProposedRouteLengthM = proposed.routes.reduce(
    (s, r) => s + routeLengthM(r),
    0,
  );
  const totalExistingRouteLengthM = existing.routes.reduce(
    (s, r) => s + routeLengthM(r),
    0,
  );

  const proposedLengthsByKind = aggregateLengthsByKind(proposed.routes);
  const materialEstimates = computeMaterialEstimates(proposed.routes);

  // Complexity and disruption
  const complexityScore = computeComplexityScore(proposed.routes);
  const disruptionWeightedMetres = computeDisruptionWeightedMetres(proposed.routes);
  const disruptionBand = deriveBand(disruptionWeightedMetres);

  // Reuse ratio: what fraction of existing route length is structurally shared
  // with the proposed routes.  We approximate this by comparing path overlap
  // between existing and proposed routes sharing the same mounting location.
  // V1 implementation: conservatively zero unless the proposed routes reuse
  // existing paths (identified by matching start/end positions within 0.5 m).
  let existingRouteReuseRatio: number | null = null;
  if (totalExistingRouteLengthM > 0) {
    let reusedM = 0;
    for (const proposedRoute of proposed.routes) {
      for (const existingRoute of existing.routes) {
        if (existingRoute.kind !== proposedRoute.kind) continue;
        if (existingRoute.path.length < 2 || proposedRoute.path.length < 2) continue;
        const pStart = proposedRoute.path[0].position;
        const eStart = existingRoute.path[0].position;
        const pEnd = proposedRoute.path[proposedRoute.path.length - 1].position;
        const eEnd = existingRoute.path[existingRoute.path.length - 1].position;
        const startDist = Math.sqrt(
          (pStart.x - eStart.x) ** 2 +
          (pStart.y - eStart.y) ** 2 +
          (pStart.z - eStart.z) ** 2,
        );
        const endDist = Math.sqrt(
          (pEnd.x - eEnd.x) ** 2 +
          (pEnd.y - eEnd.y) ** 2 +
          (pEnd.z - eEnd.z) ** 2,
        );
        if (startDist <= 0.5 && endDist <= 0.5) {
          reusedM += routeLengthM(existingRoute);
        }
      }
    }
    existingRouteReuseRatio = Math.min(1, reusedM / totalExistingRouteLengthM);
  }

  const feasibilitySignals = buildFeasibilitySignals(
    installMarkup,
    proposedLengthsByKind,
    disruptionBand,
    complexityScore,
    existingRouteReuseRatio,
  );

  const routingNotes = buildRoutingNotes(
    proposedLengthsByKind,
    materialEstimates,
    disruptionBand,
  );

  return {
    totalProposedRouteLengthM,
    totalExistingRouteLengthM,
    proposedLengthsByKind,
    materialEstimates,
    complexityScore,
    disruptionBand,
    disruptionWeightedMetres,
    existingRouteReuseRatio,
    feasibilitySignals,
    routingNotes,
  };
}
