/**
 * buildVisualBlocks.ts — Assembles a fixed-order VisualBlock[] from an
 * AtlasDecisionV1 and the evaluated ScenarioResult array.
 *
 * Page order (hardcoded — do not make dynamic until PR3+):
 *  1. Hero                     — recommended system, short summary, top reasons
 *  2. Home facts               — strongest supporting facts (occupants, bathrooms, etc.)
 *  3. Customer need resolution — "What matters to you" (omitted when no survey signals)
 *  4. Problem                  — why the weaker pathway struggles
 *  5. Solution                 — why the recommended system works in this home
 *  6. Daily use                — day-to-day lived-experience cards
 *  7. Included scope           — works and items in the proposed scope
 *  8. Warning                  — compatibility warnings or lifecycle risk (when relevant)
 *  9. Future upgrades          — paths this recommendation enables
 * 10. Portal CTA               — closing block
 *
 * Rules:
 *  - No block contains long-form paragraphs. outcome = one sentence.
 *  - supportingPoints capped at 3 items.
 *  - No recommendation logic is re-derived here — all content flows from
 *    AtlasDecisionV1 or ScenarioResult fields.
 *  - A lifecycle WarningBlock is emitted automatically when condition is
 *    'worn' or 'at_risk'.
 *  - CustomerNeedResolutionBlock is only emitted when survey evidence is present.
 */

import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { PortalLaunchContext } from '../../contracts/PortalLaunchContext';
import type { EngineerLayout } from '../../contracts/EngineerLayout';
import type {
  VisualBlock,
  HeroBlock,
  FactsBlock,
  CustomerNeedResolutionBlock,
  ProblemBlock,
  SolutionBlock,
  DailyUseBlock,
  IncludedScopeBlock,
  WarningBlock,
  FutureUpgradeBlock,
  PortalCtaBlock,
  SpatialProofBlock,
} from '../../contracts/VisualBlock';
import {
  scopeFuturePaths,
  scopeCompliance,
  scopeRecommended,
  scopeFuture,
  synthesizeLegacyScope,
} from './buildQuoteScope';
import type { QuoteScopeItem } from '../../contracts/QuoteScope';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import { buildCustomerNeedResolution } from './buildCustomerNeedResolution';

// ─── Text length limits ───────────────────────────────────────────────────────

/** Maximum character count for a block title. */
const MAX_TITLE_CHARS   = 70;
/** Maximum character count for a block outcome sentence. */
const MAX_OUTCOME_CHARS = 140;
/** Maximum character count for a single supporting point. */
const MAX_POINT_CHARS   = 110;

/**
 * Hard-truncate a string to `max` characters.
 * Appends an ellipsis when truncation occurs.
 * Long physics prose must stay in the portal, not the print pack.
 */
