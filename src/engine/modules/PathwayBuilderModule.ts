/**
 * PathwayBuilderModule.ts
 *
 * Generates 2–3 expert-facing pathway options from physics constraints.
 *
 * PRINCIPLES
 * - The engine provides physics truth + constraints.
 * - The expert selects the plan; this module documents consequences and prerequisites.
 * - Separate: facts vs derived outcomes vs choices.
 * - Avoid hard "No" — use "not advisable under current constraints" or
 *   "possible, but requires prerequisite" language.
 *
 * Pathway ranking is influenced by ExpertAssumptionsV1 (risk appetite / priorities)
 * but the underlying physics is unchanged.
 */

import type { FullEngineResultCore, EngineInputV2_3, ExpertAssumptionsV1 } from '../schema/EngineInputV2_3';
import type { PlanV1, PathwayOptionV1, ConfidenceV1 } from '../../contracts/EngineOutputV1';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Minimum dynamic mains flow required for unvented cylinder installation (L/min). */
const MIN_UNVENTED_FLOW_LPM = 10;

/** Maximum number of pathway options to surface per plan. */
const MAX_PATHWAYS = 3;

function highConfidence(reasons: string[]): ConfidenceV1 {
  return { level: 'high', reasons };
}

function mediumConfidence(reasons: string[], unknowns?: string[], unlockBy?: string[]): ConfidenceV1 {
  return { level: 'medium', reasons, unknowns, unlockBy };
}

// ── Pathway builders ──────────────────────────────────────────────────────────

/**
 * Pathway A: Direct ASHP installation.
 * Only ranked #1 when all hydraulic/screed prerequisites are already met.
 */
function buildDirectAshpPathway(rank: number): PathwayOptionV1 {
  return {
    id: 'direct_ashp',
    title: 'Direct ASHP installation',
    rationale:
      'Pipework and emitter temperatures already support heat pump operation. ' +
      'No intermediate steps required.',
    outcomeToday:
      'Heat pump installed immediately. Lower running costs and reduced carbon footprint from day one.',
    prerequisites: [],
    confidence: highConfidence(['Hydraulic constraints are met', 'Pipework is already suitable']),
    rank,
  };
}

/**
 * Pathway B: Boiler + Mixergy now, ASHP later.
 * Recommended when ASHP is the best end-state but current constraints (screed,
 * budget, pipework) make immediate installation inadvisable.
 */
function buildBoilerMixergyEnablementPathway(
  rank: number,
  hasScreedRisk: boolean,
  hasHydraulicConstraint: boolean,
): PathwayOptionV1 {
  const prerequisites = [];

  if (hasScreedRisk) {
    prerequisites.push({
      description: 'Screed floor pipework must be inspected and confirmed pressure-tested before ASHP upgrade',
      triggerEvent: 'Planned renovation or floor works',
      limiterRef: 'screed-pipe-risk',
    });
  }
  if (hasHydraulicConstraint) {
    prerequisites.push({
      description: 'Upgrade primary pipework to 28 mm to support heat pump flow rates',
      triggerEvent: 'Boiler replacement works or planned renovation',
      limiterRef: 'primary-pipe-constraint',
    });
  }
  prerequisites.push({
    description: 'ASHP installation when budget and timing allow',
    triggerEvent: 'Boiler end-of-life or budget available',
  });

  const unknowns = [];
  const unlockBy = [];
  if (hasScreedRisk) {
    unknowns.push('Screed floor pipe condition unknown');
    unlockBy.push('Pressure-test existing screed pipework');
  }
  if (hasHydraulicConstraint) {
    unknowns.push('Primary pipe upgrade cost not surveyed');
    unlockBy.push('Obtain quote for 28 mm primary pipework upgrade');
  }

  return {
    id: 'boiler_mixergy_enablement',
    title: 'Boiler + Mixergy now, ASHP later',
    rationale:
      'ASHP is the best long-term option if prerequisites are met, but current constraints make immediate ' +
      'installation inadvisable. A new efficient boiler paired with a Mixergy smart cylinder ' +
      'is a legitimate engineering strategy: it delivers reliable DHW today, ' +
      'reduces cycling losses, and keeps the ASHP pathway open for later.',
    outcomeToday:
      'Reliable hot water from Mixergy smart cylinder with reduced cycling penalties. ' +
      'High-efficiency boiler lowers running costs immediately.',
    outcomeAfterTrigger:
      'After prerequisite works, ASHP can be installed. Mixergy cylinder is fully compatible ' +
      'with ASHP operation, so no DHW replacement is needed.',
    prerequisites,
    confidence:
      unknowns.length > 0
        ? mediumConfidence(
            ['Boiler+Mixergy is viable under current constraints'],
            unknowns,
            unlockBy,
          )
        : highConfidence(['Boiler+Mixergy is viable under current constraints']),
    rank,
  };
}

