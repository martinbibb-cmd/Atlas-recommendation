import type { EducationalConceptCategoryV1 } from '../taxonomy/EducationalConceptTaxonomyV1';

// ─── Per-concept coverage record ─────────────────────────────────────────────

export interface LibraryConceptCoverageV1 {
  readonly conceptId: string;
  readonly conceptTitle: string;
  readonly category: EducationalConceptCategoryV1;

  /** At least one diagram (from diagramExplanationRegistry or educationalAssetRegistry) covers this concept. */
  readonly hasDiagram: boolean;

  /** At least one animation asset in educationalAssetRegistry covers this concept. */
  readonly hasAnimation: boolean;

  /** At least one asset with hasPrintEquivalent=true covers this concept. */
  readonly hasPrintCard: boolean;

  /** educationalContentRegistry has an entry for this concept with a non-empty livingWithSystemGuidance. */
  readonly hasLivedExperienceContent: boolean;

  /** educationalContentRegistry has an entry with a non-empty commonMisunderstanding for this concept. */
  readonly hasMisconceptionReality: boolean;

  /** educationalContentRegistry has an entry with a complete livingExperiencePattern object. */
  readonly hasLivingExperiencePattern: boolean;

  /** educationalContentRegistry has an entry whose customerExplanation includes "what you may notice" (case-insensitive). */
  readonly hasWhatYouMayNotice: boolean;

  /** At least one routing rule in educationalRoutingRules references this concept in requiredConceptIds. */
  readonly hasJourneyRouting: boolean;

  /** Distinct audience values from assets that cover this concept. */
  readonly audiencesCovered: readonly string[];

  /**
   * True when: hasJourneyRouting AND at least one of (hasLivedExperienceContent, hasWhatYouMayNotice).
   * Signals that the concept can safely appear in customer projections without quality gaps.
   */
  readonly projectionSafe: boolean;
}

// ─── Readiness scoring ────────────────────────────────────────────────────────

/**
 * Aggregate readiness counts across all concepts.
 * Each field is the count of concepts that satisfy the readiness dimension.
 */
export interface LibraryCoverageReadinessScoreV1 {
  readonly totalConcepts: number;

  /** Concepts with hasLivedExperienceContent AND hasWhatYouMayNotice AND hasMisconceptionReality. */
  readonly customerReadyCount: number;

  /** Concepts with hasDiagram OR hasAnimation. */
  readonly visuallyReadyCount: number;

  /** Concepts with hasPrintCard. */
  readonly printReadyCount: number;

  /** Concepts with projectionSafe=true. */
  readonly projectionSafeCount: number;

  readonly customerReadyPct: number;
  readonly visuallyReadyPct: number;
  readonly printReadyPct: number;
  readonly projectionSafePct: number;
}

// ─── Missing coverage grouped by type ────────────────────────────────────────

export interface LibraryCoverageMissingByTypeV1 {
  readonly missingDiagram: readonly string[];
  readonly missingAnimation: readonly string[];
  readonly missingPrintCard: readonly string[];
  readonly missingLivedExperienceContent: readonly string[];
  readonly missingMisconceptionReality: readonly string[];
  readonly missingLivingExperiencePattern: readonly string[];
  readonly missingWhatYouMayNotice: readonly string[];
  readonly missingJourneyRouting: readonly string[];
}

// ─── Top-level audit ──────────────────────────────────────────────────────────

export interface LibraryCoverageAuditV1 {
  readonly schemaVersion: '1.0';
  readonly generatedAt: string;
  readonly conceptCoverage: readonly LibraryConceptCoverageV1[];
  readonly readinessScore: LibraryCoverageReadinessScoreV1;
  readonly missingByType: LibraryCoverageMissingByTypeV1;

  /** Concept IDs that have no visual assets at all (no diagram and no animation). */
  readonly conceptsWithNoVisualAssets: readonly string[];

  /** Concept IDs that have no lived-experience content (neither livingWithSystemGuidance nor whatYouMayNotice). */
  readonly conceptsWithNoLivedExperienceContent: readonly string[];

  /** Concept IDs not referenced by any routing rule. */
  readonly unroutedConceptIds: readonly string[];
}