function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}\u2026`;
}

function truncatePoints(points: string[]): string[] {
  return points.map((p) => truncateText(p, MAX_POINT_CHARS));
}

// ─── Visual key constants ─────────────────────────────────────────────────────

const VK = {
  hero: 'recommended_system_hero',
  facts: 'home_facts_overview',
  customerNeedResolution: 'customer_need_resolution',
  combiProblem: 'combi_concurrency_problem',
  ashpProblem: 'ashp_pipe_limit_problem',
  solution: 'stored_hot_water_solution',
  dailyUse: 'daily_use_showers',
  includedScope: 'included_scope_system_boiler_mixergy',
  lifecycleWarning: 'boiler_lifecycle_warning',
  showerWarning: 'shower_compatibility_warning',
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
 * Only returns a scenario when it has a concrete physics flag — we never
 * emit a generic "why X struggles" explainer page for a system that has
 * no measured constraint against this home.
 */
function pickWeakerScenario(
  scenarios: ScenarioResult[],
  recommendedId: string,
): ScenarioResult | undefined {
  const others = scenarios.filter((s) => s.scenarioId !== recommendedId);
  if (others.length === 0) return undefined;

  // Only surface a problem block when an actual physics flag exists.
  // Without a flag, the scenario has no concrete measured constraint to
  // explain, and we would produce a generic combi page that does not belong.
  return others.find(
    (s) =>
      s.physicsFlags.combiFlowRisk ||
      s.physicsFlags.hydraulicLimit ||
      s.physicsFlags.pressureConstraint,
  );
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
    title: truncateText('Recommended system', MAX_TITLE_CHARS),
    outcome: truncateText(decision.headline, MAX_OUTCOME_CHARS),
    supportingPoints: truncatePoints(top(decision.keyReasons, 3)),
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
    outcome: truncateText('Key facts that shaped the recommendation.', MAX_OUTCOME_CHARS),
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

  const homeNeedLabels: Record<ScenarioResult['system']['type'], string> = {
    combi:   'stored hot water',
    system:  'mains-fed supply',
    regular: 'mains-fed supply',
    ashp:    'a conventional system',
  };
  const title = `Why your home needs ${homeNeedLabels[weaker.system.type]}`;

  return {
    id: 'problem',
    type: 'problem',
    scenarioId: weaker.scenarioId,
    title: truncateText(title, MAX_TITLE_CHARS),
    outcome: truncateText(weaker.keyConstraints[0], MAX_OUTCOME_CHARS),
    supportingPoints: truncatePoints(top(weaker.keyConstraints.slice(1), 2)),
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
    outcome: truncateText(recommended?.system.summary ?? decision.summary, MAX_OUTCOME_CHARS),
    supportingPoints: truncatePoints(top(decision.keyReasons, 3)),
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

function buildIncludedScopeBlock(decision: AtlasDecisionV1): IncludedScopeBlock | null {
  const qscope = decision.quoteScope;

  // ── Included now (non-compliance, status='included') ──────────────────────
  let includedItems: QuoteScopeItem[];
  if (qscope.length > 0) {
    includedItems = qscope.filter(
      (s) => s.status === 'included' && s.category !== 'compliance' && s.category !== 'future',
    );
  } else {
    // Legacy fallback: synthesise from flat string list
    includedItems = synthesizeLegacyScope(decision.includedItems);
  }

  // ── Compliance requirements (status='included', category='compliance') ────
  const complianceItems: QuoteScopeItem[] = qscope.length > 0 ? scopeCompliance(qscope) : [];

  // ── Recommended upgrades (status='recommended') ───────────────────────────
  const recommendedItems: QuoteScopeItem[] = qscope.length > 0 ? scopeRecommended(qscope) : [];

  // ── Future options (status='optional', category='future') ─────────────────
  const futureItems: QuoteScopeItem[] = qscope.length > 0 ? scopeFuture(qscope) : [];

  // Emit the block only when there is something to show across any group.
  const totalItems =
    includedItems.length + complianceItems.length + recommendedItems.length + futureItems.length;
  if (totalItems === 0) return null;

  return {
    id: 'included-scope',
    type: 'included_scope',
    title: 'What is included',
    outcome: 'Everything covered in the proposed scope of work.',
    items: includedItems,
    complianceItems,
    recommendedItems,
    futureItems,
    visualKey: VK.includedScope,
  };
}

/**
 * Build warning blocks from compatibility warnings and lifecycle condition.
 * Returns an empty array if there is nothing to surface.
 *
 * Block order: lifecycle → shower compatibility → physics compatibility.
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

  // Shower compatibility warning — dedicated block when a note is present
  const shower = decision.showerCompatibilityNote;
  if (shower) {
    blocks.push({
      id: 'shower-compatibility-warning',
      type: 'warning',
      severity: shower.severity,
      title: 'Shower compatibility',
      outcome: shower.customerSummary,
      visualKey: VK.showerWarning,
    });
  }

  // Physics compatibility warnings from the recommendation (exclude shower
  // summary which is already surfaced in the shower block above)
  const physicsWarnings = shower
    ? decision.compatibilityWarnings.filter((w) => w !== shower.customerSummary)
    : decision.compatibilityWarnings;

  if (physicsWarnings.length > 0) {
    blocks.push({
      id: 'compatibility-warning',
      type: 'warning',
      severity: 'advisory',
      title: 'Installation considerations',
      outcome: top(physicsWarnings, 1)[0],
      supportingPoints: top(physicsWarnings.slice(1), 2),
      visualKey: VK.lifecycleWarning,
    });
  }

  return blocks;
}

function buildFutureUpgradeBlock(decision: AtlasDecisionV1): FutureUpgradeBlock | null {
  // Use canonical scope to get future paths with included items already filtered out.
  // Fall back to futureUpgradePaths string list when quoteScope is empty.
  const paths = decision.quoteScope.length > 0
    ? scopeFuturePaths(decision.quoteScope)
    : decision.futureUpgradePaths;

  if (paths.length === 0) return null;

  return {
    id: 'future-upgrades',
    type: 'future_upgrade',
    title: 'Future upgrade paths',
    outcome: 'This system is designed to grow with your home.',
    paths,
    visualKey: VK.futureUpgrade,
  };
}

function buildPortalCtaBlock(launchContext: PortalLaunchContext): PortalCtaBlock {
  return {
    id: 'portal-cta',
    type: 'portal_cta',
    title: 'Open your portal',
    outcome: 'Explore the interactive model, costs, and comparison in your portal.',
    supportingPoints: [
      'Understand this recommendation in more depth',
      'Explore costs, timelines, and alternatives',
      'Share your recommendation with household members',
    ],
    visualKey: VK.portalCta,
    launchContext,
  };
}

// ─── Confidence label helpers ─────────────────────────────────────────────────

/**
 * Maps route status to customer-facing language.
 * 'assumed' maps to 'needs verification' intentionally — never present
 * an assumed route as a confirmed fact to the customer.
 */
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

/** Capitalise the first character of a string. */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

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
        const label = o.label ?? capitalize(o.type);
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
        return `${capitalize(typeLabel)} from ${r.fromLabel} to ${r.toLabel} (${statusLabel})`;
      }
      return `${capitalize(typeLabel)} (${statusLabel})`;
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
 * @param input  — Optional EngineInputV2_3. When present, a CustomerNeedResolutionBlock
 *                 is inserted after the Facts block when survey signals are detected.
 */
export function buildVisualBlocks(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
  layout?: EngineerLayout,
  input?: EngineInputV2_3,
): VisualBlock[] {
  const blocks: VisualBlock[] = [];

  // 1. Hero
  blocks.push(buildHeroBlock(decision));

  // 2. Home facts
  blocks.push(buildFactsBlock(decision));

  // 3. Customer need resolution — personalised "What matters to you" block
  //    Only emitted when survey signals are present (no generic filler).
  if (input) {
    const recommendedScenario = scenarios.find(
      (s) => s.scenarioId === decision.recommendedScenarioId,
    );
    if (recommendedScenario) {
      const needResolutionBlock: CustomerNeedResolutionBlock | null =
        buildCustomerNeedResolution(decision, input, recommendedScenario);
      if (needResolutionBlock) blocks.push(needResolutionBlock);
    }
  }

  // 4. Problem — weaker option (omitted if only one scenario)
  const problemBlock = buildProblemBlock(decision, scenarios);
  if (problemBlock) blocks.push(problemBlock);

  // 5. Solution
  blocks.push(buildSolutionBlock(decision, scenarios));

  // 6. Daily use
  if (decision.dayToDayOutcomes.length > 0) {
    blocks.push(buildDailyUseBlock(decision));
  }

  // 7. Included scope — null when no items in scope or includedItems
  const includedScopeBlock = buildIncludedScopeBlock(decision);
  if (includedScopeBlock) blocks.push(includedScopeBlock);

  // 8. Warnings (lifecycle + compatibility) — lifecycle first
  for (const w of buildWarningBlocks(decision)) {
    blocks.push(w);
  }

  // 9. Future upgrades
  const futureBlock = buildFutureUpgradeBlock(decision);
  if (futureBlock) blocks.push(futureBlock);

  // 10. Spatial proof — where the work happens (omitted when no layout is supplied)
  if (layout) {
    const spatialBlock = buildSpatialProofBlock(layout);
    if (spatialBlock) blocks.push(spatialBlock);
  }

  // 11. Portal CTA
  blocks.push(buildPortalCtaBlock({ recommendedScenarioId: decision.recommendedScenarioId }));

  return blocks;
}