/**
 * Pathway C: Unvented stored DHW now, convert to ASHP when mains supply upgraded.
 * Recommended when mains flow is too low for unvented today but a supply upgrade
 * is planned or possible.
 */
function buildConvertLaterUnventedPathway(
  rank: number,
  mainsFlowLpm: number | undefined,
): PathwayOptionV1 {
  const mainsLabel =
    mainsFlowLpm != null ? `${mainsFlowLpm} L/min` : 'unknown — not measured';

  return {
    id: 'convert_later_unvented',
    title: 'Vented cylinder now, convert to unvented later',
    rationale:
      `Mains supply (${mainsLabel}) does not currently meet the ${MIN_UNVENTED_FLOW_LPM} L/min @ 1 bar ` +
      `threshold for unvented installation. A vented cylinder provides reliable stored ` +
      `hot water today. Unvented upgrade becomes viable after supply works.`,
    outcomeToday:
      'Vented cylinder provides adequate stored DHW. No simultaneous demand risk. ' +
      'Performance is adequate but does not benefit from mains pressure.',
    outcomeAfterTrigger:
      'After mains supply upgrade, cylinder can be replaced with an unvented unit ' +
      'for mains-pressure DHW throughout.',
    prerequisites: [
      {
        description: 'Mains supply upgrade to ≥ 18 L/min dynamic flow',
        triggerEvent: 'Street supply works or water authority upgrade',
        limiterRef: 'mains-flow-constraint',
      },
      {
        description: 'G3 unvented cylinder installation by competent person',
        triggerEvent: 'After supply upgrade confirmed',
      },
    ],
    confidence: mediumConfidence(
      ['Vented cylinder is viable under current mains supply'],
      mainsFlowLpm == null
        ? ['Mains dynamic flow rate not measured']
        : [`Mains flow (${mainsLabel}) is below unvented threshold`],
      mainsFlowLpm == null
        ? ['Measure dynamic flow with flow cup + static/dynamic pressure test']
        : ['Contact water authority about supply upgrade options'],
    ),
    rank,
  };
}

/**
 * Pathway D: Combi boiler (single-tech, low complexity).
 * Offered when combi is viable and disruption tolerance is low.
 */
function buildCombiPathway(rank: number): PathwayOptionV1 {
  return {
    id: 'combi_single_tech',
    title: 'Combi boiler (low disruption)',
    rationale:
      'Combi boiler provides on-demand hot water with minimal installation disruption. ' +
      'No cylinder space required.',
    outcomeToday:
      'On-demand hot water and space heating from a single appliance. ' +
      'Lowest upfront disruption and cost.',
    prerequisites: [],
    confidence: highConfidence(['Combi is viable under current constraints']),
    rank,
  };
}

// ── Constraint analysis helpers ───────────────────────────────────────────────

function detectScreedRisk(input: EngineInputV2_3): boolean {
  // Heuristic: microbore topology is used as a proxy indicator for screed-embedded UFH
  // pipework, as microbore systems are commonly installed in underfloor heating circuits.
  // This is a conservative heuristic — not all microbore systems have screed pipework,
  // but treating it cautiously prevents under-warning on screed leak risk.
  return input.pipingTopology === 'microbore';
}

function detectLowMainsFlow(result: FullEngineResultCore, input: EngineInputV2_3): boolean {
  const mainsFlowLpm = input.mainsDynamicFlowLpm ?? result.cwsSupplyV1.dynamic?.flowLpm;
  if (mainsFlowLpm == null) return false;
  return mainsFlowLpm < MIN_UNVENTED_FLOW_LPM;
}

