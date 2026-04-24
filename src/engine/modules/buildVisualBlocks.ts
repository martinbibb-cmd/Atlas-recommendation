/**
 * buildVisualBlocks.ts — Assembles a fixed-order VisualBlock[] from an
 * AtlasDecisionV1 and the evaluated ScenarioResult array.
 *
 * Page order (hardcoded — do not make dynamic until PR3+):
 *  1. Hero          — recommended system, short summary, top reasons
 *  2. Home facts    — strongest supporting facts (occupants, bathrooms, etc.)
 *  3. Problem       — why the weaker pathway struggles
 *  4. Solution      — why the recommended system works in this home
 *  5. Daily use     — day-to-day lived-experience cards
 *  6. Included scope — works and items in the proposed scope
 *  7. Warning       — compatibility warnings or lifecycle risk (when relevant)
 *  8. Future upgrades — paths this recommendation enables
 *  9. Portal CTA    — closing block
 *
 * Rules:
 *  - No block contains long-form paragraphs. outcome = one sentence.
 *  - supportingPoints capped at 3 items.
 *  - No recommendation logic is re-derived here — all content flows from
 *    AtlasDecisionV1 or ScenarioResult fields.
 *  - A lifecycle WarningBlock is emitted automatically when condition is
 *    'worn' or 'at_risk'.
 */

import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { PortalLaunchContext } from '../../contracts/PortalLaunchContext';
import type { EngineerLayout } from '../../contracts/EngineerLayout';
import type {
  VisualBlock,
  HeroBlock,
  FactsBlock,
  ProblemBlock,
  SolutionBlock,
  DailyUseBlock,
  IncludedScopeBlock,
  WarningBlock,
  FutureUpgradeBlock,
  PortalCtaBlock,
  SpatialProofBlock,
} from '../../contracts/VisualBlock';

// ─── Visual key constants ─────────────────────────────────────────────────────

