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

// ─── Base ─────────────────────────────────────────────────────────────────────

type BaseVisualBlock = {
  id: string;
  type:
    | 'hero'
    | 'facts'
    | 'problem'
    | 'solution'
    | 'daily_use'
    | 'included_scope'
    | 'warning'
    | 'future_upgrade'
    | 'portal_cta';
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
  items: string[];
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

// ─── Union ────────────────────────────────────────────────────────────────────

export type VisualBlock =
  | HeroBlock
  | FactsBlock
  | ProblemBlock
  | SolutionBlock
  | DailyUseBlock
  | IncludedScopeBlock
  | WarningBlock
  | FutureUpgradeBlock
  | PortalCtaBlock;
