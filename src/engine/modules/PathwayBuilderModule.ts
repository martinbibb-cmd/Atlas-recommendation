/**
 * PathwayBuilderModule – Expert-First Pathway Planning Layer
 *
 * Bridges the gap between physics constraints and a single recommendation.
 * Produces 2–3 pathway options ranked by physics facts + expert assumptions.
 *
 * Rules:
 *  - Physics is never overridden — only ranking and messaging are tuned.
 *  - Each pathway shows its constraints, unknowns, and how to unlock certainty.
 *  - Experts select a pathway; the engine never forces a single answer.
 */

import type { EngineOutputV1, PlanV1, PathwayOptionV1, ConfidenceV1 } from '../../contracts/EngineOutputV1';
import type { ExpertAssumptionsV1 } from '../schema/EngineInputV2_3';

// Minimal engine result shape needed by the builder
interface PathwayEngineSnapshot {
  /** Output produced by the core engine modules. */
  engineOutput: EngineOutputV1;
  /** Whether any limiter with id containing 'primary-pipe' is present at fail severity. */
  primaryPipeConstraintFail?: boolean;
  /** Whether the ASHP hydraulic verdict passed. */
  ashpHydraulicPass?: boolean;
  /** Dynamic mains flow rate (L/min) — undefined when not measured. */
  mainsDynamicFlowLpm?: number;
  /** Whether screed / leak risk is a concern (e.g. UFH or wet screed present). */
  screedLeakRisk?: boolean;
  /** Whether a combi is viable according to the engine. */
  combiViable?: boolean;
  /** Whether ASHP is viable according to the engine. */
  ashpViable?: boolean;
}

// Default expert assumptions when none are provided
const DEFAULT_ASSUMPTIONS: ExpertAssumptionsV1 = {
  disruptionTolerance: 'med',
  screedLeakRiskTolerance: 'normal',
  dhwExperiencePriority: 'normal',
  futureReadinessPriority: 'normal',
  comfortVsCost: 'balanced',
};

// ─── Confidence builders ──────────────────────────────────────────────────────

function highConfidence(unknowns?: string[], unlockBy?: string[]): ConfidenceV1 {
  return {
    level: 'high',
    reasons: ['All key constraints measured or well-characterised'],
    unknowns,
    unlockBy,
  };
}

function medConfidence(reasons: string[], unknowns?: string[], unlockBy?: string[]): ConfidenceV1 {
  return { level: 'medium', reasons, unknowns, unlockBy };
}

function lowConfidence(reasons: string[], unknowns?: string[], unlockBy?: string[]): ConfidenceV1 {
  return { level: 'low', reasons, unknowns, unlockBy };
}

// ─── Pathway builders ─────────────────────────────────────────────────────────

function buildDirectAshpPathway(rank: number, flowKnown: boolean): PathwayOptionV1 {
  const unknowns = flowKnown ? [] : ['Dynamic mains flow not measured'];
  const unlockBy = flowKnown ? [] : ['Measure dynamic flow at kitchen cold tap'];
  const confidence: ConfidenceV1 =
    unknowns.length > 0
      ? medConfidence(['Hydraulics passed but flow not directly measured'], unknowns, unlockBy)
      : highConfidence();

  return {
    id: 'direct_ashp',
    title: 'Direct ASHP Install',
    whenOffered: 'ASHP is hydraulically viable with no blocking constraints',
    rationale: [
      'No hydraulic blockers detected — primary pipe and heat loss support ASHP',
      'Mains flow and pressure adequate for an unvented cylinder',
      'Lowest long-run carbon and running cost trajectory',
    ],
    prerequisites: [],
    outcomeToday: [
      'Air Source Heat Pump installed now',
      'Unvented cylinder provides mains-pressure hot water',
      'Full low-temperature circuit optimisation available',
    ],
    confidence,
    rank,
  };
}