const VK = {
  hero: 'recommended_system_hero',
  facts: 'home_facts_overview',
  combiProblem: 'combi_concurrency_problem',
  ashpProblem: 'ashp_pipe_limit_problem',
  solution: 'stored_hot_water_solution',
  dailyUse: 'daily_use_showers',
  includedScope: 'included_scope_system_boiler_mixergy',
  lifecycleWarning: 'boiler_lifecycle_warning',
  futureUpgrade: 'future_upgrade_solar',
  portalCta: 'portal_demo_cta',
  spatialProof: 'spatial_proof_where_work_happens',
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp an array to at most `max` items. */
function top<T>(arr: T[], max: number): T[] {
  return arr.slice(0, max);
}

/** Pick the ScenarioResult whose scenarioId matches, or undefined. */
function findScenario(
  scenarios: ScenarioResult[],
  id: string,
): ScenarioResult | undefined {
  return scenarios.find((s) => s.scenarioId === id);
}

/**
 * Choose the "weaker" scenario to illustrate the problem block.
 * Prefers a scenario with physics flags that signal a real problem.
 * Falls back to the first non-recommended scenario.
 */
function pickWeakerScenario(
  scenarios: ScenarioResult[],
  recommendedId: string,
): ScenarioResult | undefined {
  const others = scenarios.filter((s) => s.scenarioId !== recommendedId);
  if (others.length === 0) return undefined;

  // Prefer a scenario with a concrete physics flag that maps to a problem block
  const flagged = others.find(
    (s) =>
      s.physicsFlags.combiFlowRisk ||
      s.physicsFlags.hydraulicLimit ||
      s.physicsFlags.pressureConstraint,
  );
  return flagged ?? others[0];
}

/** Derive a semantic visual key for the problem block based on physics flags. */
function problemVisualKey(scenario: ScenarioResult): string {
  if (scenario.physicsFlags.combiFlowRisk) return VK.combiProblem;
  if (scenario.physicsFlags.hydraulicLimit) return VK.ashpProblem;
  return VK.combiProblem;
}

// ─── Block builders ───────────────────────────────────────────────────────────

function buildHeroBlock(decision: AtlasDecisionV1): HeroBlock {
  return {
    id: 'hero',
    type: 'hero',
    recommendedScenarioId: decision.recommendedScenarioId,
    title: 'Recommended system',
    outcome: decision.headline,
    supportingPoints: top(decision.keyReasons, 3),
    visualKey: VK.hero,
  };
}

function buildFactsBlock(decision: AtlasDecisionV1): FactsBlock {
  // Surface the strongest supporting facts — capped at 5 to stay concise
  const priorityLabels = [
    'Occupants',
    'Bathrooms',
    'System age',
    'Boiler type',
    'Condition band',
  ];

  const facts = decision.supportingFacts
    .filter((f) => priorityLabels.includes(f.label))
    .slice(0, 5)
    .map((f) => ({ label: f.label, value: f.value }));

  // Include any facts not already covered (e.g. mains/pipe constraint)
  const extraFacts = decision.supportingFacts
    .filter((f) => !priorityLabels.includes(f.label))
    .slice(0, 2)
    .map((f) => ({ label: f.label, value: f.value }));

  return {
    id: 'home-facts',
    type: 'facts',
    title: 'About this home',
    outcome: 'Key facts that shaped the recommendation.',
    visualKey: VK.facts,
    facts: [...facts, ...extraFacts],
  };
}

function buildProblemBlock(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
): ProblemBlock | null {
  const weaker = pickWeakerScenario(scenarios, decision.recommendedScenarioId);
  if (!weaker) return null;

  // Skip the problem block when the weaker scenario has no constraints to surface
  if (weaker.keyConstraints.length === 0) return null;

  const systemTypeLabel: Record<ScenarioResult['system']['type'], string> = {
    combi:   'combi boiler',
    system:  'system boiler',
    regular: 'regular boiler',
    ashp:    'heat pump',
  };
  const title = `Why a ${systemTypeLabel[weaker.system.type]} struggles here`;

  return {
    id: 'problem',
    type: 'problem',
    scenarioId: weaker.scenarioId,
    title,
    outcome: weaker.keyConstraints[0],
    supportingPoints: top(weaker.keyConstraints.slice(1), 2),
    visualKey: problemVisualKey(weaker),
  };
}

function buildSolutionBlock(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
): SolutionBlock {
  const recommended = findScenario(scenarios, decision.recommendedScenarioId);
  return {
    id: 'solution',
    type: 'solution',
    scenarioId: decision.recommendedScenarioId,
    title: 'Why this works for your home',
    outcome: recommended?.system.summary ?? decision.summary,
    supportingPoints: top(decision.keyReasons, 3),
    visualKey: VK.solution,
  };
}

function buildDailyUseBlock(decision: AtlasDecisionV1): DailyUseBlock {
  return {
    id: 'daily-use',
    type: 'daily_use',
    scenarioId: decision.recommendedScenarioId,
    title: 'Day-to-day experience',
    outcome: 'What living with this system will feel like.',
    examples: top(decision.dayToDayOutcomes, 3),
    visualKey: VK.dailyUse,
  };
}

function buildIncludedScopeBlock(decision: AtlasDecisionV1): IncludedScopeBlock {
  return {
    id: 'included-scope',
    type: 'included_scope',
    title: 'What is included',
    outcome: 'Everything covered in the proposed scope of work.',
    items: decision.includedItems,
    visualKey: VK.includedScope,
  };
}

/**
 * Build warning blocks from compatibility warnings and lifecycle condition.
 * Returns an empty array if there is nothing to surface.
 */
function buildWarningBlocks(decision: AtlasDecisionV1): WarningBlock[] {
  const blocks: WarningBlock[] = [];

  // Lifecycle warning — emitted when condition is worn or at_risk
  const condition = decision.lifecycle.currentSystem.condition;
  if (condition === 'worn' || condition === 'at_risk') {
    blocks.push({
      id: 'lifecycle-warning',
      type: 'warning',
      severity: 'important',
      title: 'Current boiler condition',
      outcome: decision.lifecycle.summary,
      supportingPoints: top(decision.lifecycle.riskIndicators, 3),
      visualKey: VK.lifecycleWarning,
    });
  }

  // Compatibility warnings from the recommendation
  if (decision.compatibilityWarnings.length > 0) {
    blocks.push({
      id: 'compatibility-warning',
      type: 'warning',
      severity: 'advisory',
      title: 'Installation considerations',
      outcome: top(decision.compatibilityWarnings, 1)[0],
      supportingPoints: top(decision.compatibilityWarnings.slice(1), 2),
      visualKey: VK.lifecycleWarning,
    });
  }

  return blocks;
}

function buildFutureUpgradeBlock(decision: AtlasDecisionV1): FutureUpgradeBlock | null {
  if (decision.futureUpgradePaths.length === 0) return null;

  return {
    id: 'future-upgrades',
    type: 'future_upgrade',
    title: 'Future upgrade paths',
    outcome: 'This system is designed to grow with your home.',
    paths: decision.futureUpgradePaths,
    visualKey: VK.futureUpgrade,
  };
}

function buildPortalCtaBlock(launchContext: PortalLaunchContext): PortalCtaBlock {
  return {
    id: 'portal-cta',
    type: 'portal_cta',
    title: 'See your full Atlas report',
    outcome: 'Explore the interactive model, costs, and comparison in your portal.',
    visualKey: VK.portalCta,
    launchContext,
  };
}

// ─── Confidence label helpers ─────────────────────────────────────────────────

const ROUTE_STATUS_LABEL: Record<string, string> = {
  existing:  'existing',
  proposed:  'proposed',
  assumed:   'needs verification',
};

const ROUTE_TYPE_LABEL: Record<string, string> = {
  flow:        'heating flow route',
  return:      'heating return route',
  cold:        'cold water supply route',
  hot:         'hot water supply route',
  condensate:  'condensate route',
  discharge:   'discharge route',
};

/**
 * buildSpatialProofBlock
 *
 * Derives a customer-facing SpatialProofBlock from EngineerLayout truth.
 * Returns null when no meaningful spatial data is available.
 *
 * Rules:
 *  - Derives content entirely from the supplied EngineerLayout.
 *  - Assumed routes are labelled "needs verification" — never presented as confirmed.
 *  - Route and object counts are capped to keep the block concise.
 *  - No engineer-internal confidence levels exposed verbatim.
 */
export function buildSpatialProofBlock(layout: EngineerLayout): SpatialProofBlock | null {
  const { rooms, objects, routes = [] } = layout;

  // Require at least one room or object to emit a spatial block
  if (rooms.length === 0 && objects.length === 0) return null;

  // Rooms — up to 4 distinct room names
  const roomNames = top(
    rooms.map((r) => r.name).filter(Boolean),
    4,
  );

  // Key objects — boiler and cylinder surface as named location strings
  const keyObjects: string[] = top(
    objects
      .filter((o) => o.type === 'boiler' || o.type === 'cylinder' || o.type === 'flue')
      .map((o) => {
        const label = o.label ?? o.type.charAt(0).toUpperCase() + o.type.slice(1);
        const location = o.positionHint ?? (o.roomId ? rooms.find((r) => r.id === o.roomId)?.name : undefined);
        return location ? `${label} — ${location}` : label;
      }),
    4,
  );

  // Route summaries — softened by status
  const routeSummary: string[] = top(
    routes.map((r) => {
      const typeLabel = ROUTE_TYPE_LABEL[r.type] ?? r.type;
      const statusLabel = ROUTE_STATUS_LABEL[r.status] ?? r.status;
      if (r.fromLabel && r.toLabel) {
        return `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} from ${r.fromLabel} to ${r.toLabel} (${statusLabel})`;
      }
      return `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} (${statusLabel})`;
    }),
    4,
  );

  // Confidence summary — plain customer-facing status sentences
  const confidenceSummary: string[] = [];

  const boilerObj = objects.find((o) => o.type === 'boiler');
  if (boilerObj) {
    if (boilerObj.confidence === 'confirmed' || boilerObj.confidence === 'inferred') {
      confidenceSummary.push('Boiler location recorded');
    } else {
      confidenceSummary.push('Boiler location to be confirmed on site');
    }
  }

  const cylinderObj = objects.find((o) => o.type === 'cylinder');
  if (cylinderObj) {
    if (cylinderObj.confidence === 'confirmed' || cylinderObj.confidence === 'inferred') {
      confidenceSummary.push('Cylinder position planned');
    } else {
      confidenceSummary.push('Cylinder position to be agreed on site');
    }
  }

  const hasAssumedRoute = routes.some((r) => r.status === 'assumed' || r.confidence === 'needs_verification');
  const hasDischargeRoute = routes.some((r) => r.type === 'discharge' || r.type === 'condensate');
  if (hasDischargeRoute && hasAssumedRoute) {
    confidenceSummary.push('Discharge route needs checking');
  } else if (hasDischargeRoute) {
    confidenceSummary.push('Discharge route identified');
  }

  if (confidenceSummary.length === 0 && roomNames.length > 0) {
    confidenceSummary.push('Room layout recorded');
  }

  return {
    id: 'spatial-proof',
    type: 'spatial_proof',
    title: 'Where the work happens',
    outcome: 'A summary of where the proposed system will be installed in your home.',
    visualKey: VK.spatialProof,
    rooms: roomNames,
    keyObjects,
    routeSummary,
    confidenceSummary: top(confidenceSummary, 3),
  };
}

// ─── Public builder ───────────────────────────────────────────────────────────

/**
 * buildVisualBlocks
 *
 * Converts an AtlasDecisionV1 and its evaluated ScenarioResult array into an
 * ordered VisualBlock[] that drives both the customer pack and portal deck.
 *
 * The page order is fixed for PR2. Do not make it dynamic until PR3+.
 *
 * @param layout — Optional EngineerLayout. When present, a SpatialProofBlock is
 *                 inserted before the Portal CTA to show the customer where the
 *                 work will happen.
 */
export function buildVisualBlocks(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
  layout?: EngineerLayout,
): VisualBlock[] {
  const blocks: VisualBlock[] = [];

  // 1. Hero
  blocks.push(buildHeroBlock(decision));

  // 2. Home facts
  blocks.push(buildFactsBlock(decision));

  // 3. Problem — weaker option (omitted if only one scenario)
  const problemBlock = buildProblemBlock(decision, scenarios);
  if (problemBlock) blocks.push(problemBlock);

  // 4. Solution
  blocks.push(buildSolutionBlock(decision, scenarios));

  // 5. Daily use
  if (decision.dayToDayOutcomes.length > 0) {
    blocks.push(buildDailyUseBlock(decision));
  }

  // 6. Included scope
  if (decision.includedItems.length > 0) {
    blocks.push(buildIncludedScopeBlock(decision));
  }

  // 7. Warnings (lifecycle + compatibility) — lifecycle first
  for (const w of buildWarningBlocks(decision)) {
    blocks.push(w);
  }

  // 8. Future upgrades
  const futureBlock = buildFutureUpgradeBlock(decision);
  if (futureBlock) blocks.push(futureBlock);

  // 9. Spatial proof — where the work happens (omitted when no layout is supplied)
  if (layout) {
    const spatialBlock = buildSpatialProofBlock(layout);
    if (spatialBlock) blocks.push(spatialBlock);
  }

  // 10. Portal CTA
  blocks.push(buildPortalCtaBlock({ recommendedScenarioId: decision.recommendedScenarioId }));

  return blocks;
}
