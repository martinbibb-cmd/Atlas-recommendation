/**
 * CustomerPackV1.ts — Decision-first customer pack contract.
 *
 * Mind PR 35 — Render CustomerPackV1 from decision truth.
 *
 * This is the authoritative 8-section structure for the Atlas customer output.
 * It is built ONLY from AtlasDecisionV1 + ScenarioResult[] — no Scan logic,
 * no re-scoring, no re-ranking, no alternative recommendation logic.
 *
 * Design rules:
 *  1. Every field maps to a named source in AtlasDecisionV1 or ScenarioResult.
 *  2. decision.headline is the engine-derived recommendation headline — verbatim.
 *  3. antiDefault evidence comes only from decision.hardConstraints and
 *     decision.performancePenalties — these are pre-aggregated from rejected
 *     scenarios by buildDecisionFromScenarios and must not be re-derived.
 *  4. Brand affects style only — it must not change section content.
 *  5. No ScenarioResult other than the recommended scenario contributes to
 *     any customer-facing copy section except antiDefault evidencePoints
 *     (which use already-aggregated constraint data from the decision object).
 */

/**
 * Section 1 — The recommendation.
 *
 * The locked recommendation identity: which system was chosen, why in one
 * headline, and the full rationale summary.  All fields come verbatim from
 * AtlasDecisionV1 — no re-derivation is permitted here.
 */
export interface CustomerPackDecisionSection {
  /** Matches AtlasDecisionV1.recommendedScenarioId exactly. */
  recommendedScenarioId: string;
  /** Human-readable system label, e.g. "System boiler with unvented cylinder". */
  recommendedSystemLabel: string;
  /** Engine-derived recommendation headline — verbatim from AtlasDecisionV1.headline. */
  headline: string;
  /** Two-to-three sentence rationale — verbatim from AtlasDecisionV1.summary. */
  summary: string;
}

/**
 * Section 2 — Why this system works for this home.
 *
 * Physics-grounded reasons from AtlasDecisionV1.keyReasons only.
 * Must not include reasons from rejected or alternative scenarios.
 */
export interface CustomerPackWhyThisWorksSection {
  /** From AtlasDecisionV1.keyReasons — engine-derived, physics-grounded. */
  reasons: string[];
}

/**
 * Section 3 — Anti-default: why this is more than a like-for-like swap.
 *
 * Evidence-based case for why the recommended system is not simply a
 * "same-again" replacement.  All evidence must come from the locked
 * decision object — hard physics failures and performance penalties that
 * make simpler alternatives unsuitable.
 *
 * Must NEVER:
 *  - introduce copy from rejected/unconfirmed scan evidence.
 *  - soften "will fail" to "may struggle" or similar hedging.
 *  - mention alternative system names as a recommendation.
 */
export interface CustomerPackAntiDefaultSection {
  /**
   * One-sentence framing of why this is a deliberate physics choice rather
   * than a default swap.  Derived from the system type and the presence of
   * hard constraints or performance penalties.
   */
  narrative: string;
  /**
   * Hard physics failures that ruled out simpler options, plus warn-level
   * performance degradations.  Sourced from AtlasDecisionV1.hardConstraints
   * and AtlasDecisionV1.performancePenalties — already aggregated from rejected
   * scenarios by buildDecisionFromScenarios.
   *
   * Empty array when no constraints exist (e.g. ASHP selected without physics
   * gates against simpler options).
   */
  evidencePoints: string[];
}

/**
 * Section 4 — Daily benefits.
 *
 * What the customer will experience day-to-day with the recommended system.
 * Sourced from AtlasDecisionV1.dayToDayOutcomes (the recommended scenario's
 * lived-experience outcomes).
 */
export interface CustomerPackDailyBenefitsSection {
  /** From AtlasDecisionV1.dayToDayOutcomes — recommended scenario outcomes only. */
  outcomes: string[];
}

/**
 * Section 5 — Full system scope.
 *
 * Complete scope of work for the recommended installation.
 * Sourced from AtlasDecisionV1.quoteScope, requiredWorks, and
 * compatibilityWarnings.
 */
export interface CustomerPackFullSystemSection {
  /**
   * Items confirmed in the installation scope — from quoteScope where
   * status === 'included', excluding verification items.
   */
  includedItems: string[];
  /** Required installation works — from AtlasDecisionV1.requiredWorks. */
  requiredWorks: string[];
  /**
   * Compatibility advisory notes — from AtlasDecisionV1.compatibilityWarnings
   * plus quoteScope items where status === 'required'.
   */
  compatibilityNotes: string[];
}

/**
 * Section 6 — Daily use guidance.
 *
 * Practical guidance on how to get the best from the recommended system.
 * Derived from the recommended scenario's system type — not invented content.
 * Each item is a short actionable instruction.
 */
export interface CustomerPackDailyUseSection {
  /** Practical daily use guidance derived from the recommended system type. */
  guidance: string[];
}

/**
 * Section 7 — Future path.
 *
 * Upgrade paths this installation enables.  Sourced from
 * AtlasDecisionV1.futureUpgradePaths and quoteScope future items.
 */
export interface CustomerPackFuturePathSection {
  /** From AtlasDecisionV1.futureUpgradePaths — engine-confirmed future paths. */
  upgradePaths: string[];
}

/**
 * Section 8 — Close / Call to action.
 *
 * The closing section with next steps and the portal URL when available.
 */
export interface CustomerPackCloseSection {
  /** Standard next-step instruction. */
  nextStep: string;
  /**
   * Signed portal URL when available.  When present, the render layer
   * shows a QR code and link.  When absent, a placeholder is shown.
   */
  portalUrl?: string;
}

/**
 * CustomerPackV1
 *
 * The decision-first customer pack — 8 sections built from AtlasDecisionV1
 * and the recommended ScenarioResult only.
 *
 * Produced by buildCustomerPackV1().
 * Consumed by CustomerPackV1View (print/PDF) and the customer portal output.
 *
 * Invariants:
 *  - decision.recommendedScenarioId === AtlasDecisionV1.recommendedScenarioId
 *  - decision.headline === AtlasDecisionV1.headline (verbatim, engine-derived)
 *  - antiDefault.evidencePoints come only from decision.hardConstraints +
 *    decision.performancePenalties (never from raw scan evidence)
 *  - No alternative recommendation appears in any section
 *  - Brand does not affect this contract — brand affects the view layer only
 */
export interface CustomerPackV1 {
  /** Section 1 — Recommendation identity. */
  decision: CustomerPackDecisionSection;
  /** Section 2 — Why this system works for this home. */
  whyThisWorks: CustomerPackWhyThisWorksSection;
  /** Section 3 — Why this is not a like-for-like swap. */
  antiDefault: CustomerPackAntiDefaultSection;
  /** Section 4 — Day-to-day outcomes for the customer. */
  dailyBenefits: CustomerPackDailyBenefitsSection;
  /** Section 5 — Full scope of work. */
  fullSystem: CustomerPackFullSystemSection;
  /** Section 6 — Practical daily use guidance. */
  dailyUse: CustomerPackDailyUseSection;
  /** Section 7 — Future upgrade paths. */
  futurePath: CustomerPackFuturePathSection;
  /** Section 8 — CTA and next steps. */
  close: CustomerPackCloseSection;
}
