/**
 * AtlasDecisionV1.ts — Top-level decision output shape.
 *
 * Extends the existing FinalPresentationPayload pattern with the
 * LifecycleAssessment block and scenario-selection metadata.
 *
 * Design rules (see docs/atlas-canonical-contract.md):
 *  - AtlasDecisionV1 is the single authoritative shape consumed by all
 *    output surfaces (customer portal, print summary, engineer prep).
 *  - lifecycle is always populated — if age data is absent, condition
 *    defaults to 'unknown' and summary reflects that.
 *  - recommendedScenarioId must match the scenarioId of one of the
 *    evaluated ScenarioResult entries.
 *  - supportingFacts is the machine-readable evidence chain; headline /
 *    summary / keyReasons are the human-readable derivation.
 */

import type { LifecycleAssessment } from './LifecycleAssessment';
import type { QuoteScopeItem } from './QuoteScope';
import type { ShowerCompatibilityNote } from './ShowerCompatibilityNote';

/** A single supporting fact with its data source. */
export interface DecisionSupportingFact {
  /** Human-readable label, e.g. "System age". */
  label: string;
  /** Formatted value, e.g. "25 years" or 25. */
  value: string | number;
  /** Origin of this value. */
  source: 'survey' | 'engine' | 'quote';
}

/**
 * AtlasDecisionV1
 *
 * Produced by buildDecisionFromScenarios. This is the primary contract
 * consumed by the recommendation and presentation layers.
 *
 * The lifecycle field is NEW in this contract version and drives both the
 * customer-facing condition signal and the urgency tone of keyReasons.
 */
export interface AtlasDecisionV1 {
  /** scenarioId of the recommended ScenarioResult. */
  recommendedScenarioId: string;

  /** One-line customer-facing headline, e.g. "A system boiler with unvented cylinder is the right fit for this home." */
  headline: string;

  /** Two-to-three sentence summary of the recommendation rationale. */
  summary: string;

  /** Physics-grounded reasons why this scenario was chosen. */
  keyReasons: string[];

  /** Risks that the recommended scenario avoids vs the status quo. */
  avoidedRisks: string[];

  /** What the customer will experience day-to-day with the recommended system. */
  dayToDayOutcomes: string[];

  /** Works required to complete this installation. */
  requiredWorks: string[];

  /** Compatibility warnings (e.g. radiator sizing, pipe-work constraints). */
  compatibilityWarnings: string[];

  /** Items included in the proposed scope of work. */
  includedItems: string[];

  /**
   * Canonical quote scope — the single authoritative list from which all
   * scope-related surfaces are derived.
   *
   * PR13 — Populated by buildQuoteScope() from includedItems, requiredWorks,
   * compatibilityWarnings, and futureUpgradePaths.
   *
   * - Customer deck uses items where status='included' (non-compliance)
   * - Engineer handoff uses items where status='included'
   * - Portal future tab uses items where status='optional', category='future',
   *   after excluding anything already in the included scope.
   */
  quoteScope: QuoteScopeItem[];

  /** Future upgrade paths this recommendation enables. */
  futureUpgradePaths: string[];

  /**
   * Machine-readable supporting facts for the engineer prep and proof layers.
   * Each fact traces a key input value to its source.
   */
  supportingFacts: DecisionSupportingFact[];

  /**
   * Lifecycle assessment for the existing system.
   * Feeds the customer timeline visual and urgency tone in keyReasons.
   * Condition 'at_risk' or 'worn' will push a lifecycle reason into keyReasons.
   */
  lifecycle: LifecycleAssessment;

  /**
   * Shower compatibility note derived from the surveyed shower type.
   * Present when a notable compatibility consideration exists; absent otherwise.
   *
   * PR26 — Drives the shower warning block, portal proof card, and engineer
   * install note without re-deriving logic on any output surface.
   */
  showerCompatibilityNote?: ShowerCompatibilityNote;
}