function buildBoilerMixergyEnablementPathway(
  rank: number,
  hasScreedRisk: boolean,
  hasPrimaryPipeConstraint: boolean,
): PathwayOptionV1 {
  const rationale: string[] = [
    'ASHP desired but a staged approach reduces risk and disruption',
    'Mixergy cylinder enables future ASHP connection without a second cylinder swap',
  ];
  const prerequisites = [];

  if (hasScreedRisk) {
    prerequisites.push({
      id: 'screed-remediation',
      text: 'Confirm screed integrity or plan leak-risk mitigation before ASHP install',
      limiterRef: 'screed-leak-risk',
    });
    rationale.push('Screed / underfloor leak risk must be mitigated before wet-side ASHP work');
  }

  if (hasPrimaryPipeConstraint) {
    prerequisites.push({
      id: 'primary-pipe-upgrade',
      text: 'Upgrade primary pipework to 28 mm before ASHP installation',
      limiterRef: 'primary-pipe-constraint',
    });
    rationale.push('Primary pipe upgrade needed before ASHP is hydraulically viable');
  }

  const unknowns: string[] = [];
  const unlockBy: string[] = [];
  if (hasPrimaryPipeConstraint) {
    unknowns.push('Primary pipe size confirmed but upgrade not yet scheduled');
    unlockBy.push('Confirm primary pipe upgrade scope and timeline');
  }

  return {
    id: 'boiler_mixergy_enablement',
    title: 'Boiler + Mixergy Now → ASHP Ready Later',
    whenOffered: 'ASHP desired but screed risk or primary pipe constraints are present',
    rationale,
    prerequisites,
    outcomeToday: [
      'High-efficiency boiler installed with Mixergy smart cylinder',
      'Mixergy demand-mirroring reduces cycling penalties vs standard combi',
      'System physically ready for future ASHP connection',
    ],
    outcomeAfterTrigger: [
      'Swap boiler for ASHP once pre-requisites are resolved',
      'Cylinder already ASHP-compatible — no second swap required',
    ],
    confidence: unknowns.length > 0
      ? medConfidence(['Prerequisites identified but not yet resolved'], unknowns, unlockBy)
      : highConfidence(),
    rank,
  };
}

function buildConvertLaterUnventedPathway(
  rank: number,
  mainsDynamicFlowLpm: number | undefined,
): PathwayOptionV1 {
  const flowLow = mainsDynamicFlowLpm !== undefined && mainsDynamicFlowLpm < 10;
  const flowUnknown = mainsDynamicFlowLpm === undefined;

  const unknowns: string[] = [];
  const unlockBy: string[] = [];

  if (flowUnknown) {
    unknowns.push('Dynamic mains flow not measured');
    unlockBy.push('Measure dynamic flow at kitchen cold tap (bucket test or flow meter)');
  } else if (flowLow) {
    unknowns.push(`Mains flow measured at ${mainsDynamicFlowLpm} L/min — below 10 L/min unvented threshold`);
    unlockBy.push('Confirm whether a mains upgrade is planned', 'Check loft tank as interim stored-water option');
  }

  return {
    id: 'convert_later_unvented',
    title: 'Vented Now → Unvented After Mains Upgrade',
    whenOffered: 'Mains flow is low (< 10 L/min) or confidence is low due to unmeasured flow',
    rationale: [
      'Current mains flow is insufficient for a reliable unvented cylinder',
      'Vented system works today without mains pressure dependency',
      'Convert to unvented once mains supply is upgraded',
    ],
    prerequisites: [
      {
        id: 'mains-flow-gate',
        text: 'Mains flow must reach ≥ 10 L/min before unvented cylinder install',
        limiterRef: 'mains-flow-constraint',
        triggerEvent: 'mains-upgrade',
      },
    ],
    outcomeToday: [
      'Vented (gravity-fed) stored hot water system installed',
      'Reliable supply regardless of mains pressure',
    ],
    outcomeAfterTrigger: [
      'Upgrade to unvented cylinder when mains supply permits',
      'Full mains-pressure hot water available',
    ],
    confidence: flowUnknown
      ? lowConfidence(['Dynamic mains flow not measured — cannot confirm unvented viability'], unknowns, unlockBy)
      : flowLow
      ? medConfidence(['Flow measured but below unvented threshold'], unknowns, unlockBy)
      : highConfidence(),
    rank,
  };
}

