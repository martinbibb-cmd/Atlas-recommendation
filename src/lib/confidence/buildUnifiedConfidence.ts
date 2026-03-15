/**
 * buildUnifiedConfidence.ts
 *
 * PR9 — Canonical unified confidence model for Atlas recommendations.
 *
 * Confidence is split into three independent contributors:
 *   Data confidence      (50%): How much was measured vs inferred vs missing.
 *   Physics confidence   (30%): How hard the recommendation is constrained by
 *                               real physical thresholds.
 *   Decision separation  (20%): How clearly the recommended option beats
 *                               alternatives for the current objective.
 *
 * The result is a single UnifiedConfidence object reused by the simulator,
 * advice page, and print output.  All outputs are deterministic.
 *
 * Weights: Data 50% · Physics 30% · Decision 20%
 *
 * Level thresholds:  ≥ 75 → high  |  ≥ 50 → medium  |  < 50 → low
 */

import type { EngineOutputV1, EvidenceItemV1 } from '../../contracts/EngineOutputV1';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';

// ─── Output type ──────────────────────────────────────────────────────────────

export interface UnifiedConfidence {
  /** Combined confidence score: dataPct×0.5 + physicsPct×0.3 + decisionPct×0.2. */
  overallPct: number;
  /** Overall confidence band. */
  level: 'high' | 'medium' | 'low';
  /** Data quality score (0–100): proportion of critical fields that are measured. */
  dataPct: number;
  /** Physics certainty score (0–100): hard-constraint vs assumption-driven verdict. */
  physicsPct: number;
  /** Decision separation score (0–100): margin between the recommended and next-best option. */
  decisionPct: number;
  /** Human-readable labels of fields that were directly measured. */
  measured: string[];
  /** Human-readable labels of fields that were inferred or derived. */
  inferred: string[];
  /** Human-readable labels of fields that are absent and reduce certainty. */
  missing: string[];
  /** Ordered list of actions that would raise confidence further. */
  nextBestChecks: string[];
}

// ─── Data confidence ──────────────────────────────────────────────────────────

/**
 * High-weight evidence fields and their relative weights.
 * These are the inputs that most determine recommendation quality.
 */
const CRITICAL_EVIDENCE_FIELDS: ReadonlyArray<{
  id: string;
  label: string;
  weight: number;
}> = [
  { id: 'ev-heat-loss',              label: 'Design heat loss',                  weight: 20 },
  { id: 'ev-mains-pressure-dynamic', label: 'Mains dynamic pressure',            weight: 15 },
  { id: 'ev-primary-pipe',           label: 'Primary pipe size',                 weight: 15 },
  { id: 'ev-combi-simultaneity',     label: 'Bathrooms / simultaneous outlets',  weight: 15 },
  { id: 'ev-available-space',        label: 'Available cylinder space',           weight: 15 },
  { id: 'ev-mains-flow',             label: 'Mains flow rate',                   weight: 10 },
  { id: 'ev-cylinder-volume',        label: 'Current cylinder type / volume',    weight: 10 },
];

/** Next-best-check strings keyed by evidence item ID. */
const EVIDENCE_NEXT_CHECKS: Readonly<Record<string, string>> = {
  'ev-heat-loss':              'Calculate or confirm design heat loss (kW)',
  'ev-mains-pressure-dynamic': 'Measure mains dynamic pressure under flow',
  'ev-primary-pipe':           'Confirm primary pipe diameter (mm)',
  'ev-combi-simultaneity':     'Confirm bathroom count and simultaneous outlet use',
  'ev-available-space':        'Confirm cylinder siting and available space',
  'ev-mains-flow':             'Confirm measured mains flow at working draw-off',
  'ev-cylinder-volume':        'Confirm current cylinder type and volume',
};

/**
 * Determine the data status of the cylinder volume field from raw engine input
 * when the evidence array does not include an 'ev-cylinder-volume' item.
 */
function cylinderVolumeStatusFromInput(
  input: EngineInputV2_3,
): 'measured' | 'inferred' | 'missing' {
  if (input.currentCylinderPresent === false) return 'measured'; // known-absent
  if (input.cylinderVolumeLitres != null) return 'measured';
  if (input.dhwStorageType != null && input.dhwStorageType !== 'none') return 'inferred';
  return 'missing';
}

/**
 * Determine the data status of the mains flow field from raw engine input
 * when the evidence array does not include a confirmed flow item.
 */
