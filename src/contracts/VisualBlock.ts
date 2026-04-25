/**
 * VisualBlock.ts — Canonical visual block contract for the Atlas deck model.
 *
 * A VisualBlock is the unit of presentation. Every block carries a stable
 * semantic visualKey that the render layer uses to pick artwork or layout,
 * a short title, a single outcome sentence, and an optional array of up to
 * three supporting points.
 *
 * Design rules:
 *  - No block may contain long-form paragraphs. outcome is one sentence max.
 *  - supportingPoints must not exceed 3 items.
 *  - No block may re-derive recommendation logic — all content flows from
 *    AtlasDecisionV1 or ScenarioResult.
 *  - visualKey values are semantic identifiers only; no render logic lives here.
 */

import type { PortalLaunchContext } from './PortalLaunchContext';
import type { QuoteScopeItem } from './QuoteScope';

// ─── Base ─────────────────────────────────────────────────────────────────────

type BaseVisualBlock = {
  id: string;
  type:
    | 'hero'
    | 'facts'
    | 'customer_need_resolution'
    | 'problem'
    | 'solution'
    | 'daily_use'
    | 'included_scope'
    | 'warning'
    | 'future_upgrade'
    | 'portal_cta'
    | 'spatial_proof';
  title: string;
  /** One sentence. No paragraphs. */
  outcome: string;
  /** Up to 3 short supporting points. */
  supportingPoints?: string[];
  /** Stable semantic key for artwork / layout selection. */
  visualKey: string;
};

// ─── Block variants ───────────────────────────────────────────────────────────

export type HeroBlock = BaseVisualBlock & {
  type: 'hero';
  recommendedScenarioId: string;
};

export type FactsBlock = BaseVisualBlock & {
  type: 'facts';
  facts: Array<{
    label: string;
    value: string | number;
    iconKey?: string;
  }>;
};

export type ProblemBlock = BaseVisualBlock & {
  type: 'problem';
  scenarioId?: string;
};

export type SolutionBlock = BaseVisualBlock & {
  type: 'solution';
  scenarioId: string;
};

export type DailyUseBlock = BaseVisualBlock & {
  type: 'daily_use';
  scenarioId: string;
  examples: string[];
};

export type IncludedScopeBlock = BaseVisualBlock & {
  type: 'included_scope';
  /**
   * Included-now items — status='included', category !== 'compliance', category !== 'future'.
   * PR13 — Uses QuoteScopeItem so the customer deck block and engineer handoff
   * derive from the same canonical QuoteScopeItem[] in AtlasDecisionV1.quoteScope.
   */
  items: QuoteScopeItem[];
  /**
   * Compliance/regulatory requirements — status='included', category='compliance'.
   * Rendered with a "Requirement" badge rather than a benefit framing.
   */
  complianceItems?: QuoteScopeItem[];
  /**
   * Recommended upgrades — status='recommended'.
   * Advised but not yet committed in the current quote.
   */
  recommendedItems?: QuoteScopeItem[];
  /**
   * Future options — status='optional', category='future'.
   * Pathways this installation enables, shown as forward-looking cards.
   */
  futureItems?: QuoteScopeItem[];
};

export type WarningBlock = BaseVisualBlock & {
  type: 'warning';
  severity: 'info' | 'advisory' | 'important';
};

export type FutureUpgradeBlock = BaseVisualBlock & {
  type: 'future_upgrade';
  paths: string[];
};

export type PortalCtaBlock = BaseVisualBlock & {
  type: 'portal_cta';
  /**
   * Optional launch context passed to the portal when the CTA is activated.
   * When present, the portal opens at the specified tab for the given scenario.
   */
  launchContext?: PortalLaunchContext;
};

/**
 * SpatialProofBlock — Customer-facing spatial context block.
 *
 * Derived from EngineerLayout truth. Shows the customer where the proposed
 * work happens without exposing engineer-level complexity or assumed routes
 * as confirmed facts.
 *
 * Rules:
 *  - rooms, keyObjects, routeSummary, confidenceSummary come from EngineerLayout only.
 *  - Never show assumed routes as confirmed.
 *  - No full floor-plan or CAD detail.
 *  - Confidence language must be simple and reassurance-first.
 */
export type SpatialProofBlock = BaseVisualBlock & {
  type: 'spatial_proof';
  /** Room names relevant to the proposed installation. */
  rooms: string[];
  /** Short labels for key objects (e.g. "Boiler — kitchen"). */
  keyObjects: string[];
  /** Short route summaries softened by confidence (e.g. "Discharge route needs checking"). */
  routeSummary: string[];
  /** Simple confidence notes visible to the customer (e.g. "Cylinder position planned"). */
  confidenceSummary: string[];
};

/**
 * CustomerNeedResolutionItem — a single "You told us → We're doing → So you get" entry.
 *
 * Each item maps one survey-observed customer need to a concrete action and
 * the benefit the customer will experience.
 *
 * Rules:
 *  - phrasing uses "You told us…" (never "customer reported…")
 *  - need, action, and outcome must each fit on one line (no paragraphs)
 *  - confidence 'direct' = backed by a hard survey signal; 'inferred' = derived from
 *    correlated evidence
 */
export type CustomerNeedResolutionItem = {
  /** Survey-grounded customer complaint, e.g. "Some rooms don't heat properly". */
  need: string;
  /** Intervention being made, e.g. "We'll clean the system and check radiators and pipework". */
  action: string;
  /** Benefit the customer will experience, e.g. "Heat can circulate properly and reach every room". */
  outcome: string;
  /** Whether this item is directly observed ('direct') or inferred from correlated signals ('inferred'). */
  confidence?: 'direct' | 'inferred';
};

/**
 * CustomerNeedResolutionBlock — personalised "What matters to you" block.
 *
 * Turns survey answers into visible, personalised justification for the work.
 * Only emitted when at least one survey signal is present.
 * Maximum 5 items.
 *
 * Placement: after the Facts block, before the Problem/Solution blocks.
 */
export type CustomerNeedResolutionBlock = BaseVisualBlock & {
  type: 'customer_need_resolution';
  /** Up to 5 need→action→outcome items, each backed by a survey signal. */
  items: CustomerNeedResolutionItem[];
};

// ─── Union ────────────────────────────────────────────────────────────────────

export type VisualBlock =
  | HeroBlock
  | FactsBlock
  | CustomerNeedResolutionBlock
  | ProblemBlock
  | SolutionBlock
  | DailyUseBlock
  | IncludedScopeBlock
  | WarningBlock
  | FutureUpgradeBlock
  | PortalCtaBlock
  | SpatialProofBlock;
