import type { WelcomePackValidationFixtureId } from './validationFixtures/WelcomePackValidationFixtureV1';

/**
 * WelcomePackValidationReportV1
 *
 * Output of runWelcomePackValidation for a single fixture.
 * Captures content gaps, routing gaps, trust risks, accessibility risks,
 * print risks, cognitive overload warnings, and likely confusion points.
 *
 * Read-only diagnostic — never alters recommendations, routing, or engine truth.
 */
export interface WelcomePackValidationReportV1 {
  fixtureId: WelcomePackValidationFixtureId;
  fixtureLabel: string;
  archetypeId: string;

  /** Whether the plan built without error and produced a non-empty selection. */
  readiness: 'ready' | 'partial' | 'blocked';

  /** IDs of assets selected by the plan. */
  selectedAssetIds: string[];

  /** IDs of concepts covered by the plan. */
  selectedConceptIds: string[];

  /** Assets omitted and why. */
  omittedAssets: Array<{ assetId: string; reason: string }>;

  /** Assets blocked by the eligibility gate (if enabled). */
  blockedAssets: Array<{ assetId: string; reason: string }>;

  /** Concept IDs deferred to QR or appendix. */
  qrDeferredConceptIds: string[];

  /** Number of pages used vs budget. */
  pageCount: number;
  printPageBudget: number;

  /** Cognitive load budget used vs allowed. */
  cognitiveLoadBudget: string;

  /**
   * Content gap: concepts selected by the plan but lacking registered educational content.
   */
  missingContent: Array<{ conceptId: string; reason: string }>;

  /**
   * Print gap: assets selected but lacking a registered print equivalent.
   */
  missingPrintEquivalents: Array<{ assetId: string; reason: string }>;

  /**
   * Analogy gap: customer misconceptions from the fixture that are not addressed
   * by any selected asset's concept coverage.
   */
  missingAnalogies: string[];

  /**
   * Readability concerns: accessibility preferences from the fixture that are
   * not matched by the pack composition (e.g. dyslexia profile but no low-load assets).
   */
  readabilityConcerns: string[];

  /** Trust risks: emotional/trust concerns from the fixture that lack content coverage. */
  trustRisks: string[];

  /** Accessibility risks: accessibility notes from the fixture not addressed by the plan. */
  accessibilityRisks: string[];

  /** Print risks: print-first preference with assets that have no print equivalent. */
  printRisks: string[];

  /**
   * Cognitive overload warnings: plan selects high-load assets for a low-budget audience.
   */
  cognitiveOverloadWarnings: string[];

  /**
   * Likely customer confusion points derived from knownMisconceptions and conceptGaps.
   */
  likelyCustomerConfusionPoints: string[];

  /**
   * Recommended next content additions to address identified gaps.
   */
  recommendedNextContentAdditions: string[];
}
