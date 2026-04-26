/**
 * CustomerSummaryV1.ts — Locked customer-facing summary contract.
 *
 * Rules:
 *   - Built only from AtlasDecisionV1 + the selected ScenarioResult.
 *   - recommendedScenarioId must equal AtlasDecisionV1.recommendedScenarioId.
 *   - No scoring, no ranking, no AI deciding.
 *   - No customer-facing claim unless it comes from a field.
 *   - AI may rewrite the text in plainer English, but may never change the
 *     recommendation or add facts not present here.
 */

/**
 * CustomerSummaryV1
 *
 * A deterministic, locked projection of AtlasDecisionV1.
 * Consumed by:
 *   - Customer PDF summary
 *   - Portal recommendation summary
 *   - AI handoff case summary
 *   - GeminiAISummary prompt input
 */
export interface CustomerSummaryV1 {
  /** The Atlas-selected scenario identifier — must equal AtlasDecisionV1.recommendedScenarioId. */
  recommendedScenarioId: string;

  /** Human-readable system name, e.g. "Air source heat pump". */
  recommendedSystemLabel: string;

  /** One-line customer-facing headline from AtlasDecisionV1.headline. */
  headline: string;

  /** Two-to-three sentence plain-English decision rationale from AtlasDecisionV1.summary. */
  plainEnglishDecision: string;

  /** Physics-grounded reasons why this scenario was chosen — from AtlasDecisionV1.keyReasons only. */
  whyThisWins: string[];

  /** Risks the recommended scenario avoids — from AtlasDecisionV1.avoidedRisks only. */
  whatThisAvoids: string[];

  /**
   * Deliverable scope items confirmed in this quote — from quoteScope where
   * status === 'included', excluding verification items (category === 'compliance'
   * with no customer benefit).
   */
  includedNow: string[];

  /**
   * Pre-installation checks and compatibility notes — from
   * AtlasDecisionV1.compatibilityWarnings + quoteScope items where
   * status === 'required' or (status === 'included' && category === 'compliance').
   */
  requiredChecks: string[];

  /**
   * Advised upgrades not yet committed — from quoteScope where
   * status === 'recommended' or status === 'optional'.
   */
  optionalUpgrades: string[];

  /**
   * Future upgrade paths this installation enables — from
   * AtlasDecisionV1.futureUpgradePaths or quoteScope items where
   * category === 'future'.
   */
  futureReady: string[];

  /**
   * Confidence notes — any remaining compatibility warnings not captured
   * in requiredChecks, plus lifecycle urgency notes.
   */
  confidenceNotes: string[];

  /**
   * Non-negotiable physics failures — hard gates from the engine that
   * disqualify alternative systems. Sourced from rejected scenarios'
   * fail-severity physics flags.
   *
   * AI must render these with the same directness as the engine output.
   * It must NEVER soften "will fail" to "may struggle" or "could be less suited".
   */
  hardConstraints: string[];

  /**
   * Quantifiable performance penalties identified by the engine — warn-level
   * degradations such as short-draw efficiency collapse (<30 %) or reduced
   * flow at low mains pressure.
   *
   * AI must present these directly and may not hedge or qualify them.
   */
  performancePenalties: string[];

  /**
   * Single canonical explanation string — the authoritative narrative locked
   * from engine output. This is the one string all surfaces (UI, print, portal,
   * AI handoff) must use verbatim or treat as the sole source for any rewrite.
   *
   * Equal to AtlasDecisionV1.summary and must not be re-derived or paraphrased
   * by any output surface.
   */
  fitNarrative: string;
}
