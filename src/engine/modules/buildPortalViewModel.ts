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
import { buildScenarioDisplayIdentity } from './buildScenarioDisplayIdentity';

// ─── Tab identifiers ──────────────────────────────────────────────────────────

/**
 * The four Atlas Pillars that organise the customer portal.
 *
 *   identity   — Pillar 1: Who you are and what matters to you (property facts + priority cards)
 *   verdict    — Pillar 2: Physics-based ratings, why Atlas chose this, Scenario Explorer
 *   experience — Pillar 3: 24-hour simulation of life with the recommended system
 *   roadmap    — Pillar 4: Future upgrade paths and installation requirements
 */
export type PortalTabId =
  | 'identity'
  | 'verdict'
  | 'experience'
  | 'roadmap';

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

/**
 * Data bundle for the Verdict pillar (Pillar 2).
 * Combines physics proof cards, scenario comparison, and spatial evidence
 * into a single content object so the tab renderer does not need to
 * conditionally merge them.
 */
export interface VerdictData {
  /** Physics-based proof cards — key reasons, avoided risks, compatibility notes. */
  whyCards: ProofCard[];
  /** One card per scenario — recommended scenario first. */
  comparisonCards: ComparisonCard[];
  /**
   * Optional spatial proof block.
   * Present only when the deck contains a spatial_proof block derived from EngineerLayout.
   */
  spatialProof: SpatialProofBlock | null;
}

/**
 * Data bundle for the Experience pillar (Pillar 3).
 * Prefers the interactive simulator; falls back to static day-to-day cards
 * when simulation data is absent.
 */
export interface ExperienceData {
  /** Static day-to-day outcome cards — used when simulation is null. */
  cards: DailyUseCard[];
  /** 24-hour interactive simulation for the recommended scenario. */
  simulation: DailyUseSimulation | null;
}

export interface PortalViewModel {
  /** Ordered tab definitions aligned with the Four Atlas Pillars. */
  tabs: Array<{ id: PortalTabId; label: string }>;

  /**
   * Pillar 1 — Identity.
   * VisualBlocks for the "What Matters to You" tab.
   * Contains: hero, facts, customer_need_resolution, solution, warning, included_scope blocks.
   */
  identityBlocks: VisualBlock[];

  /**
   * Pillar 2 — Verdict.
   * Physics proof cards + comparison + spatial evidence for the Verdict & Physics tab.
   */
  verdictData: VerdictData;

  /**
   * Pillar 3 — Experience.
   * 24-hour simulation data for the Your Day tab.
   */
  experienceData: ExperienceData;

  /**
   * Pillar 4 — Roadmap.
   * VisualBlocks for the Roadmap tab (future_upgrade blocks).
   */
  roadmapBlocks: VisualBlock[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp an array to at most `max` items. */
function top<T>(arr: T[], max: number): T[] {
  return arr.slice(0, max);
}

// ─── Block selectors ──────────────────────────────────────────────────────────

/** Pillar 1 — Identity: blocks that establish what the property needs and what matters to the customer. */
const IDENTITY_TAB_TYPES = new Set<VisualBlock['type']>([
  'hero',
  'facts',
  'customer_need_resolution',
  'solution',
  'system_work_explainer',
  'warning',
  'included_scope',
]);

/** Pillar 4 — Roadmap: future upgrade paths. */
const ROADMAP_TAB_TYPES = new Set<VisualBlock['type']>(['future_upgrade']);

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
    title: (scenario.display ?? buildScenarioDisplayIdentity(scenario)).title,
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
      title: `${(recommended.display ?? buildScenarioDisplayIdentity(recommended)).title} — day to day`,
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
 * VisualBlock[] into a PortalViewModel organised around the Four Atlas Pillars.
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
    { id: 'identity',   label: 'What Matters to You' },
    { id: 'verdict',    label: 'Verdict & Physics' },
    { id: 'experience', label: 'Your Day' },
    { id: 'roadmap',    label: 'Roadmap' },
  ];

  // Pillar 1 — Identity blocks (hero, facts, customer_need_resolution, solution, etc.)
  const identityBlocks = blocks.filter((b) =>
    IDENTITY_TAB_TYPES.has(b.type),
  );

  // Pillar 4 — Roadmap blocks, excluding anything already in the included scope to avoid
  // presenting already-committed work as a future upsell opportunity.
  const includedLabels = new Set(
    scopeIncluded(decision.quoteScope).map((s) => s.label.toLowerCase().trim()),
  );
  const roadmapBlocks = blocks
    .filter((b) => ROADMAP_TAB_TYPES.has(b.type))
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
    identityBlocks,
    verdictData: {
      whyCards:       buildWhyCards(decision),
      comparisonCards: buildComparisonCards(decision, scenarios),
      spatialProof:   spatialProofBlock,
    },
    experienceData: {
      cards:      buildDailyUseCards(decision, scenarios),
      simulation: buildDailyUseSimulation(decision, scenarios),
    },
    roadmapBlocks,
  };
}
