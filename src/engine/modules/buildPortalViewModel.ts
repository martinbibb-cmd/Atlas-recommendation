/**
 * buildPortalViewModel.ts — Derives the portal view model from canonical
 * decision, scenario, and visual block data.
 *
 * Design rules:
 *   - No recommendation logic re-derived here — content flows entirely from
 *     AtlasDecisionV1, ScenarioResult[], and the supplied VisualBlock[].
 *   - Deterministic — no Math.random(), no timestamps.
 *   - Outputs are card-sized; no long-form paragraphs.
 *   - Recommendation remains primary; alternatives are subordinate.
 */

import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { VisualBlock, SpatialProofBlock } from '../../contracts/VisualBlock';
import type { DailyUseSimulation } from '../../contracts/DailyUseSimulation';
import { buildDailyUseSimulation } from './buildDailyUseSimulation';
import { scopeIncluded } from './buildQuoteScope';

// ─── Tab identifiers ──────────────────────────────────────────────────────────

export type PortalTabId =
  | 'recommended'
  | 'why'
  | 'compare'
  | 'daily_use'
  | 'future';

// ─── Card types ───────────────────────────────────────────────────────────────

/** A single proof card for the "Why Atlas chose this" tab. */
export interface ProofCard {
  id: string;
  /** Short card heading, e.g. "Key reason" or "Avoided risk". */
  title: string;
  /** The main evidence value — one sentence. */
  value: string;
  /** Optional short supporting points (up to 3). */
  supportingPoints?: string[];
}

/** Comparison card for the "Compare other options" tab. */
export interface ComparisonCard {
  scenarioId: string;
  /** Customer-facing system name, e.g. "Combi boiler". */
  title: string;
  /** True when this is the recommended scenario. */
  isRecommended: boolean;
  /** One-sentence fit summary for this scenario. */
  summary: string;
  /** Up to 3 top strengths. */
  strengths: string[];
  /** Up to 3 top constraints. */
  constraints: string[];
}

/** Day-to-day outcome card for the "Daily-use demo" tab. */
export interface DailyUseCard {
  scenarioId: string;
  /** Card heading. */
  title: string;
  /** What the customer can expect day-to-day. */
  outcomes: string[];
}

// ─── Portal view model ────────────────────────────────────────────────────────

export interface PortalViewModel {
  /** Ordered tab definitions. */
  tabs: Array<{ id: PortalTabId; label: string }>;

  /** VisualBlocks for the "Recommended for you" tab (hero/facts/solution/warning/scope). */
  recommendedBlocks: VisualBlock[];

  /** Proof cards for the "Why Atlas chose this" tab. */
  whyCards: ProofCard[];

  /** One card per scenario for the "Compare other options" tab — recommended first. */
  comparisonCards: ComparisonCard[];

  /** Day-to-day outcome cards for the "Daily-use demo" tab. */
  dailyUseCards: DailyUseCard[];

  /** Interactive daily-use simulator for the recommended scenario (PR5). */
  dailyUseSimulation: DailyUseSimulation | null;

  /** VisualBlocks for the "Future upgrades" tab (future_upgrade blocks only). */
  futureBlocks: VisualBlock[];

