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
  SystemWorkExplainerBlock,
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
  isVerificationItem,
  EMPTY_SCOPE_MESSAGE,
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
  workExplainer: 'system_work_explainer_cards',
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

// ─── Label helpers ────────────────────────────────────────────────────────────

function formatDwellingType(v: string): string {
  const map: Record<string, string> = {
    detached: 'Detached house',
    semi: 'Semi-detached house',
    end_terrace: 'End-terrace house',
    mid_terrace: 'Mid-terrace house',
    flat_ground: 'Ground-floor flat',
    flat_mid: 'Mid-floor flat',
    flat_penthouse: 'Penthouse flat',
  };
  return map[v] ?? v.replace(/_/g, ' ');
}

function formatDhwDeliveryMode(v: string): string {
  const map: Record<string, string> = {
    gravity: 'Tank-fed supply',
    pumped_from_tank: 'Tank-fed supply (pumped)',
    tank_pumped: 'Tank-fed supply (pumped)',
    pumped: 'Tank-fed supply (pumped)',
    mains_mixer: 'Mains-fed supply',
    accumulator_supported: 'Accumulator-supported',
    break_tank_booster: 'Break-tank booster',
    electric_cold_only: 'Electric cold only',
    unknown: 'Unknown',
  };
  return map[v] ?? v.replace(/_/g, ' ');
}

function formatEmitterType(v: string): string {
  const map: Record<string, string> = {
    radiators: 'Radiators',
    ufh: 'Underfloor heating',
    mixed: 'Radiators and underfloor',
  };
  return map[v] ?? v.replace(/_/g, ' ');
}

function formatWallType(v: string): string {
  const map: Record<string, string> = {
    cavity_insulated: 'Cavity wall (insulated)',
    cavity_uninsulated: 'Cavity wall (uninsulated)',
    solid_masonry: 'Solid masonry wall',
    solid_insulated: 'Solid wall (insulated)',
    timber_frame: 'Timber frame',
    unknown: 'Unknown',
  };
  return map[v] ?? v.replace(/_/g, ' ');
}

function formatPvStatus(v: string): string {
  const map: Record<string, string> = {
    none: 'Not installed',
    existing: 'Installed',
    planned: 'Planned',
  };
  return map[v] ?? v;
}

// ─── Facts block ──────────────────────────────────────────────────────────────

/**
 * Build the 'About your home' facts block from the decision and, when
 * available, the full survey input.  Survey-sourced fields are appended after
 * the core decision facts so the most engine-grounded values come first.
 */