function buildCombiSingleTechPathway(rank: number): PathwayOptionV1 {
  return {
    id: 'combi_single_tech',
    title: 'Combi Boiler — Minimum Disruption',
    whenOffered: 'Combi is viable and disruption tolerance is low',
    rationale: [
      'Like-for-like replacement — no cylinder or pipework changes',
      'Lowest upfront disruption and installation time',
      'Viable for current occupancy and DHW demand profile',
    ],
    prerequisites: [],
    outcomeToday: [
      'Combi boiler installed — on-demand hot water, no cylinder',
      'Sealed CH circuit — no loft tank required',
    ],
    confidence: highConfidence(),
    rank,
  };
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build a PlanV1 from the engine result and optional expert assumptions.
 *
 * Pathway offer rules (MVP):
 *  - direct_ashp:               no blocking hydraulic constraints AND no screed risk AND ASHP viable
 *  - boiler_mixergy_enablement: ASHP desired/viable but screed risk OR primary pipe constraint present
 *  - convert_later_unvented:    mains flow < 10 L/min OR flow unknown AND confidence low
 *  - combi_single_tech:         combi viable AND disruptionTolerance === 'low'
 */
export function buildPathwaysV1(
  snapshot: PathwayEngineSnapshot,
  expertAssumptions?: ExpertAssumptionsV1,
): PlanV1 {
  const assumptions = expertAssumptions ?? DEFAULT_ASSUMPTIONS;
  const {
    engineOutput,
    primaryPipeConstraintFail = false,
    ashpHydraulicPass = false,
    mainsDynamicFlowLpm,
    screedLeakRisk = false,
    combiViable = false,
    ashpViable = false,
  } = snapshot;

  const flowLpm = mainsDynamicFlowLpm;
  const flowLow = flowLpm !== undefined && flowLpm < 10;
  const flowUnknown = flowLpm === undefined;
  const lowFlowOrUnknown = flowLow || flowUnknown;

  // Shared constraints from existing limiters
  const limiters = engineOutput.limiters?.limiters ?? [];
  const sharedConstraints = limiters
    .filter(l => l.severity === 'fail' || l.severity === 'warn')
    .map(l => ({ limiterId: l.id, summary: l.impact.summary }));

  const pathways: PathwayOptionV1[] = [];

  // ── Pathway 1: Direct ASHP ────────────────────────────────────────────────
  if (ashpViable && ashpHydraulicPass && !screedLeakRisk && !primaryPipeConstraintFail) {
    const flowKnown = flowLpm !== undefined && !flowLow;
    pathways.push(buildDirectAshpPathway(pathways.length + 1, flowKnown));
  }

  // ── Pathway 2: Boiler + Mixergy Enablement ────────────────────────────────
  if (ashpViable && (screedLeakRisk || primaryPipeConstraintFail)) {
    pathways.push(
      buildBoilerMixergyEnablementPathway(pathways.length + 1, screedLeakRisk, primaryPipeConstraintFail),
    );
  }

  // ── Pathway 3: Convert Later Unvented ─────────────────────────────────────
  if (lowFlowOrUnknown) {
    pathways.push(buildConvertLaterUnventedPathway(pathways.length + 1, flowLpm));
  }

  // ── Pathway 4: Combi Single Tech ──────────────────────────────────────────
  if (combiViable && assumptions.disruptionTolerance === 'low') {
    pathways.push(buildCombiSingleTechPathway(pathways.length + 1));
  }

  // ── Fallback: always offer at least one pathway ───────────────────────────
  if (pathways.length === 0) {
    // Offer boiler+mixergy as a safe default when no clear path found
    pathways.push(buildBoilerMixergyEnablementPathway(1, screedLeakRisk, primaryPipeConstraintFail));
  }

  // Re-sort by rank (ascending)
  pathways.sort((a, b) => a.rank - b.rank);

  return { pathways, sharedConstraints };
}

/**
 * Derive a PathwayEngineSnapshot from the minimal engine result fields needed by PathwayBuilderModule.
 */
export function snapshotFromResult(
  engineOutput: EngineOutputV1,
  opts: {
    mainsDynamicFlowLpm?: number;
    screedLeakRisk?: boolean;
    primaryPipeDiameter?: number;
  } = {},
): PathwayEngineSnapshot {
  const limiters = engineOutput.limiters?.limiters ?? [];
  const primaryPipeConstraintFail = limiters.some(
    l => l.id.includes('primary-pipe') && l.severity === 'fail',
  );

  const ashpEligibility = engineOutput.eligibility.find(e => e.id === 'ashp');
  const combiEligibility = engineOutput.eligibility.find(e => e.id === 'on_demand');
  const ashpViable = ashpEligibility?.status === 'viable';
  const combiViable =
    combiEligibility?.status === 'viable' || combiEligibility?.status === 'caution';

  // Infer ASHP hydraulic pass from eligibility and absence of hydraulic limiters
  const ashpHydraulicBlocker = limiters.some(
    l =>
      (l.id.includes('primary-pipe') || l.id.includes('flow-temp-too-high')) &&
      l.severity === 'fail',
  );
  const ashpHydraulicPass = ashpViable && !ashpHydraulicBlocker;

  return {
    engineOutput,
    primaryPipeConstraintFail,
    ashpHydraulicPass,
    mainsDynamicFlowLpm: opts.mainsDynamicFlowLpm,
    screedLeakRisk: opts.screedLeakRisk ?? false,
    combiViable,
    ashpViable,
  };
}