function detectMainsFlowUnknown(result: FullEngineResultCore, input: EngineInputV2_3): boolean {
  const mainsFlowLpm = input.mainsDynamicFlowLpm ?? result.cwsSupplyV1.dynamic?.flowLpm;
  return mainsFlowLpm == null;
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Builds a PlanV1 containing 2–3 pathway options for expert selection.
 *
 * The pathways surface engineering trade-offs and sequencing — the expert
 * selects the plan; the engine documents consequences and prerequisites.
 */
export function buildPathwaysV1(
  result: FullEngineResultCore,
  input: EngineInputV2_3,
  expertAssumptions?: ExpertAssumptionsV1,
): PlanV1 {
  const ea = expertAssumptions ?? {};
  const disruptionTolerance = ea.disruptionTolerance ?? 'low';
  const futureReadiness = ea.futureReadinessPriority ?? 'normal';
  const screedRisk = ea.screedLeakRiskTolerance ?? 'cautious';
  const spacePriority = ea.spaceSavingPriority ?? 'low';

  const hasScreedRisk = detectScreedRisk(input) && screedRisk === 'cautious';
  const hasHydraulicConstraint = result.hydraulicV1.verdict.ashpRisk !== 'pass';
  const ashpViable = !result.redFlags.rejectAshp && result.hydraulicV1.verdict.ashpRisk !== 'fail';
  // When space-saving priority is high, treat borderline (warn) combi as viable for pathway building.
  const combiPhysicsViable = (result.combiDhwV1?.verdict.combiRisk ?? 'pass') !== 'fail' && !result.redFlags.rejectCombi;
  const combiViable = combiPhysicsViable &&
    ((result.combiDhwV1?.verdict.combiRisk ?? 'pass') !== 'warn' || spacePriority === 'high' || spacePriority === 'medium');
  const lowMainsFlow = detectLowMainsFlow(result, input);
  const mainsUnknown = detectMainsFlowUnknown(result, input);
  const mainsFlowLpm = input.mainsDynamicFlowLpm ?? result.cwsSupplyV1.dynamic?.flowLpm;

  const pathways: PathwayOptionV1[] = [];
  const sharedConstraints: string[] = [];

  // Populate shared constraints from physics facts
  if (hasHydraulicConstraint) {
    const ashp = result.hydraulicV1.ashp;
    sharedConstraints.push(
      `Primary pipework requires ${ashp.flowLpm.toFixed(1)} L/min for ASHP — ` +
      `current sizing is a constraint on direct heat pump installation.`,
    );
  }
  if (hasScreedRisk) {
    sharedConstraints.push(
      'Screed floor pipework present — pressure integrity must be confirmed before ASHP.',
    );
  }
  if (lowMainsFlow) {
    sharedConstraints.push(
      `Mains dynamic flow (${mainsFlowLpm} L/min) is below the 10 L/min threshold ` +
      `for unvented cylinder installation.`,
    );
  }
  if (mainsUnknown) {
    sharedConstraints.push(
      'Mains dynamic flow rate not measured — unvented eligibility cannot be confirmed. ' +
      'Unlock by: measuring with flow cup + static/dynamic pressure test.',
    );
  }

  // Scenario 1: ASHP is viable directly (no blocking constraints)
  // Suppress ASHP from pathways when space-saving priority is high and combi is viable —
  // the customer has expressed a clear preference for compact systems.
  const suppressAshpForSpace = spacePriority === 'high' && combiPhysicsViable;
  if (ashpViable && !hasScreedRisk && !hasHydraulicConstraint && !suppressAshpForSpace) {
    const directAshpRank = futureReadiness === 'high' ? 1 : disruptionTolerance === 'low' ? 2 : 1;
    pathways.push(buildDirectAshpPathway(directAshpRank));
  }

  // Scenario 2: ASHP is the best end-state but an enablement path is needed.
  // This applies whether ASHP is currently viable (but constrained) or blocked —
  // the expert may still want to preserve the heat-pump pathway.
  if (!suppressAshpForSpace && (hasScreedRisk || hasHydraulicConstraint)) {
    const enablementRank = futureReadiness === 'high' ? 1 : 2;
    pathways.push(buildBoilerMixergyEnablementPathway(enablementRank, hasScreedRisk, hasHydraulicConstraint));
  } else if (!suppressAshpForSpace && !ashpViable && futureReadiness === 'high') {
    // ASHP not viable for other reasons but expert wants future readiness — show blocked enablement path
    pathways.push(buildBoilerMixergyEnablementPathway(2, false, true));
  }

  // Scenario 3: Low mains flow → convert later pathway
  if (lowMainsFlow || mainsUnknown) {
    const convertRank = pathways.length + 1;
    pathways.push(buildConvertLaterUnventedPathway(convertRank, mainsFlowLpm));
  }

  // Scenario 4: Combi (low disruption or high space priority) — always offered when viable
  // High space priority overrides the disruption-tolerance gate so combi always surfaces.
  const offerCombi = combiViable && (disruptionTolerance === 'low' || spacePriority === 'high' || spacePriority === 'medium');
  if (offerCombi) {
    // Only add combi if no pathway already covers the low-disruption case
    const alreadyHasLowDisruption = pathways.some(p => p.id === 'combi_single_tech');
    if (!alreadyHasLowDisruption) {
      const combiRank = (disruptionTolerance === 'low' || spacePriority !== 'low') && futureReadiness !== 'high' ? 1 : pathways.length + 1;
      pathways.push(buildCombiPathway(combiRank));
    }
  }

  // Fallback: if no pathways generated, provide a minimal two-option set
  if (pathways.length === 0) {
    if (combiViable) {
      pathways.push(buildCombiPathway(1));
    }
    pathways.push(buildBoilerMixergyEnablementPathway(combiViable ? 2 : 1, hasScreedRisk, hasHydraulicConstraint));
  }

  // Limit to MAX_PATHWAYS max; sort by rank ascending
  const sortedPathways = pathways
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_PATHWAYS);

  return {
    pathways: sortedPathways,
    sharedConstraints,
  };
}
