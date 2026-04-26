/**
 * AiHandoffPayload.ts — Structured AI handoff contract.
 *
 * Defines the shape of the payload assembled by buildAiHandoffPayload and
 * serialised into the visible AI handoff block in the customer advice pack.
 *
 * Design rules:
 *  - Static policy fields (introduction, validationPolicy, source rules) are
 *    defined here and injected by the builder — they are not derived from
 *    AtlasDecisionV1 survey data.
 *  - Case-specific fields (recommendation, facts, scope, etc.) are derived
 *    entirely from AtlasDecisionV1 and ScenarioResult[], as before.
 *  - No recommendation logic lives in this contract.
 */

/**
 * AiHandoffPayload
 *
 * Produced by buildAiHandoffPayload. Serialised to the visible copyable text
 * block in CustomerAdvicePrintPack so the customer can paste it into any AI
 * assistant (ChatGPT, Claude, Gemini) and receive grounded, validated advice.
 */
export interface AiHandoffPayload {
  /**
   * Opening message to the external AI assistant, explaining the context and
   * responsibilities. Rendered at the top of the serialised text so the
   * assistant understands its role before reading case-specific data.
   */
  assistantIntroduction: string;

  /**
   * Instructions telling the external assistant how to answer the customer:
   * what sources to use, how to separate facts from assumptions, and what
   * to flag for specialist verification.
   */
  validationPolicy: string;

  /**
   * Categories of external sources the assistant may use to validate general
   * claims. Sources must be official or technically authoritative — never
   * marketing collateral unless no technical document exists.
   */
  trustedSourceCategories: string[];

  /**
   * Rules that bind each trusted source category to a specific use case,
   * preventing sources from being used outside their authority domain.
   */
  sourceUseRules: string[];

  // ── Case-specific fields derived from AtlasDecisionV1 ──────────────────────

  /** The recommended system headline from the Atlas decision. */
  recommendedHeadline: string;

  /** Physics-grounded reasons why this scenario was selected. */
  keyReasons: string[];

  /**
   * Non-recommended options with the primary reason each was not chosen.
   * Framed as "Options considered" — neutral, not adversarial.
   * Uses "less suited because…" / "possible future pathway if…" language.
   */
  optionsConsidered: Array<{ summary: string; constraint: string }>;

  /** Key household facts from the survey. */
  householdFacts: Array<{ label: string; value: string | number }>;

  /** Items included in the proposed scope of work. */
  includedScope: string[];

  /** Works required to complete the installation. */
  requiredWorks: string[];

  /** Advised upgrades not yet committed in the current quote. */
  recommendedUpgrades: string[];

  /** Compatibility warnings (e.g. radiator sizing, pipe-work constraints). */
  warnings: string[];

  /** Future upgrade paths this recommendation enables. */
  futureUpgrades: string[];

  /**
   * Non-negotiable physics failures from rejected scenarios. Sourced from
   * CustomerSummaryV1.hardConstraints.
   * AI must render these with the same directness as the engine — never soften
   * "will fail" to "may struggle" or "could be less suitable".
   */
  hardConstraints: string[];

  /**
   * Quantifiable performance penalties from rejected scenarios. Sourced from
   * CustomerSummaryV1.performancePenalties.
   * AI must present these directly and may not hedge or qualify them.
   */
  performancePenalties: string[];
}