function buildFactsBlock(
  decision: AtlasDecisionV1,
  input?: EngineInputV2_3,
): FactsBlock {
  // ── Core decision facts (engine-grounded) ────────────────────────────────
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

  // Include any engine facts not already covered (e.g. mains/pipe constraint)
  const extraDecisionFacts = decision.supportingFacts
    .filter((f) => !priorityLabels.includes(f.label))
    .slice(0, 2)
    .map((f) => ({ label: f.label, value: f.value }));

  const baseFacts = [...facts, ...extraDecisionFacts];

  // ── Additional survey-sourced fields ─────────────────────────────────────
  // Only appended when an engine input is available; each field is only added
  // when it carries a meaningful value (not 'unknown' or absent).
  const surveyFacts: Array<{ label: string; value: string | number }> = [];

  if (input) {
    // Property
    if (input.dwellingType) {
      surveyFacts.push({ label: 'Property type', value: formatDwellingType(input.dwellingType) });
    }
    if (input.bedrooms !== undefined) {
      surveyFacts.push({ label: 'Bedrooms', value: input.bedrooms });
    }

    // Heating demand
    if (input.heatLossWatts) {
      const kw = (input.heatLossWatts / 1000).toFixed(1);
      surveyFacts.push({ label: 'Peak heat loss', value: `${kw} kW` });
    }
    if (input.radiatorCount) {
      surveyFacts.push({ label: 'Radiators', value: input.radiatorCount });
    }
    if (input.emitterType && input.emitterType !== 'radiators') {
      surveyFacts.push({ label: 'Emitters', value: formatEmitterType(input.emitterType) });
    }

    // Pipework
    if (input.primaryPipeDiameter) {
      surveyFacts.push({ label: 'Pipe size', value: `${input.primaryPipeDiameter} mm` });
    }

    // Hot water
    if (input.dhwDeliveryMode && input.dhwDeliveryMode !== 'unknown') {
      surveyFacts.push({ label: 'Hot water type', value: formatDhwDeliveryMode(input.dhwDeliveryMode) });
    }
    if (input.cylinderVolumeLitres !== undefined) {
      surveyFacts.push({ label: 'Cylinder volume', value: `${input.cylinderVolumeLitres} L` });
    }

    // Water services
    const dynamicBar = input.dynamicMainsPressureBar ?? input.dynamicMainsPressure;
    if (dynamicBar !== undefined) {
      surveyFacts.push({ label: 'Mains pressure', value: `${dynamicBar.toFixed(1)} bar` });
    }

    // Building fabric
    const wallType = input.building?.fabric?.wallType;
    if (wallType && wallType !== 'unknown') {
      surveyFacts.push({ label: 'Wall type', value: formatWallType(wallType) });
    }

    // Low-carbon / future tech
    if (input.pvStatus && input.pvStatus !== 'none') {
      surveyFacts.push({ label: 'Solar PV', value: formatPvStatus(input.pvStatus) });
    }
    if (input.batteryStatus && input.batteryStatus !== 'none') {
      surveyFacts.push({ label: 'Battery storage', value: formatPvStatus(input.batteryStatus) });
    }
  }

  return {
    id: 'home-facts',
    type: 'facts',
    title: 'About your home',
    outcome: truncateText('Key facts about your home that shaped this recommendation.', MAX_OUTCOME_CHARS),
    visualKey: VK.facts,
    facts: [...baseFacts, ...surveyFacts],
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
    combi:   'on-demand hot water',
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

function buildIncludedScopeBlock(decision: AtlasDecisionV1): IncludedScopeBlock {
  const qscope = decision.quoteScope;

  // ── Included now (non-compliance, status='included', not verification) ─────
  let includedItems: QuoteScopeItem[];
  if (qscope.length > 0) {
    includedItems = qscope.filter(
      (s) =>
        s.status === 'included' &&
        s.category !== 'compliance' &&
        s.category !== 'future' &&
        !isVerificationItem(s.label),
    );
  } else {
    // Legacy fallback: synthesise from flat string list (filter verification items)
    includedItems = synthesizeLegacyScope(
      decision.includedItems.filter((label) => !isVerificationItem(label)),
    );
  }

  // ── Compliance requirements (status='included', category='compliance') ────
  const complianceItems: QuoteScopeItem[] = qscope.length > 0 ? scopeCompliance(qscope) : [];

  // ── Recommended upgrades (status='recommended') ───────────────────────────
  const recommendedItems: QuoteScopeItem[] = qscope.length > 0 ? scopeRecommended(qscope) : [];

  // ── Future options (status='optional', category='future') ─────────────────
  const futureItems: QuoteScopeItem[] = qscope.length > 0 ? scopeFuture(qscope) : [];

  // When no real included works have been captured, use the honest advisor
  // message rather than pretending the scope is complete.
  const hasRealWork = includedItems.length > 0;
  const outcome = hasRealWork
    ? 'Everything covered in the proposed scope of work.'
    : EMPTY_SCOPE_MESSAGE;

  return {
    id: 'included-scope',
    type: 'included_scope',
    title: 'What is included',
    outcome,
    items: includedItems,
    complianceItems,
    recommendedItems,
    futureItems,
    visualKey: VK.includedScope,
  };
}

/**
 * REAL_WORK_CATEGORIES — the scope categories that represent actual
 * installation deliverables a customer can see and benefit from.
 *
 * Explicitly excludes:
 *   - 'compliance' — regulatory requirements, not benefits
 *   - 'future'     — pathways, not current work
 *
 * Verification items (label matches isVerificationItem()) are also excluded
 * regardless of their category.
 */
const REAL_WORK_CATEGORIES = new Set<string>([
  'heat_source',
  'hot_water',
  'controls',
  'protection',
  'flush',
  'pipework',
]);

/**
 * buildSystemWorkExplainerBlock
 *
 * Builds a SystemWorkExplainerBlock from real included/recommended scope items.
 * Each card explains: what it is, what it does, and why it helps the customer.
 * Capped at 6 cards. Only emitted when there are items with meaningful descriptions.
 *
 * Verification notes (confirm/check/verify phrases) are excluded — they are
 * engineer pre-conditions, not customer deliverables.
 */
function buildSystemWorkExplainerBlock(
  decision: AtlasDecisionV1,
): SystemWorkExplainerBlock | null {
  const qscope = decision.quoteScope;
  if (qscope.length === 0) return null;

  const eligibleItems = qscope.filter(
    (s) =>
      (s.status === 'included' || s.status === 'recommended') &&
      REAL_WORK_CATEGORIES.has(s.category) &&
      !isVerificationItem(s.label) &&
      (s.whatItDoes ?? s.customerBenefit),
  );

  if (eligibleItems.length === 0) return null;

  const cards = eligibleItems.slice(0, 6).map((item) => ({
    whatItIs:   item.label,
    whatItDoes: item.whatItDoes ?? '',
    whyItHelps: item.customerBenefit ?? '',
  }));

  return {
    id: 'system-work-explainer',
    type: 'system_work_explainer',
    title: 'What the work involves',
    outcome: 'A plain-English guide to each item in your scope.',
    cards,
    visualKey: VK.workExplainer,
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

  // 2. Home facts — expanded with survey data when input is available
  blocks.push(buildFactsBlock(decision, input));

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

  // 7. Included scope — always emitted; shows empty-scope message when nothing captured
  const includedScopeBlock = buildIncludedScopeBlock(decision);
  blocks.push(includedScopeBlock);

  // 7b. System work explainer — only when scope items have descriptions
  const workExplainerBlock = buildSystemWorkExplainerBlock(decision);
  if (workExplainerBlock) blocks.push(workExplainerBlock);

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