function mainsFlowStatusFromInput(
  input: EngineInputV2_3,
): 'measured' | 'inferred' | 'missing' {
  if (input.mainsDynamicFlowLpmKnown === true) return 'measured';
  if (input.mainsDynamicFlowLpm != null) return 'inferred';
  return 'missing';
}

/**
 * Resolve the data status of a critical field.
 *
 * Priority: evidence array → supplemental input check → inferred fallback.
 */
function resolveFieldStatus(
  fieldId: string,
  evidenceMap: ReadonlyMap<string, EvidenceItemV1>,
  input?: EngineInputV2_3,
): 'measured' | 'inferred' | 'missing' {
  const item = evidenceMap.get(fieldId);
  if (item) {
    if (item.source === 'manual') return 'measured';
    if (item.source === 'placeholder') return 'missing';
    return 'inferred'; // 'assumed' | 'derived'
  }

  // Supplemental field checks when not in evidence
  if (input) {
    if (fieldId === 'ev-mains-flow') return mainsFlowStatusFromInput(input);
    if (fieldId === 'ev-cylinder-volume') return cylinderVolumeStatusFromInput(input);
  }

  // Not in evidence and no input — treat as inferred (not zero, not full)
  return 'inferred';
}

function computeDataConfidence(
  evidence: EvidenceItemV1[],
  input?: EngineInputV2_3,
): {
  dataPct: number;
  measured: string[];
  inferred: string[];
  missing: string[];
  nextBestChecks: string[];
} {
  const measured: string[] = [];
  const inferred: string[] = [];
  const missing: string[] = [];
  const nextBestChecks: string[] = [];

  const evidenceMap = new Map<string, EvidenceItemV1>(evidence.map(e => [e.id, e]));

  let weightedScore = 0;
  let totalWeight = 0;

  for (const field of CRITICAL_EVIDENCE_FIELDS) {
    totalWeight += field.weight;
    const status = resolveFieldStatus(field.id, evidenceMap, input);

    if (status === 'measured') {
      weightedScore += field.weight;
      measured.push(field.label);
    } else if (status === 'inferred') {
      weightedScore += field.weight * 0.5;
      inferred.push(field.label);
      const check = EVIDENCE_NEXT_CHECKS[field.id];
      if (check) nextBestChecks.push(check);
    } else {
      // missing
      missing.push(field.label);
      const check = EVIDENCE_NEXT_CHECKS[field.id];
      if (check) nextBestChecks.push(check);
    }
  }

  const dataPct = totalWeight > 0
    ? Math.round((weightedScore / totalWeight) * 100)
    : 50;

  return {
    dataPct: Math.max(0, Math.min(100, dataPct)),
    measured,
    inferred,
    missing,
    // Surface missing fields first (highest leverage), then inferred; max 3 checks.
    nextBestChecks: nextBestChecks.slice(0, MAX_NEXT_BEST_CHECKS),
  };
}

// ─── Scoring constants ────────────────────────────────────────────────────────

/**
 * Maximum number of actionable "next best check" items to surface per result.
 * Keeping this small (3) ensures the output remains scannable.
 */
const MAX_NEXT_BEST_CHECKS = 3;

/**
 * Physics confidence scoring adjustments.
 *
 * Positive values raise confidence (hard constraint confirmed by measurement).
 * Negative values lower confidence (assumption-driven or soft constraint).
 */
const PHYSICS_BONUS_HARD_MEASURED = 6;   // Hard constraint confirmed by a measured source
const PHYSICS_PENALTY_HARD_ASSUMED = -5; // Hard constraint but based on assumptions
const PHYSICS_PENALTY_SOFT_ASSUMED = -3; // Soft constraint based on assumptions
const PHYSICS_PENALTY_WARN_ASSUMPTION = -8;  // Significant assumption (severity: warn)
const PHYSICS_PENALTY_INFO_ASSUMPTION = -3;  // Minor assumption (severity: info)
const PHYSICS_PENALTY_UNMEASURED_KEY_FIELD = -10; // Physics-critical field not measured

/**
 * Limiter IDs that represent hard physical constraints rather than soft preferences.
 * When driven by measured sources, these significantly increase physics confidence.
 */