  /**
   * Optional spatial proof block for the "Why Atlas chose this" tab.
   * Present only when the deck contains a spatial_proof block derived from EngineerLayout.
   */
  spatialProof: SpatialProofBlock | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp an array to at most `max` items. */
function top<T>(arr: T[], max: number): T[] {
  return arr.slice(0, max);
}

const SYSTEM_TYPE_LABEL: Record<ScenarioResult['system']['type'], string> = {
  combi:   'Combi boiler',
  system:  'System boiler',
  regular: 'Regular boiler',
  ashp:    'Heat pump',
};

// ─── Block selectors ──────────────────────────────────────────────────────────

const RECOMMENDED_TAB_TYPES = new Set<VisualBlock['type']>([
  'hero',
  'facts',
  'customer_need_resolution',
  'solution',
  'system_work_explainer',
  'warning',
  'included_scope',
]);
const FUTURE_TAB_TYPES = new Set<VisualBlock['type']>(['future_upgrade']);

// ─── Card builders ────────────────────────────────────────────────────────────

function buildWhyCards(decision: AtlasDecisionV1): ProofCard[] {
  const cards: ProofCard[] = [];

  // Key reasons — one card per reason, grouped under "Key reason"
  decision.keyReasons.forEach((reason, i) => {
    cards.push({
      id: `reason-${i}`,
      title: 'Key reason',
      value: reason,
    });
  });

  // Avoided risks — one card per risk
  decision.avoidedRisks.forEach((risk, i) => {
    cards.push({
      id: `avoided-risk-${i}`,
      title: 'Avoided risk',
      value: risk,
    });
  });

  // Supporting facts — surfaced as evidence cards
  top(decision.supportingFacts, 4).forEach((fact) => {
    cards.push({
      id: `fact-${fact.label.toLowerCase().replace(/\s+/g, '-')}`,
      title: fact.label,
      value: String(fact.value),
    });
  });

  // Lifecycle — if worn or at risk, surface as a standalone proof card
  const condition = decision.lifecycle.currentSystem.condition;
  if (condition === 'worn' || condition === 'at_risk') {
    cards.push({
      id: 'lifecycle',
      title: 'Current system condition',
      value: decision.lifecycle.summary,
      supportingPoints: top(decision.lifecycle.riskIndicators, 3),
    });
  }

  // Compatibility constraints — shown as advisory evidence (exclude shower
  // summary which is surfaced as its own card below)
  const physicsWarnings = decision.showerCompatibilityNote
    ? decision.compatibilityWarnings.filter(
        (w) => w !== decision.showerCompatibilityNote?.customerSummary,
      )
    : decision.compatibilityWarnings;

  if (physicsWarnings.length > 0) {
    cards.push({
      id: 'compatibility',
      title: 'Installation consideration',
      value: physicsWarnings[0],
      supportingPoints: top(physicsWarnings.slice(1), 2),
    });
  }

  // Shower compatibility — dedicated proof card when a note is present
  const shower = decision.showerCompatibilityNote;
  if (shower) {
    cards.push({
      id: 'shower-compatibility',
      title: 'Shower compatibility',
      value: shower.customerSummary,
    });
  }

  return cards;
}

function buildComparisonCards(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
): ComparisonCard[] {
  // Recommended scenario first, then alternatives
  const recommended = scenarios.find(
    (s) => s.scenarioId === decision.recommendedScenarioId,
  );
  const alternatives = scenarios.filter(
    (s) => s.scenarioId !== decision.recommendedScenarioId,
  );

  const ordered = recommended ? [recommended, ...alternatives] : alternatives;

  return ordered.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    title: SYSTEM_TYPE_LABEL[scenario.system.type] ?? scenario.system.type,
    isRecommended: scenario.scenarioId === decision.recommendedScenarioId,
    summary: scenario.system.summary,
    strengths: top(scenario.keyBenefits, 3),
    constraints: top(scenario.keyConstraints, 3),
  }));
}

function buildDailyUseCards(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
): DailyUseCard[] {
  const cards: DailyUseCard[] = [];

  // Recommended scenario first
  const recommended = scenarios.find(
    (s) => s.scenarioId === decision.recommendedScenarioId,
  );
  if (recommended) {
    cards.push({
      scenarioId: recommended.scenarioId,
      title: `${SYSTEM_TYPE_LABEL[recommended.system.type] ?? recommended.system.type} — day to day`,
      outcomes: top(recommended.dayToDayOutcomes, 4),
    });
  }

  // Fall back to decision-level outcomes when the scenario has none
  if (cards.length > 0 && cards[0].outcomes.length === 0) {
    cards[0] = { ...cards[0], outcomes: top(decision.dayToDayOutcomes, 4) };
  }

  return cards;
}

// ─── Public builder ───────────────────────────────────────────────────────────

/**
 * buildPortalViewModel
 *
 * Converts an AtlasDecisionV1, its ScenarioResult[], and the assembled
 * VisualBlock[] into a PortalViewModel that drives the five-tab portal surface.
 *
 * No recommendation logic is re-derived here. All reasoning flows from the
 * supplied inputs.
 */
export function buildPortalViewModel(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
  blocks: VisualBlock[],
): PortalViewModel {
  const tabs: PortalViewModel['tabs'] = [
    { id: 'recommended', label: 'Recommended for you' },
    { id: 'why',         label: 'Why Atlas chose this' },
    { id: 'compare',     label: 'Compare other options' },
    { id: 'daily_use',   label: 'Daily-use demo' },
    { id: 'future',      label: 'Future upgrades' },
  ];

  const recommendedBlocks = blocks.filter((b) =>
    RECOMMENDED_TAB_TYPES.has(b.type),
  );

  // Future blocks exclude anything already in the included scope to avoid
  // presenting already-committed work as a future upsell opportunity.
  const includedLabels = new Set(
    scopeIncluded(decision.quoteScope).map((s) => s.label.toLowerCase().trim()),
  );
  const futureBlocks = blocks
    .filter((b) => FUTURE_TAB_TYPES.has(b.type))
    .map((b) => {
      if (b.type !== 'future_upgrade') return b;
      return {
        ...b,
        paths: b.paths.filter(
          (p) => !includedLabels.has(p.toLowerCase().trim()),
        ),
      };
    })
    .filter((b) => b.type !== 'future_upgrade' || b.paths.length > 0);

  const spatialProofBlock = blocks.find((b): b is SpatialProofBlock => b.type === 'spatial_proof') ?? null;

  return {
    tabs,
    recommendedBlocks,
    whyCards:            buildWhyCards(decision),
    comparisonCards:     buildComparisonCards(decision, scenarios),
    dailyUseCards:       buildDailyUseCards(decision, scenarios),
    dailyUseSimulation:  buildDailyUseSimulation(decision, scenarios),
    futureBlocks,
    spatialProof:        spatialProofBlock,
  };
}