const HARD_CONSTRAINT_IDS: ReadonlySet<string> = new Set([
  'mains-flow-constraint',
  'combi-concurrency-constraint',
  'primary-pipe-constraint',
  'flow-temp-too-high-for-ashp',
  'radiator-output-insufficient',
]);

function computePhysicsConfidence(output: EngineOutputV1): number {
  const limiters = output.limiters?.limiters ?? [];
  const assumptions = [
    ...(output.meta?.assumptions ?? []),
    ...(output.verdict?.assumptionsUsed ?? []),
  ];
  const evidence = output.evidence ?? [];

  let score = 70; // base

  // Hard constraint limiters with measured sources raise confidence
  for (const limiter of limiters) {
    const isHardConstraint = HARD_CONSTRAINT_IDS.has(limiter.id);
    const measuredSource = limiter.sources.some(s => s.kind === 'measured');
    const highSeverity = limiter.severity === 'fail' || limiter.severity === 'warn';

    if (isHardConstraint && measuredSource && highSeverity) {
      score += PHYSICS_BONUS_HARD_MEASURED;
    } else if (isHardConstraint && !measuredSource) {
      score += PHYSICS_PENALTY_HARD_ASSUMED;
    } else if (!isHardConstraint && !measuredSource) {
      score += PHYSICS_PENALTY_SOFT_ASSUMED;
    }
  }

  // Penalty for significant assumptions
  for (const assumption of assumptions) {
    if (assumption.severity === 'warn') {
      score += PHYSICS_PENALTY_WARN_ASSUMPTION;
    } else if (assumption.severity === 'info') {
      score += PHYSICS_PENALTY_INFO_ASSUMPTION;
    }
  }

  // Penalty when physics-critical evidence relies on assumptions or is missing
  for (const item of evidence) {
    if (
      (item.id === 'ev-heat-loss' || item.id === 'ev-mains-pressure-dynamic') &&
      (item.source === 'assumed' || item.source === 'placeholder')
    ) {
      score += PHYSICS_PENALTY_UNMEASURED_KEY_FIELD;
    }
  }

  return Math.max(40, Math.min(95, Math.round(score)));
}

// ─── Decision confidence ──────────────────────────────────────────────────────

function computeDecisionConfidence(output: EngineOutputV1): number {
  const options = output.options ?? [];

  // Collect valid scores from non-rejected options
  const scores = options
    .filter(o => o.status !== 'rejected' && o.score != null)
    .map(o => o.score!.total)
    .sort((a, b) => b - a); // descending

  if (scores.length === 0) {
    // No scores — use engine confidence level as a proxy
    const level =
      output.meta?.confidence?.level ??
      output.verdict?.confidence?.level;
    if (level === 'high')   return 85;
    if (level === 'medium') return 65;
    if (level === 'low')    return 45;
    return 65; // default
  }

  if (scores.length === 1) {
    return 88; // Single viable option — maximum separation by definition
  }

  const gap = scores[0] - scores[1];
  if (gap >= 20) return 90;
  if (gap >= 15) return 80;
  if (gap >= 10) return 70;
  if (gap >= 5)  return 60;
  return 50; // Options are close — low separation confidence
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build a unified confidence object from engine output and optional survey input.
 *
 * All outputs are deterministic — same input always produces same output.
 * No Math.random().
 *
 * @param output - Engine output (options, evidence, limiters, verdict used).
 * @param input  - Optional engine input for supplemental field presence checks.
 * @returns UnifiedConfidence with overall score, three contributors, and action list.
 */
export function buildUnifiedConfidence(
  output: EngineOutputV1,
  input?: EngineInputV2_3,
): UnifiedConfidence {
  const evidence = output.evidence ?? [];

  const { dataPct, measured, inferred, missing, nextBestChecks } =
    computeDataConfidence(evidence, input);

  const physicsPct   = computePhysicsConfidence(output);
  const decisionPct  = computeDecisionConfidence(output);

  // Weighted combination: Data 50% · Physics 30% · Decision 20%
  const overallPct = Math.round(
    dataPct   * 0.50 +
    physicsPct * 0.30 +
    decisionPct * 0.20,
  );

  const level: UnifiedConfidence['level'] =
    overallPct >= 75 ? 'high'   :
    overallPct >= 50 ? 'medium' :
    'low';

  return {
    overallPct,
    level,
    dataPct,
    physicsPct,
    decisionPct,
    measured,
    inferred,
    missing,
    nextBestChecks,
  };
}
